import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropicClient, COACH_MODEL } from "../anthropic/client";
import type { CoachContext } from "../supabase/coach-context";
import { isCoachMockModeEnabled } from "./mock-mode";
import { streamMockCoachReply } from "./mock-provider";
import {
  COACH_ACTIONS_MARKER,
  PROPOSE_ACTIONS_TOOL,
  hasAnyCoachActions,
  sanitizeCoachActions,
  sanitizeFollowUpQuestions,
} from "./actions-schema";
import { buildCoachDiagnostics } from "./diagnostics";

export interface CoachConversationMessage {
  role: "user" | "assistant";
  content: string;
}

/**
 * 今回のユーザーメッセージの末尾に付ける、propose_actionsツール呼び出しの再確認。
 * 会話履歴には過去の回答の本文だけが入り、ツール呼び出しの記録は入らないため、
 * Claudeが「過去の回答ではツールを呼んでいない」と受け取り、呼び出しを省くことがある。
 * それを防ぐため、Claudeへ送る今回の依頼にだけ付ける(DBへは保存しない。API通信回数も増えない)。
 * system promptで、このタグはシステムからの補足でありユーザーの発言ではないと説明している。
 */
const FOLLOW_UP_REMINDER =
  "<reply_reminder>回答の本文を書き終えたら、最後に必ず propose_actions ツールを1回呼び出し、" +
  "follow_up_questions に今回の回答に沿った次の質問候補を3つ入れてください。</reply_reminder>";

/** 最後のユーザーメッセージにだけ、FOLLOW_UP_REMINDERを別のテキストとして付け足す。 */
function withFollowUpReminder(messages: CoachConversationMessage[]): Anthropic.MessageParam[] {
  const lastIndex = messages.length - 1;
  return messages.map((message, index) =>
    index === lastIndex && message.role === "user"
      ? {
          role: "user",
          content: [
            { type: "text", text: message.content },
            { type: "text", text: FOLLOW_UP_REMINDER },
          ],
        }
      : message,
  );
}

/**
 * AI Coachの応答をテキストチャンクのasyncイテレータとして返す。
 *
 * isCoachMockModeEnabled()がtrueの場合のみMock Providerを使い、Anthropic API
 * は一切呼び出さない(client.messages.streamにすら到達しない)。それ以外は
 * 常に実際のsrc/lib/anthropic経由でClaudeを呼び出す既存の経路を通る
 * (src/lib/anthropic/以下の実装自体は変更していない)。
 */
export async function* streamCoachReply(params: {
  systemPrompt: string;
  messages: CoachConversationMessage[];
  userMessage: string;
  context: CoachContext;
}): AsyncGenerator<string> {
  if (isCoachMockModeEnabled()) {
    yield* streamMockCoachReply({ userMessage: params.userMessage, context: params.context });
    return;
  }

  const client = getAnthropicClient();
  const claudeStream = client.messages.stream({
    model: COACH_MODEL,
    // propose_actionsツール呼び出し分の出力トークンも必要なため、通常の
    // 会話テキストのみだった頃より少し余裕を持たせる。
    max_tokens: 3072,
    system: params.systemPrompt,
    messages: withFollowUpReminder(params.messages),
    tools: [PROPOSE_ACTIONS_TOOL],
  });

  for await (const event of claudeStream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      yield event.delta.text;
    }
  }

  const finalMessage = await claudeStream.finalMessage();
  // 【一時的な調査用】質問候補が表示されない原因の調査。応答の形(終了理由・ツール呼び出しの
  // 有無・質問候補の形式と件数・トークン数)だけを記録し、本文や個人情報は含めない。
  // 調査用の記録で失敗しても、AIの回答には影響させない。原因特定後に削除する。
  try {
    console.info(`coach diagnostics ${JSON.stringify(buildCoachDiagnostics(finalMessage))}`);
  } catch {
    // 記録できなくても何もしない
  }
  const toolUseBlock = finalMessage.content.find(
    (block) => block.type === "tool_use" && block.name === "propose_actions",
  );
  if (toolUseBlock && toolUseBlock.type === "tool_use") {
    const actions = sanitizeCoachActions(toolUseBlock.input);
    // 「次の質問」候補も同じツール呼び出しで受け取る(追加のAPI呼び出しは行わない)。
    const input = toolUseBlock.input as { follow_up_questions?: unknown } | null;
    const followUpQuestions = sanitizeFollowUpQuestions(input?.follow_up_questions);
    if (hasAnyCoachActions(actions) || followUpQuestions.length > 0) {
      // 会話テキストの後ろに、既存のプレーンテキストストリームの延長として
      // マーカー+JSONを1チャンクだけ追加する(新しいレスポンス形式は導入しない)。
      yield `${COACH_ACTIONS_MARKER}${JSON.stringify({ ...actions, followUpQuestions })}`;
    }
  }
}
