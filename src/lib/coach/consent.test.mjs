// hasAiCoachConsent()(AI Coachの外部AIへのデータ送信への同意判定)の単体テスト。
// 実行方法: node --test src/lib/coach/consent.test.mjs
// (Node.js組み込みのテストランナーを使う。DB・Supabaseには接続しない)
import { test } from "node:test";
import assert from "node:assert/strict";
import { AI_COACH_CONSENT_VERSION, hasAiCoachConsent } from "./consent.ts";

const CONSENTED_AT = "2026-10-20T00:00:00+00:00";

test("profileがnull(取得失敗・未作成)ならfalse", () => {
  assert.equal(hasAiCoachConsent(null), false);
});

test("同意日時がnull(未同意・取り消し後)ならfalse", () => {
  assert.equal(
    hasAiCoachConsent({ ai_coach_consented_at: null, ai_coach_consent_version: null }),
    false,
  );
  // 版だけが現在のものでも、同意日時がnullなら同意なし
  assert.equal(
    hasAiCoachConsent({ ai_coach_consented_at: null, ai_coach_consent_version: AI_COACH_CONSENT_VERSION }),
    false,
  );
});

test("同意した版が古ければfalse", () => {
  assert.equal(
    hasAiCoachConsent({ ai_coach_consented_at: CONSENTED_AT, ai_coach_consent_version: "2026-01-01" }),
    false,
  );
});

test("同意した版が現在の版と異なればfalse(新しい版・表記揺れ・null)", () => {
  for (const version of ["2099-12-31", ` ${AI_COACH_CONSENT_VERSION}`, `${AI_COACH_CONSENT_VERSION} `, "", null]) {
    assert.equal(
      hasAiCoachConsent({ ai_coach_consented_at: CONSENTED_AT, ai_coach_consent_version: version }),
      false,
      `version=${JSON.stringify(version)}`,
    );
  }
});

test("同意日時があり、現在の版ならtrue", () => {
  assert.equal(
    hasAiCoachConsent({ ai_coach_consented_at: CONSENTED_AT, ai_coach_consent_version: AI_COACH_CONSENT_VERSION }),
    true,
  );
});

// ---------------------------------------------------------------------------
// 以下は「現在の実装がどう判定するか」を記録するテスト。望ましい挙動かどうかは
// 別途判断する(DBの列はtimestamptz型で、両列はCHECK制約で必ず揃うため、
// 通常の経路(select("*"))ではこれらの値はアプリに届かない)。
// ---------------------------------------------------------------------------

test("[現状の記録] 同意日時が空文字でも、現在の版ならtrueと判定される", () => {
  // 実装はnullかどうかだけを見ている(consent.ts: ai_coach_consented_at !== null)
  assert.equal(
    hasAiCoachConsent({ ai_coach_consented_at: "", ai_coach_consent_version: AI_COACH_CONSENT_VERSION }),
    true,
  );
  // 空文字でも、版が現在のものでなければfalse
  assert.equal(
    hasAiCoachConsent({ ai_coach_consented_at: "", ai_coach_consent_version: null }),
    false,
  );
});

test("[現状の記録] 同意の版の項目が欠落していればfalse", () => {
  assert.equal(hasAiCoachConsent({ ai_coach_consented_at: CONSENTED_AT }), false);
  // 2つとも欠落(マイグレーション007の適用前と同じ形)もfalse
  assert.equal(hasAiCoachConsent({}), false);
  assert.equal(hasAiCoachConsent({ id: "x", display_name: "表示名" }), false);
});

test("[現状の記録] 同意日時の項目が欠落していても、現在の版があればtrueと判定される", () => {
  // undefined !== null がtrueになるため
  assert.equal(hasAiCoachConsent({ ai_coach_consent_version: AI_COACH_CONSENT_VERSION }), true);
});

test("[現状の記録] profileがundefinedだと例外になる(nullだけを想定した実装)", () => {
  // 呼び出し元(getCurrentProfile)はProfileかnullだけを返すため、通常は起きない
  assert.throws(() => hasAiCoachConsent(undefined), TypeError);
});
