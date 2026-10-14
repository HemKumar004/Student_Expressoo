import { useMemo } from "react";
import { useApi, useAuth } from "@expressoo/shared";

/** The (subject, section) pairs this staff member teaches, plus derived option lists. */
export function useAssignments() {
  const { api } = useAuth();
  const query = useApi(() => api.get("/academics/assignments/mine"), []);
  const derived = useMemo(() => {
    const items = query.data?.items || [];
    const sections = [];
    const seen = new Set();
    for (const a of items) {
      if (!seen.has(a.section.id)) {
        seen.add(a.section.id);
        sections.push(a.section);
      }
    }
    const subjects = [];
    const seenSubjects = new Set();
    for (const a of items) {
      if (!seenSubjects.has(a.subject.id)) {
        seenSubjects.add(a.subject.id);
        subjects.push(a.subject);
      }
    }
    return { items, sections, subjects };
  }, [query.data]);
  return { ...query, ...derived };
}

export const assignmentLabel = (a) => `${a.subject.code} · ${a.section.label}`;
