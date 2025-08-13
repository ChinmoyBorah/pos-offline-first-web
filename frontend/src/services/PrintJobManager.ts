import { DataService, PrintJob } from "./DataService";
import { PrintConfig } from "./PrintConfig";

const ROLE = (import.meta as any).env?.VITE_ROLE || "manager";
function handlesDest(dest: string): boolean {
  if (ROLE === "cashier" || ROLE === "manager") return dest === "receipt";
  if (ROLE === "kitchen") return dest === "kitchen";
  return false;
}
// failure mocking handled via PrintConfig

class PrintJobManager {
  private timer: number | undefined;
  private readonly INTERVAL = 6000; // 6 seconds
  private readonly PROCESS_TIME = 5000;
  private readonly MAX_RETRY = 3;

  constructor() {
    // Ensure cleanup when tab closes / reloads
    window.addEventListener("beforeunload", () => this.stop());
    window.addEventListener("pagehide", () => this.stop());
  }

  start() {
    if (this.timer) return;
    // recover any stuck 'printing' jobs (e.g. after reload) back to 'queued'
    const jobs = DataService.getPrintJobs();
    let mutated = false;
    for (const j of jobs) {
      if (j.status === "printing") {
        j.status = "queued";
        j.startedAt = undefined;
        j.finishedAt = undefined;
        mutated = true;
      }
    }
    if (mutated) DataService.savePrintJobs(jobs);
    this.timer = window.setInterval(() => this.runOnce(), this.INTERVAL);
    this.runOnce();
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  runOnce() {
    const jobs = DataService.getPrintJobs();
    const next = jobs
      .filter((j: PrintJob) => j.status === "queued" && handlesDest(j.dest))
      .sort((a: PrintJob, b: PrintJob) => a.priority - b.priority)[0];
    console.log("next", next, jobs);

    if (!next) {
      // nothing left → shutdown interval to save CPU
      this.stop();
      return;
    }
    this.process(next);
  }

  add(job: Omit<PrintJob, "id" | "status" | "attempts">) {
    const pj: PrintJob = {
      id: crypto.randomUUID(),
      attempts: 0,
      status: "queued",
      ...job,
    } as PrintJob;
    const list = DataService.getPrintJobs();
    const hadProcessable = list.some(
      (j) => j.status === "queued" && handlesDest(j.dest)
    );
    list.push(pj);
    DataService.savePrintJobs(list);
    // If there was nothing processable before, ensure we start now (after save)
    if (!hadProcessable && handlesDest(pj.dest)) {
      this.start();
    }
  }

  retry(id: string) {
    DataService.updatePrintJobStatus(id, "queued");
  }

  private async process(job: PrintJob) {
    DataService.updatePrintJobStatus(job.id, "printing");
    const ok = await this.print(job);
    if (ok) {
      DataService.updatePrintJobStatus(job.id, "done");
      setTimeout(() => {
        DataService.removePrintJob(job.id);
      }, 2000);
    } else {
      DataService.updatePrintJobStatus(job.id, "error");
    }
  }

  private async print(job: PrintJob): Promise<boolean> {
    // artificial delay to let UI show progress bar
    await new Promise((res) => setTimeout(res, this.PROCESS_TIME));

    // developer-triggered failure flag
    if (PrintConfig.consumeFailFlag()) {
      return false;
    }

    try {
      // Simulated print success (we avoid real pop-ups to prevent blocker failures)
      return true;
    } catch {
      return true;
    }
  }
}

export const printJobManager = new PrintJobManager();
