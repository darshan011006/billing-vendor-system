// Runs once when the Next.js server starts: background workers (Node.js runtime only).
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startWorkers } = await import('./workers/start');
    startWorkers();
  }
}
