/** Draft answer payload stored in `quiz_attempts.answers` while IN_PROGRESS. */
export interface DraftAnswerItem {
  questionId: string;
  answer: string;
}

export interface DraftAnswersPayload {
  kind: "draft";
  items: DraftAnswerItem[];
}

export function emptyDraftPayload(): DraftAnswersPayload {
  return { kind: "draft", items: [] };
}

export function isDraftPayload(value: unknown): value is DraftAnswersPayload {
  return (
    !!value &&
    typeof value === "object" &&
    (value as DraftAnswersPayload).kind === "draft" &&
    Array.isArray((value as DraftAnswersPayload).items)
  );
}

export function parseDraftAnswers(value: unknown): Map<string, string> {
  const map = new Map<string, string>();
  if (!isDraftPayload(value)) {
    return map;
  }
  for (const item of value.items) {
    if (item?.questionId && typeof item.answer === "string") {
      map.set(item.questionId, item.answer);
    }
  }
  return map;
}

export function mergeDraftItems(
  existing: unknown,
  updates: DraftAnswerItem[],
): DraftAnswersPayload {
  const map = parseDraftAnswers(existing);
  for (const u of updates) {
    map.set(u.questionId, u.answer);
  }
  return {
    kind: "draft",
    items: [...map.entries()].map(([questionId, answer]) => ({
      questionId,
      answer,
    })),
  };
}

export function draftItemsToArray(value: unknown): DraftAnswerItem[] {
  if (!isDraftPayload(value)) {
    return [];
  }
  return value.items;
}
