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
 *
 * ## ⚠️ 它在機器很忙的時候會【跑不出結果】——而那看起來像產品壞了
 *
 * 2026-09-08 一次 8 分鐘的全套（平常 4 分）：`audit-cin-fail-state` 整檔紅
 * （「參照編譯器跑不動第 3 段」）、`fuzz-cpp-strings` 的 `fuzz_1` 紅
 * （`runCpp` 回 `null`）。**單獨重跑兩支全綠**，而它們一行都沒被改過。
 *
 * > **一個靠外部子行程的測試，它的紅有兩種意思：程式錯了，或者那個子行程
 * > 這一次沒排到 CPU——而兩種在 `expect` 那一行長得一模一樣。**
 *
 * 🟢 判準與 `playwright.config.ts` 檔頭那條同一個：全套跑得比平常慢很多
 * 而紅的是**這一族**（`runCpp` 為 null／跑不動第 N 段）→ 先單獨重跑；
 * 單獨也紅才是迴歸。⚠️ 而 `test.skip` 掉的 `[BLOCKED…]` 那批**不是**這個：
 * 那些是標了 pre-existing bug 的刻意跳過。
 */
import { execSync, execFileSync, spawn } from 'node:child_process'
import { writeFileSync, mkdirSync, rmSync, openSync, closeSync } from 'node:fs'
import path from 'node:path'

const flag = '-std=c++17'
/**
 * **額外的 include 路徑**——預設空的，所以護欄的行為一個字都不變。
 *
 * 🔴 它為 `bits/stdc++.h` 而生：那是 GCC 專屬的標頭，而 Apple clang 沒有。
 *    學生的競賽程式幾乎都用它——沒有這條路，「參照編譯器收不收下」會量出
 *    206 筆假的編譯失敗（實測 2026-09-16）。
 */
const extraInc = process.env.SEMORPHE_REFCC_INCLUDE
  ? ` -I${process.env.SEMORPHE_REFCC_INCLUDE}`
  : ''
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
/**
 * ⚠️ **`stdin` 是 2026-09-16 補的**——在此之前它寫死 `stdio: ['ignore', …]`，
 * 於是每一個「要讀輸入」的測試，g++ 那一側都讀到 EOF、印出未初始化的垃圾，
 * 而**看起來像是我們錯了**。
 *
 * > **一個不吃輸入的參照實作，量出來的每一個「不一致」都是它自己造的。**
 */
export function runCppDetailed(code: string, stdin?: string): execResult {
  if (!hasReferenceCompiler()) {
    // 沒有編譯器**不是**「這一段跑不動」，是量測機構壞了。丟出去，別混進統計。
    throw new Error('找不到參照編譯器（g++）。護欄不得在此跳過——一筆看不見的缺陷與一筆不存在的缺陷長得一模一樣。')
  }
  mkdirSync(cwd, { recursive: true })
  const name = `r${process.pid}_${seq++}`
  const src = path.join(cwd, `${name}.cpp`)
  const bin = path.join(cwd, name)
  const inFile = path.join(cwd, `${name}.in`)
  try {
    writeFileSync(src, code)
    try {
      execSync(`g++ ${flag}${extraInc} -o ${bin} ${src}`, { encoding: 'utf-8', stdio: 'pipe' })
    } catch (e) {
      return { ok: false, stage: 'compile', message: String((e as Error).message).slice(0, 200) }
    }
    try {
      // stdin 給 /dev/null：需要輸入的程式不得卡住整批量測。
      // ⚠️ **要餵 stdin 的請走 `runCppBatchDetailed`。** 這一支是 `execSync`，
      // 它阻塞整條 Node 執行緒——在 `it()` 裡連跑七次會把同一輪的
      // 時間敏感測試推過門檻（2026-08-21 實測，`bus-update` 每輪紅不同支）。
      /**
       * 🔴 **stdin 走檔案描述子，不走管線**（2026-09-18，CI 紅了第五次）。
       *
       * 在此之前這裡寫 `input: stdin ?? ''`，而那是一條**管線**：Node 要把
       * 那串位元組寫進子行程。**程式不把輸入讀完就結束時，那一端關掉**，
       * 於是 `spawnSync` 拿到 `EPIPE` 而 `execFileSync` **丟例外**
       * ——即使 stdout 早就完整產出了。
       *
       * ```
       * 本機（macOS）   綠    寫得完／時序不同
       * CI（Linux）     紅    spawnSync … EPIPE
       * ```
       *
       * ⚠️ 症狀會偽裝成「參照編譯器收不下這一段」，也就是**測試說自己壞了**
       *    ——而真正壞的是餵法。批次那一支早就走檔案重導（`< inFile`），
       *    所以同一段程式在那裡從來沒紅過。
       *
       * > **兩條路餵同一份輸入而只有一條會 EPIPE，那個差別不在程式，
       * > 在「誰負責把剩下的位元組吞掉」——檔案沒有那個責任，管線有。**
       *
       * 🟢 而 `execFileSync`（不是 `execSync`）要留著：逾時殺得到的是那支
       *    執行檔本人，不是它的 shell 祖父（2026-09-17 的孤兒行程那一刀）。
       */
      writeFileSync(inFile, stdin ?? '')
      const fd = openSync(inFile, 'r')
      try {
        return {
          ok: true,
          output: execFileSync(bin, [], {
            encoding: 'utf-8', timeout: timeoutMs,
            stdio: [fd, 'pipe', 'pipe'],
          }),
        }
      } finally {
        closeSync(fd)
      }
    } catch (e) {
      return { ok: false, stage: 'run', message: String((e as Error).message).slice(0, 200) }
    }
  } finally {
    rmSync(src, { force: true })
    rmSync(bin, { force: true })
    rmSync(inFile, { force: true })
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
  return (await runCppBatchDetailed(codes, concurrency)).map((r) => (r.ok ? r.output : null))
}

/**
 * 並行執行，**而保留失敗的理由**。
 *
 * ## 為什麼需要它
 *
 * `runCppBatch` 把失敗壓成 `null`——於是「編譯器**跑不動**」與
 * 「編譯器**看懂了而且拒絕**」變成同一件事。
 *
 * > **一個把「工具跑不動」與「程式不合法」算在同一欄的量測，
 * > 正好看不見我們最該擔心的那一格。**
 *
 * ⚠️ 而 `stderr` 一定要留：分類判準靠的是**編譯器說了什麼**，
 * 不是「它有沒有回 0」。
 */
export async function runCppBatchDetailed(
  codes: readonly string[],
  concurrency = 8,
  /** 第 i 段要餵的標準輸入；省略或 `undefined` 就是 `/dev/null`。 */
  stdins: readonly (string | undefined)[] = [],
): Promise<asyncOutcome[]> {
  const out: asyncOutcome[] = new Array(codes.length).fill(null).map(() => ({ ok: false, output: null }))
  let next = 0
  const worker = async (): Promise<void> => {
    for (;;) {
      const i = next++
      if (i >= codes.length) return
      out[i] = await runCppAsyncDetailed(codes[i], stdins[i])
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, codes.length) }, worker))
  return out
}

/** 一次非同步執行的結果。失敗時**帶著階段與編譯器原話**。 */
export interface asyncOutcome {
  ok: boolean
  output: string | null
  stage?: 'compile' | 'run'
  message?: string
}

/**
 * 非同步單次執行。
 *
 * ⚠️ **必須是 `exec` 不是 `execSync`**：`execSync` 阻塞整條 Node 執行緒，
 * 用它寫出來的「並行」是零並行——而它看起來與真的並行一模一樣。
 */
async function runCppAsync(code: string): Promise<string | null> {
  const r = await runCppAsyncDetailed(code)
  return r.ok ? r.output : null
}

/** 見 `runCppBatchDetailed`——同一件事，而**不丟掉 stderr**。 */
async function runCppAsyncDetailed(code: string, stdin?: string): Promise<asyncOutcome> {
  if (!hasReferenceCompiler()) {
    throw new Error('找不到參照編譯器（g++）。護欄不得在此跳過——一筆看不見的缺陷與一筆不存在的缺陷長得一模一樣。')
  }
  mkdirSync(cwd, { recursive: true })
  const name = `a${process.pid}_${seq++}`
  const src = path.join(cwd, `${name}.cpp`)
  const bin = path.join(cwd, name)
  const inFile = path.join(cwd, `${name}.in`)
  /**
   * 🔴 **逾時要殺【整個行程群組】，不是那個 shell**（2026-09-17）。
   *
   * 這裡的指令帶著 shell 重導（`bin < file`），所以 `exec` 跑的是
   * `/bin/sh -c "bin < file"`。`exec` 的 `timeout` 選項殺得到的是**那個 shell**
   * ——而真正在跑的程式是它的**孫子**。shell 死掉之後，那支程式**變成孤兒，
   * 繼續跑到天荒地老**。
   *
   * 實測（2026-09-17）：一輪**正常結束**的語料探針留下 **3 支**孤兒，
   * 各燒 90% CPU、記憶體持續長大。接下來三次「全套測試」與「重跑探針」
   * 全部被系統以記憶體不足砍掉，而那看起來像是**測試自己太重**。
   *
   * > **一個被殺掉的父行程，不會帶走它的孩子——
   * > 而一支沒有人再看著的孤兒，它的帳會記在下一個人頭上。**
   *
   * ⚠️ 與 [history/240] 同一族：那一次是我把編譯並行度開到 8 打掛使用者的機器。
   *    這一次的量級小得多，而它**更難發現**——因為沒有任何一支測試變紅。
   *
   * 🟢 `detached: true` 讓 shell 自己當群組長，`kill(-pid)` 就整群帶走。
   */
  const run = (cmd: string, timeout: number): Promise<{ out: string | null; err: string }> =>
    new Promise((res) => {
      // 🔴 **`spawn` 不是 `exec`**：`detached` 不在 `exec` 的選項表裡，
      //    它是 `spawn` 的。寫給 `exec` 會被**靜默忽略**——實測那個 shell 的
      //    PGID 仍是呼叫者的群組，於是 `kill(-pid)` 回 ESRCH，而我以為我殺了它。
      //
      //    > **一個不存在的選項不會報錯，它只會讓你以為那件事生效了。**
      const child = spawn('/bin/sh', ['-c', cmd], { detached: true })
      let out = '', err = '', done = false
      child.stdout.on('data', (d: Buffer) => { out += d.toString() })
      child.stderr.on('data', (d: Buffer) => { err += d.toString() })
      const finish = (ok: boolean, msg: string): void => {
        if (done) return
        done = true
        clearTimeout(timer)
        res({ out: ok ? out : null, err: err || msg })
      }
      const timer = setTimeout(() => {
        // ⚠️ 負的 pid ＝ 整個行程群組（`detached` 讓 shell 當上群組長）。
        //    少了這一步，被殺掉的是 shell 而**真正在跑的程式是它的孫子**。
        try { if (child.pid) process.kill(-child.pid, 'SIGKILL') } catch { child.kill('SIGKILL') }
        finish(false, `timeout after ${timeout}ms`)
      }, timeout)
      child.on('error', (e: Error) => finish(false, e.message))
      child.on('close', (code: number | null) => finish(code === 0, `exit ${code}`))
    })
  try {
    writeFileSync(src, code)
    const compiled = await run(`g++ ${flag}${extraInc} -o ${bin} ${src}`, 30000)
    if (compiled.out === null) {
      return { ok: false, output: null, stage: 'compile', message: compiled.err.slice(0, 400) }
    }
    // ⚠️ stdin 走**檔案重導**而不是管線：`exec` 的 callback 形式沒有寫入端，
    //    而「沒有輸入」與「輸入耗盡」必須是同一條路才量得準。
    if (stdin !== undefined) writeFileSync(inFile, stdin)
    const ran = await run(`${bin} < ${stdin === undefined ? '/dev/null' : inFile}`, timeoutMs)
    if (ran.out === null) return { ok: false, output: null, stage: 'run', message: ran.err.slice(0, 400) }
    return { ok: true, output: ran.out }
  } finally {
    rmSync(src, { force: true })
    rmSync(bin, { force: true })
    rmSync(inFile, { force: true })
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
