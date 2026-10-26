// node:testでNext.jsのコード(src/以下の.ts)を直接importするための読み込みフック。
// アプリ本体・ビルドには使われない(テスト実行時に --import で読み込むだけ)。
//
// Node.js単体では、tsconfig.jsonのパス別名「@/...」や、拡張子を省略した
// 相対import(例: "../anthropic/client")を解決できないため、ここで
// src/以下の実在する.ts/.tsxファイルへ読み替える。
// 使用するmodule.registerHooks()はNode.js 22.15以降の機能(試験的機能)。
import { registerHooks } from "node:module";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SRC_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function resolveSourceFile(base) {
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, path.join(base, "index.ts")]) {
    if (/\.(ts|tsx|mjs|js)$/.test(candidate) && existsSync(candidate)) {
      return pathToFileURL(candidate).href;
    }
  }
  return null;
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    // next/serverはpackage.jsonのexportsが無いため、拡張子付きで解決する
    if (specifier === "next/server") {
      return nextResolve("next/server.js", context);
    }

    let base = null;
    if (specifier.startsWith("@/")) {
      base = path.join(SRC_DIR, specifier.slice(2));
    } else if (
      (specifier.startsWith("./") || specifier.startsWith("../")) &&
      context.parentURL?.startsWith("file:") &&
      fileURLToPath(context.parentURL).startsWith(SRC_DIR + path.sep)
    ) {
      base = path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier);
    }

    if (base) {
      const url = resolveSourceFile(base);
      if (url) {
        return { url, shortCircuit: true };
      }
    }
    return nextResolve(specifier, context);
  },
});
