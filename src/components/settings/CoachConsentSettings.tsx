"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  revokeAiCoachConsent,
  type CoachConsentActionState,
} from "@/lib/supabase/coach-consent-actions";
import { hasAiCoachConsent } from "@/lib/coach/consent";
import type { Profile } from "@/lib/supabase/types";

const initialState: CoachConsentActionState = { error: null };

/**
 * サーバー(UTC)での描画とブラウザでの描画で表示がずれないよう、
 * タイムゾーンを日本時間に固定する。
 */
function formatConsentedAt(value: string): string {
  return new Date(value).toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * 設定画面で、AI Coachの外部AI(Anthropic Claude API)へのデータ送信への
 * 同意状態を表示し、同意を取り消せるようにする。
 * 取り消すと、もう一度同意するまで/api/coachがサーバー側でリクエストを拒否する。
 */
export function CoachConsentSettings({ profile }: { profile: Profile | null }) {
  const [state, formAction, isPending] = useActionState(revokeAiCoachConsent, initialState);
  const consented = hasAiCoachConsent(profile);

  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="text-sm font-medium text-foreground">外部AIへのデータ送信</p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
          AI Coachは、メッセージや事業の情報をAnthropic社のClaude APIへ送信して回答を作成します。
        </p>
      </div>

      {consented && profile?.ai_coach_consented_at ? (
        <>
          <p className="text-sm text-foreground">
            同意済み（{formatConsentedAt(profile.ai_coach_consented_at)}）
          </p>
          <form action={formAction} className="flex flex-col gap-2">
            <p className="text-xs leading-relaxed text-muted-foreground">
              同意を取り消すと、もう一度同意するまでAI Coachは利用できません。これまでの会話履歴は削除されません。
            </p>
            <button
              type="submit"
              disabled={isPending}
              className="w-full rounded-xl border border-border bg-surface py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-surface-muted disabled:opacity-60 sm:w-auto sm:self-start sm:px-6"
            >
              {isPending ? "処理中…" : "同意を取り消す"}
            </button>
          </form>
        </>
      ) : (
        <p className="text-sm text-foreground">
          未同意（AI Coachは利用できません）。
          <Link href="/coach" className="ml-1 font-medium underline">
            AI Coachを開いて内容を確認する
          </Link>
        </p>
      )}

      {state.error ? (
        <p role="alert" className="text-sm text-red-400">
          {state.error}
        </p>
      ) : null}
      {state.success && !consented ? (
        <p className="text-sm text-green-400">同意を取り消しました。</p>
      ) : null}
    </div>
  );
}
