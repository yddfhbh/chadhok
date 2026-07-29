import { PermissionsBitField } from "discord.js";

import { RESET_ALLOWED_USER_ID } from "./config.js";

export function canResetConversation(message) {
  if (message.author.id === RESET_ALLOWED_USER_ID) {
    return true;
  }

  return Boolean(
    message.memberPermissions?.has(PermissionsBitField.Flags.Administrator)
  );
}
