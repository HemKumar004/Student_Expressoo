/**
 * Centralised API client. One instance per portal; each keeps its own session token
 * (portals run on separate origins, so storage never collides). Never sends secrets other
 * than the user's own bearer token, and never fabricates successful responses.
 */
export class ApiError extends Error {
  constructor(message, { status = 0, code, details } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details || null;
  }
}

function safeStorage() {
  try {
    const k = "__se_probe__";
    window.localStorage.setItem(k, "1");
    window.localStorage.removeItem(k);
    return window.localStorage;
  } catch {
    const mem = new Map();
    return { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v), removeItem: (k) => mem.delete(k) };
  }
}

function buildQuery(query) {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value)) value.forEach((v) => params.append(key, v));
    else params.set(key, String(value));
  }
  const s = params.toString();
  return s ? `?${s}` : "";
}

function filenameFrom(disposition, fallback) {
  if (!disposition) return fallback;
  const star = /filename\*=UTF-8''([^;]+)/i.exec(disposition);
  if (star) return decodeURIComponent(star[1].replace(/"/g, ""));
  const plain = /filename="?([^";]+)"?/i.exec(disposition);
  return plain ? plain[1] : fallback;
}

export function createApiClient({ baseUrl, portal }) {
  if (!baseUrl) throw new Error("API base URL is not configured (set VITE_API_URL).");
  const root = baseUrl.replace(/\/+$/, "");
  const storage = safeStorage();
  const tokenKey = `expressoo.${portal}.token`;
  const expiredListeners = new Set();

  const getToken = () => storage.getItem(tokenKey);
  const setToken = (token) => storage.setItem(tokenKey, token);
  const clearToken = () => storage.removeItem(tokenKey);

  function handleFailure(status, data, hadToken) {
    const err = new ApiError(data?.error?.message || `Request failed (${status})`, {
      status,
      code: data?.error?.code,
      details: data?.error?.details,
    });
    if (status === 401 && hadToken) {
      clearToken();
      expiredListeners.forEach((fn) => fn(err));
    }
    return err;
  }

  async function request(method, path, { body, query, signal } = {}) {
    const token = getToken();
    const headers = { Accept: "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;
    const isForm = typeof FormData !== "undefined" && body instanceof FormData;
    if (body !== undefined && !isForm) headers["Content-Type"] = "application/json";

    let res;
    try {
      res = await fetch(`${root}${path}${buildQuery(query)}`, {
        method,
        headers,
        ...(body !== undefined && { body: isForm ? body : JSON.stringify(body) }),
        signal,
      });
    } catch (err) {
      if (err?.name === "AbortError") throw err;
      throw new ApiError("Cannot reach the server. Check your connection and try again.", { status: 0, code: "NETWORK" });
    }

    const type = res.headers.get("content-type") || "";
    const data = type.includes("application/json") ? await res.json().catch(() => null) : null;
    if (!res.ok) throw handleFailure(res.status, data, Boolean(token));
    return data;
  }

  /** Multipart upload with progress (fetch cannot report upload progress). */
  function upload(path, formData, { onProgress, signal } = {}) {
    return new Promise((resolve, reject) => {
      const token = getToken();
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${root}${path}`);
      xhr.setRequestHeader("Accept", "application/json");
      if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => {
        let data = null;
        try {
          data = JSON.parse(xhr.responseText);
        } catch {
          /* non-JSON response */
        }
        if (xhr.status >= 200 && xhr.status < 300) resolve(data);
        else reject(handleFailure(xhr.status, data, Boolean(token)));
      };
      xhr.onerror = () => reject(new ApiError("Upload failed — the server could not be reached.", { status: 0, code: "NETWORK" }));
      xhr.onabort = () => reject(new DOMException("Upload cancelled", "AbortError"));
      if (signal) signal.addEventListener("abort", () => xhr.abort(), { once: true });
      xhr.send(formData);
    });
  }

  /** Download an authorised file as a blob and hand it to the browser. */
  async function download(path, fallbackName = "download") {
    const token = getToken();
    let res;
    try {
      res = await fetch(`${root}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    } catch {
      throw new ApiError("Cannot reach the server. Check your connection and try again.", { status: 0, code: "NETWORK" });
    }
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw handleFailure(res.status, data, Boolean(token));
    }
    const blob = await res.blob();
    const name = filenameFrom(res.headers.get("content-disposition"), fallbackName);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return name;
  }

  return {
    portal,
    baseUrl: root,
    get: (path, opts) => request("GET", path, opts),
    post: (path, body, opts) => request("POST", path, { ...opts, body }),
    put: (path, body, opts) => request("PUT", path, { ...opts, body }),
    patch: (path, body, opts) => request("PATCH", path, { ...opts, body }),
    del: (path, opts) => request("DELETE", path, opts),
    upload,
    download,
    getToken,
    setToken,
    clearToken,
    onSessionExpired(fn) {
      expiredListeners.add(fn);
      return () => expiredListeners.delete(fn);
    },
  };
}
