// POST /api/coach(route.ts)の、外部AIへのデータ送信への同意チェックのテスト。
// 未同意なら403を返し、会話を保存せず、Claude API(Anthropicクライアント)も
// 作成・呼び出ししないことを確かめる。
//
// 実行方法(Node.js 22.15以降。試験的機能 registerHooks / mock.module を使う):
//   node --import ./src/test-support/register-alias.mjs --experimental-test-module-mocks --test src/app/api/coach/route.test.mjs
//
// 本物のSupabase・Claude APIには接続しない。DBアクセスとAnthropicクライアントは
// 下のmock.moduleで偽物に差し替え、呼び出し回数を数える。
// route.ts・consent.ts・provider.ts・mock-mode.ts・actions-schema.tsは本物を使う。
import { test, mock, beforeEach } from "node:test";
import assert from "node:assert/strict";

const USER = { id: "11111111-1111-1111-1111-111111111111" };
const BUSINESS = { id: "22222222-2222-2222-2222-222222222222" };

const state = {
  profile: null,
  savedMessages: [],
  anthropicClientsCreated: 0,
  anthropicStreamCalls: 0,
};

function srcUrl(relativePath) {
  return new URL(`../../../${relativePath}`, import.meta.url).href;
}

// "server-only"は本来Next.jsのサーバー側でのみ読み込める印のパッケージ
// (Node.jsから直接読むと例外を投げる)ため、空のモジュールに差し替える。
mock.module("server-only", { namedExports: {} });

mock.module(srcUrl("lib/supabase/get-current-user.ts"), {
  namedExports: { getCurrentUser: async () => USER },
});
mock.module(srcUrl("lib/supabase/profile.ts"), {
  // 本物のgetCurrentProfile()は取得失敗時にnullを返す
  namedExports: { getCurrentProfile: async () => state.profile },
});
mock.module(srcUrl("lib/supabase/business.ts"), {
  namedExports: { getCurrentBusiness: async () => BUSINESS },
});
mock.module(srcUrl("lib/supabase/coach-context.ts"), {
  namedExports: { getCoachContext: async () => ({}) },
});
mock.module(srcUrl("lib/supabase/coach-messages.ts"), {
  namedExports: {
    DAILY_MESSAGE_LIMIT: 20,
    countTodayUserMessages: async () => 0,
    getCoachMessages: async () => [],
    insertCoachMessage: async (params) => {
      state.savedMessages.push({ role: params.role, content: params.content });
    },
  },
});
mock.module(srcUrl("lib/anthropic/system-prompt.ts"), {
  namedExports: { buildCoachSystemPrompt: () => "system prompt" },
});
mock.module(srcUrl("lib/anthropic/client.ts"), {
  namedExports: {
    COACH_MODEL: "test-model",
    getAnthropicClient: () => {
      state.anthropicClientsCreated++;
      return {
        messages: {
          stream: () => {
            state.anthropicStreamCalls++;
            return {
              async *[Symbol.asyncIterator]() {
                yield { type: "content_block_delta", delta: { type: "text_delta", text: "こんにちは。" } };
              },
              finalMessage: async () => ({ content: [] }),
            };
          },
        },
      };
    },
  },
});

// Mock Provider(開発用の偽AI)に切り替わらないようにする
delete process.env.COACH_MOCK_MODE;

const { POST } = await import(srcUrl("app/api/coach/route.ts"));
const { AI_COACH_CONSENT_VERSION, AI_COACH_CONSENT_REQUIRED_CODE } = await import(
  srcUrl("lib/coach/consent.ts")
);

const NOT_CONSENTED = { ai_coach_consented_at: null, ai_coach_consent_version: null };
const CONSENTED = {
  ai_coach_consented_at: "2026-10-20T00:00:00+00:00",
  ai_coach_consent_version: AI_COACH_CONSENT_VERSION,
};

async function postCoach(body = { message: "集客のアイデアをください" }) {
  const response = await POST(
    new Request("http://localhost/api/coach", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
  return { status: response.status, text: await response.text() };
}

function resetCounters() {
  state.savedMessages = [];
  state.anthropicClientsCreated = 0;
  state.anthropicStreamCalls = 0;
}

/** 403(同意が必要)が返り、保存もAnthropicの作成・呼び出しも起きていないことを確かめる。 */
async function assertConsentRequired(body) {
  const res = await postCoach(body);
  assert.equal(res.status, 403);
  assert.equal(JSON.parse(res.text).code, AI_COACH_CONSENT_REQUIRED_CODE);
  assert.deepEqual(state.savedMessages, [], "メッセージを保存しない");
  assert.equal(state.anthropicClientsCreated, 0, "Anthropicクライアントを作成しない");
  assert.equal(state.anthropicStreamCalls, 0, "Claude APIを呼び出さない");
}

/** 200が返り、ユーザー発言とAI応答を保存し、Claude APIを1回だけ呼んだことを確かめる。 */
async function assertProcessedNormally() {
  const res = await postCoach();
  assert.equal(res.status, 200);
  assert.equal(res.text, "こんにちは。");
  assert.deepEqual(state.savedMessages, [
    { role: "user", content: "集客のアイデアをください" },
    { role: "coach", content: "こんにちは。" },
  ]);
  assert.equal(state.anthropicClientsCreated, 1);
  assert.equal(state.anthropicStreamCalls, 1);
}

beforeEach(resetCounters);

test("未同意なら403で、保存もClaude APIの呼び出しもしない", async () => {
  state.profile = NOT_CONSENTED;
  await assertConsentRequired();
});

test("クライアントが同意済みと申告しても、DBの値が未同意なら403", async () => {
  state.profile = NOT_CONSENTED;
  await assertConsentRequired({
    message: "こんにちは",
    consented: true,
    ai_coach_consented_at: "2026-10-20T00:00:00+00:00",
    ai_coach_consent_version: AI_COACH_CONSENT_VERSION,
  });
});

test("プロフィールの取得に失敗した場合(null)も403", async () => {
  state.profile = null;
  await assertConsentRequired();
});

test("古いバージョンの説明文への同意では403", async () => {
  state.profile = { ai_coach_consented_at: "2026-01-01T00:00:00+00:00", ai_coach_consent_version: "2026-01-01" };
  await assertConsentRequired();
});

test("同意済みなら正常に処理される", async () => {
  state.profile = CONSENTED;
  await assertProcessedNormally();
});

test("同意 → 取り消し → 再同意の順に、200 → 403 → 200になる", async () => {
  state.profile = CONSENTED;
  await assertProcessedNormally();

  // 取り消し後のDBの値(set_ai_coach_consent(false, null)で両列がnullになる)
  resetCounters();
  state.profile = NOT_CONSENTED;
  await assertConsentRequired();

  // 再同意後のDBの値
  resetCounters();
  state.profile = {
    ai_coach_consented_at: "2026-10-26T00:00:00+00:00",
    ai_coach_consent_version: AI_COACH_CONSENT_VERSION,
  };
  await assertProcessedNormally();
});
