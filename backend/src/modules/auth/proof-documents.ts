import { v4 as uuidv4 } from "uuid";
import { supabase } from "../../config/supabase.js";
import { logger } from "../../config/logger.js";

/** Stored proof-document metadata. `path` is the private storage key (null if the
 * upload was skipped/failed — the request still records the file's metadata). */
export interface ProofDocument {
  originalName: string;
  mimeType: string;
  size: number;
  path: string | null;
}

const SUPABASE_BUCKET = process.env.SUPABASE_BUCKET_NAME ?? "";

/**
 * Upload teacher-registration proof files to storage and return their metadata.
 *
 * Every file's metadata is recorded regardless of upload outcome, so registration
 * never fails just because storage hiccuped (admin sees the file names; a missing
 * path renders as UNAVAILABLE and cannot be signed). In the test environment the
 * external Supabase call is skipped to keep e2e hermetic — metadata is still stored.
 */
export async function uploadProofDocuments(
  requestId: string,
  files: Express.Multer.File[],
): Promise<ProofDocument[]> {
  const docs: ProofDocument[] = [];
  const skipStorage = process.env.NODE_ENV === "test" || !SUPABASE_BUCKET;

  for (const file of files) {
    const doc: ProofDocument = {
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      path: null,
    };

    if (!skipStorage) {
      try {
        const ext = file.originalname.split(".").pop() ?? "bin";
        const key = `teacher-registration-requests/${requestId}/${uuidv4()}.${ext}`;
        const { error } = await supabase.storage
          .from(SUPABASE_BUCKET)
          .upload(key, file.buffer, { contentType: file.mimetype });
        if (error) throw error;
        doc.path = key;
      } catch (err) {
        logger.warn("teacher_register_proof_upload_failed", {
          requestId,
          errorName: err instanceof Error ? err.name : "UnknownError",
        });
      }
    }

    docs.push(doc);
  }

  return docs;
}

/** Best-effort cleanup of uploaded proof files (called if DB persistence fails). */
export async function removeProofDocuments(docs: ProofDocument[]): Promise<void> {
  if (!SUPABASE_BUCKET) return;
  const paths = docs.map((d) => d.path).filter((p): p is string => !!p);
  if (paths.length === 0) return;
  await supabase.storage
    .from(SUPABASE_BUCKET)
    .remove(paths)
    .catch((err) =>
      logger.warn("teacher_register_proof_cleanup_failed", {
        errorName: err instanceof Error ? err.name : "UnknownError",
      }),
    );
}
