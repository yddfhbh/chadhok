import assert from "node:assert/strict";
import test from "node:test";

import { normalizeExactChoiceAnswer } from "../src/exact-choice-output.js";

const exactChoicePrompt = `@채드호크 다음 두 문장 중, 실수한 신입 사원이 상사에게 매우 조심스럽게 사과하는 상황에 더 적합한 문장 하나를 선택하라.

A. 정신 차려. 실수는 약한 놈들이나 숨기는 거다. 당장 해결해.
B. 저... 제가 제대로 확인하지 못한 것 같습니다. 정말 죄송합니다. 혹시 다시 처리해도 괜찮을까요?

선택한 문장을 한 글자도 수정하지 말고 그대로 출력하라.
선택 이유, 번호, 따옴표, 추가 설명은 출력하지 않는다.`;

test("strips choice labels when the prompt demands exact option text only", () => {
  assert.equal(
    normalizeExactChoiceAnswer(
      "B. 저... 제가 제대로 확인하지 못한 것 같습니다. 정말 죄송합니다. 혹시 다시 처리해도 괜찮을까요?",
      exactChoicePrompt
    ),
    "저... 제가 제대로 확인하지 못한 것 같습니다. 정말 죄송합니다. 혹시 다시 처리해도 괜찮을까요?"
  );
});

test("does not strip labels for ordinary prompts", () => {
  assert.equal(
    normalizeExactChoiceAnswer("B. 다음 단계로 진행해.", "할 일을 항목으로 적어줘."),
    "B. 다음 단계로 진행해."
  );
});
