import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";

export const metadata: Metadata = {
  title: "サポート | 起業しよ。",
  description: "「起業しよ。」のお問い合わせ先・不具合報告・アカウント削除方法について説明します。",
};

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2.5">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      <div className="flex flex-col gap-2.5 text-sm leading-relaxed text-muted-foreground">
        {children}
      </div>
    </section>
  );
}

export default function SupportPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-5 py-10 sm:px-6">
      <header className="flex flex-col gap-2">
        <Link
          href="/"
          className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          ← 起業しよ。 トップへ戻る
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">サポート</h1>
      </header>

      <Section title="このアプリについて">
        <p>
          「起業しよ。」は、アイデアを実際のビジネスに変えるためのAIビジネス支援アプリです。タスク・目標・財務（売上・経費）・ビジネスアイデアの管理と、AIコーチとの対話を通じて、個人事業主・スモールビジネス経営者の起業・副業をサポートします。
        </p>
      </Section>

      <Section title="お問い合わせ先">
        <p>
          不具合の報告、操作方法に関するご質問、機能へのご要望など、本アプリに関するお問い合わせは、以下のメールアドレスまでご連絡ください。
        </p>
        <p>
          <a
            href="mailto:kigyoshiyo@gmail.com"
            className="font-medium text-foreground underline"
          >
            kigyoshiyo@gmail.com
          </a>
        </p>
        <p>
          お問い合わせの際は、ご利用の環境（Web版／Androidアプリ版など）と、発生している状況をできるだけ詳しくお知らせください。
        </p>
      </Section>

      <Section title="アカウントを削除したい場合">
        <p>
          アカウントの削除は、アプリ内の「設定」画面から行えます。「設定」画面の「アカウントの削除」セクションにある「アカウントを削除」ボタンを押すと確認画面が表示されるので、内容をご確認のうえチェックボックスにチェックを入れ、「削除する」を押してください。
        </p>
        <p>
          アカウントを削除すると、プロフィール・事業・アイデア・タスク・目標・売上/経費の記録・AI
          Coachとの会話履歴を含む、すべてのデータが直ちに完全に削除されます。この操作は取り消せません。
        </p>
      </Section>

      <Section title="返信について">
        <p>
          お問い合わせへの返信までお時間をいただく場合があります。あらかじめご了承ください。
        </p>
      </Section>

      <Section title="関連ページ">
        <p>
          <Link href="/privacy" className="font-medium text-foreground underline">
            プライバシーポリシー
          </Link>
        </p>
      </Section>
    </main>
  );
}
