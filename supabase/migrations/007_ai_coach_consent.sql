-- =============================================================================
-- 起業しよ。: AI Coachの外部AI(Anthropic Claude API)へのデータ送信への同意
--
-- 1. profiles に「現在の同意状態」を表す2列を追加する。
--    - ai_coach_consented_at   : 現在有効な同意をした日時(未同意・取り消し後はNULL)
--    - ai_coach_consent_version: 同意した説明文の版(src/lib/coach/consent.tsの
--                                AI_COACH_CONSENT_VERSION)。説明文を改訂して版を
--                                上げると、旧版への同意は無効として再同意を求める。
--    既存行はどちらもNULL(=未同意)のまま追加する。既存ユーザーを勝手に
--    同意済みにしないため、DEFAULTやバックフィルは行わない。
--
-- 2. ai_coach_consent_events に「同意・取り消しの記録(履歴)」を追記する。
--    profilesの列は最新の状態だけを持ち、取り消すとNULLに戻るため、
--    いつ同意し、いつ取り消したかの記録はこちらに別途残す
--    (同意日時と同意の記録を混同しないため)。利用者本人は自分の記録の
--    参照のみ可能で、追加・更新・削除はできない(追加は3の関数だけが行う。
--    アカウント削除時はauth.usersからの連鎖削除で消える)。
--
-- 3. set_ai_coach_consent() で、上記1と2を1トランザクションで更新する。
--    同意の2列と記録は利用者が直接書き換えられない(4のトリガー・権限)ため、
--    この関数はsecurity definer(関数の所有者の権限)で実行する。
--    対象は常にauth.uid()の行・記録のみで、引数でuser_idは受け取らない。
--
-- 4. profilesの同意の2列は、利用者のロール(authenticated/anon)からは
--    直接INSERT/UPDATEできないようにする(トリガー)。既存のプロフィール
--    更新処理(表示名・通知設定等)は2列に触れないため影響しない。
--    service_role等の管理用ロールからの変更は妨げない。
--
-- profilesのRLSは行単位(既存4ポリシー)のため、新しい列にも自動的に
-- 適用され、profilesのRLSポリシーの追加・変更は不要。
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. profiles: 現在の同意状態
-- -----------------------------------------------------------------------------
alter table public.profiles
  add column ai_coach_consented_at timestamptz,
  add column ai_coach_consent_version text,
  add constraint profiles_ai_coach_consent_pair check (
    (ai_coach_consented_at is null) = (ai_coach_consent_version is null)
  );

comment on column public.profiles.ai_coach_consented_at is
  'AI Coachの外部AI(Anthropic Claude API)へのデータ送信に、現在有効な同意をした日時。未同意・取り消し後はNULL。set_ai_coach_consent()以外から利用者が変更することはできない。履歴はai_coach_consent_eventsを参照。';
comment on column public.profiles.ai_coach_consent_version is
  '同意した説明文の版(src/lib/coach/consent.tsのAI_COACH_CONSENT_VERSION)。現在の版と異なる場合は未同意として扱う。set_ai_coach_consent()以外から利用者が変更することはできない。';

-- -----------------------------------------------------------------------------
-- 2. ai_coach_consent_events: 同意・取り消しの記録
-- -----------------------------------------------------------------------------
create table public.ai_coach_consent_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null check (action in ('granted', 'revoked')),
  consent_version text,
  created_at timestamptz not null default now(),
  constraint ai_coach_consent_events_version_on_grant check (
    action <> 'granted' or consent_version is not null
  )
);

comment on table public.ai_coach_consent_events is
  'AI Coachの外部AIへのデータ送信に対する同意(granted)・取り消し(revoked)の記録。set_ai_coach_consent()だけが追記する。';

create index ai_coach_consent_events_user_id_created_at_idx
  on public.ai_coach_consent_events (user_id, created_at desc);

alter table public.ai_coach_consent_events enable row level security;

create policy "ai_coach_consent_events_select_own" on public.ai_coach_consent_events
  for select to authenticated
  using ((select auth.uid()) = user_id);
-- insert/update/deleteのポリシーは作らない(利用者は記録を追加・書き換え・
-- 削除できない。追記はsecurity definerのset_ai_coach_consent()だけが行う)。

-- Supabaseは新規テーブルにanon/authenticatedへ全権限(TRUNCATE等を含む)を
-- 自動付与する設定のことが多い。TRUNCATEはRLSの対象外のため、
-- authenticatedからも一旦すべて剥奪したうえで、参照(SELECT)のみを付与する。
revoke all on table public.ai_coach_consent_events from public;
revoke all on table public.ai_coach_consent_events from anon;
revoke all on table public.ai_coach_consent_events from authenticated;
grant select on table public.ai_coach_consent_events to authenticated;

-- -----------------------------------------------------------------------------
-- 3. set_ai_coach_consent(): 状態の更新と記録の追記を同時に行う
-- -----------------------------------------------------------------------------
create function public.set_ai_coach_consent(p_granted boolean, p_consent_version text)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_now timestamptz := pg_catalog.now();
begin
  if v_user_id is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_granted is null then
    raise exception 'p_granted must not be null' using errcode = '22004';
  end if;
  if p_granted
     and (p_consent_version is null or pg_catalog.length(pg_catalog.btrim(p_consent_version)) = 0) then
    raise exception 'p_consent_version is required when granting consent' using errcode = '22023';
  end if;

  update public.profiles
  set
    ai_coach_consented_at = case when p_granted then v_now else null end,
    ai_coach_consent_version = case when p_granted then p_consent_version else null end
  where id = v_user_id;

  if not found then
    raise exception 'profile not found' using errcode = 'P0002';
  end if;

  insert into public.ai_coach_consent_events (user_id, action, consent_version)
  values (
    v_user_id,
    case when p_granted then 'granted' else 'revoked' end,
    case when p_granted then p_consent_version else null end
  );

  return case when p_granted then v_now else null end;
end;
$$;

comment on function public.set_ai_coach_consent(boolean, text) is
  'ログイン中ユーザー自身(auth.uid())のAI Coachデータ送信への同意(true)・取り消し(false)を、profilesの状態更新とai_coach_consent_eventsへの記録追記を1トランザクションで行う。security definerだが、対象は常にauth.uid()の行のみ。';

revoke all on function public.set_ai_coach_consent(boolean, text) from public;
revoke all on function public.set_ai_coach_consent(boolean, text) from anon;
grant execute on function public.set_ai_coach_consent(boolean, text) to authenticated;

-- -----------------------------------------------------------------------------
-- 4. profilesの同意の2列を、利用者のロールから直接変更できないようにする
-- -----------------------------------------------------------------------------
-- 利用者のリクエスト(PostgREST)はauthenticated/anonロールで実行される。
-- set_ai_coach_consent()はsecurity definerのため、関数内のcurrent_userは
-- 関数の所有者になり、このチェックを通過する。service_role等の管理用ロールも
-- 対象外とする(既存の正規処理を妨げない)。
create function public.prevent_direct_ai_coach_consent_change()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      if new.ai_coach_consented_at is not null or new.ai_coach_consent_version is not null then
        raise exception 'ai_coach consent columns can only be set via set_ai_coach_consent()'
          using errcode = '42501';
      end if;
    elsif new.ai_coach_consented_at is distinct from old.ai_coach_consented_at
       or new.ai_coach_consent_version is distinct from old.ai_coach_consent_version then
      raise exception 'ai_coach consent columns can only be changed via set_ai_coach_consent()'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

comment on function public.prevent_direct_ai_coach_consent_change() is
  'profilesのai_coach_consented_at/ai_coach_consent_versionを、利用者のロール(authenticated/anon)が直接INSERT/UPDATEするのを拒否する。変更はset_ai_coach_consent()経由のみ。';

-- トリガー関数は直接呼び出すものではないため、実行権限は誰にも付与しない
-- (トリガーとしての実行には影響しない)。
revoke all on function public.prevent_direct_ai_coach_consent_change() from public;
revoke all on function public.prevent_direct_ai_coach_consent_change() from anon;
revoke all on function public.prevent_direct_ai_coach_consent_change() from authenticated;

create trigger trg_profiles_ai_coach_consent_guard
  before insert or update on public.profiles
  for each row execute function public.prevent_direct_ai_coach_consent_change();

commit;
