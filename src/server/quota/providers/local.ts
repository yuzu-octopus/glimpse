// Helpers for local/CLI providers — Bun.file + Bun.spawn with 10s timeout, sanitizeUrl on throw
export async function readTextFile(path: string): Promise<string> {
  try {
    const f = Bun.file(path);
    if (!(await f.exists())) throw new Error(`quota file not found: ${path}`);
    return await f.text();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/not found/i.test(msg)) throw new Error('quota file not found');
    throw new Error('quota file not found');
  }
}

// Spawn helper with 10s timeout — sanitized error (no cmd leakage)
export async function spawnWithTimeout(cmd: string[], timeoutMs = 10_000): Promise<string> {
  const proc = Bun.spawn(cmd, { stdout: 'pipe', stderr: 'pipe' });
  const timeout = setTimeout(() => {
    try { proc.kill(); } catch {}
  }, timeoutMs);
  try {
    const text = await new Response(proc.stdout).text();
    await proc.exited;
    clearTimeout(timeout);
    if (proc.exitCode !== 0) {
      const errText = await new Response(proc.stderr).text().catch(() => '');
      void errText;
      throw new Error('cli probe failed');
    }
    return text;
  } catch {
    clearTimeout(timeout);
    try { proc.kill(); } catch {}
    throw new Error('cli probe failed');
  } finally {
    clearTimeout(timeout);
  }
}
