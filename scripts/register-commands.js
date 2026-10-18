import "dotenv/config";
import { REST, Routes } from "discord.js";
import { DISCORD_TOKEN, PEER_CHAT_GUILD_ID } from "../src/config.js";
import { definitions } from "../src/commands.js";

const applicationId = process.env.DISCORD_CLIENT_ID?.trim();
if (!/^\d{15,22}$/.test(applicationId ?? "") ||
    !/^\d{15,22}$/.test(PEER_CHAT_GUILD_ID)) {
  throw new Error("DISCORD_CLIENT_ID와 PEER_CHAT_GUILD_ID를 설정해야 합니다.");
}

const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);
const endpoint = Routes.applicationGuildCommands(applicationId, PEER_CHAT_GUILD_ID);
const existing = await rest.get(endpoint);
const desiredNames = new Set(definitions.map(command => command.name));

for (const command of definitions) {
  const prior = existing.find(c => c.name === command.name);
  if (prior) await rest.patch(Routes.applicationGuildCommand(applicationId, PEER_CHAT_GUILD_ID, prior.id), { body: command.toJSON() });
  else await rest.post(endpoint, { body: command.toJSON() });
}
// Never delete the bot's other guild commands.
console.log("Registered chadhok commands:", [...desiredNames].join(", "));
