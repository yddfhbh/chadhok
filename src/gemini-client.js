import { GoogleGenAI } from "@google/genai";

import { GEMINI_API_KEYS, GEMINI_MODELS, GOOGLE_GENAI_USE_VERTEXAI } from "./config.js";
import { GIGACHAD_SYSTEM_INSTRUCTION } from "./gigachad-prompt.js";

const geminiClients = GEMINI_API_KEYS.map((apiKey) => new GoogleGenAI({ apiKey }));
let nextClientIndex = 0;

function isMissingHistoryError(error) {
  const status = error?.status;
  const message = String(error?.message ?? "");

  return status === 404
    || /previous[_ ]interaction[_ ]id/i.test(message)
    || /interaction/i.test(message) && /not found/i.test(message);
}

function isRetryableKeyError(error) {
  const status = error?.status;
  const message = String(error?.message ?? "").toLowerCase();

  return status === 429
    || status === 500
    || status === 503
    || message.includes("quota")
    || message.includes("rate limit")
    || message.includes("resource exhausted");
}

function isRetryableModelError(error) {
  const status = error?.status;
  const message = String(error?.message ?? "").toLowerCase();

  return status === 404
    || status === 400
    || status === 500
    || status === 503
    || message.includes("model")
    || message.includes("unsupported")
    || message.includes("not found")
    || message.includes("invalid argument");
}

function isAuthenticationError(error) {
  const status = error?.status ?? error?.statusCode;
  const message = String(error?.message ?? "").toLowerCase();
  const body = String(error?.body ?? "").toLowerCase();

  return status === 401
    || message.includes("unauthenticated")
    || body.includes("unauthenticated")
    || body.includes("access_token_type_unsupported");
}

function getClientOrder() {
  const startIndex = nextClientIndex % geminiClients.length;
  const ordered = [];

  for (let offset = 0; offset < geminiClients.length; offset += 1) {
    const index = (startIndex + offset) % geminiClients.length;
    ordered.push({
      client: geminiClients[index],
      keyIndex: index,
      keyPreview: maskApiKey(GEMINI_API_KEYS[index]),
    });
  }

  nextClientIndex = (startIndex + 1) % geminiClients.length;
  return ordered;
}

function maskApiKey(apiKey) {
  const value = String(apiKey ?? "").trim();
  if (!value) {
    return "(empty)";
  }

  if (value.length <= 8) {
    return `${value.slice(0, 2)}***`;
  }

  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function buildAuthenticationError(error, model, keyIndex, keyPreview) {
  const details = [
    `Gemini authentication failed for model=${model}, keyIndex=${keyIndex}, key=${keyPreview}.`,
    "Check that the key is a Gemini Developer API key from Google AI Studio, not an OAuth token, service-account token, or Vertex credential.",
    "If GOOGLE_GENAI_USE_VERTEXAI is set, remove it or set it to false for this bot.",
    "If the key was restricted in Google Cloud Console, do not restrict it to Generative Language API there. Use AI Studio's 'Restrict to Gemini API only' instead.",
    "If the key is blocked, dormant, leaked, or a broken AQ. auth key, generate a new AI Studio key and replace the old one.",
  ];

  if (GOOGLE_GENAI_USE_VERTEXAI) {
    details.push(`Current GOOGLE_GENAI_USE_VERTEXAI=${GOOGLE_GENAI_USE_VERTEXAI}`);
  }

  const enhancedError = new Error(details.join(" "));
  enhancedError.cause = error;
  enhancedError.status = error?.status ?? error?.statusCode;
  enhancedError.code = "GEMINI_AUTHENTICATION_FAILED";
  return enhancedError;
}

export async function generateGigachadReply(prompt, previousInteractionId) {
  let lastError;

  for (const model of GEMINI_MODELS) {
    const clients = getClientOrder();

    for (let attempt = 0; attempt < clients.length; attempt += 1) {
      const { client, keyIndex, keyPreview } = clients[attempt];

      try {
        return await createInteraction(client, model, prompt, previousInteractionId);
      } catch (error) {
        lastError = error;

        if (isAuthenticationError(error)) {
          throw buildAuthenticationError(error, model, keyIndex, keyPreview);
        }

        if (previousInteractionId && isMissingHistoryError(error)) {
          try {
            return await createInteraction(client, model, prompt, undefined);
          } catch (retryError) {
            lastError = retryError;

            if (isAuthenticationError(retryError)) {
              throw buildAuthenticationError(retryError, model, keyIndex, keyPreview);
            }

            if (
              !isRetryableKeyError(retryError)
              && !isRetryableModelError(retryError)
            ) {
              throw retryError;
            }

            continue;
          }
        }

        if (!isRetryableKeyError(error) && !isRetryableModelError(error)) {
          throw error;
        }
      }
    }
  }

  throw lastError;
}

async function createInteraction(client, model, prompt, previousInteractionId) {
  const interaction = await client.interactions.create({
    model,
    input: prompt,
    previous_interaction_id: previousInteractionId,
    system_instruction: GIGACHAD_SYSTEM_INSTRUCTION,
    store: true,
  });

  return {
    interactionId: interaction.id,
    text: interaction.output_text?.trim()
      || "브로, 지금은 답을 못 뽑았다. 다시 던져.",
  };
}
