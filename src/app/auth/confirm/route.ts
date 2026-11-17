import { redirect } from "next/navigation";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

const DEFAULT_NEXT_PATH = "/update-password";

/** パスワード再設定リンク(recovery)で認証した後の遷移先。nextの値に関わらず固定する。 */
const RECOVERY_PATH = "/update-password";

/** code形式で、パスワード再設定以外(会員登録の確認メール等)のリンクだった場合の既定の遷移先。 */
const CODE_FLOW_DEFAULT_PATH = "/";

/** リンクが無効・期限切れの場合の遷移先。 */
const LINK_EXPIRED_PATH = "/reset-password?error=expired";

/**
 * PKCEの検証に必要な情報(再設定を申し込んだブラウザのCookieに保存される)が
 * 見つからない場合の遷移先。申し込みとは別のブラウザ(メールアプリ内のブラウザ、
 * iPhoneアプリ等)でリンクを開いた場合に起きるため、その旨を案内する。
 */
const LINK_OTHER_BROWSER_PATH = "/reset-password?error=other_browser";

/**
 * オープンリダイレクト対策: nextクエリパラメータは「このサイト内部への
 * 相対パス」である場合のみ許可する。
 *
 * - "/"で始まらない値(https://example.com、javascript:...等の絶対URL/
 *   scheme付きURLは"/"で始まらないため、ここで弾かれる)
 * - "//evil.example.com"のようなprotocol-relative URL("//"で始まる)
 * - "/\evil.example.com"のようなバックスラッシュを使った回避策
 *   (一部のブラウザ/プロキシが"\"を"/"として正規化し、実質的に
 *   protocol-relative URLとして扱われることがあるため)
 * のいずれかに該当する場合は無効とみなし、安全なデフォルト遷移先を返す。
 * URLSearchParams#get()は既にパーセントエンコードをデコード済みの値を返すため、
 * "%2F%2Fevil.example.com"のようなエンコードによる回避もここで検出できる。
 */
function resolveSafeNextPath(rawNext: string | null): string {
  if (!rawNext) {
    return DEFAULT_NEXT_PATH;
  }
  if (!rawNext.startsWith("/")) {
    return DEFAULT_NEXT_PATH;
  }
  if (rawNext.startsWith("//") || rawNext.startsWith("/\\")) {
    return DEFAULT_NEXT_PATH;
  }
  return rawNext;
}

/**
 * 確認メール・パスワード再設定メール内のリンクから戻ってくるRoute Handler。
 *
 * 次の2つの形式に対応する。
 * 1. token_hash形式(メールテンプレートを書き換えた場合): 下記のverifyOtpで検証する。
 * 2. code形式(Supabase標準のメールテンプレートの場合): Supabaseのページを経由して
 *    ?code=...付きで戻ってくるため、exchangeCodeForSessionでセッションに交換する。
 *    交換にはresetPasswordForEmail/signUp時にCookieへ保存された検証用の値(PKCE)が
 *    必要なため、申し込みと同じブラウザで開いた場合のみ成功する。
 *    パスワード再設定のリンクだった場合は、必ず/update-passwordへ遷移させる。
 * code・トークンの値はログに出さない。
 *
 * signup確認(type=signup/email)・パスワード再設定(type=recovery)の両方が
 * このルートを共有する(typeによって処理を分岐する必要はない。verifyOtpは
 * type共通のAPIのため)。
 * Supabase公式のNext.js SSR向け推奨パターン(token_hash + verifyOtp)に
 * 従う。リンクのトークンをこのアプリ側で保存・管理することはせず、
 * Supabase Authへそのまま渡して検証するのみ。
 *
 * 検証に成功すると、Supabaseが正規のセッションCookieを発行する
 * (このアプリの既存のCookieベースセッション/RLSの前提をそのまま利用)。
 *
 * 対応するSupabase Dashboard側の設定(メールテンプレートでこのURLへ
 * token_hash/type/nextを渡すこと)が別途必要。必須設定値はREADME.mdの
 * 「Supabase Auth設定(本番環境)」を参照。next未指定時はDEFAULT_NEXT_PATH
 * (パスワード再設定フロー向け)にフォールバックするため、signup確認メールの
 * テンプレートでは明示的に next=/ 等を指定すること。
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const rawNext = searchParams.get("next");
  const next = resolveSafeNextPath(rawNext);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    // 将来Supabaseがリダイレクト先にフローID(sb_flow_id)を付けるようになった場合に備え、
    // あれば渡す(無ければ従来どおり、Cookie内の最新の検証用の値が使われる)。
    const flowId = searchParams.get("sb_flow_id");
    const { data, error } = await supabase.auth.exchangeCodeForSession(
      code,
      flowId ? { flowId } : undefined,
    );
    if (!error) {
      // パスワード再設定のリンクかどうか。@supabase/auth-jsは実行時に返しているが、
      // 型定義(AuthTokenResponse)には含まれていないため、型を補って読む。
      const { redirectType } = data as { redirectType?: string | null };
      if (redirectType === "recovery") {
        redirect(RECOVERY_PATH);
      }
      redirect(rawNext ? next : CODE_FLOW_DEFAULT_PATH);
    }
    if (error.code === "pkce_code_verifier_not_found") {
      redirect(LINK_OTHER_BROWSER_PATH);
    }
    redirect(LINK_EXPIRED_PATH);
  }

  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      redirect(next);
    }
  }

  redirect(LINK_EXPIRED_PATH);
}
