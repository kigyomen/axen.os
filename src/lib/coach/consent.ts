import type { Profile } from "../supabase/types";

/**
 * AI Coachの外部AIへのデータ送信に関する説明文の版。
 * 説明文(AI_COACH_SENT_DATA_ITEMS等)の内容を変えた場合はこの値を変更する。
 * 変更すると、既存ユーザーの旧版への同意は無効になり、再同意が必要になる。
 */
export const AI_COACH_CONSENT_VERSION = "2026-10-19";

/** /api/coachが同意の無いリクエストを拒否する際に返すエラーコード。 */
export const AI_COACH_CONSENT_REQUIRED_CODE = "ai_coach_consent_required";

/**
 * AI Coachの回答生成のため、Anthropic社のClaude APIへ送信するデータ。
 * /api/coach(route.ts)・formatCoachContext(coach-context.ts)の実装と
 * 一致させること(実装を変えたらここも更新し、AI_COACH_CONSENT_VERSIONを上げる)。
 */
export const AI_COACH_SENT_DATA_ITEMS: readonly string[] = [
  "入力したメッセージ",
  "このAI Coachとの直近の会話履歴(最大30件)",
  "表示名",
  "選択中のAIコーチの種類",
  "初回登録時の回答のうち、今の課題・起業に使える時間・初期予算・事業アイデアの有無",
  "事業名・業種・ステージ・一言紹介",
  "売上・経費の累計額、利益、利益率(個々の取引の明細は送信しません)",
  "未完了タスクの件数と、直近5件のタイトル・優先度・期限",
  "完了済みタスクの件数",
  "ビジネスアイデアの件数と、直近5件のタイトル・ステージ・スコア",
  "目標の件数と、進行中の直近3件のタイトル・達成率・期限、終了した直近5件のタイトル・状態・期限",
];

/** 送信しないデータ(説明文用)。 */
export const AI_COACH_NOT_SENT_DATA_ITEMS: readonly string[] = [
  "メールアドレス・パスワード",
  "売上・経費の個々の明細(取引先・顧客名など)",
];

/**
 * profilesの値から、現在の版の説明文に同意済みかを判定する。
 * サーバー側(/api/coach)の判定と画面表示の両方でこの関数を使う。
 * profileがnull(取得失敗・未作成)の場合は必ずfalse(同意なし)として扱う。
 */
export function hasAiCoachConsent(
  profile: Pick<Profile, "ai_coach_consented_at" | "ai_coach_consent_version"> | null,
): boolean {
  return (
    profile !== null &&
    profile.ai_coach_consented_at !== null &&
    profile.ai_coach_consent_version === AI_COACH_CONSENT_VERSION
  );
}
