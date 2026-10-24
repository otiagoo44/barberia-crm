"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  useRef,
  useMemo,
  type SetStateAction,
} from "react";

export const ResourceScope = createContext("public");
const changed = "barberia:resources-changed";
const revoked = "barberia:session-revoked";
export class ApiError extends Error {
  constructor(
    message: string,
    public fields: Record<string, string> = {},
    public requestId?: string,
  ) {
    super(message);
  }
}
function broadcast(event: string) {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(event));
}
async function request(url: string, options: RequestInit) {
  try {
    return await fetch(url, options);
  } catch {
    throw new Error(
      "No pudimos conectar. Revisá tu conexión y volvé a intentar.",
    );
  }
}
export async function api<T>(url: string, body?: unknown): Promise<T> {
  if (
    body !== undefined &&
    /\/api\/auth\/(signout|signin)|\/api\/auth\/mfa\/revoke/.test(url)
  )
    broadcast(revoked);
  const result = await request(
    url,
    body === undefined
      ? { cache: "no-store" }
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
  );
  const json = await result.json();
  if (!result.ok) {
    if (result.status === 401 || result.status === 403) broadcast(revoked);
    throw new ApiError(
      json.error ?? "No pudimos completar la operación.",
      json.fields,
      json.request_id,
    );
  }
  if (body !== undefined) broadcast(changed);
  return json as T;
}
export function resourceUrl(
  resource: string,
  params: Record<string, string | null | undefined>,
) {
  const q = new URLSearchParams();
  for (const [key, value] of Object.entries(params))
    if (value) q.set(key, value);
  return `/api/workspace/${resource}?${q}`;
}
/** No retained/shared response cache. A render can only expose its exact live scope/version. */
export function useResource<T>(url: string | null) {
  const scope = useContext(ResourceScope);
  const [revision, setRevision] = useState(0);
  const refreshQueued = useRef(false);
  const reload = useCallback(() => {
    if (refreshQueued.current) return;
    refreshQueued.current = true;
    setRevision((v) => v + 1);
    setTimeout(() => {
      refreshQueued.current = false;
    }, 0);
  }, []);
  // A → B → A must create a new read, even if B was cancelled before responding.
  const key = useMemo(() => ({ scope, url, revision }), [scope, url, revision]);
  const [state, setState] = useState<{
    key: typeof key | null;
    data: T | null;
    error: string;
  }>({ key: null, data: null, error: "" });
  useEffect(() => {
    if (!url) return;
    const controller = new AbortController();
    const invalidate = reload;
    const invalidateSession = () => {
      controller.abort();
      setState({
        key,
        data: null,
        error:
          "La sesión o los permisos cambiaron. Volvé a entrar o actualizá para comprobar tu acceso.",
      });
    };
    window.addEventListener(changed, invalidate);
    window.addEventListener(revoked, invalidateSession);
    async function load() {
      try {
        const result = await request(url!, {
          cache: "no-store",
          signal: controller.signal,
        });
        const body = await result.json();
        if (controller.signal.aborted) return;
        if (result.status === 401 || result.status === 403) {
          broadcast(revoked);
          return;
        }
        if (!result.ok)
          throw new Error(body.error ?? "No pudimos cargar los datos.");
        setState({ key, data: body as T, error: "" });
      } catch (error) {
        if (!controller.signal.aborted)
          setState({
            key,
            data: null,
            error:
              error instanceof Error ? error.message : "Error de conexión.",
          });
      }
    }
    void load();
    return () => {
      controller.abort();
      window.removeEventListener(changed, invalidate);
      window.removeEventListener(revoked, invalidateSession);
    };
  }, [url, key, reload]);
  const setData = useCallback(
    (value: SetStateAction<T | null>) =>
      setState((current) => {
        if (current.key !== key) return current;
        return {
          ...current,
          data:
            typeof value === "function"
              ? (value as (previous: T | null) => T | null)(current.data)
              : value,
        };
      }),
    [key],
  );
  return {
    data: url && state.key === key ? state.data : null,
    setData,
    loading: !!url && state.key !== key,
    error: url && state.key === key ? state.error : "",
    reload,
  };
}
