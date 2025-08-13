export const PrintConfig = {
  /** If true, the very next print job will fail once */
  shouldFailNext: false,
  failOnce() {
    this.shouldFailNext = true;
  },
  consumeFailFlag(): boolean {
    const v = this.shouldFailNext;
    this.shouldFailNext = false;
    return v;
  },
};

// Expose for dev console debugging
//    window.PrintConfig.failOnce()
declare global {
  interface Window {
    PrintConfig: typeof PrintConfig;
  }
}
// eslint-disable-next-line no-unsafe-assignment
window.PrintConfig = PrintConfig;
