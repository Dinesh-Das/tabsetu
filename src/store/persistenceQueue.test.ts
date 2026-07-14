import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PersistenceQueue,
  subscribeToPersistenceFailures,
  type PersistenceFailure,
} from "@/store/persistenceQueue";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("PersistenceQueue", () => {
  it("continues writing after a rejected operation", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const queue = new PersistenceQueue("test store");
    const writes: string[] = [];

    const failed = queue.enqueue(() => {
      writes.push("failed");
      return Promise.reject(new Error("quota exceeded"));
    });
    await expect(failed).rejects.toThrow("quota exceeded");

    await queue.enqueue(() => {
      writes.push("recovered");
      return Promise.resolve();
    });
    await expect(queue.flush()).resolves.toBeUndefined();
    expect(writes).toEqual(["failed", "recovered"]);
  });

  it("reports failures to UI subscribers", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const failures: PersistenceFailure[] = [];
    const listener = (failure: PersistenceFailure) => failures.push(failure);
    const unsubscribe = subscribeToPersistenceFailures(listener);
    const queue = new PersistenceQueue("sessions");

    await expect(queue.enqueue(() => Promise.reject(new Error("write failed")))).rejects.toThrow(
      "write failed"
    );

    expect(failures).toHaveLength(1);
    expect(failures[0]?.store).toBe("sessions");
    expect(failures[0]?.error).toBeInstanceOf(Error);
    unsubscribe();
  });
});
