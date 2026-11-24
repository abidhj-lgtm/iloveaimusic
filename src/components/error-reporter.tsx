"use client";

import { useEffect } from "react";

let sent = 0;
const MAX = 6;

function send(payload: { message: string; stack?: string }) {
  if (sent >= MAX) return;
  sent++;
  try {
    void fetch("/api/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      keepalive: true,
      body: JSON.stringify({ ...payload, url: location.href })
    }).catch(() => undefined);
  } catch { /* never break the page */ }
}

export function ErrorReporter() {
  useEffect(() => {
    const onError = (e: ErrorEvent) => {
      send({ message: e.message || "window error", stack: e.error?.stack });
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      const reason = e.reason;
      send({
        message: reason instanceof Error ? reason.message : String(reason ?? "unhandled rejection"),
        stack: reason instanceof Error ? reason.stack : undefined
      });
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}

export function reportClientError(err: unknown, context?: string) {
  const e = err instanceof Error ? err : new Error(String(err));
  send({ message: context ? `${context}: ${e.message}` : e.message, stack: e.stack });
}