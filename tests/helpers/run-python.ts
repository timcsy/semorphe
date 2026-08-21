/**
 * **參照直譯器**——Python 那一側的「實體」。
 *
 * `knowledge/concepts/等價與觀察集.md` §七：投影之間不對稱，只有一個接得到
 * 外部的權威。C++ 那側是 `g++`（見 `run-cpp.ts`），Python 這側是 `python3`。
 *
 * ## 🔴 為什麼需要它（2026-08-21）
 *
 * 第五十條護欄量到 32 段語料全部「跑得動」，而**其中一段的答案是錯的**：
 *
 * ```
 * p = [("甲", 12), ("乙", 10)]
 * p.sort(key=lambda x: x[1])
 * print(p[0][0])        # 該是「乙」，而我們印「甲」
 * ```
 *
 * `key=` 被靜靜忽略——排序仍然發生、仍然有輸出、護欄三軸全綠。
 * 我是**手動抽查**才發現的。
 *
 * > **「跑得動」與「答案對」是兩件事，而只量有沒有丟錯的護欄分不出來。**
 *
 * ## ⚠️ 版本要記原文
 *
 * 與 `run-cpp.ts` 同一個理由：換一台機器跑出不同數字時，
 * 沒有版本字串就查不出原因。
 */
import { execSync, exec } from 'node:child_process'
import { writeFileSync, mkdirSync, rmSync } from 'node:fs'
import path from 'node:path'

const cwd = '/tmp/semorphe-refpy'
const timeoutMs = 10000
let seq = 0

/** 參照直譯器的識別——**記原文**。 */
export function referenceInterpreterInfo(): { version: string } {
  return { version: execSync('python3 --version', { encoding: 'utf-8' }).trim() }
}

/** 參照直譯器在不在。**false 時護欄要紅，不是 skip。** */
export function hasReferencePython(): boolean {
  try {
    execSync('python3 --version', { stdio: 'pipe' })
    return true
  } catch {
    return false
  }
}

export type pyOutcome = { ok: true; output: string } | { ok: false; message: string }

/**
 * 並行跑一批 Python，回傳與輸入同序的結果。
 *
 * ⚠️ **`exec` 不是 `execSync`**：`execSync` 阻塞整條 Node 執行緒，
 * 用它寫出來的並行是零並行——而它還會對同一輪的其他測試收稅
 * （`experience.md`：「一支自己會過的測試可以只因為佔住執行緒而弄紅別人」）。
 */
export async function runPythonBatch(
  codes: readonly string[],
  stdins: readonly (string | undefined)[] = [],
  concurrency = 8,
): Promise<pyOutcome[]> {
  const out: pyOutcome[] = codes.map(() => ({ ok: false, message: '(未跑)' }))
  let next = 0
  const worker = async (): Promise<void> => {
    for (;;) {
      const i = next++
      if (i >= codes.length) return
      out[i] = await runOne(codes[i], stdins[i])
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, codes.length) }, worker))
  return out
}

async function runOne(code: string, stdin?: string): Promise<pyOutcome> {
  if (!hasReferencePython()) {
    throw new Error('找不到參照直譯器（python3）。護欄不得在此跳過——一筆看不見的缺陷與一筆不存在的缺陷長得一模一樣。')
  }
  mkdirSync(cwd, { recursive: true })
  const name = `p${process.pid}_${seq++}`
  const src = path.join(cwd, `${name}.py`)
  const inFile = path.join(cwd, `${name}.in`)
  try {
    writeFileSync(src, code)
    if (stdin !== undefined) writeFileSync(inFile, stdin)
    return await new Promise<pyOutcome>((res) =>
      exec(
        `python3 ${src} < ${stdin === undefined ? '/dev/null' : inFile}`,
        { encoding: 'utf-8', timeout: timeoutMs },
        (e, stdout, stderr) =>
          res(e ? { ok: false, message: String(stderr || (e as Error).message).slice(0, 300) } : { ok: true, output: stdout }),
      ),
    )
  } finally {
    rmSync(src, { force: true })
    rmSync(inFile, { force: true })
  }
}
