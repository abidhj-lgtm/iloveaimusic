"use client";

import { useEffect, useState } from "react";

const DB_NAME = "ilistenai-media";
const STORE = "media";
const memory = new Map<string, Blob>();
const urlCache = new Map<string, string>();
let dbPromise: Promise<IDBDatabase | null> | null = null;

const isDirect = (key: string) =>
  key.startsWith("http") || key.startsWith("data:") || key.startsWith("blob:") || key.startsWith("/");

function openDB(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    try {
      if (typeof indexedDB === "undefined") { resolve(null); return; }
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch { resolve(null); }
  });
  return dbPromise;
}

export async function putMedia(key: string, blob: Blob): Promise<void> {
  memory.set(key, blob);
  const db = await openDB();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(blob, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch { resolve(); }
  });
}

export async function getMedia(key: string): Promise<Blob | null> {
  if (memory.has(key)) return memory.get(key)!;
  const db = await openDB();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => {
        const b = req.result as Blob | undefined;
        if (b) memory.set(key, b);
        resolve(b ?? null);
      };
      req.onerror = () => resolve(null);
    } catch { resolve(null); }
  });
}

export async function getMediaUrl(key: string): Promise<string | null> {
  if (isDirect(key)) return key;
  if (urlCache.has(key)) return urlCache.get(key)!;
  const blob = await getMedia(key);
  if (!blob) return null;
  const url = URL.createObjectURL(blob);
  urlCache.set(key, url);
  return url;
}

export function useMediaUrl(key?: string | null): string | null {
  const [url, setUrl] = useState<string | null>(() => {
    if (!key) return null;
    if (isDirect(key)) return key;
    return urlCache.has(key) ? urlCache.get(key)! : null;
  });
  useEffect(() => {
    let alive = true;
    if (!key) { setUrl(null); return; }
    if (isDirect(key)) { setUrl(key); return; }
    getMediaUrl(key).then((u) => { if (alive) setUrl(u); });
    return () => { alive = false; };
  }, [key]);
  return url;
}