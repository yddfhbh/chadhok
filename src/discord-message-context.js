import { ChannelType } from "discord.js";

import { MAX_PROMPT_CHARS, RESET_COMMAND } from "./config.js";

const RESET_KEYWORDS = new Set(["reset", "리셋", "초기화"]);

export function buildConversationKey(message) {
  if (message.channel.type === ChannelType.DM) {
    return `dm:${message.channel.id}`;
  }

  return `${message.guildId}:${message.channelId}:${message.author.id}`;
}

export function sanitizeUserInput(input) {
  return String(input ?? "")
    .replace(/\r\n/g, "\n")
    .trim()
    .slice(0, MAX_PROMPT_CHARS);
}

export async function isReplyToBot(message, botUserId) {
  if (!message.reference?.messageId) {
    return false;
  }

  try {
    const referenced = await message.fetchReference();
    return referenced.author?.id === botUserId;
  } catch {
    return false;
  }
}

export async function extractMessageAction(message, botUserId) {
  const mentionRegex = new RegExp(`<@!?${botUserId}>`, "g");
  const content = String(message.content ?? "").trim();
  const normalized = content.toLowerCase();
  const contentWithoutMention = sanitizeUserInput(content.replace(mentionRegex, ""));
  const mentionNormalized = contentWithoutMention.toLowerCase();

  if (content === RESET_COMMAND) {
    return { type: "reset" };
  }

  if (message.mentions.has(botUserId)) {
    if (RESET_KEYWORDS.has(mentionNormalized)) {
      return { type: "reset" };
    }

    return { type: "chat", prompt: contentWithoutMention };
  }

  if (message.channel.type === ChannelType.DM) {
    if (RESET_KEYWORDS.has(normalized)) {
      return { type: "reset" };
    }

    return { type: "chat", prompt: sanitizeUserInput(content) };
  }

  if (await isReplyToBot(message, botUserId)) {
    if (RESET_KEYWORDS.has(normalized)) {
      return { type: "reset" };
    }

    return { type: "chat", prompt: sanitizeUserInput(content) };
  }

  return { type: "ignore" };
}
