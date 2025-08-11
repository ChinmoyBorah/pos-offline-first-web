import { DataService, PrintJob } from "./DataService";

const ROLE = (import.meta as any).env?.VITE_ROLE || "manager";
class PrintJobManager {
  private timer: number | undefined;
  private readonly INTERVAL = 5000;

  start() {
    if (this.timer) return;
    this.timer = window.setInterval(() => this.runOnce(), this.INTERVAL);
    this.runOnce();
  }

  runOnce(job?: any) {
    const next = job
    if (next) this.process(next);
  }

  private async process(job: PrintJob) {
    const html = `<pre>${job.content}</pre>`;
    const win = window.open("", "_blank", "width=300,height=600");
    if (win) {
      win.document.write(html);
      win.document.close();
      win.focus();
      win.print();
      win.close();
    }
  }
}

export const printJobManager = new PrintJobManager();
