# 起業しよ。 引き継ぎ資料（HANDOVER）

最終更新: 2026-11-03（main: `e46a06b`）
（初版: 2026-11-02、main: `3853930`）
この資料は、ほかのAIや開発者が開発を引き継ぐための現状まとめです。
秘密情報（APIキー・パスワード・IDの値）は書いていません。値は各サービスの管理画面で確認してください。

---

## 1. 概要

- アプリ名: 起業しよ。（起業・事業づくりを支援するアプリ）
- リポジトリ: https://github.com/kigyomen/axen.os（**公開リポジトリ**。秘密情報を絶対にコミットしないこと）
- Web版（本番）: https://kigyoshiyo.vercel.app（Vercel）
- iPhone/Androidアプリ: Capacitor で上記の本番URLを表示するラッパー（`mobile/`）
  - アプリは毎回 Vercel の本番を読み込む（`mobile/capacitor.config.ts` の `server.url`）
  - **Web側（`src/`）の変更は、Vercel に反映された時点でインストール済みアプリにも反映される**
  - `mobile/capacitor.config.ts` や Codemagic・Android の設定の変更は、**アプリの再ビルドが必要**
- バンドルID / アプリID: `com.kigyoshiyo.app`

### 技術スタック
| 項目 | 内容 |
|---|---|
| Web | Next.js 16.3.3（App Router、`src/proxy.ts` で認証リダイレクト）、React 19.2.8、Tailwind CSS 4 |
| DB・認証 | Supabase（`@supabase/ssr`、`@supabase/supabase-js`）、RLS |
| AI | Anthropic Claude API（`@anthropic-ai/sdk` ^0.122.0） |
| モバイル | Capacitor 8.5.1（iOS / Android）、`@capacitor-community/admob` 8.1.0、local-notifications、share、filesystem、app、splash-screen |
| iOSビルド | Codemagic（`codemagic.yaml`） |
| Androidビルド | GitHub Actions（`.github/workflows/android-build.yml`） |
| Node.js | 22 |

> 注意: このNext.jsはバージョンが新しく、従来と書き方が違う部分がある（`AGENTS.md` 参照）。コードを書く前に `node_modules/next/dist/docs/` を確認すること。

---

## 2. 実装済みの機能

| 画面・機能 | 主なファイル |
|---|---|
| 新規登録・ログイン・ログアウト・パスワード再設定・メール確認 | `src/app/{signup,login,reset-password,update-password}`, `src/app/auth/confirm/route.ts`, `src/lib/supabase/actions.ts` |
| 初回ヒアリング（人生の目標）・事業作成オンボーディング | `src/app/welcome`, `src/app/onboarding` |
| ダッシュボード | `src/app/(main)/page.tsx` |
| 事業の切り替え・一覧・削除 | `src/app/(main)/businesses`, `src/components/layout/BusinessSwitcher.tsx` |
| アイデア管理 | `src/app/(main)/ideas` |
| タスク管理（期限・優先度・カテゴリ） | `src/app/(main)/tasks` |
| お金の記録（売上・経費）、CSV書き出し | `src/app/(main)/finance`, `src/app/api/finance/export/route.ts` |
| 目標管理 | `src/app/(main)/goals` |
| スタートガイド | `src/app/(main)/start-guide` |
| AI Coach（ストリーミング応答、タスク・目標・アイデアの提案、キャラクター選択） | `src/app/(main)/coach`, `src/app/api/coach/route.ts`, `src/lib/coach/*` |
| AI Coach の外部AI送信への同意（同意・取り消し・版管理） | `src/lib/coach/consent.ts`, `src/lib/supabase/coach-consent-actions.ts`, migration 007 |
| 設定（プロフィール、テーマ、通知、パスワード変更、ログアウト、アカウント削除） | `src/app/(main)/settings` |
| ローカル通知（タスク・目標の期限。最大64件） | `src/lib/capacitor/notifications.ts`, `src/components/capacitor/NotificationScheduler.tsx` |
| 広告（設定画面のバナーのみ） | `src/lib/capacitor/admob.ts`, `src/components/capacitor/AdBanner.tsx` |
| AdMob 診断表示（一時的。iOS かつ `NEXT_PUBLIC_ADMOB_DEBUG=1` のときだけ。12章参照） | `src/components/capacitor/AdBanner.tsx`, `src/lib/capacitor/admob.ts` |
| iOS 入力欄の自動ズーム対策（入力欄を16px） | ログイン: `src/components/auth/LoginForm.tsx`（main に反映済み）。新規登録・パスワード再設定・パスワード変更は PR #15（未マージ） |
| プライバシーポリシー・サポート | `src/app/privacy`, `src/app/support` |
| iOS対応: Safe Area、横向き時のSidebar固定、ピンチ操作の許可、iPhone専用 | `src/app/globals.css`, `Sidebar.tsx`, `mobile/capacitor.config.ts`, `codemagic.yaml` |

---

## 3. 環境変数（名前のみ。値は各管理画面で確認）

### Vercel（Production）
| 変数名 | 用途 | 備考 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase の URL | ブラウザに公開される |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase の anon キー | ブラウザに公開される（RLSで保護） |
| `SUPABASE_SERVICE_ROLE_KEY` | アカウント削除（`auth.admin.deleteUser`）専用 | **秘密**。`src/lib/supabase/admin.ts`（server-only）からのみ使用 |
| `ANTHROPIC_API_KEY` | AI Coach | **秘密**。サーバー側のみ |
| `NEXT_PUBLIC_ADMOB_BANNER_AD_UNIT_ID` | Android のバナー広告ユニットID | 未設定ならGoogleのテスト用ID |
| `NEXT_PUBLIC_ADMOB_IOS_BANNER_AD_UNIT_ID` | iOS のバナー広告ユニットID | 未設定ならGoogleのテスト用ID |
| `COACH_MOCK_MODE` | 開発用の偽AI | `NODE_ENV=development` のときだけ有効。本番では設定不要 |
| `NEXT_PUBLIC_ADMOB_DEBUG` | AdMob 診断表示（一時的） | `"1"` のときだけ、iOS アプリの設定画面に広告の読み込み結果を表示。**通常・審査時は未設定にする**（12章参照） |

- `NEXT_PUBLIC_*` は**ビルド時に埋め込まれる**。値を変えたら Vercel で Redeploy が必要。
- 調査用だった `NEXT_PUBLIC_VIEWPORT_DEBUG` は、コードからは削除済み（PR #12）。Vercel に残っていれば削除してよい。

### Codemagic
| 場所 | 名前 | 用途 |
|---|---|---|
| 環境変数グループ | `ios_admob_config` / 変数 `ADMOB_IOS_APP_ID` | iOS の AdMob App ID（Info.plist の `GADApplicationIdentifier` に書き込まれる） |
| Team integrations > Developer Portal > Manage keys | `Kigyoshiyo Apple Developer` | App Store Connect APIキー（`codemagic.yaml` の `integrations.app_store_connect`） |
| Code signing identities | — | App Store 配布用の証明書とプロビジョニングプロファイル（`com.kigyoshiyo.app`） |

### GitHub（Repository Secrets。Android用）
`ADMOB_APP_ID`, `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`

---

## 4. デプロイ・ビルドの方法

### Web（Vercel）
- `main` にマージすると Vercel の本番に反映される（PRごとに Preview も作られる）。
- 環境変数を変えたときは、Vercel で Redeploy する。

### iOS（Codemagic）
- ワークフロー `ios-app-store-release`（手動実行）: 署名付きIPAを作り、App Store Connect にアップロード（TestFlight 外部テストや審査提出は自動では行わない）。
  1. `ADMOB_IOS_APP_ID` の確認（空・形式違い・テスト用IDなら停止）
  2. `npm ci`（`mobile/`）
  3. `npx cap add ios --packagemanager CocoaPods`（**iOSプロジェクトは毎回ここで生成。リポジトリには無い**）
  4. iPhone専用化（`TARGETED_DEVICE_FAMILY = 1` に書き換え）
  5. アイコン・起動画面の反映
  6. Info.plist に `GADApplicationIdentifier` と SKAdNetwork を書き込み
  7. ビルド番号 = App Store Connect の最新 + 1
  8. `pod install` → 署名 → IPA 作成 → アップロード
- ワークフロー `ios-simulator-verify`: 署名なしのシミュレーター用ビルド（動作確認用）。
- iOSプロジェクトの設定を変えたいときは、`mobile/ios` を直接編集せず、`codemagic.yaml` の `cap add ios` の後の手順で書き換える。

### Android（GitHub Actions）
- `.github/workflows/android-build.yml`: `mobile/**` や `src/app/**` などへの push、または手動で、Debug APK と（署名用Secretsがあれば）Release AAB をビルド。
- `.github/workflows/generate-release-keystore.yml`: keystore 生成用の使い捨てワークフロー（手動のみ）。

### ローカルでの確認
```bash
npm ci
npm run lint
npx tsc --noEmit
NEXT_PUBLIC_SUPABASE_URL=... NEXT_PUBLIC_SUPABASE_ANON_KEY=... npm run build
node --test src/lib/coach/consent.test.mjs src/lib/capacitor/notifications.test.mjs
node --import ./src/test-support/register-alias.mjs --experimental-test-module-mocks --test src/app/api/coach/route.test.mjs
```
- 2026-11-02 時点: lint・型チェック・build 成功、テスト 19件すべて成功。
- 2026-11-03 時点（main `e46a06b`）: lint・型チェック・build 成功、テスト 19件すべて成功。
- APIテストは Node.js 22.15 以降が必要（試験的機能を使用）。
- Web のテスト・lint は CI では自動実行されていない（Android ビルドのみ）。

### 今後の開発環境と作業の進め方
- 必要なもの: Node.js 22.15 以降、npm。iOS のビルドは Codemagic（Mac が無くてよい）、Android は GitHub Actions。
- 初回の準備:
  1. `npm ci`（リポジトリのルート）
  2. `.env.example` をコピーして `.env.local` を作り、値を入れる（値は Vercel・Supabase・Anthropic の管理画面で確認。**`.env.local` はコミットしない**）
  3. `npm run dev` で http://localhost:3000 を開く
- アプリ（`mobile/`）の設定を確認するときは `cd mobile && npm ci` の後、`npx cap config --json` で読み込まれる設定を表示できる。
- 作業の流れ（これまでの運用）:
  1. 最新の `main` から作業ブランチを作る（`main` へ直接 push しない）
  2. 変更は必要最小限にし、`git add .` ではなくファイルを指定してステージングする
  3. 上の「ローカルでの確認」をすべて実行する
  4. push して PR を作成し、内容を確認してからマージする
- 反映のされ方:
  - `src/` などWeb側の変更 → `main` にマージすると Vercel の本番に反映され、インストール済みのアプリにもそのまま反映される（アプリの再ビルド不要）
  - `mobile/capacitor.config.ts`・`codemagic.yaml` → Codemagic で `ios-app-store-release` を実行し、TestFlight に配布し直す
  - Android の設定 → GitHub Actions でビルドし直す

---

## 5. Supabase

### テーブル（すべて RLS 有効）
`profiles`, `businesses`, `business_ideas`, `tasks`, `sales`, `expenses`, `goals`, `coach_messages`, `ai_coach_consent_events`

### マイグレーション（`supabase/migrations/`。Supabase の SQL Editor で手動適用する運用）
| ファイル | 内容 | 本番への適用 |
|---|---|---|
| 001_initial_schema | 初期スキーマ・RLS | 適用済み（アプリが動作しているため） |
| 002_onboarding_profile | オンボーディング用のプロフィール項目 | 適用済みと推定 |
| 003_task_category_freetext | タスクのカテゴリ自由入力 | 適用済みと推定 |
| 004_onboarding_business_focus | 事業オンボーディング | 適用済みと推定 |
| 005_notification_preferences | `profiles.notifications_enabled` / `notification_time` | **未確認**（2026-10-25 時点では未適用だった） |
| 006_coach_character | AI Coach のキャラクター | 適用済みと推定 |
| 007_ai_coach_consent | AI Coach 同意（列・記録テーブル・関数・保護トリガー） | 適用済み（確認済み） |

- 005 が未適用だと、通知設定の保存ができない。確認用の読み取り専用SQLで状態を確認してから適用すること。
- **005 の確認事項（公開前に必ず確認）**
  - Supabase の SQL Editor で、読み取り専用（SELECT のみ）のSQLで次を確認する:
    1. `public.profiles` に `notifications_enabled`（boolean、NOT NULL、既定値 false）があるか
    2. `public.profiles` に `notification_time`（time without time zone、NOT NULL、既定値 '09:00:00'）があるか
    3. `profiles` に本人が更新できるポリシー（`profiles_update_own`）があるか
    4. `authenticated` ロールが上の2列を UPDATE できるか
  - 確認例（`information_schema.columns` を見るだけ。データは変更しない）:
    ```sql
    select column_name, data_type, is_nullable, column_default
    from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles'
      and column_name in ('notifications_enabled', 'notification_time');
    ```
    2行返れば適用済み、0行なら未適用。
  - 未適用の場合: バックアップを取ってから、`supabase/migrations/005_notification_preferences.sql` を SQL Editor で実行する（列を2つ追加するだけで、既存の行には既定値が入る）。適用後に上のSQLで再確認する。
  - 未適用のまま公開すると、審査の担当者が設定画面で通知設定を保存したときにエラーになる。
- テスト用SQL: `supabase/tests/001_rls.sql`, `supabase/tests/002_ai_coach_consent.sql`（使い捨てのDBで実行）。
- 本番DBに適用する前に、必ずバックアップを取ること（Free プランはダウンロード可能なバックアップが無いため、`supabase db dump` などで取得）。

---

## 6. Anthropic API（AI Coach）

- 呼び出し: `src/app/api/coach/route.ts`（Route Handler）→ `src/lib/coach/provider.ts`
- モデル: `claude-sonnet-5`（`src/lib/anthropic/client.ts` の `COACH_MODEL`）。有効なモデルID。より新しい `claude-sonnet-5-5` もある（切り替える場合は動作確認が必要）。
- ストリーミング応答、`max_tokens: 3072`、`propose_actions` ツールでタスク・目標・アイデアを提案
- 会話履歴は直近30件、1事業あたり1日20メッセージまで
- 送信前に必ず同意（`profiles.ai_coach_consented_at` と版）をDBで確認し、未同意なら403（保存も Claude 呼び出しもしない）。自動テストあり。
- 送信するデータの一覧は `src/lib/coach/consent.ts` の `AI_COACH_SENT_DATA_ITEMS`。送信内容を変えたら `AI_COACH_CONSENT_VERSION` を上げる（全員が再同意になる）。
- APIキーはサーバー側のみ（`server-only`）。
- **Anthropic の Spend limit（使用金額の上限）を設定すること（公開前）**
  - 1日20メッセージの上限は「事業ごと」に、`coach_messages` の本人のメッセージ数で数えている。RLS で本人は自分のメッセージを削除・変更でき、事業の数にも上限が無いため、Supabase を直接操作すれば上限を超えて利用できる。
  - 費用が想定外に増えるのを防ぐため、Anthropic の管理画面（Console）で、組織またはワークスペースの使用金額の上限を設定する（コードの変更は不要）。
  - 根本対策（公開後でよい）: 利用者が書き換えられない別の表・関数で利用回数を数える。

---

## 7. セキュリティ上の注意

- リポジトリは公開。`.env*` は `.env.example` 以外コミットしない。
- `SUPABASE_SERVICE_ROLE_KEY` は RLS を無視できるため、`src/lib/supabase/admin.ts`（server-only）からのみ使う。現在はアカウント削除（本人のID）だけで使用。
- `NEXT_PUBLIC_*` はブラウザから見える。秘密の値を入れない。
- データのアクセス制御は RLS が前提。新しいテーブルには必ず RLS とポリシーを付ける。
- AI Coach 同意の列は、ログインユーザーが直接書き換えられないよう保護トリガーがある（変更は `set_ai_coach_consent()` 経由のみ）。
- 輸出コンプライアンス: アプリ独自の暗号化は無く、iOS 標準の HTTPS/TLS のみ（Capacitor が識別ID生成に SHA-256 を使う程度）。`ITSAppUsesNonExemptEncryption` は未設定。

---

## 8. 既知の不具合・未解決事項

1. **iOS の AdMob バナーが表示されない**（原因未確定）
   - コード・Codemagic の流れに問題は見つかっていない。AdMob 側の配信状況（新規アプリ・未公開アプリ）や、IDの組み合わせ違いの可能性。
   - 確認: 本番の JS に入っている広告ユニットID（ブラウザの開発者ツールで `ca-app-pub-` を検索）、AdMob 管理画面の iOS アプリの App ID と広告ユニット、Codemagic の `ADMOB_IOS_APP_ID`（Android の App ID を入れていないか）。
   - それでも不明なら、`AdMob` の `FailedToLoad` イベントの理由を一時的に画面表示する仕組みを追加して確認する。
   - **2026-11-03 更新**: 上記の診断表示を追加した（PR #17。12章）。TestFlight で確認した結果:
     - `bannerAdFailedToLoad` / `code=0` / `Request Error: No ad to show.`
     - `code=0` は AdMob の本当のエラー番号ではない。`@capacitor-community/admob` の iOS 実装が、失敗時に常に `code: 0` を送る作りのため（`ios/Sources/AdMobPlugin/Banner/BannerExecutor.swift`）。理由は `message` の方で判断する。
     - `No ad to show` は「広告リクエストは届いたが、配信できる広告が無い（no fill）」という意味で、App ID・広告ユニットIDの形式やアプリのコードの誤りを示すものではない。
     - AdMob 管理画面で、iOS アプリのステータスが **「要審査」** になっている。AdMob のアプリ審査が終わるまでは広告の配信が制限されるため、`No ad to show` はこの状態と合っている。
     - 対応: App Store で公開した後、AdMob 管理画面で iOS アプリを App Store の掲載情報にリンクし、AdMob の審査が終わるのを待つ。審査後も表示されない場合は、診断表示で再確認する。
     - 広告が表示されないこと自体は、App Store の審査で問題になるものではない。
2. **ログイン後に画面が約1.144倍に拡大される問題**: ログイン画面の入力欄を16pxにした（PR #11）。**実機での再確認が未完了**。新規登録・パスワード再設定など他の入力欄は14pxのまま（同じ現象が起きる可能性）。
   - **2026-11-03 更新**: 新規登録（3つ）・パスワード再設定（メール送信1つ、新しいパスワード2つ）・設定画面のパスワード変更（2つ）の入力欄を、`text-sm`（14px）→ `text-base/5`（16px、行の高さ20pxのまま）にする PR #15 を作成済み。**PR #15 は未マージ**（main の上記の画面は 14px のまま）。公開前にマージすること。
3. 設定画面をすぐ離れると、広告の読み込み完了後にバナーが他の画面に残る可能性（`removeBanner` の後に広告が届くケース）。
4. Android（WebView 140以降）で、画面端まで表示が広がるため、広告と下のメニューが重なる可能性（3ボタンナビゲーション端末）。
5. iOS でキーボード表示中、AI Coach の入力欄がホームバー分（約34px）上に表示される可能性。
6. 005 マイグレーションの本番適用状況が未確認（上記5章）。
7. README の記述の一部が古い:
   - Android の `ADMOB_APP_ID` を「ワークフローがまだ渡していない」とあるが、現在は渡している（`android-build.yml` 126行目）。
   - 公開前チェックリストがすべて未チェックのまま（実際には完了済みの項目がある）。
   - **2026-11-03 更新: 解決済み**（PR #16 で、上記2点と冒頭のアプリ名・実装状況の記述を修正）。
8. 不要になったブランチ: `origin/claude/axen-os-brand-dashboard-bs9ozi`（内容は別のコミットで main に反映済み）、マージ済みの `claude/*` ブランチ。削除してよい。
9. AI Coach の1日の上限（事業ごとに20メッセージ）は、本人が自分のメッセージを削除・変更したり、事業を増やしたりすると超えられる（6章）。公開前に Anthropic の Spend limit を設定する。
10. アプリは起動のたびに本番の Web を読み込むが、通信できないときの代わりの画面（Capacitor の `server.errorPath`）は設定していない。圏外・機内モードで起動したときの表示を実機で確認すること。
11. アプリのバージョン（`MARKETING_VERSION`）は、`cap add ios` のひな形の `1.0` のまま。Codemagic はビルド番号だけを自動で増やす。2回目以降のアップデートでは、バージョンを上げる手順が必要。
12. メールの確認リンク・パスワード再設定リンクは、アプリではなく Safari で開く（アプリへのリンクの設定は無い）。手続き後にアプリでログインし直す流れになる。

---

## 9. App Store 公開に向けた残作業

- [ ] Codemagic で `ios-app-store-release` を実行（iPhone専用化後の最新 main で）し、TestFlight で実機確認
  - 起動・ログイン・ログアウト→再ログイン（拡大されないこと）・ピンチ操作・AI Coach（同意→送信→取り消し→拒否）・通知・共有・設定画面の広告・縦横の表示・Safe Area
- [ ] App Store Connect: 新しいビルドが iPhone のみ対応になっていること
- [ ] iPhone 用スクリーンショット
- [ ] 審査用デモアカウント、審査メモ（ネイティブ機能の説明）
- [ ] プライバシーポリシー URL・サポート URL の登録、「Appのプライバシー」の申告（AdMob・Anthropic・Supabase・Vercel を含める）
- [ ] 輸出コンプライアンスの回答（iOS 標準の暗号化のみ。必要なら `ITSAppUsesNonExemptEncryption = NO` を Codemagic で Info.plist に書き込む手順を追加）
- [ ] AdMob の広告表示の確認（8章の1）
- [ ] Supabase の 005 の確認・適用

### 2026-11-03 時点の残作業（優先順）
**公開前に必ず行う**
- [ ] PR #15（新規登録・パスワード再設定・パスワード変更の入力欄を16px）をマージする
- [ ] Supabase の 005 を確認し、未適用なら適用する（5章の確認事項）
- [ ] Anthropic の Spend limit を設定する（6章）
- [ ] Vercel の `NEXT_PUBLIC_ADMOB_DEBUG` を削除して Redeploy する（診断表示を審査で出さないため。12章）。古い `NEXT_PUBLIC_VIEWPORT_DEBUG` が残っていれば一緒に削除してよい
- [ ] 最新の main で Codemagic の `ios-app-store-release` を実行し、TestFlight で下の項目を確認する

**TestFlight で確認する項目**
- [ ] 起動・新規登録・ログイン・ログアウト → 再ログイン（画面が拡大されないこと）
- [ ] 新規登録・パスワード再設定・パスワード変更の入力欄をタップしても拡大されないこと（PR #15 のマージ後）
- [ ] 2本指での拡大・縮小ができること
- [ ] ノッチ・ステータスバーと重ならないこと（縦向き・横向き）、横向きで左のメニューが固定されること
- [ ] AI Coach: 同意 → 送信 → 設定画面で取り消し → 送信が拒否されること
- [ ] 通知の設定の保存（005 の確認後）と、期限の通知が届くこと
- [ ] 共有（CSV書き出しなど）
- [ ] 設定画面の広告（現在は `No ad to show` のため表示されなくてよい。クラッシュしないこと）
- [ ] 圏外・機内モードで起動したときの表示（8章の10）
- [ ] App Store Connect で、ビルドが iPhone のみの対応になっていること

**App Store Connect の作業**
- [ ] iPhone 用スクリーンショット
- [ ] 審査用デモアカウント（メール確認・初期設定・AI Coach の同意まで済ませておくと審査がスムーズ）
- [ ] 審査メモ（Web の表示だけでなく、ローカル通知・共有などのネイティブ機能があること。ガイドライン4.2対策）
- [ ] プライバシーポリシー URL・サポート URL の登録、「Appのプライバシー」の申告（Google AdMob が集めるデータを含める）
- [ ] 年齢制限の質問への回答（AI チャット機能を含む）
- [ ] 輸出コンプライアンスの回答

**公開後**
- [ ] AdMob 管理画面で iOS アプリを App Store の掲載情報にリンクし、AdMob の審査（「要審査」）が終わるのを待つ
- [ ] 広告の表示を確認できたら、診断表示（PR #17）のコードを削除する

---

## 10. 今後の開発のおすすめ

- Web の lint・型チェック・テストを GitHub Actions で自動実行する。
- 入力欄の文字サイズを、iPhone では全画面で16px以上にそろえる（自動拡大の防止）。
- AdMob の読み込み失敗を記録する仕組み（調査しやすくするため）。
- AI のモデルを新しいもの（例: `claude-sonnet-5-5`）に上げる場合は、応答・ツール提案・費用を確認してから。
- 本番DBへのマイグレーションの適用手順と記録を残す（どれを適用したか分かるように）。

---

## 11. これまでの主なPR（2026年10〜11月）

| PR | 内容 |
|---|---|
| #1 | AI Coach 同意機能、Codemagic iOS、AdMob iOS、プライバシーポリシー |
| #2 | iOS ローカル通知の改善（64件上限、文言、前面表示） |
| #3, #4 | 同意判定の単体テスト、AI Coach API の自動テスト |
| #5, #6 | Codemagic の AdMob 変数グループ名・App Store Connect キー名の修正 |
| #7 | iOS Safe Area 対応 |
| #8 | 横向き時の Sidebar 固定 |
| #9 | iOS のピンチ操作を許可（`ios.zoomEnabled: true`） |
| #10, #12 | 調査用の表示（追加→削除） |
| #11 | ログイン入力欄を16pxに（iOS の自動拡大対策） |
| #13 | iPhone 専用化 |
| #14 | HANDOVER.md（この資料）を追加 — **マージ済み** |
| #15 | 新規登録・パスワード再設定（2画面）・パスワード変更の入力欄を16pxに（iOS の自動拡大対策。4ファイル・8か所） — **未マージ（公開前にマージが必要）** |
| #16 | README.md の古い記述を修正（アプリ名・実装状況、Android の `ADMOB_APP_ID`、公開前チェックリスト） — **マージ済み** |
| #17 | iOS の AdMob 診断表示を追加（一時的。12章） — **マージ済み** |

---

## 12. AdMob 診断機能（一時的。PR #17）

iOS で広告が表示されない原因を調べるため、広告の読み込み結果を画面に表示する仕組み。原因の調査が終わったら削除する。

### 仕組み
- `src/components/capacitor/AdBanner.tsx`
  - 次の**両方**を満たすときだけ動く: iOS アプリ（`Capacitor.getPlatform() === "ios"`）であること、ビルド時の環境変数 `NEXT_PUBLIC_ADMOB_DEBUG` が `"1"` であること。
  - 広告の部品の通知 `bannerAdLoaded`（成功）・`bannerAdFailedToLoad`（失敗。`code` と `message`）・`bannerAdSizeChanged`（大きさ）を受け取り、設定画面の上部に時刻付きで表示する。
  - 15秒たっても成功・失敗のどちらも届かないときは、その旨を表示する。
  - 表示する文字の中の `ca-app-pub-…`（広告ID）は `ca-app-pub-***` に伏せる。
- `src/lib/capacitor/admob.ts`
  - `showSettingsBannerAd(onDebug?)` が、初期化・`showBanner` の呼び出しと完了・エラーを診断表示に渡す。渡すのは `isTesting` と「本番の広告ユニットIDが設定されているか」だけで、広告IDそのものは渡さない。
- 条件を満たさないとき（通常の状態・Android・Web版）は、以前とまったく同じ処理（表示なし）。

### `NEXT_PUBLIC_ADMOB_DEBUG` の設定方法
1. Vercel の Settings → Environment Variables で、Production に `NEXT_PUBLIC_ADMOB_DEBUG` = `1` を追加する。
2. Deployments から本番を Redeploy する（`NEXT_PUBLIC_*` はビルド時に埋め込まれるため。アプリの再ビルドは不要）。
3. TestFlight のアプリで設定画面を開き、15秒ほど待って表示を確認する。
4. **確認が終わったら必ず `NEXT_PUBLIC_ADMOB_DEBUG` を削除して Redeploy する**（審査の担当者や利用者に診断の文字を見せないため）。

### 表示の見方
| 表示 | 意味 |
|---|---|
| `結果: 読み込み成功(bannerAdLoaded)` | 広告が届いて表示された |
| `結果: 読み込み失敗(bannerAdFailedToLoad) code=0 message=Request Error: No ad to show.` | 配信できる広告が無い（no fill）。設定の誤りではない。AdMob の審査前・作成直後のアプリでよく起きる。**2026-11-03 時点の実機の結果はこれ** |
| `message` に invalid request・ad unit などの言葉 | App ID と広告ユニットIDの組み合わせや値を確認する |
| `エラー: …` や `15秒たっても…` | アプリが広告の表示処理まで進めていない |

- iOS では `code` は常に `0`（8章の1を参照）。理由は `message` で判断する。

### 削除方法
1. Vercel の `NEXT_PUBLIC_ADMOB_DEBUG` を削除して Redeploy する（これで表示は消える）。
2. PR #17 の変更（`AdBanner.tsx` の診断部分と、`admob.ts` の `onDebug`）を元に戻す PR を作成してマージする。
