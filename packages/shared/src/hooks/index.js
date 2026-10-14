import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Load data from the API. Keeps the previous data while refetching (no layout jump),
 * ignores stale responses, and exposes `refetch` / `setData` for optimistic updates.
 */
export function useApi(fetcher, deps = [], { enabled = true } = {}) {
  const [state, setState] = useState({ data: undefined, error: null, loading: enabled });
  const requestId = useRef(0);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const run = useCallback(async () => {
    const id = ++requestId.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await fetcherRef.current();
      if (id === requestId.current) setState({ data, error: null, loading: false });
      return data;
    } catch (error) {
      if (error?.name === "AbortError") return undefined;
      if (id === requestId.current) setState((s) => ({ ...s, error, loading: false }));
      return undefined;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    if (enabled) run();
    else setState((s) => ({ ...s, loading: false }));
  }, [run, enabled]);

  const setData = useCallback((updater) => {
    setState((s) => ({ ...s, data: typeof updater === "function" ? updater(s.data) : updater }));
  }, []);

  return { ...state, refetch: run, setData, initialLoading: state.loading && state.data === undefined };
}

export function useDebouncedValue(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

let titleSuffix = "Student Expressoo";
export function setTitleSuffix(suffix) {
  titleSuffix = suffix;
}

export function usePageTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · ${titleSuffix}` : titleSuffix;
  }, [title]);
}

export function useMediaQuery(query) {
  const get = () => (typeof window !== "undefined" ? window.matchMedia(query).matches : false);
  const [matches, setMatches] = useState(get);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    mql.addEventListener("change", onChange);
    onChange();
    return () => mql.removeEventListener("change", onChange);
  }, [query]);
  return matches;
}

/** Close on outside click / Escape. */
export function useDismiss(ref, open, onClose) {
  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("touchstart", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("touchstart", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [ref, open, onClose]);
}

/** Paginated list state synced to a filters object. */
export function useListState(initial = {}) {
  const [filters, setFilters] = useState({ page: 1, pageSize: 20, ...initial });
  const update = useCallback((patch) => setFilters((f) => ({ ...f, page: 1, ...patch })), []);
  const setPage = useCallback((page) => setFilters((f) => ({ ...f, page })), []);
  return { filters, update, setPage, setFilters };
}

/** Field-level errors from an ApiError (validation details) merged with local errors. */
export function fieldErrors(error) {
  return error?.details && typeof error.details === "object" ? error.details : {};
}

let configPromise = null;
/** Public server rules (periods per day, upload limits, thresholds), fetched once per session. */
export function useAppConfig(api) {
  const [config, setConfig] = useState(null);
  useEffect(() => {
    let alive = true;
    configPromise = configPromise || api.get("/meta/config");
    configPromise
      .then((c) => alive && setConfig(c))
      .catch(() => {
        configPromise = null;
      });
    return () => {
      alive = false;
    };
  }, [api]);
  return config;
}
