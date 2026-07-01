import { describe, it, expect } from "vitest";
import {
  emptyDraftPayload,
  isDraftPayload,
  mergeDraftItems,
  parseDraftAnswers,
} from "./attempt-draft.js";

const Q1 = "11111111-1111-4111-8111-111111111111";
const Q2 = "22222222-2222-4222-8222-222222222222";

describe("attempt-draft", () => {
  it("starts with an empty draft payload", () => {
    const draft = emptyDraftPayload();
    expect(isDraftPayload(draft)).toBe(true);
    expect(draft.items).toEqual([]);
  });

  it("merges draft updates idempotently", () => {
    const merged = mergeDraftItems(emptyDraftPayload(), [
      { questionId: Q1, answer: "أ" },
      { questionId: Q2, answer: "صح" },
    ]);
    const again = mergeDraftItems(merged, [{ questionId: Q1, answer: "ب" }]);
    const map = parseDraftAnswers(again);
    expect(map.get(Q1)).toBe("ب");
    expect(map.get(Q2)).toBe("صح");
  });
});
