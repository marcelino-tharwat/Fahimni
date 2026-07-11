import { useState, useEffect } from "react";
import { apiClient } from "@/shared/lib/api/client";
import type { Subject } from "./types";

let cachedSubjects: Subject[] | null = null;
let inflightPromise: Promise<Subject[]> | null = null;

async function fetchSubjects(): Promise<Subject[]> {
  if (cachedSubjects) return cachedSubjects;
  if (inflightPromise) return inflightPromise;

  inflightPromise = apiClient
    .get<{ data: Subject[] }>("/subjects")
    .then((res) => {
      const data = res.data.data ?? [];
      cachedSubjects = data;
      return data;
    })
    .finally(() => {
      inflightPromise = null;
    });

  return inflightPromise;
}

export function useSubjects() {
  const [subjects, setSubjects] = useState<Subject[]>(cachedSubjects ?? []);
  const [loading, setLoading] = useState(!cachedSubjects);

  useEffect(() => {
    if (cachedSubjects) {
      setSubjects(cachedSubjects);
      setLoading(false);
      return;
    }
    let cancelled = false;
    fetchSubjects().then((data) => {
      if (!cancelled) {
        setSubjects(data);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return { subjects, loading };
}
