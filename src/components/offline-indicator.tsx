"use client";

import React, { useEffect, useState } from "react";
import { WifiOff, Wifi } from "lucide-react";
import { getQueueSize, replayQueue } from "@/lib/offline-queue";
import { useToast } from "@/lib/store";

export function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [queueSize, setQueueSize] = useState(0);
  const toast = useToast();

  useEffect(() => {
    if (typeof window === "undefined") return;

    const updateStatus = () => {
      setIsOnline(navigator.onLine);
      setQueueSize(getQueueSize());
    };

    updateStatus();
    window.addEventListener("online", updateStatus);
    window.addEventListener("offline", updateStatus);

    // Listen for SW messages
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "REPLAY_QUEUE") {
        void handleSync();
      }
    };
    navigator.serviceWorker?.addEventListener("message", handleMessage);

    return () => {
      window.removeEventListener("online", updateStatus);
      window.removeEventListener("offline", updateStatus);
      navigator.serviceWorker?.removeEventListener("message", handleMessage);
    };
  }, []);

  // Auto-sync when coming back online
  useEffect(() => {
    if (isOnline && queueSize > 0) {
      void handleSync();
    }
  }, [isOnline, queueSize]);

  const handleSync = async () => {
    if (isSyncing || queueSize === 0) return;
    setIsSyncing(true);
    try {
      const { succeeded, failed } = await replayQueue();
      setQueueSize(getQueueSize());
      if (succeeded > 0) {
        toast.push({ kind: "ok", msg: `Synced ${succeeded} action${succeeded === 1 ? "" : "s"}.` });
      }
      if (failed > 0) {
        toast.push({ kind: "err", msg: `${failed} action${failed === 1 ? "" : "s"} failed to sync.` });
      }
    } catch {
      toast.push({ kind: "err", msg: "Sync failed. Will retry later." });
    } finally {
      setIsSyncing(false);
    }
  };

  // Don't show if online and no queue
  if (isOnline && queueSize === 0) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 pointer-events-none">
      <div className={`flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium transition-all ${
        isOnline
          ? "bg-green-600/90 text-white"
          : "bg-amber-600/90 text-white"
      }`}>
        {isOnline ? (
          <>
            {isSyncing ? (
              <>
                <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Syncing {queueSize} action{queueSize === 1 ? "" : "s"}…</span>
              </>
            ) : (
              <>
                <Wifi size={14} />
                <span>Back online</span>
              </>
            )}
          </>
        ) : (
          <>
            <WifiOff size={14} />
            <span>
              You're offline
              {queueSize > 0 && ` · ${queueSize} action${queueSize === 1 ? "" : "s"} queued`}
            </span>
          </>
        )}
      </div>
    </div>
  );
}