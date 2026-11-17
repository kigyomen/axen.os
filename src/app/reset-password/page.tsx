import Link from "next/link";
import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/AuthCard";
import {
  ResetPasswordRequestForm,
  type ResetLinkError,
} from "@/components/auth/ResetPasswordRequestForm";

export const metadata: Metadata = {
  title: "パスワード再設定 | 起業しよ。",
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  // 想定した値以外(URLを書き換えられた場合等)は無視し、案内を出さない。
  const linkError: ResetLinkError | null =
    error === "expired" || error === "other_browser" ? error : null;

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <AuthCard
        subtitle="パスワードを再設定"
        footer={
          <Link href="/login" className="font-medium text-foreground hover:underline">
            ログインに戻る
          </Link>
        }
      >
        <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
          登録済みのメールアドレスを入力してください。パスワード再設定用のリンクをお送りします。
        </p>
        <ResetPasswordRequestForm linkError={linkError} />
      </AuthCard>
    </main>
  );
}
