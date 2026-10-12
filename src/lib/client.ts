"use client";
import { useCallback, useEffect, useState } from "react";
export async function api<T>(url: string, body?: unknown): Promise<T> {
  const result = await fetch(
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
  if (!result.ok)
    throw new Error(json.error ?? "No pudimos completar la operación.");
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
export function useResource<T>(url: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [source, setSource] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!url);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!url) return;
    const requestUrl = url;
    const controller = new AbortController();
    async function load() {
      try {
        const result = await fetch(requestUrl, {
          cache: "no-store",
          signal: controller.signal,
        });
        const body = await result.json();
        if (!result.ok)
          throw new Error(body.error ?? "No pudimos cargar los datos.");
        setData(body as T);
        setError("");
      } catch (e) {
        if (!controller.signal.aborted) {
          setData(null);
          setError(e instanceof Error ? e.message : "Error de conexión.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setSource(requestUrl);
          setLoading(false);
        }
      }
    }
    void load();
    return () => controller.abort();
  }, [url, revision]);
  const reload = useCallback(() => {
    setLoading(true);
    setRevision((v) => v + 1);
  }, []);
  return {
    data: source === url ? data : null,
    setData,
    loading: !!url && (loading || source !== url),
    error: source === url ? error : "",
    reload,
  };
}
