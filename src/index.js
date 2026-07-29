import "dotenv/config";

import { buildDiscordClient } from "./bot.js";
import { DISCORD_TOKEN } from "./config.js";

const client = buildDiscordClient();

client.login(DISCORD_TOKEN);
