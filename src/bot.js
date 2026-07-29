import {
  Client,
  Events,
  GatewayIntentBits,
  Partials,
} from "discord.js";

import { GEMINI_MODEL } from "./config.js";
import { handleGigachadMessage } from "./gemini-client.js";

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

    try {
      await handleGigachadMessage(message, client.user.id);
    } catch (error) {
      console.error("Gigachad message handler failed:", error);
    }
  });

  return client;
}
