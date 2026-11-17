// GET /auth/confirm(route.ts)のテスト。メール内リンクから戻ってきたときに、
// code形式(Supabase標準のメールテンプレート)とtoken_hash形式(テンプレートを
// 書き換えた場合)の両方を正しく処理し、安全な遷移先へ移動することを確かめる。
//
// 実行方法(Node.js 22.15以降。試験的機能 registerHooks / mock.module を使う):
//   node --import ./src/test-support/register-alias.mjs --experimental-test-module-mocks --test src/app/auth/confirm/route.test.mjs
//
// 本物のSupabaseには接続しない。Supabaseクライアントとredirect()は偽物に差し替える。
import { test, mock, beforeEach } from "node:test";
import assert from "node:assert/strict";

const state = {
  exchangeResult: null,
  verifyResult: null,
  exchangeCalls: [],
  verifyCalls: [],
};

function srcUrl(relativePath) {
  return new URL(`../../../${relativePath}`, import.meta.url).href;
}

class RedirectSignal extends Error {
  constructor(path) {
    super(`redirect:${path}`);
    this.path = path;
  }
}

mock.module("next/navigation", {
  namedExports: {
    redirect: (path) => {
      throw new RedirectSignal(path);
    },
  },
});

mock.module(srcUrl("lib/supabase/server.ts"), {
  namedExports: {
    createClient: async () => ({
      auth: {
        exchangeCodeForSession: async (code, options) => {
          state.exchangeCalls.push({ code, options });
          return state.exchangeResult;
        },
        verifyOtp: async (params) => {
          state.verifyCalls.push(params);
          return state.verifyResult;
        },
      },
    }),
  },
});

const { GET } = await import(srcUrl("app/auth/confirm/route.ts"));

/** GETを呼び、redirect()に渡された遷移先を返す。 */
async function redirectedTo(query) {
  try {
    await GET(new Request(`http://localhost/auth/confirm${query}`));
  } catch (error) {
    if (error instanceof RedirectSignal) return error.path;
    throw error;
  }
  assert.fail("redirect()が呼ばれなかった");
}

const SESSION_DATA = { user: { id: "u" }, session: { access_token: "x" } };

beforeEach(() => {
  state.exchangeResult = null;
  state.verifyResult = null;
  state.exchangeCalls = [];
  state.verifyCalls = [];
});

test("code形式: パスワード再設定のリンクなら/update-passwordへ進む", async () => {
  state.exchangeResult = { data: { ...SESSION_DATA, redirectType: "recovery" }, error: null };
  assert.equal(await redirectedTo("?code=abc&next=/update-password"), "/update-password");
  assert.deepEqual(state.exchangeCalls, [{ code: "abc", options: undefined }]);
  assert.equal(state.verifyCalls.length, 0);
});

test("code形式: 再設定のリンクなら、nextが別の値でも/update-passwordへ進む", async () => {
  state.exchangeResult = { data: { ...SESSION_DATA, redirectType: "recovery" }, error: null };
  assert.equal(await redirectedTo("?code=abc"), "/update-password");
  assert.equal(await redirectedTo("?code=abc&next=/settings"), "/update-password");
});

test("code形式: 再設定以外(会員登録の確認等)でnextが無ければ/へ進む", async () => {
  state.exchangeResult = { data: { ...SESSION_DATA, redirectType: null }, error: null };
  assert.equal(await redirectedTo("?code=abc"), "/");
});

test("code形式: 再設定以外でも、外部サイトへのnextは拒否する", async () => {
  state.exchangeResult = { data: { ...SESSION_DATA, redirectType: null }, error: null };
  for (const next of ["https://evil.example.com", "//evil.example.com", "/\\evil.example.com"]) {
    const path = await redirectedTo(`?code=abc&next=${encodeURIComponent(next)}`);
    assert.ok(path.startsWith("/") && !path.startsWith("//") && !path.startsWith("/\\"), path);
  }
});

test("code形式: 別のブラウザで開いた(PKCEの検証用の値が無い)場合は案内画面へ", async () => {
  state.exchangeResult = {
    data: { user: null, session: null, redirectType: null },
    error: { code: "pkce_code_verifier_not_found", message: "missing" },
  };
  assert.equal(await redirectedTo("?code=abc"), "/reset-password?error=other_browser");
});

test("code形式: 期限切れ・使用済みのcodeは期限切れの画面へ", async () => {
  state.exchangeResult = {
    data: { user: null, session: null, redirectType: null },
    error: { code: "flow_state_expired", message: "expired" },
  };
  assert.equal(await redirectedTo("?code=abc"), "/reset-password?error=expired");
});

test("code形式: sb_flow_idがあれば交換時に渡す", async () => {
  state.exchangeResult = { data: { ...SESSION_DATA, redirectType: "recovery" }, error: null };
  await redirectedTo("?code=abc&sb_flow_id=flow1");
  assert.deepEqual(state.exchangeCalls, [{ code: "abc", options: { flowId: "flow1" } }]);
});

test("token_hash形式: 従来どおりverifyOtpで検証し、nextへ進む", async () => {
  state.verifyResult = { error: null };
  assert.equal(
    await redirectedTo("?token_hash=th&type=recovery&next=/update-password"),
    "/update-password",
  );
  assert.deepEqual(state.verifyCalls, [{ type: "recovery", token_hash: "th" }]);
  assert.equal(state.exchangeCalls.length, 0);
  assert.equal(await redirectedTo("?token_hash=th&type=signup&next=/"), "/");
});

test("token_hash形式: 検証に失敗したら期限切れの画面へ", async () => {
  state.verifyResult = { error: { message: "invalid" } };
  assert.equal(await redirectedTo("?token_hash=th&type=recovery"), "/reset-password?error=expired");
});

test("token_hash形式: 外部サイトへのnextは拒否し、既定の/update-passwordへ進む", async () => {
  state.verifyResult = { error: null };
  assert.equal(
    await redirectedTo(`?token_hash=th&type=recovery&next=${encodeURIComponent("https://evil.example.com")}`),
    "/update-password",
  );
});

test("codeもtoken_hashも無い場合は期限切れの画面へ", async () => {
  assert.equal(await redirectedTo(""), "/reset-password?error=expired");
  assert.equal(await redirectedTo("?error=access_denied&error_code=otp_expired"), "/reset-password?error=expired");
});
