-- =============================================================================
-- supabase/tests/002_ai_coach_consent.sql
--
-- 007_ai_coach_consent.sql(AI Coachのデータ送信への同意)の
-- 列・記録テーブル・権限・RLS・set_ai_coach_consent()・直接変更を防ぐ
-- トリガーが意図通りに動作するかを検証するテストスイート。
--
-- 重要な警告:
--   このファイルはテストユーザー・テストデータの作成/削除を行う。
--   本番Supabaseプロジェクト、または実データの入った環境に対しては
--   絶対に実行しないこと。使い捨てのテスト用データベースでのみ実行する。
--
-- 実行方法(001_rls.sqlと同じ使い捨てデータベースで):
--   1) 001〜007のマイグレーションを順に適用する
--   2) 001_rls.sql を実行する(authスタブ・ロールの準備も兼ねる)
--   3) 本ファイルを実行する
--        psql -d kigyoshiyo_test -f supabase/tests/002_ai_coach_consent.sql
--
-- service_roleロールが存在する環境(Supabase)では、管理用ロールからの
-- 変更が妨げられないことも確認する(存在しない環境では省略する)。
--
-- ファイル末尾の "ALL AI COACH CONSENT TESTS PASSED" まで到達すれば
-- 全テストが意図通りの結果。
-- =============================================================================

\set ON_ERROR_STOP on

-- -----------------------------------------------------------------------------
-- STEP 1: テストユーザーを2名作成し、それぞれのprofiles行を作る
-- -----------------------------------------------------------------------------
delete from auth.users where email in ('consent-a@test.local', 'consent-b@test.local');

insert into auth.users (id, email) values
  ('33333333-3333-3333-3333-333333333333', 'consent-a@test.local'),
  ('44444444-4444-4444-4444-444444444444', 'consent-b@test.local');

set role authenticated;
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
insert into profiles (id) values ((select auth.uid()));
reset role;

set role authenticated;
set request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';
insert into profiles (id) values ((select auth.uid()));
reset role;

-- =============================================================================
-- TEST 1: 権限の構成(不要な権限が残っていない)
-- =============================================================================
do $$
begin
  assert has_table_privilege('authenticated', 'public.ai_coach_consent_events', 'SELECT'),
    'FAIL: authenticatedが記録を参照できない';
  assert not has_table_privilege('authenticated', 'public.ai_coach_consent_events',
    'INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER'),
    'FAIL: authenticatedに記録テーブルの不要な権限が残っている';
  assert not has_table_privilege('anon', 'public.ai_coach_consent_events',
    'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER'),
    'FAIL: anonに記録テーブルの権限がある';

  assert has_function_privilege('authenticated', 'public.set_ai_coach_consent(boolean, text)', 'EXECUTE'),
    'FAIL: authenticatedが同意の関数を実行できない';
  assert not has_function_privilege('anon', 'public.set_ai_coach_consent(boolean, text)', 'EXECUTE'),
    'FAIL: anonが同意の関数を実行できる';
  assert not has_function_privilege('anon', 'public.prevent_direct_ai_coach_consent_change()', 'EXECUTE')
     and not has_function_privilege('authenticated', 'public.prevent_direct_ai_coach_consent_change()', 'EXECUTE'),
    'FAIL: トリガー関数に実行権限が付与されている';

  assert (
    select count(*) from pg_policies
    where schemaname = 'public' and tablename = 'ai_coach_consent_events'
  ) = 1, 'FAIL: 記録テーブルのRLSポリシーが参照用の1つだけになっていない';

  raise notice 'PASS: 記録テーブルはauthenticatedのSELECTのみ、anonは権限なし、関数の実行はauthenticatedのみ';
end
$$;

-- =============================================================================
-- TEST 2: 新しいprofiles行は未同意(NULL)で作られる
-- =============================================================================
do $$
begin
  assert (
    select count(*) from profiles
    where id in ('33333333-3333-3333-3333-333333333333', '44444444-4444-4444-4444-444444444444')
      and ai_coach_consented_at is null
      and ai_coach_consent_version is null
  ) = 2, 'FAIL: 新しいprofiles行が未同意になっていない';
  raise notice 'PASS: 新しいprofiles行は未同意(NULL)で作られる';
end
$$;

-- =============================================================================
-- TEST 3: User A が同意すると、状態が保存され、記録が1件追記される
-- =============================================================================
do $$
declare
  v_returned timestamptz;
  v_profile profiles%rowtype;
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', true);

  v_returned := set_ai_coach_consent(true, 'test-v1');
  select * into v_profile from profiles where id = '33333333-3333-3333-3333-333333333333';

  assert v_profile.ai_coach_consented_at is not null, 'FAIL: 同意日時が保存されていない';
  assert v_profile.ai_coach_consented_at = v_returned, 'FAIL: 戻り値と保存された同意日時が一致しない';
  assert v_profile.ai_coach_consent_version = 'test-v1', 'FAIL: 同意した版が保存されていない';
  assert (
    select count(*) from ai_coach_consent_events
    where user_id = '33333333-3333-3333-3333-333333333333'
      and action = 'granted' and consent_version = 'test-v1'
  ) = 1, 'FAIL: 同意の記録が追記されていない(または本人が参照できない)';

  perform set_config('role', 'none', true);
  raise notice 'PASS: 同意すると状態が保存され、記録(granted)が追記され、本人が参照できる';
end
$$;

-- =============================================================================
-- TEST 4: User B は User A の同意状態・記録を参照・変更できない
-- =============================================================================
do $$
declare
  v_count integer;
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', '44444444-4444-4444-4444-444444444444', true);

  assert (
    select count(*) from ai_coach_consent_events
    where user_id = '33333333-3333-3333-3333-333333333333'
  ) = 0, 'FAIL: User B から User A の同意記録が見えてしまう';

  -- 他人の行はRLSで見えないため、更新対象が0件になる(トリガーまで到達しない)
  update profiles set ai_coach_consented_at = null, ai_coach_consent_version = null
  where id = '33333333-3333-3333-3333-333333333333';
  get diagnostics v_count = row_count;
  assert v_count = 0, 'FAIL: User B が User A の同意状態を変更できてしまう';

  -- User B が関数を呼んでも、変わるのは User B 自身の行だけ
  perform set_ai_coach_consent(false, null);

  perform set_config('role', 'none', true);

  assert (
    select ai_coach_consented_at is not null from profiles
    where id = '33333333-3333-3333-3333-333333333333'
  ), 'FAIL: User B の操作で User A の同意が取り消されてしまった';
  assert (
    select count(*) from ai_coach_consent_events
    where user_id = '44444444-4444-4444-4444-444444444444' and action = 'revoked'
  ) = 1, 'FAIL: User B の取り消しが User B 自身の記録として残っていない';

  raise notice 'PASS: 他人の同意状態・記録は参照・変更できず、関数は本人の行だけを変更する';
end
$$;

-- =============================================================================
-- TEST 5: 同意の記録は本人でも追加・書き換え・削除・TRUNCATEできない
-- =============================================================================
do $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', true);

  begin
    insert into ai_coach_consent_events (user_id, action, consent_version)
    values ('33333333-3333-3333-3333-333333333333', 'granted', 'forged');
    raise exception 'FAIL: 本人が同意の記録を直接追加できてしまった';
  exception
    when insufficient_privilege then
      null;
  end;

  begin
    insert into ai_coach_consent_events (user_id, action, consent_version)
    values ('44444444-4444-4444-4444-444444444444', 'granted', 'forged');
    raise exception 'FAIL: 他人のuser_idで同意の記録を追加できてしまった';
  exception
    when insufficient_privilege then
      null;
  end;

  begin
    update ai_coach_consent_events set action = 'revoked'
    where user_id = '33333333-3333-3333-3333-333333333333';
    raise exception 'FAIL: 同意の記録を書き換えできてしまった';
  exception
    when insufficient_privilege then
      null;
  end;

  begin
    delete from ai_coach_consent_events
    where user_id = '33333333-3333-3333-3333-333333333333';
    raise exception 'FAIL: 同意の記録を削除できてしまった';
  exception
    when insufficient_privilege then
      null;
  end;

  begin
    truncate ai_coach_consent_events;
    raise exception 'FAIL: 同意の記録をTRUNCATEできてしまった';
  exception
    when insufficient_privilege then
      null;
  end;

  perform set_config('role', 'none', true);

  assert (
    select count(*) from ai_coach_consent_events
    where user_id in ('33333333-3333-3333-3333-333333333333', '44444444-4444-4444-4444-444444444444')
  ) = 2, 'FAIL: 不正な操作で同意の記録の件数が変わった';

  raise notice 'PASS: 同意の記録は追加・書き換え・削除・TRUNCATEできない';
end
$$;

-- =============================================================================
-- TEST 6: 利用者は同意の2列を直接変更できない(関数を経由しない偽装の防止)
-- =============================================================================
do $$
declare
  v_before profiles%rowtype;
  v_after profiles%rowtype;
begin
  select * into v_before from profiles where id = '44444444-4444-4444-4444-444444444444';

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', '44444444-4444-4444-4444-444444444444', true);

  begin
    update profiles
    set ai_coach_consented_at = '2020-01-01', ai_coach_consent_version = 'test-v1'
    where id = (select auth.uid());
    raise exception 'FAIL: 本人が同意の2列を直接書き換えて同意済みにできてしまった';
  exception
    when insufficient_privilege then
      null;
  end;

  begin
    update profiles set ai_coach_consent_version = 'forged'
    where id = (select auth.uid());
    raise exception 'FAIL: 本人が説明文の版だけを直接書き換えできてしまった';
  exception
    when insufficient_privilege then
      null;
  end;

  -- 行を削除して、同意済みの値を入れて作り直すことによる偽装もできない
  begin
    delete from profiles where id = (select auth.uid());
    insert into profiles (id, ai_coach_consented_at, ai_coach_consent_version)
    values ((select auth.uid()), '2020-01-01', 'test-v1');
    raise exception 'FAIL: 同意済みの値を入れてprofiles行を作成できてしまった';
  exception
    when insufficient_privilege then
      null;
  end;

  perform set_config('role', 'none', true);

  select * into v_after from profiles where id = '44444444-4444-4444-4444-444444444444';
  assert v_after.ai_coach_consented_at is not distinct from v_before.ai_coach_consented_at
     and v_after.ai_coach_consent_version is not distinct from v_before.ai_coach_consent_version,
    'FAIL: 拒否された直接変更で同意状態が変わってしまった';

  raise notice 'PASS: 利用者は同意の2列を直接変更・偽装できない(INSERT/UPDATEとも)';
end
$$;

-- =============================================================================
-- TEST 7: 既存のプロフィール更新(同意の2列以外)はこれまでどおりできる
-- =============================================================================
do $$
declare
  v_count integer;
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', true);

  -- 表示名・アイコン(profile-actions.ts)、通知設定(notification-actions.ts)、
  -- AIコーチ(coach-character-actions.ts)と同じ形の更新
  update profiles set display_name = '新しい表示名', avatar_url = 'rocket'
  where id = (select auth.uid());
  get diagnostics v_count = row_count;
  assert v_count = 1, 'FAIL: 表示名・アイコンを更新できない';

  update profiles set notifications_enabled = true, notification_time = '08:30:00'
  where id = (select auth.uid());
  update profiles set coach_character = 'leo' where id = (select auth.uid());

  -- 同意の2列を「同じ値のまま」含めた更新(行全体の書き戻し)も妨げない
  update profiles
  set display_name = '表示名2',
      ai_coach_consented_at = ai_coach_consented_at,
      ai_coach_consent_version = ai_coach_consent_version
  where id = (select auth.uid());
  get diagnostics v_count = row_count;
  assert v_count = 1, 'FAIL: 同意の2列を変えない更新が拒否された';

  -- ログイン時のensureProfileExists(upsert + ignoreDuplicates)と同じ形
  insert into profiles (id) values ((select auth.uid())) on conflict (id) do nothing;

  perform set_config('role', 'none', true);

  assert (
    select display_name = '表示名2' and notifications_enabled and coach_character = 'leo'
      and ai_coach_consent_version = 'test-v1'
    from profiles where id = '33333333-3333-3333-3333-333333333333'
  ), 'FAIL: 既存のプロフィール更新の結果が正しくない、または同意状態が変わった';

  raise notice 'PASS: 既存のプロフィール更新・作成はこれまでどおりでき、同意状態は維持される';
end
$$;

-- =============================================================================
-- TEST 8: 取り消すと状態がNULLに戻り、記録(revoked)が追記される
-- =============================================================================
do $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', true);

  perform set_ai_coach_consent(false, null);

  assert (
    select ai_coach_consented_at is null and ai_coach_consent_version is null
    from profiles where id = '33333333-3333-3333-3333-333333333333'
  ), 'FAIL: 取り消し後も同意状態が残っている';
  assert (
    select string_agg(action, ',' order by created_at) from ai_coach_consent_events
    where user_id = '33333333-3333-3333-3333-333333333333'
  ) = 'granted,revoked', 'FAIL: 同意・取り消しの記録が順に残っていない';

  -- 取り消し後に再同意できる
  perform set_ai_coach_consent(true, 'test-v2');
  assert (
    select ai_coach_consent_version = 'test-v2' from profiles
    where id = '33333333-3333-3333-3333-333333333333'
  ), 'FAIL: 取り消し後に再同意できない';
  perform set_ai_coach_consent(false, null);

  perform set_config('role', 'none', true);
  raise notice 'PASS: 取り消すと状態がNULLに戻り記録(revoked)が追記され、再同意もできる';
end
$$;

-- =============================================================================
-- TEST 9: 不正な呼び出しは拒否され、状態も記録も変わらない
-- =============================================================================
do $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', true);

  begin
    perform set_ai_coach_consent(true, null);
    raise exception 'FAIL: 版を指定せずに同意できてしまった';
  exception
    when invalid_parameter_value then
      null;
  end;

  begin
    perform set_ai_coach_consent(true, '   ');
    raise exception 'FAIL: 空白の版で同意できてしまった';
  exception
    when invalid_parameter_value then
      null;
  end;

  begin
    perform set_ai_coach_consent(null, 'test-v1');
    raise exception 'FAIL: p_granted=NULLで呼び出せてしまった';
  exception
    when null_value_not_allowed then
      null;
  end;

  perform set_config('role', 'none', true);

  assert (
    select ai_coach_consented_at is null from profiles
    where id = '33333333-3333-3333-3333-333333333333'
  ), 'FAIL: 不正な呼び出しで同意状態が変わってしまった';
  assert (
    select count(*) from ai_coach_consent_events
    where user_id = '33333333-3333-3333-3333-333333333333'
  ) = 4, 'FAIL: 不正な呼び出しで記録が追加されてしまった';

  raise notice 'PASS: 版の無い同意・NULLの指定は拒否される';
end
$$;

-- =============================================================================
-- TEST 10: 未ログイン(auth.uid()がNULL)・anonでは同意できず、記録も参照できない
-- =============================================================================
do $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', '', true);
  begin
    perform set_ai_coach_consent(true, 'test-v1');
    raise exception 'FAIL: auth.uid()がNULLでも同意できてしまった';
  exception
    when insufficient_privilege then
      null;
  end;

  perform set_config('role', 'anon', true);
  begin
    perform set_ai_coach_consent(true, 'test-v1');
    raise exception 'FAIL: anonで同意の関数を実行できてしまった';
  exception
    when insufficient_privilege then
      null;
  end;
  begin
    perform count(*) from ai_coach_consent_events;
    raise exception 'FAIL: anonで同意の記録を参照できてしまった';
  exception
    when insufficient_privilege then
      null;
  end;

  perform set_config('role', 'none', true);
  raise notice 'PASS: 未ログイン・anonでは同意できず、記録も参照できない';
end
$$;

-- =============================================================================
-- TEST 11: 管理用ロール(service_role)からの変更は妨げない(存在する環境のみ)
-- =============================================================================
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'service_role')
     or not has_table_privilege('service_role', 'public.profiles', 'UPDATE') then
    raise notice 'SKIP: service_roleが無い(またはprofilesの更新権限が無い)環境のため、管理用ロールのテストは省略';
    return;
  end if;

  perform set_config('role', 'service_role', true);
  update profiles
  set ai_coach_consented_at = '2026-01-01', ai_coach_consent_version = 'admin-set'
  where id = '44444444-4444-4444-4444-444444444444';
  update profiles
  set ai_coach_consented_at = null, ai_coach_consent_version = null
  where id = '44444444-4444-4444-4444-444444444444';
  perform set_config('role', 'none', true);

  raise notice 'PASS: service_roleからの同意の列の変更は妨げられない';
end
$$;

-- =============================================================================
-- TEST 12: 片方の列だけの状態にはできない(CHECK制約。トリガー対象外のロールでも)
-- =============================================================================
do $$
begin
  begin
    update profiles set ai_coach_consented_at = now()
    where id = '33333333-3333-3333-3333-333333333333';
    raise exception 'FAIL: 版なしで同意日時だけを保存できてしまった';
  exception
    when check_violation then
      null;
  end;
  raise notice 'PASS: 同意日時と版は片方だけの状態にできない';
end
$$;

-- =============================================================================
-- TEST 13: アカウント削除(auth.usersの削除)で同意の記録も消える
-- =============================================================================
delete from auth.users where email in ('consent-a@test.local', 'consent-b@test.local');

do $$
begin
  assert (
    select count(*) from ai_coach_consent_events
    where user_id in ('33333333-3333-3333-3333-333333333333', '44444444-4444-4444-4444-444444444444')
  ) = 0, 'FAIL: アカウント削除後も同意の記録が残っている';
  raise notice 'PASS: アカウント削除で同意の記録も削除される';
end
$$;

-- =============================================================================
-- 完了
-- =============================================================================
do $$
begin
  raise notice '=================================================';
  raise notice 'ALL AI COACH CONSENT TESTS PASSED';
  raise notice '=================================================';
end
$$;
