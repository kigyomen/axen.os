// buildCoachDiagnostics()(一時的な調査ログ)のテスト。
// 実行方法: node --import ./src/test-support/register-alias.mjs --test src/lib/coach/diagnostics.test.mjs
// 記録内容に会話本文・質問の文面・ツールの入力内容が含まれないことを確かめる。
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildCoachDiagnostics } from "./diagnostics.ts";

const SECRET_TEXTS = ["ひみつの本文です", "価格の決め方を教えて", "タスクひみつ", "user@example.com"];

function message(content, stopReason = "tool_use") {
  return {
    id: "msg",
    type: "message",
    role: "assistant",
    model: "test",
    content,
    stop_reason: stopReason,
    stop_sequence: null,
    usage: { input_tokens: 1200, output_tokens: 345 },
  };
}

test("ツール呼び出しあり・質問候補が配列の場合", () => {
  const d = buildCoachDiagnostics(
    message([
      { type: "thinking", thinking: "", signature: "s" },
      { type: "text", text: "ひみつの本文です user@example.com", citations: null },
      {
        type: "tool_use",
        id: "t",
        name: "propose_actions",
        input: { tasks: [{ title: "タスクひみつ" }], follow_up_questions: ["価格の決め方を教えて", "", 5] },
      },
    ]),
  );
  assert.deepEqual(d, {
    stopReason: "tool_use",
    blockTypes: ["thinking", "text", "tool_use"],
    toolCalled: true,
    followUpType: "array",
    followUpRawCount: 3,
    followUpAcceptedCount: 1,
    inputTokens: 1200,
    outputTokens: 345,
  });
  const logged = JSON.stringify(d);
  for (const secret of SECRET_TEXTS) {
    assert.ok(!logged.includes(secret), `記録に本文等が含まれている: ${secret}`);
  }
});

test("ツール呼び出しなし・上限で打ち切りの場合", () => {
  const d = buildCoachDiagnostics(
    message([{ type: "text", text: "ひみつの本文です", citations: null }], "max_tokens"),
  );
  assert.equal(d.stopReason, "max_tokens");
  assert.equal(d.toolCalled, false);
  assert.equal(d.followUpType, "missing");
  assert.equal(d.followUpRawCount, null);
  assert.equal(d.followUpAcceptedCount, 0);
  assert.ok(!JSON.stringify(d).includes("ひみつ"));
});

test("質問候補が文字列で返った場合も、形式だけを記録する", () => {
  const d = buildCoachDiagnostics(
    message([
      {
        type: "tool_use",
        id: "t",
        name: "propose_actions",
        input: { follow_up_questions: '["価格の決め方を教えて"]' },
      },
    ]),
  );
  assert.equal(d.followUpType, "string");
  assert.equal(d.followUpRawCount, null);
  assert.equal(d.followUpAcceptedCount, 0);
  assert.ok(!JSON.stringify(d).includes("価格"));
});
