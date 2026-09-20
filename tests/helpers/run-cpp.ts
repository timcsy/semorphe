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

export function runShell(cmd: string, timeout: number): Promise<{ out: string | null; err: string }> {
  return new Promise((res) => {
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
  try {
    writeFileSync(src, code)
    const compiled = await runShell(`g++ ${flag}${extraInc} -o ${bin} ${src}`, 30000)
    if (compiled.out === null) {
      return { ok: false, output: null, stage: 'compile', message: compiled.err.slice(0, 400) }
    }
    // ⚠️ stdin 走**檔案重導**而不是管線：`exec` 的 callback 形式沒有寫入端，
    //    而「沒有輸入」與「輸入耗盡」必須是同一條路才量得準。
    if (stdin !== undefined) writeFileSync(inFile, stdin)
    const ran = await runShell(`${bin} < ${stdin === undefined ? '/dev/null' : inFile}`, timeoutMs)
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

/**
 * **這份輸入，讓這支程式走進未定義行為了嗎**——拿消毒器問參照編譯器。
 *
 * ## 🔴 它為什麼存在（2026-09-19）
 *
 * 語料的「解譯器出錯」那一欄裡，有一類**不是我們的缺陷**：
 * `AP325/7/7_6.cpp` 寫 `vector<S> A[n];` 之後 `cin >> u; A[u].push_back(…)`,
 * 而測資生出來的 `u` 大於 `n`。**g++ 不檢查所以照跑，我們檢查所以出聲。**
 *
 * 那不是「我們錯了」，也不是「我們對了」——**是那份測資讓那支程式沒有定義的行為**。
 * 而它佔了當時 44 支裡的 5 支，足以讓人把一整刀花在一個不存在的缺陷上。
 *
 * ## ⚠️ 為什麼不改測資產生器（量過了，2026-09-19）
 *
 * 直覺的修法是「之後的整數以第一個整數為上界」（競賽題「讀 n 再讀 n 筆」的慣例）。
 * **實測：44 → 43。** 修好了 AP325/7 那四支，換來 `10_a277` 爆堆疊、
 * `8_toj8`／`a005` 除以零（`rnd(bound)` 會生出 0）、`7_11` 負索引。
 *
 * > **一個改「測資怎麼生」的改動，如果換掉的支數與修好的支數差不多，
 * > 它量到的是測資的形狀，不是缺陷的分佈。**
 *
 * ## 🔴 判準：**外部權威，不是我的判斷**
 *
 * 使用者說過「語料只是參考，實際 fuzz 錯了就是錯了，不要迴避」。
 * 這一支之所以不是迴避，是因為**它問的不是我**——是 clang／gcc 的消毒器。
 * 我說「這支有 UB」沒有份量；`UndefinedBehaviorSanitizer` 說了才算。
 *
 * ⚠️ 而它只能證實，不能否證：消毒器**沒叫**不代表沒有 UB
 *（它抓不到未初始化的讀取、抓不到全域陣列的小幅越界）。
 * 所以回 `false` 的那些**仍然算我們的帳**。
 *
 * @returns 消毒器有沒有指名一段未定義行為；`null` 表示消毒器自己編不起來（不下判斷）
 */
export async function sanitizerSaysUB(code: string, stdin?: string): Promise<{ ub: boolean | null; detail: string }> {
  if (!hasReferenceCompiler()) {
    throw new Error('找不到參照編譯器（g++）。護欄不得在此跳過——一筆看不見的缺陷與一筆不存在的缺陷長得一模一樣。')
  }
  mkdirSync(cwd, { recursive: true })
  const name = `s${process.pid}_${seq++}`
  const src = path.join(cwd, `${name}.cpp`)
  const bin = path.join(cwd, name)
  const inFile = path.join(cwd, `${name}.in`)
  try {
    writeFileSync(src, code)
    const built = await runShell(
      `g++ ${flag}${extraInc} -fsanitize=address,undefined -g -o ${bin} ${src}`, 60000)
    if (built.out === null) {
      // 消毒器版編不起來（有些語料只在這個模式下撞到標頭問題）——**不下判斷**
      return { ub: null, detail: '消毒器版編不起來' }
    }
    writeFileSync(inFile, stdin ?? '')
    /**
     * 🔴 **stderr 在「它成功了」那一路也要讀**：UBSan 的「runtime error」
     * 預設**會讓程式繼續跑並且正常退出**（不是 `-fno-sanitize-recover`），
     * 而 AddressSanitizer 才會讓它死。
     *
     * > **一個只在「它失敗了」那一路讀 stderr 的偵測器，
     * > 對「它成功了而且順便印出違規」保持沉默。**
     *
     * 🔴 **而它必須是【非同步】的那一條路**（2026-09-20）。
     * 在此之前這裡是 `spawnSync`，而 `spawnSync` 的 `timeout` 送得出訊號、
     * **卻要等那個行程真的死掉**。一個卡在 `UE`（不可中斷的等待）的行程
     * 永遠不會死，於是整個 vitest 停在 0% CPU——看起來像「測試太重被砍了」。
     *
     * ⚠️ 那一天量到的殘骸逐字是 `s<pid>_5`、`s<pid>_219` 這一族，
     *    七次執行各留一個，而 `memory_pressure` 說記憶體 45% 空閒。
     *
     * > **一個在使用者空間殺不掉的行程，唯一的處置是【不要等它】。**
     *
     * 🟢 `runShell` 的計時器自己 resolve，不等孩子——它會留下一個孤兒，
     *    而那比卡住整套測試便宜。
     */
    const ran = await runShell(`${bin} < ${inFile}`, timeoutMs)
    const combined = String(ran.err ?? '') + String(ran.out ?? '')
    const m = combined.match(/runtime error: [^\n]{0,80}|ERROR: AddressSanitizer: [^\n]{0,80}/)
    return m ? { ub: true, detail: m[0] } : { ub: false, detail: '' }
  } finally {
    rmSync(src, { force: true })
    rmSync(bin, { force: true })
    rmSync(inFile, { force: true })
  }
}
