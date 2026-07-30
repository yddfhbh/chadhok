import { PermissionsBitField } from "discord.js";

import { RESET_ALLOWED_USER_ID } from "./config.js";

export async function canResetConversation(message) {
  if (message.author.id === RESET_ALLOWED_USER_ID) {
    return true;
  }

  const member =
    message.member
    ?? await message.guild?.members.fetch(message.author.id).catch(() => null);

  return member?.permissions.has(PermissionsBitField.Flags.Administrator) ?? false;
}
