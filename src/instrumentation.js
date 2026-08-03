export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { initConsoleLogCapture } = await import("@/lib/consoleLogBuffer");
    initConsoleLogCapture();
    const { startGrokCliManager } = await import("@/lib/grokCliManager");
    startGrokCliManager();
  }
}
