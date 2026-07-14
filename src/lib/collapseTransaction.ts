import type { UndoCollapseBuffer } from "@/types";

interface CollapseTransactionOptions {
  buffer: UndoCollapseBuffer;
  flushSession: () => Promise<void>;
  persistUndoBuffer: (buffer: UndoCollapseBuffer) => Promise<void>;
  closeBrowserTabs: () => Promise<void>;
}

export async function commitCollapseTransaction({
  buffer,
  flushSession,
  persistUndoBuffer,
  closeBrowserTabs,
}: CollapseTransactionOptions): Promise<void> {
  await flushSession();
  await persistUndoBuffer(buffer);
  await closeBrowserTabs();
}
