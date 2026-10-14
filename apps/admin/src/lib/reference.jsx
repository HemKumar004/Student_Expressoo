import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useAuth } from "@expressoo/shared";

const ReferenceContext = createContext(null);

/**
 * Academic reference data (departments, courses, sections, subjects) used by filters and
 * forms across the console. Loaded once and refreshed after academic changes.
 */
export function ReferenceProvider({ children }) {
  const { api } = useAuth();
  const [data, setData] = useState({ departments: [], courses: [], sections: [], subjects: [], loading: true, error: null });

  const reload = useCallback(async () => {
    try {
      const [d, c, s, sub] = await Promise.all([api.get("/academics/departments"), api.get("/academics/courses"), api.get("/academics/sections"), api.get("/academics/subjects")]);
      setData({ departments: d.items, courses: c.items, sections: s.items, subjects: sub.items, loading: false, error: null });
    } catch (error) {
      setData((x) => ({ ...x, loading: false, error }));
    }
  }, [api]);

  useEffect(() => {
    reload();
  }, [reload]);

  return <ReferenceContext.Provider value={{ ...data, reload }}>{children}</ReferenceContext.Provider>;
}

export function useReference() {
  const ctx = useContext(ReferenceContext);
  if (!ctx) throw new Error("useReference must be used inside <ReferenceProvider>");
  return ctx;
}
