/**
 * 兩支護欄（`audit-portable-core`、`audit-panels-only`）都會跑 `tools/build-sdk.mjs`，
 * 而它寫的是同一個 `dist-sdk/`（Vite 先清空再寫）。全套並行 2 時兩支會同時建，
 * 一支在另一支清空目錄的那一刻用 esbuild 打包 → 「建不起來」，單獨重跑就綠（2026-11-11 撞到）。
 *
 * 所以「建 dist-sdk ＋ 把它打包進例子」這一段要排隊：跨行程的鎖，用 mkdir 的原子性做。
 * 拿著鎖的行程死掉時（目錄裡的 pid 不在了）就接手，不會永遠卡住。
 */
import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const sleep = (ms: number): void => { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms) }

function alive(pid: number): boolean {
  try { process.kill(pid, 0); return true } catch { return false }
}

export function withSdkBuildLock<T>(root: string, fn: () => T, timeoutMs = 170_000): T {
  const dir = path.join(root, 'dist-sdk.lock')
  const until = Date.now() + timeoutMs
  for (;;) {
    try {
      mkdirSync(dir)
      writeFileSync(path.join(dir, 'pid'), String(process.pid))
      break
    } catch {
      let holder = NaN
      try { holder = Number(readFileSync(path.join(dir, 'pid'), 'utf8')) } catch { /* 剛建、還沒寫 pid */ }
      const orphan = Number.isFinite(holder) && holder > 0 ? !alive(holder) : (() => { try { return Date.now() - statSync(dir).mtimeMs > 10_000 } catch { return false } })()
      if (orphan) { rmSync(dir, { recursive: true, force: true }); continue }
      if (Date.now() > until) throw new Error(`等 dist-sdk 的建置鎖逾時（${dir}，持有者 ${holder}）`)
      sleep(250)
    }
  }
  try { return fn() } finally { rmSync(dir, { recursive: true, force: true }) }
}
