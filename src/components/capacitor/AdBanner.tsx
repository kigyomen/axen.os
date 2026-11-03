"use client";

import { useEffect, useState } from "react";
import { Capacitor, type PluginListenerHandle } from "@capacitor/core";
import { AdMob, BannerAdPluginEvents } from "@capacitor-community/admob";
import { removeSettingsBannerAd, showSettingsBannerAd } from "@/lib/capacitor/admob";

/**
 * iOSで広告が表示されない原因を調べるための一時的な診断表示。
 * iOSアプリ(Capacitor)で、かつビルド時の環境変数 NEXT_PUBLIC_ADMOB_DEBUG が "1" の
 * 場合だけ、広告の読み込みの各段階と失敗理由をSettings画面に表示する。
 * 原因が分かったら削除する。Next.jsはprocess.env.NEXT_PUBLIC_*を直接参照した
 * 箇所だけをビルド時に埋め込むため、変数名は必ずリテラルで書く。
 */
const ADMOB_DEBUG_ENABLED = process.env.NEXT_PUBLIC_ADMOB_DEBUG === "1";

/** 結果が届かない場合に、その旨を表示するまでの時間。 */
const ADMOB_DEBUG_TIMEOUT_MS = 15000;

/** 診断表示に広告IDを出さないよう、ca-app-pub-で始まるIDを伏せる。 */
function maskAdIds(text: string): string {
  return text.replace(/ca-app-pub-[0-9]+[~/][0-9]+/g, "ca-app-pub-***");
}

/**
 * Settings画面専用のAdMobバナー広告。
 *
 * Capacitor.isNativePlatform()がfalseの場合(Web版)は何もしない
 * (@capacitor-community/admobはネイティブブリッジが存在しない環境では
 * 安全にno-opになるよう作られているが、ここでも明示的にガードする)。
 * アンマウント時(=Settings画面を離れる時)に必ずバナーを削除するため、
 * 他の画面に広告が残ることはない。
 */
export function AdBanner() {
  const [debugLog, setDebugLog] = useState<string[]>([]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    const debug = ADMOB_DEBUG_ENABLED && Capacitor.getPlatform() === "ios";
    if (!debug) {
      showSettingsBannerAd();
      return () => {
        removeSettingsBannerAd();
      };
    }

    let cancelled = false;
    let settled = false;
    const handles: PluginListenerHandle[] = [];
    const log = (message: string) => {
      if (cancelled) {
        return;
      }
      const time = new Date().toLocaleTimeString("ja-JP", { hour12: false });
      setDebugLog((prev) => [...prev, `${time} ${maskAdIds(message)}`]);
    };
    const timer = window.setTimeout(() => {
      if (!settled) {
        log(`${ADMOB_DEBUG_TIMEOUT_MS / 1000}秒たっても、読み込み成功・失敗のどちらの結果も届いていません`);
      }
    }, ADMOB_DEBUG_TIMEOUT_MS);

    (async () => {
      handles.push(
        await AdMob.addListener(BannerAdPluginEvents.Loaded, () => {
          settled = true;
          log("結果: 読み込み成功(bannerAdLoaded)");
        }),
        await AdMob.addListener(BannerAdPluginEvents.FailedToLoad, (error) => {
          settled = true;
          log(`結果: 読み込み失敗(bannerAdFailedToLoad) code=${error.code} message=${error.message}`);
        }),
        await AdMob.addListener(BannerAdPluginEvents.SizeChanged, (size) => {
          log(`サイズ: ${size.width}x${size.height}`);
        }),
      );
      if (cancelled) {
        handles.forEach((handle) => handle.remove());
        return;
      }
      await showSettingsBannerAd(log);
    })();

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      handles.forEach((handle) => handle.remove());
      removeSettingsBannerAd();
    };
  }, []);

  if (!ADMOB_DEBUG_ENABLED || debugLog.length === 0) {
    return null;
  }

  return (
    <div className="rounded-xl border border-border bg-surface-muted p-3 font-mono text-xs text-foreground">
      <p className="mb-1 font-semibold">AdMob 診断(一時的な表示)</p>
      {debugLog.map((line, index) => (
        <p key={index} className="break-all">
          {line}
        </p>
      ))}
    </div>
  );
}
