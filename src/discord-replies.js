export function splitDiscordMessage(text, limit = 1900) {
  if (text.length <= limit) {
    return [text];
  }

  const chunks = [];
  let remaining = text;

  while (remaining.length > limit) {
    const slice = remaining.slice(0, limit);
    const splitAt = Math.max(slice.lastIndexOf("\n"), slice.lastIndexOf(" "));
    const cut = splitAt > limit * 0.6 ? splitAt : limit;
    chunks.push(remaining.slice(0, cut).trim());
    remaining = remaining.slice(cut).trim();
  }

  if (remaining.length > 0) {
    chunks.push(remaining);
  }

  return chunks;
}

export async function sendReply(message, content) {
  const chunks = splitDiscordMessage(content);

  for (let index = 0; index < chunks.length; index += 1) {
    const chunk = chunks[index];
    const payload = {
      content: chunk,
      allowedMentions: { parse: [], repliedUser: false },
    };

    if (index === 0) {
      await message.reply(payload);
      continue;
    }

    await message.channel.send(payload);
  }
}
