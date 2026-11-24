// sanitizeNextStepSuggestions()(AIコーチの提案ボタンのデータの検証)の単体テスト。
// 実行方法: node --test src/lib/coach/next-step-suggestions.test.mjs
// 提案ボタンは、AIが回答の中で実際に示した提案の数だけ表示する(件数を固定しない・補わない)。
import { test } from "node:test";
import assert from "node:assert/strict";
import { sanitizeNextStepSuggestions } from "./actions-schema.ts";

const step = (label, message) => ({ label, message });

test("提案が1つなら1つ、2つなら2つだけ返す(件数を補わない)", () => {
  assert.deepEqual(sanitizeNextStepSuggestions([step("競合を調べる", "競合3社の価格を一緒に調べたい")]), [
    step("競合を調べる", "競合3社の価格を一緒に調べたい"),
  ]);
  assert.equal(
    sanitizeNextStepSuggestions([step("A", "Aをやりたい"), step("B", "Bをやりたい")]).length,
    2,
  );
});

test("提案が無ければ空配列(ボタンを表示しない)", () => {
  assert.deepEqual(sanitizeNextStepSuggestions([]), []);
});

test("形式が想定外なら空配列", () => {
  assert.deepEqual(sanitizeNextStepSuggestions(undefined), []);
  assert.deepEqual(sanitizeNextStepSuggestions("提案"), []);
  assert.deepEqual(sanitizeNextStepSuggestions(["文字列だけの提案"]), []);
  assert.deepEqual(sanitizeNextStepSuggestions({ 0: step("A", "Aをやりたい") }), []);
});

test("labelかmessageが無い・空・長すぎるもの、labelの重複は捨て、空白は整える", () => {
  assert.deepEqual(
    sanitizeNextStepSuggestions([
      step("", "空のラベル"),
      step("メッセージ無し", ""),
      { label: "型が違う", message: 5 },
      step("あ".repeat(41), "長すぎるラベル"),
      step("長すぎる文", "あ".repeat(201)),
      step("  価格を\n決める ", "  価格の決め方を\n教えて "),
      step("価格を 決める", "重複"),
    ]),
    [step("価格を 決める", "価格の決め方を 教えて")],
  );
});

test("異常に多い場合だけ、上限(5件)で止める", () => {
  const many = Array.from({ length: 8 }, (_, i) => step(`提案${i}`, `提案${i}をやりたい`));
  assert.equal(sanitizeNextStepSuggestions(many).length, 5);
});
