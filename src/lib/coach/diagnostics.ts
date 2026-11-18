import type Anthropic from "@anthropic-ai/sdk";
import { sanitizeFollowUpQuestions } from "./actions-schema";

/**
 * 【一時的な調査用】AIコーチの「次の質問」候補が本番で表示されない原因を調べるため、
 * Claudeの応答の「形」だけをVercelのログに1行で残す。原因が分かったら、このファイルと
 * provider.tsの呼び出し部分を削除する。
 *
 * 記録するのは件数・種類・トークン数・終了理由だけで、会話本文・質問の文面・ツールの入力内容・
 * ユーザー情報・APIキーは一切含めない(この関数はメッセージ以外の情報を受け取らない)。
 */
export interface CoachDiagnostics {
  /** 終了理由(end_turn=正常終了、max_tokens=トークン上限で打ち切り、tool_use=ツール呼び出しで終了 等) */
  stopReason: string | null;
  /** 応答に含まれていたブロックの種類の並び(例: ["thinking", "text", "tool_use"]) */
  blockTypes: string[];
  /** propose_actionsツールが呼び出されたか */
  toolCalled: boolean;
  /** follow_up_questionsのデータ形式(array / string / object / missing 等) */
  followUpType: string;
  /** follow_up_questionsが配列だった場合の要素数(配列でなければnull) */
  followUpRawCount: number | null;
  /** 検証を通って画面に送られる質問候補の件数 */
  followUpAcceptedCount: number;
  inputTokens: number;
  outputTokens: number;
}

function describeType(value: unknown): string {
  if (value === undefined) return "missing";
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

export function buildCoachDiagnostics(message: Anthropic.Message): CoachDiagnostics {
  const toolUseBlock = message.content.find(
    (block) => block.type === "tool_use" && block.name === "propose_actions",
  );
  const input =
    toolUseBlock && toolUseBlock.type === "tool_use" && toolUseBlock.input && typeof toolUseBlock.input === "object"
      ? (toolUseBlock.input as Record<string, unknown>)
      : null;
  const followUp = input ? input.follow_up_questions : undefined;

  return {
    stopReason: message.stop_reason,
    blockTypes: message.content.map((block) => block.type),
    toolCalled: Boolean(toolUseBlock),
    followUpType: describeType(followUp),
    followUpRawCount: Array.isArray(followUp) ? followUp.length : null,
    followUpAcceptedCount: sanitizeFollowUpQuestions(followUp).length,
    inputTokens: message.usage.input_tokens,
    outputTokens: message.usage.output_tokens,
  };
}
