// sanitizeFollowUpQuestions()(AIコーチの「次の質問」候補の検証)の単体テスト。
// 実行方法: node --test src/lib/coach/follow-up-questions.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { sanitizeFollowUpQuestions } from "./actions-schema.ts";

test("正しい候補はそのまま最大3件まで返す", () => {
  assert.deepEqual(sanitizeFollowUpQuestions(["質問A", "質問B", "質問C", "質問D"]), [
    "質問A",
    "質問B",
    "質問C",
  ]);
});

test("文字列以外・空・長すぎるもの・重複は捨て、空白は整える", () => {
  assert.deepEqual(
    sanitizeFollowUpQuestions([1, null, "", "   ", "あ".repeat(61), "  価格を\n決めたい ", "価格を 決めたい"]),
    ["価格を 決めたい"],
  );
});

test("配列でない場合は空配列(画面側は固定の質問例を表示する)", () => {
  assert.deepEqual(sanitizeFollowUpQuestions(undefined), []);
  assert.deepEqual(sanitizeFollowUpQuestions("質問"), []);
  assert.deepEqual(sanitizeFollowUpQuestions({ 0: "質問" }), []);
});
