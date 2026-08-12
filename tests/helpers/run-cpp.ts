/**
 * **參照編譯器**——軟體域的那顆「實體」。
 *
 * `knowledge/concepts/等價與觀察集.md` §七：投影之間不對稱，只有一個接得到外部的
 * 權威，而 `g++` 就是軟體域的那顆參照元件。**行為由量測定義，不由宣告定義。**
 *
 * 這一份取代了兩份逐字相同的私有實作（`fuzz-cpp-strings`、`fuzz-cpp-stacks-queues`）。
 *
 * ## ⚠️ `g++` 不一定是 GCC
 *
 * macOS 上 `/usr/bin/g++` 是 Apple clang 的別名。所以基線要記的是
 * **版本字串原文**，不是「g++」這個名字——否則換一台機器跑出不同數字時，
 * 沒有人查得出原因。
 */
import { execSync, exec } from 'node:child_process'
import { writeFileSync, mkdirSync, rmSync } from 'node:fs'
import path from 'node:path'

const flag = '-std=c++17'
const cwd = '/tmp/semorphe-refcc'
const timeoutMs = 5000

let seq = 0

/** 參照編譯器的識別——**記原文**，見檔頭。 */
export function referenceCompilerInfo(): { version: string; flags: string } {
  return { version: execSync('g++ --version', { encoding: 'utf-8' }).split('\n')[0].trim(), flags: flag }
}

/** 參照編譯器在不在。**false 時護欄要紅，不是 skip。** */
export function hasReferenceCompiler(): boolean {
  try {
    execSync('g++ --version', { stdio: 'pipe' })
    return true
  } catch {
    return false
  }
}

export type execResult =
  | { ok: true; output: string }
  | { ok: false; stage: 'compile' | 'run'; message: string }

/**
 * 編譯並執行一段 C++，回傳標準輸出。
 *
 * 分得出**編譯失敗**與**執行失敗**——誤差護欄需要這個區分，因為
 * 「參照跑不動」與「參照跑出別的答案」是兩種不同的東西。
 */
export function runCppDetailed(code: string): execResult {
  if (!hasReferenceCompiler()) {
    // 沒有編譯器**不是**「這一段跑不動」，是量測機構壞了。丟出去，別混進統計。
    throw new Error('找不到參照編譯器（g++）。護欄不得在此跳過——一筆看不見的缺陷與一筆不存在的缺陷長得一模一樣。')
  }
  mkdirSync(cwd, { recursive: true })
  const name = `r${process.pid}_${seq++}`
  const src = path.join(cwd, `${name}.cpp`)
  const bin = path.join(cwd, name)
  try {
    writeFileSync(src, code)
    try {
      execSync(`g++ ${flag} -o ${bin} ${src}`, { encoding: 'utf-8', stdio: 'pipe' })
    } catch (e) {
      return { ok: false, stage: 'compile', message: String((e as Error).message).slice(0, 200) }
    }
    try {
      // stdin 給 /dev/null：需要輸入的程式不得卡住整批量測。
      return { ok: true, output: execSync(bin, { encoding: 'utf-8', timeout: timeoutMs, stdio: ['ignore', 'pipe', 'pipe'] }) }
    } catch (e) {
      return { ok: false, stage: 'run', message: String((e as Error).message).slice(0, 200) }
    }
  } finally {
    rmSync(src, { force: true })
    rmSync(bin, { force: true })
  }
}

/**
 * 批次版：**並行**編譯執行，回傳與輸入同序的結果。
 *
 * 為什麼需要它：序列跑 300 段約 8 分鐘，而 `npm test` 多 8 分鐘會讓人
 * 改成手動跑——**沒有人跑的護欄等於沒有護欄**。
 *
 * ⚠️ 不抽樣。抽樣的護欄不能當棘輪，而且靜默的抽樣會讓「涵蓋了全部」
 * 這句話變成假的。要縮短時間就並行，不是少跑。
 */
export async function runCppBatch(codes: readonly string[], concurrency = 8): Promise<(string | null)[]> {
  const out: (string | null)[] = new Array(codes.length).fill(null)
  let next = 0
  const worker = async (): Promise<void> => {
    for (;;) {
      const i = next++
      if (i >= codes.length) return
      out[i] = await runCppAsync(codes[i])
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, codes.length) }, worker))
  return out
}

/**
 * 非同步單次執行。
 *
 * ⚠️ **必須是 `exec` 不是 `execSync`**：`execSync` 阻塞整條 Node 執行緒，
 * 用它寫出來的「並行」是零並行——而它看起來與真的並行一模一樣。
 */
async function runCppAsync(code: string): Promise<string | null> {
  if (!hasReferenceCompiler()) {
    throw new Error('找不到參照編譯器（g++）。護欄不得在此跳過——一筆看不見的缺陷與一筆不存在的缺陷長得一模一樣。')
  }
  mkdirSync(cwd, { recursive: true })
  const name = `a${process.pid}_${seq++}`
  const src = path.join(cwd, `${name}.cpp`)
  const bin = path.join(cwd, name)
  const run = (cmd: string, timeout: number): Promise<string | null> =>
    new Promise((res) => exec(cmd, { encoding: 'utf-8', timeout }, (err, stdout) => res(err ? null : stdout)))
  try {
    writeFileSync(src, code)
    if ((await run(`g++ ${flag} -o ${bin} ${src}`, 30000)) === null) return null
    return await run(`${bin} < /dev/null`, timeoutMs)
  } finally {
    rmSync(src, { force: true })
    rmSync(bin, { force: true })
  }
}

/**
 * 舊介面：失敗回 `null`。
 *
 * 保留是為了讓收攏**不改變既有兩個檔的行為**——它們比的是
 * `runCpp(產回去的碼)` vs `runCpp(原碼)`，兩邊都是參照編譯器（來回保義），
 * 對失敗原因不感興趣。
 */
export function runCpp(code: string): string | null {
  const r = runCppDetailed(code)
  return r.ok ? r.output : null
}
