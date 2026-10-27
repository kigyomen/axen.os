import type { CapacitorConfig } from "@capacitor/cli";

/**
 * 「起業しよ。」Androidアプリ(Capacitorラッパー)の設定。
 *
 * server.url はユーザーから提示されたVercel本番URL
 * (https://kigyoshiyo.vercel.app/)を使用している。
 * 本番ドメインが今後カスタムドメインに変わった場合は、この値を
 * 書き換えること。
 *
 * このファイルはCapacitorラッパー専用の設定であり、Next.jsアプリ本体
 * (リポジトリルートのsrc/等)には一切影響しません。
 */
const config: CapacitorConfig = {
  appId: "com.kigyoshiyo.app",
  appName: "起業しよ。",
  webDir: "www",
  server: {
    url: "https://kigyoshiyo.vercel.app",
    // 本番URLは常にHTTPSのため平文HTTPは許可しない
    cleartext: false,
    androidScheme: "https",
  },
  ios: {
    // CapacitorのiOS既定(false)では、拡大が始まった瞬間にピンチ操作の受け付けを
    // 無効化し、その後元に戻さない。小さい文字の入力欄をタップした際のiOSの
    // 自動拡大などをきっかけに、以後すべての画面でピンチ操作が効かなくなるため、
    // 拡大・縮小を許可する(iOSのみ。Androidには影響しない)。
    zoomEnabled: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 600,
      launchAutoHide: true,
      backgroundColor: "#0a0a0a",
      showSpinner: false,
      androidScaleType: "CENTER_CROP",
    },
    LocalNotifications: {
      // iOSのみで使われる設定(Androidでは無視される)。アプリを前面に
      // 表示中でも、ローカル通知をバナー・通知センター・音で知らせる。
      presentationOptions: ["banner", "list", "sound"],
    },
  },
};

export default config;
