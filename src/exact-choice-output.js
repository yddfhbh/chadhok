export function normalizeExactChoiceAnswer(answer, prompt = "") {
  const text = String(answer ?? "").trim();
  if (!text || !shouldEnforceExactChoiceOutput(prompt)) {
    return text;
  }

  const options = extractChoiceOptions(prompt);
  if (options.length === 0) {
    return text;
  }

  for (const option of options) {
    if (text === option.labeled || text === option.body) {
      return option.body;
    }
  }

  const match = text.match(/^([A-Z]|\d+)[.)]\s+(.+)$/);
  if (!match) {
    return text;
  }

  const body = match[2].trim();
  return options.some((option) => option.body === body)
    ? body
    : text;
}

function shouldEnforceExactChoiceOutput(prompt) {
  const text = String(prompt ?? "");

  return [
    /한 글자도 수정하지 말고 그대로 출력/i,
    /선택한 문장.{0,40}그대로 출력/i,
    /선택 이유.{0,20}출력하지 않는다/i,
    /추가 설명.{0,20}출력하지 않는다/i,
    /번호.{0,20}출력하지 않는다/i,
    /따옴표.{0,20}출력하지 않는다/i,
  ].some((pattern) => pattern.test(text));
}

function extractChoiceOptions(prompt) {
  return String(prompt ?? "")
    .split("\n")
    .map((line) => line.trim())
    .map((line) => {
      const match = line.match(/^([A-Z]|\d+)[.)]\s+(.+)$/);
      if (!match) {
        return null;
      }

      return {
        label: match[1],
        labeled: line,
        body: match[2].trim(),
      };
    })
    .filter(Boolean);
}
