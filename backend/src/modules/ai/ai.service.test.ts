import { describe, it, expect, vi, beforeEach } from "vitest";

vi.hoisted(() => {
  process.env.GEMINI_API_KEY = "test-key";
});
vi.mock("../../config/database.js", () => ({ prisma: {} }));
vi.mock("../../shared/services/geminiClient.js", () => ({
  geminiClient: { embedContent: vi.fn() },
}));

import { AiService, EXPECTED_EMBEDDING_DIMENSION } from "./ai.service.js";

describe("AiService.chunkText", () => {
  const service = new AiService();

  it("splits on paragraph boundaries and drops empty blocks", () => {
    const chunks = service.chunkText("أول فقرة.\n\n\n\nثاني فقرة أطول بما يكفي لتكون مستقلة.");
    expect(chunks.length).toBeGreaterThanOrEqual(1);
    expect(chunks.every((c) => c.content.trim().length > 0)).toBe(true);
  });

  it("preserves Arabic text", () => {
    const text = "الكيمياء علم يدرس المادة وتحولاتها.\n\nالذرة هي أصغر وحدة كيميائية.";
    const chunks = service.chunkText(text);
    expect(chunks[0]!.content).toContain("الكيمياء");
  });

  it("returns no chunks for whitespace-only input", () => {
    expect(service.chunkText("   \n\n\t  ")).toHaveLength(0);
  });
});

describe("EXPECTED_EMBEDDING_DIMENSION", () => {
  it("matches pgvector column size", () => {
    expect(EXPECTED_EMBEDDING_DIMENSION).toBe(3072);
  });
});
