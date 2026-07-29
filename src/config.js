import path from "node:path";

const RESET_PRIVILEGED_USER_ID = "635107514471415808";
const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash-lite";

function parseCommaSeparatedValues(value) {
  return String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function getUniqueValues(values) {
  return [...new Set(values.filter(Boolean))];
}

export const DISCORD_TOKEN = process.env.DISCORD_TOKEN?.trim() || "";
export const GEMINI_API_KEYS = getUniqueValues([
  ...parseCommaSeparatedValues(process.env.GEMINI_API_KEYS),
  process.env.GEMINI_API_KEY?.trim(),
  process.env.GOOGLE_API_KEY?.trim(),
]);
export const GEMINI_MODEL = process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
export const GEMINI_FALLBACK_MODELS = getUniqueValues([
  ...parseCommaSeparatedValues(process.env.GEMINI_FALLBACK_MODELS),
  "gemini-3.1-flash-lite",
]);
export const GEMINI_MODELS = getUniqueValues([GEMINI_MODEL, ...GEMINI_FALLBACK_MODELS]);
export const GOOGLE_GENAI_USE_VERTEXAI = process.env.GOOGLE_GENAI_USE_VERTEXAI?.trim() || "";
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

if (GEMINI_API_KEYS.length === 0) {
  missingEnv.push("GEMINI_API_KEYS or GEMINI_API_KEY or GOOGLE_API_KEY");
}

if (missingEnv.length > 0) {
  throw new Error(`Missing required environment variables: ${missingEnv.join(", ")}`);
}
