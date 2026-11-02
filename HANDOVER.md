# 起業しよ。 引き継ぎ資料（HANDOVER）

最終更新: 2026-11-02（main: `3853930`）
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
- APIテストは Node.js 22.15 以降が必要（試験的機能を使用）。
- Web のテスト・lint は CI では自動実行されていない（Android ビルドのみ）。

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
2. **ログイン後に画面が約1.144倍に拡大される問題**: ログイン画面の入力欄を16pxにした（PR #11）。**実機での再確認が未完了**。新規登録・パスワード再設定など他の入力欄は14pxのまま（同じ現象が起きる可能性）。
3. 設定画面をすぐ離れると、広告の読み込み完了後にバナーが他の画面に残る可能性（`removeBanner` の後に広告が届くケース）。
4. Android（WebView 140以降）で、画面端まで表示が広がるため、広告と下のメニューが重なる可能性（3ボタンナビゲーション端末）。
5. iOS でキーボード表示中、AI Coach の入力欄がホームバー分（約34px）上に表示される可能性。
6. 005 マイグレーションの本番適用状況が未確認（上記5章）。
7. README の記述の一部が古い:
   - Android の `ADMOB_APP_ID` を「ワークフローがまだ渡していない」とあるが、現在は渡している（`android-build.yml` 126行目）。
   - 公開前チェックリストがすべて未チェックのまま（実際には完了済みの項目がある）。
8. 不要になったブランチ: `origin/claude/axen-os-brand-dashboard-bs9ozi`（内容は別のコミットで main に反映済み）、マージ済みの `claude/*` ブランチ。削除してよい。

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
