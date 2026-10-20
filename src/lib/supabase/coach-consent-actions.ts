"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "./server";
import { getCurrentUser } from "./get-current-user";
import { AI_COACH_CONSENT_VERSION } from "../coach/consent";

export interface CoachConsentActionState {
  error: string | null;
  success?: boolean;
}

/**
 * set_ai_coach_consent()(supabase/migrations/007_ai_coach_consent.sql)を呼び、
 * ログイン中ユーザー自身のprofilesの同意状態の更新と、
 * ai_coach_consent_eventsへの記録の追記を1トランザクションで行う。
 *
 * user_idはクライアントから受け取らない(関数内でauth.uid()を使う)。
 * 同意する説明文の版もクライアントから受け取らず、サーバー側の
 * AI_COACH_CONSENT_VERSIONを使う。
 */
async function setAiCoachConsent(granted: boolean): Promise<CoachConsentActionState> {
  const user = await getCurrentUser();
  if (!user) {
    return { error: "ログインが必要です。" };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_ai_coach_consent", {
    p_granted: granted,
    p_consent_version: granted ? AI_COACH_CONSENT_VERSION : null,
  });

  if (error) {
    console.error("setAiCoachConsent failed", error);
    return {
      error: granted
        ? "同意の保存に失敗しました。時間をおいて再度お試しください。"
        : "同意の取り消しに失敗しました。時間をおいて再度お試しください。",
    };
  }

  revalidatePath("/coach");
  revalidatePath("/settings");

  return { error: null, success: true };
}

/** AI Coachの初回利用時の説明画面から、データ送信に同意する。 */
export async function grantAiCoachConsent(): Promise<CoachConsentActionState> {
  return setAiCoachConsent(true);
}

/** 設定画面から、データ送信への同意を取り消す。 */
export async function revokeAiCoachConsent(): Promise<CoachConsentActionState> {
  return setAiCoachConsent(false);
}
