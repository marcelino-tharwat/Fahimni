import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Upload, X, FileText, Image } from "lucide-react";

interface ProofFile {
  id: string;
  file: File;
}

interface ProofUploadProps {
  files: ProofFile[];
  onChange: (files: ProofFile[]) => void;
  error?: string;
}

const ALLOWED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
];
const MAX_SIZE = 10 * 1024 * 1024;
const MAX_COUNT = 5;

export function ProofUpload({ files, onChange, error }: ProofUploadProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [typeError, setTypeError] = useState<string | null>(null);

  const handleSelect = () => inputRef.current?.click();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTypeError(null);
    const selected = Array.from(e.target.files ?? []);
    if (selected.length + files.length > MAX_COUNT) {
      setTypeError(t("teacherRequest:maxFiles", { count: MAX_COUNT }));
      return;
    }
    const invalid = selected.find(
      (f) => !ALLOWED_TYPES.includes(f.type) || f.size > MAX_SIZE,
    );
    if (invalid) {
      setTypeError(t("teacherRequest:invalidFile"));
      return;
    }
    const newFiles = selected.map((f) => ({
      id: crypto.randomUUID(),
      file: f,
    }));
    onChange([...files, ...newFiles]);
    e.target.value = "";
  };

  const removeFile = (id: string) => {
    onChange(files.filter((f) => f.id !== id));
  };

  return (
    <div className="flex w-full flex-col gap-2">
      <label className="text-start font-cairo text-sm font-medium text-text-primary">
        {t("teacherRequest:proofDocuments")}
      </label>
      <div
        onClick={handleSelect}
        className="flex cursor-pointer flex-col items-center gap-2 rounded-input border-2 border-dashed border-border bg-surface px-4 py-6 transition hover:border-accent"
      >
        <Upload className="text-text-secondary" size={28} />
        <p className="font-cairo text-sm text-text-secondary">
          {t("teacherRequest:uploadHint")}
        </p>
        <p className="font-cairo text-xs text-text-secondary">
          {t("teacherRequest:uploadFormats")}
        </p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={handleChange}
      />
      {typeError && (
        <span className="text-start text-sm text-danger">{typeError}</span>
      )}
      {error && !typeError && (
        <span className="text-start text-sm text-danger">{error}</span>
      )}
      {files.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {files.map((f) => (
            <li
              key={f.id}
              className="flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2"
            >
              {f.file.type === "application/pdf" ? (
                <FileText size={16} className="shrink-0 text-accent" />
              ) : (
                <Image size={16} className="shrink-0 text-accent" />
              )}
              <span className="flex-1 truncate font-cairo text-sm text-text-primary">
                {f.file.name}
              </span>
              <button
                type="button"
                onClick={() => removeFile(f.id)}
                className="shrink-0 text-text-secondary hover:text-danger"
              >
                <X size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
