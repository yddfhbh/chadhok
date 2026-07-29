import { GoogleGenAI } from "@google/genai";

import { GEMINI_API_KEY, GEMINI_MODEL } from "./config.js";
import { GIGACHAD_SYSTEM_INSTRUCTION } from "./gigachad-prompt.js";

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

function isMissingHistoryError(error) {
  const status = error?.status;
  const message = String(error?.message ?? "");

  return status === 404
    || /previous[_ ]interaction[_ ]id/i.test(message)
    || /interaction/i.test(message) && /not found/i.test(message);
}

export async function generateGigachadReply(prompt, previousInteractionId) {
  try {
    return await createInteraction(prompt, previousInteractionId);
  } catch (error) {
    if (!previousInteractionId || !isMissingHistoryError(error)) {
      throw error;
    }

    return createInteraction(prompt, undefined);
  }
}

async function createInteraction(prompt, previousInteractionId) {
  const interaction = await ai.interactions.create({
    model: GEMINI_MODEL,
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
