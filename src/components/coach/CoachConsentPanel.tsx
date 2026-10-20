"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import {
  grantAiCoachConsent,
  type CoachConsentActionState,
} from "@/lib/supabase/coach-consent-actions";
import { AI_COACH_NOT_SENT_DATA_ITEMS, AI_COACH_SENT_DATA_ITEMS } from "@/lib/coach/consent";

const initialState: CoachConsentActionState = { error: null };

/**
 * AI Coachの初回利用時(または同意の取り消し後・説明文の改訂後)に、
 * 外部AI(Anthropic Claude API)へのデータ送信について説明し、同意を得る画面。
 *
 * 同意はgrantAiCoachConsent(Server Action)でDBに保存する。保存後は
 * revalidatePath("/coach")によりページが再描画され、チャット画面に切り替わる。
 * 「同意しない」を選んでも何も保存・送信せず、AI Coach以外の機能は
 * これまでどおり利用できる。
 */
export function CoachConsentPanel() {
  const [state, formAction, isPending] = useActionState(grantAiCoachConsent, initialState);
  const [declined, setDeclined] = useState(false);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <ShieldCheck className="h-5 w-5" aria-hidden />
        </div>
        <div>
          <h2 className="text-base font-semibold text-foreground">AI Coachのご利用にあたって</h2>
          <p className="text-xs text-muted-foreground">外部のAIサービスへのデータ送信について</p>
        </div>
      </div>

      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-surface px-4 py-4 text-sm leading-relaxed text-muted-foreground">
        <p>
          AI Coachの回答は、Anthropic社のAIサービス「Claude API」を使って作成します。
          AI Coachにメッセージを送ると、入力したメッセージに加えて、これまでの会話履歴や
          事業の情報も、回答の作成に使うためClaude APIへ送信されます。
        </p>

        <div className="flex flex-col gap-1.5">
          <p className="font-medium text-foreground">送信するデータ</p>
          <ul className="list-disc space-y-1 pl-5">
            {AI_COACH_SENT_DATA_ITEMS.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col gap-1.5">
          <p className="font-medium text-foreground">送信しないデータ</p>
          <ul className="list-disc space-y-1 pl-5">
            {AI_COACH_NOT_SENT_DATA_ITEMS.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>

        <p>
          データは、メッセージを送信したときにだけ送られます。同意はいつでも「設定」画面から
          取り消せます。取り消した後は、もう一度同意するまでAI Coachは利用できません。
          詳しくは
          <Link href="/privacy" className="font-medium text-foreground underline">
            プライバシーポリシー
          </Link>
          をご確認ください。
        </p>
      </div>

      {state.error ? (
        <p role="alert" className="text-sm text-red-400">
          {state.error}
        </p>
      ) : null}

      {declined ? (
        <div
          role="status"
          className="flex flex-col gap-2 rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-muted-foreground"
        >
          <p>
            同意しない場合、AI Coachは利用できません。データは送信されていません。AI
            Coach以外の機能は、これまでどおりご利用いただけます。
          </p>
          <Link href="/" className="font-medium text-foreground underline">
            ホームへ戻る
          </Link>
        </div>
      ) : null}

      <form action={formAction} className="flex flex-col gap-2 sm:flex-row">
        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60 sm:w-auto sm:px-6"
        >
          {isPending ? "保存中…" : "同意して利用する"}
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => setDeclined(true)}
          className="w-full rounded-xl border border-border bg-surface py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-surface-muted disabled:opacity-60 sm:w-auto sm:px-6"
        >
          同意しない
        </button>
      </form>
    </div>
  );
}
