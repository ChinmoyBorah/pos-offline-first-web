export function registerSW(onServerChanges: (changes: any[]) => void) {
  if (!("serviceWorker" in navigator)) return;
  const swUrl = new URL("./sw.js", import.meta.url);
  navigator.serviceWorker
    .register(swUrl, { type: "module" })
    .then(() => {
      navigator.serviceWorker.addEventListener("message", (e) => {
        if (e.data?.type === "serverChanges") onServerChanges(e.data.changes);
      });
    })
    .catch(console.error);
}
