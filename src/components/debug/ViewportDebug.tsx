"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Capacitor } from "@capacitor/core";

/**
 * iOSアプリで「再ログイン後に画面が拡大され、ピンチ操作で拡大・縮小できなくなる」
 * 不具合の原因調査用に、表示倍率やページの大きさを画面左上に表示する一時的な表示。
 * 不具合そのものの修正ではない(原因が分かったら削除する)。
 *
 * 次の両方を満たす場合だけ表示する(それ以外では何もしない):
 * - Capacitorの実行環境がiOS(Capacitor.getPlatform() === "ios")
 * - ビルド時の環境変数 NEXT_PUBLIC_VIEWPORT_DEBUG が "1"
 *
 * Next.jsはprocess.env.NEXT_PUBLIC_*を直接参照した箇所だけをビルド時に
 * 埋め込むため、変数名は必ずリテラルで書く(admob.tsと同じ)。
 *
 * タッチを受け付けない(pointer-events: none)ため、2本指の操作を妨げない。
 * 値を読むだけで、フォーカスの移動や認証処理には一切関与しない。
 */
const VIEWPORT_DEBUG_ENABLED = process.env.NEXT_PUBLIC_VIEWPORT_DEBUG === "1";

const UPDATE_INTERVAL_MS = 500;

interface ViewportSnapshot {
  scale: string;
  visualWidth: string;
  visualHeight: string;
  visualOffsetLeft: number;
  visualOffsetTop: number;
  visualScale: number;
  innerWidth: number;
  innerHeight: number;
  scrollWidth: number;
  scrollHeight: number;
  clientWidth: number;
  clientHeight: number;
  activeTag: string;
  activeType: string;
  updatedAt: string;
}

function takeSnapshot(): ViewportSnapshot {
  const vv = window.visualViewport;
  const root = document.documentElement;
  const active = document.activeElement;
  const activeType = active && "type" in active ? String((active as HTMLInputElement).type) : "";

  return {
    scale: vv ? vv.scale.toFixed(3) : "unsupported",
    visualWidth: vv ? vv.width.toFixed(1) : "unsupported",
    visualHeight: vv ? vv.height.toFixed(1) : "unsupported",
    visualOffsetLeft: vv ? vv.offsetLeft : 0,
    visualOffsetTop: vv ? vv.offsetTop : 0,
    visualScale: vv && vv.scale > 0 ? vv.scale : 1,
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
    scrollWidth: root.scrollWidth,
    scrollHeight: root.scrollHeight,
    clientWidth: root.clientWidth,
    clientHeight: root.clientHeight,
    activeTag: active ? active.tagName : "(none)",
    activeType: activeType || "-",
    updatedAt: new Date().toLocaleTimeString("ja-JP", { hour12: false }),
  };
}

export function ViewportDebug() {
  const pathname = usePathname();
  // iOS以外・環境変数が"1"でない場合はnullのまま(何も表示しない)。
  const [snapshot, setSnapshot] = useState<ViewportSnapshot | null>(null);

  // pathnameが変わるたびに登録し直し、画面遷移の直後の値も記録する。
  useEffect(() => {
    if (!VIEWPORT_DEBUG_ENABLED || Capacitor.getPlatform() !== "ios") {
      return;
    }

    const update = () => setSnapshot(takeSnapshot());
    const firstFrame = window.requestAnimationFrame(update);

    const vv = window.visualViewport;
    vv?.addEventListener("resize", update);
    vv?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, { passive: true });
    document.addEventListener("focusin", update);
    document.addEventListener("focusout", update);
    const timer = window.setInterval(update, UPDATE_INTERVAL_MS);

    return () => {
      window.cancelAnimationFrame(firstFrame);
      vv?.removeEventListener("resize", update);
      vv?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update);
      document.removeEventListener("focusin", update);
      document.removeEventListener("focusout", update);
      window.clearInterval(timer);
    };
  }, [pathname]);

  if (!VIEWPORT_DEBUG_ENABLED || !snapshot) {
    return null;
  }

  const rows: [string, string | number][] = [
    ["path", pathname],
    ["vv.scale", snapshot.scale],
    ["vv.width", snapshot.visualWidth],
    ["vv.height", snapshot.visualHeight],
    ["innerWidth", snapshot.innerWidth],
    ["innerHeight", snapshot.innerHeight],
    ["scrollWidth", snapshot.scrollWidth],
    ["scrollHeight", snapshot.scrollHeight],
    ["clientWidth", snapshot.clientWidth],
    ["clientHeight", snapshot.clientHeight],
    ["active", snapshot.activeTag],
    ["activeType", snapshot.activeType],
    ["updated", snapshot.updatedAt],
  ];

  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        // 拡大中も見えている範囲(visual viewport)の左上に表示し、文字の大きさを
        // 拡大率で打ち消す。セーフエリア(ノッチ)と重ならないよう少し下げる。
        top: snapshot.visualOffsetTop,
        left: snapshot.visualOffsetLeft,
        transform: `scale(${1 / snapshot.visualScale})`,
        transformOrigin: "top left",
        marginTop: "env(safe-area-inset-top)",
        marginLeft: "env(safe-area-inset-left)",
        zIndex: 2147483647,
        pointerEvents: "none",
        maxWidth: 220,
        padding: "6px 8px",
        borderRadius: 8,
        background: "rgba(0, 0, 0, 0.72)",
        color: "#fff",
        font: "11px/1.35 ui-monospace, SFMono-Regular, Menlo, monospace",
        whiteSpace: "nowrap",
        overflow: "hidden",
      }}
    >
      {rows.map(([label, value]) => (
        <div key={label}>
          {label}: {value}
        </div>
      ))}
    </div>
  );
}
