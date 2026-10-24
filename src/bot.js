import {
  Client,
  Events,
  GatewayIntentBits,
  Partials,
} from "discord.js";

import {
  GEMINI_MODEL, PEER_CHAT_GUILD_ID, PEER_CHAT_BOT_IDS,
  PEER_CHAT_OWNER_ID, PEER_CHAT_FILE,
  PEER_CHAT_COOLDOWN_MS,
} from "./config.js";
import { PeerChat } from "./peer-chat.js";
import { handleCommand } from "./commands.js";
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

  const peerChat = new PeerChat({
    filePath: PEER_CHAT_FILE,
    guildId: PEER_CHAT_GUILD_ID,
    peerIds: PEER_CHAT_BOT_IDS,
    ownerId: PEER_CHAT_OWNER_ID,
    cooldownMs: PEER_CHAT_COOLDOWN_MS,
  });

  client.once(Events.ClientReady, (readyClient) => {
    console.log(`Logged in as ${readyClient.user.tag}`);
    console.log(`Model: ${GEMINI_MODEL}`);
  });

  client.on(Events.MessageCreate, async (message) => {
    if (!client.user || message.webhookId || message.author.id === client.user.id) return;
    try {
      if (message.author.bot) {
        if (!peerChat.isPeerMessage(message, client.user.id)) return;
        await peerChat.observe(message, client.user.id, (candidate, canSend) =>
          handleGigachadMessage(candidate, client.user.id, { peer: true, canSend }));
        return;
      }
      await handleGigachadMessage(message, client.user.id);
    } catch (error) {
      console.error("Gigachad message handler failed:", error);
    }
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    try {
      await handleCommand(interaction, { peerChat, ownerId: PEER_CHAT_OWNER_ID });
    } catch (error) {
      console.error("Chadhok interaction failed:", error?.name ?? "unknown");
      if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
        try { await interaction.reply({ content: "명령 처리 실패", ephemeral: true }); }
        catch { /* expired */ }
      }
    }
  });

  return client;
}
