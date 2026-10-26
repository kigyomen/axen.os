// planReminders()(リマインダーの予約対象・件数の決定)の最小限のテスト。
// 実行方法: node --test src/lib/capacitor/notifications.test.mjs
// (Node.js組み込みのテストランナーを使う。端末の通知APIは呼ばない)
import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_SCHEDULED_REMINDERS, planReminders } from "./notifications.ts";

// 端末ローカル時刻で日時を組み立てる(toLocalDateと同じ解釈)。
const local = (y, m, d, hh = 9, mm = 0) => new Date(y, m - 1, d, hh, mm).getTime();
const pad = (n) => String(n).padStart(2, "0");
const ymd = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const daysFrom = (base, n) => {
  const d = new Date(base);
  d.setDate(d.getDate() + n);
  return ymd(d);
};

const NOW = local(2026, 1, 10, 12, 0);

test("期限の近い順に並べ、最大64件に絞る", () => {
  // 100件のタスク(1〜100日後)を、あえて遠い順に渡す
  const taskReminders = Array.from({ length: 100 }, (_, i) => ({
    id: `t${100 - i}`,
    title: `task ${100 - i}`,
    date: daysFrom(NOW, 100 - i),
  }));
  const planned = planReminders({ enabled: true, time: "09:00", taskReminders, goalReminders: [] }, NOW);

  assert.equal(MAX_SCHEDULED_REMINDERS, 64);
  assert.equal(planned.length, 64);
  assert.equal(planned[0].body, "task 1");
  assert.equal(planned[63].body, "task 64");
  for (let i = 1; i < planned.length; i++) {
    assert.ok(planned[i - 1].at.getTime() <= planned[i].at.getTime());
  }
});

test("通知時刻を過ぎたもの(当日で時刻が過去のものを含む)は予約しない", () => {
  const planned = planReminders(
    {
      enabled: true,
      time: "09:00",
      taskReminders: [
        { id: "past", title: "昨日", date: daysFrom(NOW, -1) },
        { id: "today", title: "今日(09:00は既に過去)", date: daysFrom(NOW, 0) },
        { id: "future", title: "明日", date: daysFrom(NOW, 1) },
      ],
      goalReminders: [{ id: "g-bad", title: "日付の形式が不正", date: "2026/01/20" }],
    },
    NOW,
  );
  assert.deepEqual(
    planned.map((p) => p.body),
    ["明日"],
  );
});

test("タスクと目標を合わせて近い順にし、通知IDは重複しない", () => {
  const planned = planReminders(
    {
      enabled: true,
      time: "08:30",
      taskReminders: [
        { id: "same", title: "タスク3日後", date: daysFrom(NOW, 3) },
        { id: "a", title: "タスク1日後", date: daysFrom(NOW, 1) },
        // 同じタスクが重複して渡された場合も1件にする(近い方を残す)
        { id: "same", title: "タスク3日後(重複)", date: daysFrom(NOW, 5) },
      ],
      goalReminders: [
        { id: "same", title: "目標2日後", date: daysFrom(NOW, 2) },
        { id: "b", title: "目標1日後", date: daysFrom(NOW, 1) },
      ],
    },
    NOW,
  );
  // 同時刻(1日後)はタスク→目標の元の並びを保つ。task:sameとgoal:sameは別ID
  assert.deepEqual(
    planned.map((p) => p.body),
    ["タスク1日後", "目標1日後", "目標2日後", "タスク3日後"],
  );
  assert.equal(new Set(planned.map((p) => p.id)).size, planned.length);
  for (const p of planned) {
    assert.ok(Number.isInteger(p.id) && p.id >= 0 && p.id <= 0x7fffffff);
    assert.equal(p.at.getHours(), 8);
    assert.equal(p.at.getMinutes(), 30);
  }
});

test("対象が無い場合は空になる", () => {
  assert.deepEqual(
    planReminders({ enabled: true, time: "09:00", taskReminders: [], goalReminders: [] }, NOW),
    [],
  );
});
