import { CoachChat } from "@/components/coach/CoachChat";
import { CoachConsentPanel } from "@/components/coach/CoachConsentPanel";
import { hasAiCoachConsent } from "@/lib/coach/consent";
import { resolveCoachCharacter } from "@/lib/coach/characters";
import { getCurrentBusiness } from "@/lib/supabase/business";
import { getCoachMessages } from "@/lib/supabase/coach-messages";
import { getCurrentProfile } from "@/lib/supabase/profile";

export default async function CoachPage({
  searchParams,
}: {
  searchParams: Promise<{ prompt?: string }>;
}) {
  const business = await getCurrentBusiness();
  // getCurrentProfile()はReact cache()で1リクエスト内メモ化されるため、
  // (main)/layout.tsxで既に呼ばれている分の再取得コストは発生しない。
  const [initialMessages, profile] = await Promise.all([
    business ? getCoachMessages(business.id) : Promise.resolve([]),
    getCurrentProfile(),
  ]);
  const { prompt } = await searchParams;
  const coachCharacterId = resolveCoachCharacter(profile?.coach_character).id;

  if (!business) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-24 text-center">
        <p className="text-sm font-medium text-foreground">事業情報が見つかりませんでした</p>
        <p className="text-sm text-muted-foreground">
          時間をおいてページを再読み込みしてください。
        </p>
      </div>
    );
  }

  // 外部AIへのデータ送信に(現在の版の説明文で)同意していない場合は、
  // チャットの代わりに説明・同意画面を表示する。これは表示上の制御で、
  // 実際の送信可否は/api/coachがDBの同意状態で必ず再確認する。
  if (!hasAiCoachConsent(profile)) {
    return <CoachConsentPanel />;
  }

  // key={business.id}: CoachChatはストリーミング中の会話を保持するため
  // initialMessagesをuseStateの初期値としてのみ使う。事業切り替え時に
  // 別事業の履歴へ確実に入れ替えるため、business.id が変わったら
  // コンポーネントごと再マウントさせる。
  return (
    <CoachChat
      key={business.id}
      initialMessages={initialMessages}
      initialInput={prompt}
      coachCharacterId={coachCharacterId}
    />
  );
}
