import { describe, it, expect } from "vitest";
import {
  buildContentDisposition,
  sanitizeContentDispositionFilename,
} from "./material-filename.util.js";

describe("material-filename.util", () => {
  it("strips CRLF from filenames", () => {
    const { filename, filenameStar } = sanitizeContentDispositionFilename(
      "ملخص\r\nlesson.pdf",
    );
    expect(filenameStar).not.toContain("\r");
    expect(filenameStar).not.toContain("\n");
    expect(filename).toBeTruthy();
  });

  it("builds attachment disposition with UTF-8 filename*", () => {
    const header = buildContentDisposition("ورقة عمل.pdf", "attachment");
    expect(header).toContain("attachment");
    expect(header).toContain("filename*=");
  });

  it("builds inline disposition for preview", () => {
    const header = buildContentDisposition("notes.pdf", "inline");
    expect(header.startsWith("inline")).toBe(true);
  });
});
