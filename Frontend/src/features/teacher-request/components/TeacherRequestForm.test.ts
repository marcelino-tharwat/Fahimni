import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(resolve(here, rel), "utf8");

const formSource = read("./TeacherRequestForm.tsx");
const proofUploadSource = read("./ProofUpload.tsx");

describe("TeacherRequestForm — static guards (node env)", () => {
  it("renders the page title", () => {
    expect(formSource).toContain("pageTitle");
  });

  it("displays reference number after success", () => {
    expect(formSource).toContain("publicReference");
    expect(formSource).toContain("referenceNumber");
  });

  it("includes consent checkbox", () => {
    expect(formSource).toContain("consent");
    expect(formSource).toContain('type="checkbox"');
  });

  it("shows success state after submission", () => {
    expect(formSource).toContain("successData");
    expect(formSource).toContain("CheckCircle");
    expect(formSource).toContain("successTitle");
    expect(formSource).toContain("successMessage");
  });

  it("displays error state", () => {
    expect(formSource).toContain("submitError");
    expect(formSource).toContain("red-50");
  });

  it("has loading state that disables submit", () => {
    expect(formSource).toContain("submitting");
    expect(formSource).toContain("loading={submitting}");
  });

  it("validates required fields via zod schema", () => {
    expect(formSource).toContain("fullName");
    expect(formSource).toContain(".trim().min(2");
    expect(formSource).toContain("email");
    expect(formSource).toContain(".toLowerCase()");
    expect(formSource).toContain("mobile");
    expect(formSource).toContain("consent");
    expect(formSource).toContain("z.literal(true");
  });

  it("validates Egyptian mobile number format", () => {
    expect(formSource).toContain("+20|0");
    expect(formSource).toContain("10|11|12|15");
  });

  it("requires at least one proof document", () => {
    expect(formSource).toContain("proofFiles.length < 1");
    expect(formSource).toContain("minProofRequired");
  });

  it("sends multipart/form-data request", () => {
    expect(formSource).toContain("FormData");
    expect(formSource).toContain('"proofDocuments"');
    expect(formSource).toContain('"Content-Type"');
  });

  it("handles duplicate pending request error", () => {
    expect(formSource).toContain("catch");
    expect(formSource).toContain("submitError");
  });

  it("does not submit status field", () => {
    expect(formSource).not.toContain("append(\"status\"");
    expect(formSource).not.toContain("append('status'");
  });

  it("does not submit adminNotes field", () => {
    expect(formSource).not.toContain("adminNotes");
  });

  it("does not submit reviewedBy field", () => {
    expect(formSource).not.toContain("reviewedBy");
    expect(formSource).not.toContain("reviewedAt");
  });

  it("does not include approve/reject buttons", () => {
    expect(formSource).not.toContain("approve");
    expect(formSource).not.toContain("reject");
  });

  it("does not use mock data", () => {
    expect(formSource).not.toMatch(/mock/);
  });

  it("uses ProofUpload component", () => {
    expect(formSource).toContain("ProofUpload");
  });
});

describe("ProofUpload — static guards", () => {
  it("validates allowed MIME types", () => {
    expect(proofUploadSource).toContain("application/pdf");
    expect(proofUploadSource).toContain("image/jpeg");
    expect(proofUploadSource).toContain("image/png");
    expect(proofUploadSource).toContain("image/webp");
  });

  it("has maximum file count limit", () => {
    expect(proofUploadSource).toContain("MAX_COUNT");
    expect(proofUploadSource).toContain("MAX_SIZE");
  });

  it("shows file list with remove button", () => {
    expect(proofUploadSource).toContain("removeFile");
    expect(proofUploadSource).toContain("X");
  });

  it("displays file type error messages", () => {
    expect(proofUploadSource).toContain("typeError");
    expect(proofUploadSource).toContain("invalidFile");
  });

  it("shows file type icons for PDF and images", () => {
    expect(proofUploadSource).toContain("FileText");
    expect(proofUploadSource).toContain("Image");
  });

  it("does not send file path or storage key to frontend", () => {
    expect(proofUploadSource).not.toContain("storageKey");
    expect(proofUploadSource).not.toContain("filePath");
  });

  it("does not include admin controls", () => {
    expect(proofUploadSource).not.toContain("approve");
    expect(proofUploadSource).not.toContain("reject");
  });
});
