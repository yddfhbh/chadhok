import {
  Client,
  Events,
  GatewayIntentBits,
  Partials,
} from "discord.js";

import { CONVERSATIONS_PATH, GEMINI_MODEL } from "./config.js";
import { ConversationStore } from "./conversation-store.js";
import { buildConversationKey, extractMessageAction } from "./discord-message-context.js";
import { sendReply } from "./discord-replies.js";
import { generateGigachadReply } from "./gemini-client.js";
import { canResetConversation } from "./permissions.js";

const conversationStore = new ConversationStore(CONVERSATIONS_PATH);

export function buildDiscordClient() {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.DirectMessages,
      GatewayIntentBits.MessageContent,
    ],
    partials: [Partials.Channel],
  });

  client.once(Events.ClientReady, (readyClient) => {
    console.log(`Logged in as ${readyClient.user.tag}`);
    console.log(`Model: ${GEMINI_MODEL}`);
  });

  client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot || !client.user) {
      return;
    }

    const action = await extractMessageAction(message, client.user.id);

    if (action.type === "ignore") {
      return;
    }

    const conversationKey = buildConversationKey(message);

    if (action.type === "reset") {
      await handleReset(message, conversationKey);
      return;
    }

    if (!action.prompt) {
      await sendReply(message, "할 말부터 던져라, My son. 예시: `@봇 오늘 해야 할 일 쪼개줘`");
      return;
    }

    await message.channel.sendTyping();

    try {
      const session = await conversationStore.get(conversationKey);
      const reply = await generateGigachadReply(action.prompt, session?.interactionId);

      await conversationStore.set(conversationKey, {
        interactionId: reply.interactionId,
        updatedAt: new Date().toISOString(),
        username: message.author.username,
      });

      await sendReply(message, reply.text);
    } catch (error) {
      console.error("Gemini request failed:", error);
      await sendReply(message, "서버가 잠깐 비틀거린다. No panic. 잠깐 후 다시 던져.");
    }
  });

  return client;
}

async function handleReset(message, conversationKey) {
  if (!canResetConversation(message)) {
    await sendReply(
      message,
      "리셋은 관리자나 지정된 한 명만 한다, My son. 권한 없으면 손대지 마."
    );
    return;
  }

  await conversationStore.delete(conversationKey);
  await sendReply(message, "리셋 완료다, My son. 판 갈았다. 다시 던져.");
}
