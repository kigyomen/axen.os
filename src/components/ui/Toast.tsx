"use client";

import { CheckCircle2 } from "lucide-react";
import { useEffect } from "react";

const TOAST_DURATION_MS = 3000;

/**
 * 登録完了などを短時間だけ知らせる通知。一定時間後にonDismissを呼ぶ。
 * 同じ文言を続けて表示する場合も、呼び出し側でkeyを変えればタイマーがやり直される。
 * 下部ナビゲーション(モバイル)とセーフエリアに重ならない位置に表示し、
 * 画面の操作を妨げないようpointer-eventsは無効にする。
 */
export function Toast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  useEffect(() => {
    const timer = window.setTimeout(onDismiss, TOAST_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(6rem+env(safe-area-inset-bottom))] z-50 flex justify-center px-4 md:bottom-[calc(2rem+env(safe-area-inset-bottom))]"
    >
      <div className="flex items-center gap-2 rounded-full bg-foreground px-4 py-2.5 text-sm font-medium text-background shadow-lg">
        <CheckCircle2 className="h-4 w-4 shrink-0 text-green-400" aria-hidden />
        {message}
      </div>
    </div>
  );
}
