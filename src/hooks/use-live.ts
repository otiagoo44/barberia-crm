"use client";
import { useEffect, useRef, useState } from "react";
export type LiveChange = { table?: string; id?: string; type: string };
export function useLive(
  org: string,
  branch: string,
  onChange: (change: LiveChange) => void,
) {
  const callback = useRef(onChange);
  const [state, setState] = useState("Conectando…");
  useEffect(() => {
    callback.current = onChange;
  }, [onChange]);
  useEffect(() => {
    if (!branch) return;
    const source = new EventSource(`/api/live?org=${org}&branch=${branch}`);
    let connected = false;
    source.onmessage = (e) => {
      const message = JSON.parse(e.data) as LiveChange;
      if (message.type === "connected") {
        setState("En vivo");
        if (connected) callback.current({ type: "reconnected" });
        connected = true;
      } else if (message.type === "disconnected")
        setState("Sin conexión en vivo · podés actualizar");
      else callback.current(message);
    };
    source.onerror = () => setState("Sin conexión en vivo · podés actualizar");
    const visible = () => {
      if (document.visibilityState === "visible")
        callback.current({ type: "visible" });
    };
    document.addEventListener("visibilitychange", visible);
    return () => {
      source.close();
      document.removeEventListener("visibilitychange", visible);
    };
  }, [org, branch]);
  return state;
}
