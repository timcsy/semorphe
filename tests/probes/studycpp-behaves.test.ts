/**
 * **探針：那 218 支學生的程式，我們的解譯器跑出來的，和真實編譯器一樣嗎。**
 *
 * ## 🔴 它補的是那四個面向都沒看的那一格（2026-09-16）
 *
 * 使用者：「你有幫我驗證語料庫的執行結果與模擬的是一致的嗎？」——沒有。
 * 四支 `studycpp-*` 探針裡 `interpret`／`execute` 的出現次數是 **0**：
 * 它們量的全是形狀（殘差、不動點、載得進工作區、宣告的形狀）。
 *
 * > **殘差量的是「我沒認出來」，而它對「我認錯了」保持沉默。
 * > 而形狀層的「認錯」與行為層的「認錯」，也不是同一件事。**
 *
 * ## ⚠️ 測資怎麼來——使用者拍板「依照題目生」
 *
 * 那批是 AP325／TIOJ／zeroJudge 的題目，**大多要讀 stdin**，而語料沒有測資。
 * 做法是**問程式自己**：語義樹裡有每一次讀取的型別與順序，照那個生。
 *
 * 🔴 而判準是「**兩邊餵同一份**」，不是「這份輸入對那一題有意義」——
 * 輸入合不合題意不影響「g++ 印 A 而我們印 B」這個判定。
 * 型別要對（拿 `abc` 餵 `cin >> n` 會讓後面全部失效），數量要夠（不能餓死）。
 *
 * ## 判準有三層（CLAUDE.md 記過，少一層就會追到雜訊）
 *
 * 
 * ① 先問參照編譯器「這一段是合法的 C++ 嗎」  不問 → 追自己造的雜訊
 * ② 兩邊餵一模一樣的 stdin                    不同 → 比的是輸入不是行為
 * ③ 文字不同 ≠ 錯，行為不同才是              不分 → 正規化會被算成缺陷
 * 
 */
import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import { SemanticInterpreter } from '../../src/interpreter/interpreter'
import { runCppBatchDetailed, hasReferenceCompiler } from '../helpers/run-cpp'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { SemanticInterpreter } from '../../src/interpreter/interpreter'
import type { Lifter } from '../../src/core/lift/lifter'
import type { SemanticNode } from '../../src/core/types'

const ROOT = path.resolve(__dirname, '../..')
const DIR = process.env.STUDYCPP_DIR ?? ''

/**
 * **同時最多編幾支**——🔴 **這個數字是一次當機換來的**（2026-09-16）。
 *
 * 第一版寫 8，而這一支探針要編 204 支**含 `bits/stdc++.h`** 的程式
 * （單支峰值 94 MB、0.64 秒）。實測那天的系統紀錄：
 *
 * 
 * 14:51  17 支 clang 同時在 unnest DYLD 共享區
 * 14:51:16  kernel: memorystatus: killing_idle_process …（接下來 2,880 次）
 * 14:57  使用者重開機
 * 
 *
 * 而 kernel 自己說出了機制——每一支 clang 都會把原本**共用**的動態庫區段解巢：
 *
 * > `triggered unnest of DYLD shared region` …
 * > **this increases system memory footprint until the target exits**
 *
 * ⚠️ 所以「峰值 94 MB × N」**低估了**：真正的成本包含那份不再共享的區段，
 * 而它在 `ps` 的 RSS 上看不出來。
 *
 * 🪦 而讓它變重的正是我以為在修的那一步：補 `bits/stdc++.h` 墊片之前，
 * 218 支裡有 206 支在第一行就失敗（幾乎免費）；補上之後它們**真的去編**了。
 *
 * > **一個把「大部分都失敗」修成「大部分都成功」的修法，
 * > 會把一個近乎 no-op 的動作變成真正的負載——而它的帳單不在那份報告裡。**
 *
 * 🟢 判準不是「挑一個小一點的數字」，是**留給機器其他東西用的餘裕**：
 * 這支探針跑在 vitest 裡，而 vitest 自己還開著十幾支 worker。
 */
const COMPILE_CONCURRENCY = 3

function files(): string[] {
  if (!DIR || !fs.existsSync(DIR)) return []
  const out: string[] = []
  const walk = (d: string): void => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name)
      if (e.isDirectory()) walk(p)
      else if (e.name.endsWith('.cpp')) out.push(p)
    }
  }
  walk(DIR)
  return out.sort()
}

let tsParser: Parser
let lifter: Lifter
beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${ROOT}/public/${s}` })
  tsParser = new Parser()
  tsParser.setLanguage(await Language.load(`${ROOT}/public/tree-sitter-cpp.wasm`))
  lifter = createTestLifter()
  registerCppLanguage()
}, 120_000)

const FS = files()


// ── 測資怎麼來：問程式自己 ────────────────────────────────────────────

/** 走遍整棵樹（含所有槽）。 */
function walk(n: SemanticNode | undefined, fn: (x: SemanticNode) => void): void {
  if (!n || typeof n !== 'object') return
  fn(n)
  for (const v of Object.values(n.slots ?? {})) {
    if (Array.isArray(v)) for (const c of v) walk(c as SemanticNode, fn)
    else walk(v as SemanticNode, fn)
  }
}

/** 名字 → 宣告的型別。⚠️ 同名重複宣告時**後面的贏**，與 C++ 的遮蔽方向一致。 */
function typeOfNames(tree: SemanticNode): Map<string, string> {
  const m = new Map<string, string>()
  walk(tree, (n) => {
    if (!n.componentId?.endsWith(':var_declare') && !n.componentId?.endsWith(':array_declare')) return
    const t = String((n.properties as Record<string, unknown>)?.type ?? '')
    const name = String((n.properties as Record<string, unknown>)?.name ?? '')
    if (name) m.set(name, t)
  })
  return m
}

/** 一次讀取要吃掉什麼型別的一個 token。 */
type Kind = 'int' | 'double' | 'char' | 'string'

function kindOf(t: string): Kind {
  const s = t.replace(/[&*]/g, '').trim()
  if (/^(double|float|long double)$/.test(s)) return 'double'
  if (s === 'char') return 'char'
  if (/string/.test(s)) return 'string'
  return 'int'
}

/** 這支程式的讀取排程——**照原始碼順序**，而且標出哪些在迴圈裡。 */
export function readSchedule(tree: SemanticNode): { kinds: Kind[]; inLoop: Kind[] } {
  const types = typeOfNames(tree)
  const kinds: Kind[] = []
  const inLoop: Kind[] = []
  const visit = (n: SemanticNode | undefined, depth: number): void => {
    if (!n || typeof n !== 'object') return
    const id = n.componentId ?? ''
    const isLoop = /:(loop_while|loop_for|loop_count|loop_do|container_iter)$/.test(id)
    if (/:(input|input_formatted|input_line)$/.test(id)) {
      const vals = (n.slots?.values ?? []) as SemanticNode[]
      for (const v of Array.isArray(vals) ? vals : [vals]) {
        // 目標可能是 `a`、`a[i]`、`s` —— 一律從名字查宣告
        let name = ''
        walk(v, (x) => {
          const nm = String((x.properties as Record<string, unknown>)?.name ?? '')
          if (nm && !name) name = nm
        })
        const k = kindOf(types.get(name) ?? 'int')
        kinds.push(k)
        if (depth > 0) inLoop.push(k)
      }
      if (/:input_line$/.test(id) && (n.slots?.values ?? []).length === 0) kinds.push('string')
    }
    for (const v of Object.values(n.slots ?? {})) {
      if (Array.isArray(v)) for (const c of v) visit(c as SemanticNode, depth + (isLoop ? 1 : 0))
      else visit(v as SemanticNode, depth + (isLoop ? 1 : 0))
    }
  }
  visit(tree, 0)
  return { kinds, inLoop }
}

/**
 * 照排程生一份輸入。
 *
 * 🔴 **第一個整數刻意小**（3–8）——競賽題幾乎都是「先讀 n，再讀 n 筆」，
 *    而 n 大一點就會讀到餓死或跑很久。
 * ⚠️ 判準**不是「這份輸入對那一題有意義」**，是【兩邊餵同一份】：
 *    輸入合不合題意，不影響「g++ 印 A 而我們印 B」這個判定。
 */
export function makeStdin(
  sch: { kinds: Kind[]; inLoop: Kind[] }, seed: number, tail = 200,
): string[] {
  let x = seed * 2654435761 % 2147483647
  const rnd = (n: number): number => { x = (x * 48271) % 2147483647; return x % n }
  const tok = (k: Kind, first: boolean): string =>
    k === 'double' ? `${1 + rnd(9)}.${rnd(9)}`
      : k === 'char' ? String.fromCharCode(97 + rnd(26))
        : k === 'string' ? ['ab', 'cd', 'hello', 'xy', 'semorphe'][rnd(5)]
          : String(first ? 3 + rnd(6) : 1 + rnd(20))
  const out: string[] = []
  sch.kinds.forEach((k, i) => out.push(tok(k, i === 0)))
  // 迴圈裡的讀取不知道會跑幾圈——多給一些，餓死比多餵更難查
  const cycle = sch.inLoop.length > 0 ? sch.inLoop : []
  for (let i = 0; i < tail && cycle.length > 0; i++) out.push(tok(cycle[i % cycle.length], false))
  return out
}

describe.skipIf(FS.length === 0 || !hasReferenceCompiler())(
  '探針：學生的程式，解譯器與參照編譯器跑出來一不一樣', () => {

  /** ⚠️ 行尾空白與結尾換行是**排版**，不是行為（判準③）。 */
  const norm = (s: string): string =>
    s.split('\n').map((l) => l.replace(/\s+$/, '')).join('\n').replace(/\n+$/, '')

  it('🔴 ③ 同一份輸入，解譯器與參照編譯器印出來的要一樣', async () => {
    interface Row { file: string; src: string; stdin: string[] }
    const rows: Row[] = []
    let liftFail = 0
    const TAIL = Number(process.env.PROBE_TAIL ?? 200)
    for (const f of FS) {
      const src = fs.readFileSync(f, 'utf8')
      try {
        const tree = lifter.lift(tsParser.parse(src).rootNode as never) as SemanticNode
        rows.push({ file: path.relative(DIR, f), src, stdin: makeStdin(readSchedule(tree), 1, TAIL) })
      } catch { liftFail++ }
    }

    // 參照編譯器那一側——⚠️ 並行度見 `COMPILE_CONCURRENCY` 的檔頭（一次當機換來的）
    const ref = await runCppBatchDetailed(
      rows.map((r) => r.src), COMPILE_CONCURRENCY, rows.map((r) => r.stdin.join('\n') + '\n'))

    const tally = { compileFail: 0, refRunFail: 0, interpError: 0, stepBudget: 0, same: 0, differ: 0 }
    const shape = { weStopEarly: 0, wePrintMore: 0, reallyDifferent: 0 }
    const errKinds = new Map<string, number>()
    const errSample = new Map<string, string>()
    const diffs: string[] = []
    for (let i = 0; i < rows.length; i++) {
      const r = ref[i]
      if (!r.ok) { tally[r.stage === 'compile' ? 'compileFail' : 'refRunFail']++; continue }
      let got: string
      try {
        const tree = lifter.lift(tsParser.parse(rows[i].src).rootNode as never) as SemanticNode
        const out: string[] = []
        /**
         * ⚠️ **步數預算不是缺陷判準**——撞到上限的那些是 N 皇后回溯那一類，
         * g++ 幾毫秒跑完，而樹走式解譯器慢 10–100 倍。所以它獨立成一格，
         * 不混進「解譯器出錯」。
         */
        const interp = new SemanticInterpreter({
          maxSteps: Number(process.env.PROBE_STEPS ?? 2_000_000),
        })
        interp.setOutputCallback((x) => out.push(x))
        await interp.execute(tree, rows[i].stdin)
        got = out.join('')
      } catch (e) {
        tally.interpError++
        // 🔴 **分族，不要一支一支追**——90 支的清單看不出下一刀該切哪裡。
        const msg = String(e)
        if (msg.includes('MAX_STEPS')) { tally.interpError--; tally.stepBudget++; continue }
        const key = (msg.match(/RUNTIME_ERR_[A-Z_]+/) ?? msg.match(/Error: [^"{]{0,40}/) ?? ['其他'])[0]
        const detail = (msg.match(/\{"%1":"([^"]{0,40})/) ?? ['', ''])[1]
        const k = `${key}${detail ? ` ｜ ${detail}` : ''}`
        errKinds.set(k, (errKinds.get(k) ?? 0) + 1)
        if (!errSample.has(k)) errSample.set(k, rows[i].file)
        continue
      }
      if (norm(got) === norm(r.output ?? '')) tally.same++
      else {
        tally.differ++
        const a = norm(r.output ?? ''), b = norm(got)
        // 🔴 **先分形狀再談缺陷**：「我們的是它的前綴」多半是餵的測資不夠，
        //    程式讀到 EOF 就停了——那是量測工具的帳，不是解譯器的。
        if (a.startsWith(b)) shape.weStopEarly++
        else if (b.startsWith(a)) shape.wePrintMore++
        else shape.reallyDifferent++
        if (diffs.length < 45) diffs.push(
          `   ✘ ${rows[i].file}\n      g++ ：${JSON.stringify(norm(r.output ?? '').slice(0, 70))}` +
          `\n      我們：${JSON.stringify(norm(got).slice(0, 70))}`)
      }
    }
    const ran = tally.same + tally.differ
    console.log([
      `  抬升失敗        ${liftFail}`,
      `  編不過          ${tally.compileFail}`,
      `  參照跑不完      ${tally.refRunFail}   ← 多半是餵的測資讓它崩／逾時`,
      `  解譯器出錯      ${tally.interpError}`,
      `  步數預算用完    ${tally.stepBudget}   ← 不是缺陷，是樹走式解譯器比編譯碼慢`,
      `  ── 兩邊都跑完 ${ran} 支 ──`,
      `  🟢 一致         ${tally.same}`,
      `  🔴 不一致       ${tally.differ}`,
      `       ├ 我們少了尾巴 ${shape.weStopEarly}   ← 多半是測資餵不夠（量測工具的帳）`,
      `       ├ 我們多了尾巴 ${shape.wePrintMore}`,
      `       └ 內容真的不同 ${shape.reallyDifferent}   ← 🔴 這一欄才是缺陷`,
      `  （測資尾巴長度 ${TAIL}）`,
      '  ── 解譯器出錯的分族 ──',
      [...errKinds.entries()].sort((a, b) => b[1] - a[1])
        .map(([k, n2]) => `   ${String(n2).padStart(3)} 支  ${k}\n          例：${errSample.get(k)}`).join('\n'),
      diffs.join('\n'),
    ].join('\n'))
    expect(ran, '🔴 一支都沒跑完 → 下面的數字不算數').toBeGreaterThan(20)
  }, 1_800_000)

  it('② 讀取排程：程式自己說得出它要吃什麼', () => {
    const rows: string[] = []
    let noInput = 0
    for (const f of FS) {
      let sch
      try {
        const tree = lifter.lift(tsParser.parse(fs.readFileSync(f, 'utf8')).rootNode as never) as SemanticNode
        sch = readSchedule(tree)
      } catch { continue }
      if (sch.kinds.length === 0) { noInput++; continue }
      if (rows.length < 8) {
        rows.push(`   ${path.basename(f).padEnd(30)} 讀 ${JSON.stringify(sch.kinds).slice(0, 46)}` +
          `${sch.inLoop.length ? ` ＋迴圈裡 ${JSON.stringify(sch.inLoop).slice(0, 26)}` : ''}` +
          `\n      → ${makeStdin(sch, 1).slice(0, 12).join(' ')}`)
      }
    }
    console.log(`  不讀輸入的：${noInput} / ${FS.length}\n` + rows.join('\n'))
    expect(FS.length).toBeGreaterThan(200)
  }, 300_000)

  it('① 地基：這 218 支裡，參照編譯器收下幾支', async () => {
    const srcs = FS.map((f) => fs.readFileSync(f, 'utf8'))
    const res = await runCppBatchDetailed(srcs, COMPILE_CONCURRENCY, srcs.map(() => ''))
    const compileFail = res.filter((r) => !r.ok && r.stage === 'compile')
    const runFail = res.filter((r) => !r.ok && r.stage === 'run')
    console.log([
      `  總共            ${FS.length}`,
      `  編得過而跑得完  ${res.filter((r) => r.ok).length}`,
      `  編不過          ${compileFail.length}`,
      `  編得過而跑不完  ${runFail.length}   ← 多半是等 stdin（空輸入餵下去）`,
    ].join('\n'))
    expect(FS.length).toBeGreaterThan(200)
  }, 600_000)

})
