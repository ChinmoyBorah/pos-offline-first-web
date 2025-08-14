import { describe, it, expect, beforeEach, vi } from "vitest";
import { DataService } from "../src/services/DataService";
import { printJobManager } from "../src/services/PrintJobManager";

vi.useFakeTimers();

describe("PrintJobManager", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("processes a queued job to done", async () => {
    printJobManager.add({
      orderId: "o1",
      dest: "receipt",
      priority: 1,
      html: "<p>test</p>",
    });

    // 6s covers 5s processing + <2s before auto-removal kicks in
    await vi.advanceTimersByTimeAsync(6000);

    const [job] = DataService.getPrintJobs();
    expect(job?.status).toBe("done");
  });
});
