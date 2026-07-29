import { GoogleGenAI } from "@google/genai";

import { GEMINI_API_KEYS, GEMINI_MODELS } from "./config.js";
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

function getClientOrder() {
  const startIndex = nextClientIndex % geminiClients.length;
  const ordered = [];

  for (let offset = 0; offset < geminiClients.length; offset += 1) {
    const index = (startIndex + offset) % geminiClients.length;
    ordered.push(geminiClients[index]);
  }

  nextClientIndex = (startIndex + 1) % geminiClients.length;
  return ordered;
}

export async function generateGigachadReply(prompt, previousInteractionId) {
  let lastError;

  for (const model of GEMINI_MODELS) {
    const clients = getClientOrder();

    for (let attempt = 0; attempt < clients.length; attempt += 1) {
      const client = clients[attempt];

      try {
        return await createInteraction(client, model, prompt, previousInteractionId);
      } catch (error) {
        lastError = error;

        if (previousInteractionId && isMissingHistoryError(error)) {
          try {
            return await createInteraction(client, model, prompt, undefined);
          } catch (retryError) {
            lastError = retryError;

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
