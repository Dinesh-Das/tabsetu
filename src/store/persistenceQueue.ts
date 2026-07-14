export interface PersistenceFailure {
  store: string;
  error: Error;
}

type PersistenceFailureListener = (failure: PersistenceFailure) => void;

const failureListeners = new Set<PersistenceFailureListener>();

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error("Unknown storage error");
}

function reportFailure(store: string, error: unknown): void {
  const failure = { store, error: toError(error) };
  console.error(`[TabSetu] Could not persist ${store}:`, failure.error);
  for (const listener of failureListeners) {
    listener(failure);
  }
}

export function subscribeToPersistenceFailures(listener: PersistenceFailureListener): () => void {
  failureListeners.add(listener);
  return () => failureListeners.delete(listener);
}

/**
 * Serializes storage writes without allowing one rejected write to poison the queue.
 * Callers may await flush() when an action must be durable before continuing.
 */
export class PersistenceQueue {
  private tail: Promise<void> = Promise.resolve();

  constructor(private readonly store: string) {}

  enqueue(write: () => Promise<void>): Promise<void> {
    const operation = this.tail.then(write, write);
    this.tail = operation;
    void operation.catch((error: unknown) => reportFailure(this.store, error));
    return operation;
  }

  flush(): Promise<void> {
    return this.tail;
  }
}
