import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * 認証必須のルート。未ログインの場合は /login へリダイレクトする。
 */
const PROTECTED_PATHS = [
  "/",
  "/ideas",
  "/tasks",
  "/finance",
  "/goals",
  "/coach",
  "/settings",
  "/businesses",
  "/onboarding",
  "/welcome",
  "/update-password",
];

/**
 * ログイン済みならアクセスさせないルート。
 */
const AUTH_PATHS = ["/login", "/signup"];

function isProtectedPath(pathname: string) {
  return PROTECTED_PATHS.some((path) =>
    path === "/" ? pathname === "/" : pathname === path || pathname.startsWith(`${path}/`),
  );
}

function isAuthPath(pathname: string) {
  return AUTH_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

/**
 * Supabase標準のメールテンプレートのリンクが、?code=...付きで戻ってくることがあるページ。
 * - /update-password: 以前のパスワード再設定メール(redirectToが/update-passwordだった頃)
 * - /: redirectToが許可されなかった場合にSupabaseが使うSite URL
 * どちらもログインが必要なページのため、そのままではログイン画面へ戻されてしまう。
 * codeを処理できる/auth/confirmへ、クエリをそのまま引き継いで転送する。
 */
const CODE_LINK_FALLBACK_PATHS = ["/", "/update-password"];

function buildCodeLinkRedirect(request: NextRequest): NextResponse | null {
  const { pathname, searchParams } = request.nextUrl;
  if (!CODE_LINK_FALLBACK_PATHS.includes(pathname) || !searchParams.has("code")) {
    return null;
  }
  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = "/auth/confirm";
  // 遷移先(next)は固定値のみを使う(外部サイトへのリダイレクトを防ぐため、
  // 元のURLのnextは引き継がない)。パスワード再設定のリンクかどうかは
  // /auth/confirm側で判定し、再設定なら必ず/update-passwordへ進む。
  redirectUrl.searchParams.delete("next");
  if (pathname === "/update-password") {
    redirectUrl.searchParams.set("next", "/update-password");
  }
  return NextResponse.redirect(redirectUrl);
}

/** レスポンス間でリフレッシュ後のCookieを引き継ぐ */
function copyCookies(from: NextResponse, to: NextResponse) {
  from.cookies.getAll().forEach((cookie) => {
    to.cookies.set(cookie);
  });
  return to;
}

/**
 * Next.js 16のProxy（旧middleware）。
 * 全ページアクセス時にSupabaseのセッションをリフレッシュし、
 * 未ログインでの保護ルートアクセス／ログイン済みでの認証ページアクセスを
 * リダイレクトする。
 *
 * .env.local が未設定の間（Supabase未接続の開発初期）は何もせずに
 * そのまま通す。既存のUIをSupabase未接続でも壊さないための措置。
 */
export async function proxy(request: NextRequest) {
  const hasSupabaseEnv =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!hasSupabaseEnv) {
    return NextResponse.next();
  }

  const codeLinkRedirect = buildCodeLinkRedirect(request);
  if (codeLinkRedirect) {
    return codeLinkRedirect;
  }

  const { response, user } = await updateSession(request);
  const { pathname } = request.nextUrl;

  if (!user && isProtectedPath(pathname)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    return copyCookies(response, NextResponse.redirect(redirectUrl));
  }

  if (user && isAuthPath(pathname)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/";
    return copyCookies(response, NextResponse.redirect(redirectUrl));
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * 以下を除く全パスに適用する:
     * - _next/static (静的ファイル)
     * - _next/image (画像最適化ファイル)
     * - favicon.ico, 画像ファイル
     */
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
