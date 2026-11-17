// src/proxy.tsのうち、Supabase標準のメールテンプレートのリンク(?code=...付き)を
// /auth/confirmへ転送する処理のテスト。既存のログイン判定が変わらないことも確かめる。
//
// 実行方法(Node.js 22.15以降。試験的機能 registerHooks / mock.module を使う):
//   node --import ./src/test-support/register-alias.mjs --experimental-test-module-mocks --test src/proxy.test.mjs
//
// 本物のSupabaseには接続しない。セッション確認(updateSession)は偽物に差し替える。
import { test, mock, beforeEach } from "node:test";
import assert from "node:assert/strict";

const state = { user: null, updateSessionCalls: 0 };

mock.module(new URL("./lib/supabase/middleware.ts", import.meta.url).href, {
  namedExports: {
    updateSession: async () => {
      state.updateSessionCalls++;
      const { NextResponse } = await import("next/server");
      return { response: NextResponse.next(), user: state.user };
    },
  },
});

// Supabaseの設定がある状態にする(値はダミー。proxyは有無だけを見る)
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "dummy";

const { NextRequest } = await import("next/server");
const { proxy } = await import(new URL("./proxy.ts", import.meta.url).href);

async function run(path) {
  const response = await proxy(new NextRequest(`http://localhost${path}`));
  const location = response.headers.get("location");
  if (!location) return { status: response.status, to: null };
  const url = new URL(location);
  return { status: response.status, to: `${url.pathname}${url.search}` };
}

beforeEach(() => {
  state.user = null;
  state.updateSessionCalls = 0;
});

test("以前の再設定メールのリンク(/update-password?code=)は/auth/confirmへ転送する", async () => {
  const res = await run("/update-password?code=abc");
  assert.equal(res.status, 307);
  assert.equal(res.to, "/auth/confirm?code=abc&next=%2Fupdate-password");
  assert.equal(state.updateSessionCalls, 0);
});

test("Site URLに戻された場合(/?code=)も/auth/confirmへ転送する", async () => {
  assert.equal((await run("/?code=abc")).to, "/auth/confirm?code=abc");
});

test("転送時、元のURLのnext(外部サイト等)は引き継がない", async () => {
  assert.equal(
    (await run(`/?code=abc&next=${encodeURIComponent("https://evil.example.com")}`)).to,
    "/auth/confirm?code=abc",
  );
  assert.equal(
    (await run("/update-password?code=abc&next=%2F%2Fevil.example.com")).to,
    "/auth/confirm?code=abc&next=%2Fupdate-password",
  );
});

test("他のページのcodeは転送しない(従来どおりのログイン判定)", async () => {
  assert.equal((await run("/tasks?code=abc")).to, "/login?code=abc");
});

test("codeが無い場合のログイン判定は従来どおり", async () => {
  assert.equal((await run("/update-password")).to, "/login");
  assert.equal((await run("/login")).to, null);
  assert.equal((await run("/auth/confirm?code=abc")).to, null);
  state.user = { id: "u" };
  assert.equal((await run("/update-password")).to, null);
  assert.equal((await run("/login")).to, "/");
});
