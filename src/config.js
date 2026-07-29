import path from "node:path";

const RESET_PRIVILEGED_USER_ID = "635107514471415808";

export const DISCORD_TOKEN = process.env.DISCORD_TOKEN?.trim() || "";
export const GEMINI_API_KEY =
  process.env.GOOGLE_API_KEY?.trim()
  || process.env.GEMINI_API_KEY?.trim()
  || "";
export const GEMINI_MODEL = process.env.GEMINI_MODEL?.trim() || "gemini-3.6-flash";
export const RESET_COMMAND = process.env.RESET_COMMAND?.trim() || "!reset";
export const MAX_PROMPT_CHARS = Number.parseInt(process.env.MAX_PROMPT_CHARS || "4000", 10);
export const RESET_ALLOWED_USER_ID =
  process.env.RESET_ALLOWED_USER_ID?.trim() || RESET_PRIVILEGED_USER_ID;
export const DATA_DIR = path.resolve("data");
export const CONVERSATIONS_PATH = path.join(DATA_DIR, "conversations.json");

const missingEnv = [];

if (!DISCORD_TOKEN) {
  missingEnv.push("DISCORD_TOKEN");
}

if (!GEMINI_API_KEY) {
  missingEnv.push("GEMINI_API_KEY or GOOGLE_API_KEY");
}

if (missingEnv.length > 0) {
  throw new Error(`Missing required environment variables: ${missingEnv.join(", ")}`);
}
