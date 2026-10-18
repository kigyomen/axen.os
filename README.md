# Founder（仮称）

アイデアを、実際のビジネスに変えるためのAIビジネス支援アプリ。
起業志望者・学生起業家・副業を始めたい人・個人事業主・小規模事業者を対象とする。

## 現在のフェーズ

**Phase 1: 基盤 + UI（仮データ）**

Next.js + TypeScript + Tailwind CSS で、以下5画面のUIのみを実装済み。
バックエンド・Supabase連携・認証・AI APIは未実装（仮データで表示）。

- Dashboard
- Business Ideas
- Tasks
- Finance（Sales / Expenses / Profit）
- AI Business Coach（チャットUIのみ、送信不可）

## 技術スタック

- Next.js (App Router)
- TypeScript
- Tailwind CSS
- lucide-react（アイコン）
- Supabase（Phase 2以降で導入予定）
- AI機能（Phase 3以降で導入予定）

## セットアップ

```bash
npm install
npm run dev
```

[http://localhost:3000](http://localhost:3000) で確認できます。スマートフォン表示ではボトムナビ、デスクトップ表示ではサイドバーになります。

## 開発コマンド

```bash
npm run dev     # 開発サーバー起動
npm run build   # 本番ビルド
npm run start   # 本番サーバー起動
npm run lint    # ESLint実行
```

## 今後の実装予定

- Supabase（DB / Auth）
- 各画面のCRUD・データ永続化
- AI Business Coach（AI API接続）
Vercel deployment test

## Supabase Auth設定（本番環境）

本番（Vercel）環境でメール確認・パスワード再設定のリンクが正しく機能するために、
コード側の設定に加えて **Supabase Dashboard側の設定が別途必要** です。
この設定はコードから変更できないため、Supabase Dashboardで手動確認・設定してください。

対象: Supabase Dashboard > Authentication > URL Configuration

- **Site URL**: 本番のVercel URL（例: `https://<production-domain>.vercel.app`、
  独自ドメインを使う場合はそのドメイン）を設定する。開発用の`http://localhost:3000`や
  古いpreview URLのままになっていないか確認すること。
- **Redirect URLs**（許可リスト）: 上記の本番URL配下（少なくとも
  `https://<production-domain>.vercel.app/auth/confirm`と
  `https://<production-domain>.vercel.app/update-password`）を追加する。
  ここに登録されていないURLへは、Supabaseがメール内リンクのリダイレクトを許可しない。
  開発環境用に`http://localhost:3000/**`も別途登録して構わない（本番用の値を
  上書きしないよう、両方を並記する）。

対象: Supabase Dashboard > Authentication > Email Templates

このアプリは`src/app/auth/confirm/route.ts`でtoken_hash + verifyOtp方式
（Supabase公式のNext.js SSR向け推奨パターン）を実装しています。
デフォルトの`{{ .ConfirmationURL }}`を使うテンプレートのままだと、
Supabaseがホストする確認ページを経由してしまい、このアプリの
`/auth/confirm`を通らないため、以下の形式にテンプレートを変更する必要があります。

- **Confirm signup**（新規登録の確認メール）:
  ```
  {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup&next=/
  ```
- **Reset Password**（パスワード再設定メール）:
  ```
  {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/update-password
  ```

`next`パラメータは`/`で始まる相対パスのみ受け付けます（オープンリダイレクト対策。
`src/app/auth/confirm/route.ts`の`resolveSafeNextPath()`を参照）。
`next`を省略した場合は`/update-password`にフォールバックするため、
signup確認メールのテンプレートでは`next=/`を明示的に指定してください。

## AdMob設定（本番環境）

Android版・iOS版アプリの設定（Settings）画面にのみ、バナー広告（Google AdMob）を実装
しています（以下はAndroid版の説明。iOS版は後述の「iOS版」を参照）。現在のコードはGoogle公式のテスト広告ID
（https://developers.google.com/admob/android/test-ads）を既定値として使用して
おり、本番のAdMob IDへ切り替えるまでは、実機で表示される広告はすべてテスト広告
です（誤タップしてもGoogle広告主に課金されません）。

本番のAdMob IDへ切り替えるには、以下の**2箇所**の設定が必要です。どちらか一方
だけを設定するとテスト広告と本番広告が混在した状態になるため、**必ず両方を同時
に設定してください**。

1. **バナー広告のAd Unit ID**（Vercelの環境変数）
   AdMob管理画面で発行したバナー広告ユニットID
   （`ca-app-pub-xxxxxxxxxxxxxxxx/xxxxxxxxxx`の形式）を、Vercel Dashboard >
   Settings > Environment Variables で、Production環境の
   `NEXT_PUBLIC_ADMOB_BANNER_AD_UNIT_ID` に設定する（`.env.example`参照）。
   この値は秘密情報ではない（配布したAPKを解析すれば誰でも読み取れる）ため、
   `NEXT_PUBLIC_`を付けてクライアントに公開する設計で問題ない。

2. **AdMob App ID**（GitHub Actions Secrets）
   AdMob管理画面で発行したApp ID（`ca-app-pub-xxxxxxxxxxxxxxxx~xxxxxxxxxx`の
   形式）を、GitHubリポジトリ > Settings > Secrets and variables > Actions で、
   `ADMOB_APP_ID`という名前のRepository Secretとして追加する（既存のRelease
   署名用Secrets、`ANDROID_KEYSTORE_BASE64`等と同じ場所）。
   `mobile/android/app/build.gradle`がビルド時にこの環境変数を読み込み、
   `mobile/android/app/src/main/AndroidManifest.xml`へmanifest placeholder経由
   で注入する。現時点では`.github/workflows/android-build.yml`はこのSecretを
   ビルドへ渡していないため、本番公開前に、Release AABをビルドするstepの`env:`
   に`ADMOB_APP_ID: ${{ secrets.ADMOB_APP_ID }}`を追加すること。

### iOS版

iOS版も同じSettings画面にバナー広告を表示する。AdMobではAndroidとiOSで別の
IDが発行されるため、iOS用に以下の**2箇所**を設定する。

1. **バナー広告のAd Unit ID**（Vercelの環境変数）
   iOS用のバナー広告ユニットIDを、Production環境の
   `NEXT_PUBLIC_ADMOB_IOS_BANNER_AD_UNIT_ID` に設定する。未設定の間は
   Google公式のiOS用テストID（https://developers.google.com/admob/ios/test-ads）
   が使われる。この値はWeb側の設定のため、変更するとアプリの更新なしで、
   インストール済みのすべてのiOSアプリに即座に反映される。

2. **AdMob App ID**（Codemagicの環境変数グループ`admob_ios`）
   `codemagic.yaml`の`ios-app-store-release`は、`ADMOB_IOS_APP_ID`が
   未設定・形式が不正・Google公式のテスト用ID（`ca-app-pub-3940256099942544~`
   で始まるもの）のいずれかの場合、最初のstepでエラーを出して停止する
   （公開用IPAにテスト用IDが混入しないようにするため）。以下の手順で設定する。
   1. AdMob管理画面でiOSアプリを登録し、App ID
      （`ca-app-pub-xxxxxxxxxxxxxxxx~xxxxxxxxxx`の形式。`/`区切りの広告
      ユニットIDとは別物）を確認する。
   2. Codemagicで対象アプリのSettings > Environment variablesを開き、
      Variable nameに`ADMOB_IOS_APP_ID`、Variable valueに上記App ID、
      Groupに`admob_ios`を指定して追加する（App IDは秘密情報ではないため、
      Secureにするかは任意）。
   3. `codemagic.yaml`の`ios-app-store-release`にある
      `# groups:`と`#   - admob_ios`の2行のコメントを外してコミットする。
      グループを作る前にコメントを外すと、このworkflowはビルド開始時に
      「unknown variable group」エラーになる（`ios-simulator-verify`は
      このグループを参照しないため影響を受けない）。

   設定した値は、ビルド時に`Info.plist`の`GADApplicationIdentifier`へ
   書き込まれる。

**順番の注意**：App IDと広告ユニットIDは同じAdMobアプリのものを使う。
Vercel側の広告ユニットIDを本番にするのは、本番App IDでビルドしたアプリが
公開されてからにする（App IDがテスト用のままのアプリに本番の広告ユニットIDを
渡すと、広告が表示されない）。

## App Store公開前チェックリスト（iOS版）

App Store Connectへのアップロードは`codemagic.yaml`の`ios-app-store-release`
（Codemagicダッシュボードから手動実行）で行う。以下は公開までに必要な作業の
一覧で、**チェックが付いていない項目は未実施**。

### Apple・App Store Connect

- [ ] Apple Developer Programに登録する
- [ ] Certificates, Identifiers & ProfilesでバンドルID`com.kigyoshiyo.app`を登録する
- [ ] App Store Connectで、バンドルID`com.kigyoshiyo.app`の新規アプリを登録する
  （未登録だと、ビルド番号を決めるstepで停止する）
- [ ] App Store ConnectのUsers and Access > Integrationsで、App Store Connect
  APIキー（App Manager以上の権限を推奨）を発行し、Issuer ID・Key ID・
  .p8ファイルを控える

### Codemagic

- [ ] Team settings > Team integrations > Developer Portalに、上記APIキーを
  **`kigyoshiyo_app_store_connect`という名前で**登録する（`codemagic.yaml`の
  `integrations.app_store_connect`と一致させる）
- [ ] Team settings > codemagic.yaml settings > Code signing identitiesに、
  Apple Distribution証明書と、`com.kigyoshiyo.app`用のApp Store配布用
  プロビジョニングプロファイルを登録する
- [ ] 環境変数グループ`admob_ios`に`ADMOB_IOS_APP_ID`を登録し、
  `codemagic.yaml`の`groups:`のコメントを外す（上記「iOS版」参照）

### AdMob

- [ ] AdMob管理画面でiOSアプリを登録し、本番のApp IDとバナー広告ユニットIDを発行する
- [ ] App IDをCodemagic（`ADMOB_IOS_APP_ID`）、広告ユニットIDをVercel
  （`NEXT_PUBLIC_ADMOB_IOS_BANNER_AD_UNIT_ID`）に設定する（上記「順番の注意」参照）
- [ ] EEA・英国で配信する場合、AdMobの規約で求められる同意取得（Google UMP）
  への対応を検討する（現在は未実装。配信地域を日本などに限定する方法もある）

### プライバシー・審査

- [ ] プライバシーポリシー（`/privacy`）の内容が、現在の実装（Google AdMob、
  Anthropic Claude API、Supabase、Vercel）と一致しているか最終確認する
- [ ] App Store Connectの「Appのプライバシー」で、本アプリが扱うデータと、
  Google Mobile Ads SDKが収集するデータ（Googleが公開しているデータ開示情報を参照）
  を申告する
- [ ] AI Coach利用時にClaude APIへデータを送信することについて、アプリ内での
  説明・同意の要否を確認する（App Store Reviewガイドライン5.1.2(i)。現在は
  アプリ内の同意画面は未実装）
- [ ] 審査用のデモアカウント（メールアドレス・パスワード）を作成し、
  App Store Connectの「App Reviewに関する情報」に記入する
- [ ] App Store Connectのアプリ情報に、プライバシーポリシーURLとサポートURL（`/support`）を登録する
- [ ] 審査メモに、Webサイトの表示だけでなくネイティブ機能（ローカル通知・
  共有など）を備えていることを記載する（ガイドライン4.2対策）
- [ ] スクリーンショットを用意する（現在のiOSプロジェクトはiPhone・iPadの両方に
  対応する設定のため、iPad用も必要）

### ビルド・テスト

- [ ] Codemagicで`ios-app-store-release`を実行し、IPAの作成とApp Store Connectへの
  アップロードが成功することを確認する（2026年10月時点で未実施・未検証）
- [ ] TestFlightで実機にインストールし、起動、ログイン、AI Coach、通知、共有、
  設定画面の広告表示（クラッシュしないこと）を確認する
- [ ] 輸出コンプライアンス（暗号化の使用）について、App Store Connectで回答する
  （現在`Info.plist`に`ITSAppUsesNonExemptEncryption`を設定していないため、
  ビルドごとに回答が求められる）
