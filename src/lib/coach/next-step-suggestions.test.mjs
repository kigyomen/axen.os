// sanitizeNextStepSuggestions()(AIコーチの提案ボタンのデータの検証)の単体テスト。
// 実行方法: node --test src/lib/coach/next-step-suggestions.test.mjs
// 提案ボタンは、AIが回答の中で実際に示した提案の数だけ表示する(件数を固定しない・補わない)。
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PROPOSE_ACTIONS_TOOL,
  sanitizeCoachActions,
  sanitizeNextStepSuggestions,
} from "./actions-schema.ts";

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

test("ツール定義: 提案ボタンは必須の項目で0〜5件(最小件数は無い)", () => {
  const schema = PROPOSE_ACTIONS_TOOL.input_schema;
  assert.deepEqual(schema.required, ["next_step_suggestions"]);
  const steps = schema.properties.next_step_suggestions;
  assert.equal(steps.maxItems, 5);
  assert.equal(steps.minItems, undefined);
  assert.deepEqual(steps.items.required, ["label", "message"]);
});

test("ツール定義: tasksと提案ボタンの役割の違いと、重複してよいことを説明している", () => {
  const description = PROPOSE_ACTIONS_TOOL.description;
  assert.match(description, /tasksとnext_step_suggestionsは役割が違う/);
  assert.match(description, /同じテーマの提案を両方に入れてよい/);
  assert.match(description, /一緒に考えましょう/);
  assert.match(description, /本文に無い提案を新しく作ったり、件数を埋めるために追加したりしない/);
});

test("ツール定義: タスク・目標・アイデアの定義は変わっていない", () => {
  const { tasks, goals, ideas } = PROPOSE_ACTIONS_TOOL.input_schema.properties;
  assert.deepEqual(tasks.items.required, ["title"]);
  assert.deepEqual(goals.items.required, ["title", "target_value"]);
  assert.deepEqual(ideas.items.required, ["title"]);
});

test("同じテーマの提案がtasksと提案ボタンの両方にあっても、両方とも残る", () => {
  const input = {
    tasks: [{ title: "競合3社の価格を調べる" }],
    goals: [],
    ideas: [],
    next_step_suggestions: [step("競合の価格を調べる", "競合3社の価格を一緒に調べたい")],
  };
  assert.equal(sanitizeCoachActions(input).tasks.length, 1);
  assert.deepEqual(sanitizeNextStepSuggestions(input.next_step_suggestions), [
    step("競合の価格を調べる", "競合3社の価格を一緒に調べたい"),
  ]);
});
