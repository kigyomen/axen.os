import { Capacitor } from "@capacitor/core";
import { AdMob, BannerAdPosition, BannerAdSize } from "@capacitor-community/admob";

type AdPlatform = "android" | "ios";

/**
 * Google公式のテスト用バナー広告ユニットID。AndroidとiOSで値が異なる
 * (https://developers.google.com/admob/android/test-ads,
 *  https://developers.google.com/admob/ios/test-ads)。
 * 本番の広告ユニットIDが未設定の間は常にこの値へフォールバックし、
 * 開発・テスト中に誤って本番広告を表示してしまうことを防ぐ。
 */
const TEST_BANNER_AD_UNIT_IDS: Record<AdPlatform, string> = {
  android: "ca-app-pub-3940256099942544/6300978111",
  ios: "ca-app-pub-3940256099942544/2934735716",
};

/**
 * 本番の広告ユニットID。NEXT_PUBLIC_ADMOB_BANNER_AD_UNIT_IDはAndroid版、
 * NEXT_PUBLIC_ADMOB_IOS_BANNER_AD_UNIT_IDはiOS版の値(AdMobでは
 * プラットフォームごとに別のIDが発行される)。
 * Next.jsはprocess.env.NEXT_PUBLIC_*を直接参照した箇所だけをビルド時に
 * 埋め込むため、変数名は必ずリテラルで書く。
 */
const CONFIGURED_BANNER_AD_UNIT_IDS: Record<AdPlatform, string | undefined> = {
  android: process.env.NEXT_PUBLIC_ADMOB_BANNER_AD_UNIT_ID,
  ios: process.env.NEXT_PUBLIC_ADMOB_IOS_BANNER_AD_UNIT_ID,
};

/**
 * 実行中のプラットフォームに対応するバナー広告IDを返す。
 * 本番の広告ユニットIDが設定されていない間は、常にテストリクエストとして扱う
 * (isTesting: true)。本番IDを設定して初めてisTesting: falseになる。
 * Android/iOS以外(Web版)ではnullを返す。
 */
function resolveBannerAd(): { adId: string; isTesting: boolean } | null {
  const platform = Capacitor.getPlatform();
  if (platform !== "android" && platform !== "ios") {
    return null;
  }

  const configuredAdUnitId = CONFIGURED_BANNER_AD_UNIT_IDS[platform];
  return {
    adId: configuredAdUnitId || TEST_BANNER_AD_UNIT_IDS[platform],
    isTesting: !configuredAdUnitId,
  };
}

/**
 * BottomNav(src/components/layout/BottomNav.tsx)の実際の高さ
 * (アイコン20dp + gap 4dp + ラベル行 約14dp + 上下padding 20dp + border 1dp ≒ 59dp)に、
 * 端末のジェスチャーナビゲーション等のsafe area(env(safe-area-inset-bottom)、
 * 端末により0〜34dp程度)を踏まえた余裕を加えた固定値。バナー(ネイティブ側の
 * 別レイヤーのView)がBottomNavのタップ領域に重ならないようにするためのもので、
 * 全端末での完全な一致を保証するものではない(Android・iOS実機での確認を推奨)。
 */
const BOTTOM_NAV_CLEARANCE_DP = 80;

let initializePromise: Promise<void> | null = null;

function ensureInitialized(): Promise<void> {
  if (!initializePromise) {
    initializePromise = AdMob.initialize().catch((err) => {
      // 失敗時は次回呼び出しで再試行できるようキャッシュをリセットする。
      initializePromise = null;
      throw err;
    });
  }
  return initializePromise;
}

/**
 * Settings画面専用のバナー広告を表示する。
 * Capacitor.isNativePlatform()がfalseの場合(Web版)は何もしない。
 */
export async function showSettingsBannerAd(): Promise<void> {
  const bannerAd = Capacitor.isNativePlatform() ? resolveBannerAd() : null;
  if (!bannerAd) {
    return;
  }

  try {
    await ensureInitialized();
    await AdMob.showBanner({
      adId: bannerAd.adId,
      isTesting: bannerAd.isTesting,
      adSize: BannerAdSize.ADAPTIVE_BANNER,
      position: BannerAdPosition.BOTTOM_CENTER,
      margin: BOTTOM_NAV_CLEARANCE_DP,
    });
  } catch (err) {
    console.error("showSettingsBannerAd failed", err);
  }
}

/** Settings画面を離れる際にバナーを完全に取り除く(他画面に広告を残さない)。 */
export async function removeSettingsBannerAd(): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    return;
  }

  try {
    await AdMob.removeBanner();
  } catch (err) {
    console.error("removeSettingsBannerAd failed", err);
  }
}
