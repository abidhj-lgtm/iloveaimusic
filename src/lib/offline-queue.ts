// Offline queue for background sync of likes, comments, saves
const QUEUE_KEY = "ilistenai:offline-queue";

export interface QueuedAction {
  id: string;
  url: string;
  method: string;
  body?: any;
  timestamp: number;
  retries: number;
}

export function getQueue(): QueuedAction[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addToQueue(action: Omit<QueuedAction, "id" | "timestamp" | "retries">): void {
  const queue = getQueue();
  queue.push({
    ...action,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    timestamp: Date.now(),
    retries: 0,
  });
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export function removeFromQueue(id: string): void {
  const queue = getQueue().filter((a) => a.id !== id);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export function clearQueue(): void {
  localStorage.removeItem(QUEUE_KEY);
}

export async function replayQueue(onProgress?: (current: number, total: number) => void): Promise<{
  succeeded: number;
  failed: number;
}> {
  const queue = getQueue();
  if (queue.length === 0) return { succeeded: 0, failed: 0 };

  let succeeded = 0;
  let failed = 0;

  for (let i = 0; i < queue.length; i++) {
    const action = queue[i];
    onProgress?.(i + 1, queue.length);

    try {
      const res = await fetch(action.url, {
        method: action.method,
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: action.body ? JSON.stringify(action.body) : undefined,
      });

      if (res.ok) {
        removeFromQueue(action.id);
        succeeded++;
      } else {
        action.retries++;
        if (action.retries >= 3) {
          removeFromQueue(action.id);
          failed++;
        } else {
          // Update retries count
          const updated = getQueue().map((a) => (a.id === action.id ? action : a));
          localStorage.setItem(QUEUE_KEY, JSON.stringify(updated));
          failed++;
        }
      }
    } catch {
      action.retries++;
      if (action.retries >= 3) {
        removeFromQueue(action.id);
        failed++;
      }
    }
  }

  return { succeeded, failed };
}

export function getQueueSize(): number {
  return getQueue().length;
}