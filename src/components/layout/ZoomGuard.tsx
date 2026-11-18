"use client";

import { useEffect } from "react";

/**
 * スマートフォンでの意図しない画面の拡大・縮小(ピンチ操作)を防ぐ。
 *
 * iOSのアプリ(WKWebView)とAndroidは、layout.tsxのviewport設定
 * (maximumScale: 1 / userScalable: false)で拡大しなくなるが、iPhoneのSafariは
 * アクセシビリティのためにこの設定を無視する。そのためSafari独自の
 * ジェスチャーイベント(2本指の操作)だけを取り消す。1本指のスクロールやタップ、
 * 入力欄の操作には関係しない。ダブルタップでの拡大はglobals.cssの
 * touch-action: manipulationで防いでいる。
 */
export function ZoomGuard() {
  useEffect(() => {
    const preventGesture = (event: Event) => event.preventDefault();
    const events = ["gesturestart", "gesturechange", "gestureend"] as const;
    events.forEach((name) => document.addEventListener(name, preventGesture, { passive: false }));
    return () => {
      events.forEach((name) => document.removeEventListener(name, preventGesture));
    };
  }, []);

  return null;
}
