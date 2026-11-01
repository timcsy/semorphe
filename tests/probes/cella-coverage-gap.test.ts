/**
 * **探針：切換那天學生會失去什麼**（spec 199，重構階段 6.0）。
 *
 * 階段 6c 要拆掉 JS 直譯器。在那之前先量：**今天 JS 直譯器跑得動、而 Cella 給不出結果的程式有多少、卡在哪裡**
 * ——那一格就是切換後學生按執行看到「判不出來」而不是輸出的範圍（設計 draft 五之十）。
 *
 * 母體是學生的練習（StudyCpp 218 支，`STUDYCPP_DIR`；沒有就跳過）——課文已經 109/109 由 Cella 判過（階段 4），
 * 這裡量的是課文以外、學生自己寫的形狀。測資照 `studycpp-behaves` 的做法「問程式自己」，兩邊餵同一份。
 *
 * ## 🔴 判準：四格不得合併
 *
 * ```
 * 一致            兩邊都跑完、輸出相同
 * 輸出不同        兩邊都跑完、輸出不同              ← 有一邊算錯（Cella 照 clang／標準，通常是 JS 那邊）
 * 退步            JS 跑完、Cella 給不出結果          ← 切換的代價：翻不出（formalize）／判不出（unknown，依種類）
 * Cella 較嚴      JS 跑完、Cella 判 reject           ← 不是退步：Cella 抓到 JS 沒抓到的未定義行為（要看種類，測資造成的也算在這）
 * ```
 * 「JS 自己也跑不完」（步數、錯誤）另計——那一格不是切換造成的。
 *
 * ⚠️ 入口條件先於讀數：載得進的程式要有兩百支以上，否則「退步 0」可能只是母體是空的
 *    （〈一個「零缺陷」的讀數，與一個「零樣本」的讀數，數字長得一模一樣〉）。
 * 結果另寫一份 JSON 到 `CELLA_GAP_OUT`（有設才寫）——給 draft 與 cella 那邊看。
 *
 * `CELLA_GAP_FORMALIZE_ONLY=1`：只 lift ＋ formalize（秒級、不跑兩邊）——補 formalize 時一批一批量「還有幾支翻不出、卡在哪」用（6.1）。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { SemanticInterpreter } from '../../src/interpreter/interpreter'
import { formalize } from '../../src/providers/cella/formalize'
import { createCellaChecker, type CellaChecker } from '../../src/providers/cella/verdict'
import { readSchedule, makeStdin } from '../helpers/stdin-from-tree'
import type { SemanticNode } from '../../src/core/types'
import { spawn, type ChildProcess } from 'node:child_process'
import readline from 'node:readline'

const ROOT = path.resolve(__dirname, '../..')
const DIR = process.env.STUDYCPP_DIR ?? ''
const STEPS = Number(process.env.PROBE_STEPS ?? 10_000_000)
const FORMALIZE_ONLY = process.env.CELLA_GAP_FORMALIZE_ONLY === '1'
/**
 * 整支探針的時間上限（預設一小時）。⚠️ 2026-11-02 升到 Cella 0.1.202611011759 之後第一次在一小時上限逾時、什麼都沒量到
 * ——翻得出、真的跑到底的程式變多了。所以上限可調，而且每跑完一支就把那一支寫進 `CELLA_GAP_PROGRESS`（有設才寫）：逾時也留得下讀數。
 */
const TIMEOUT = Number(process.env.PROBE_TIMEOUT_MS ?? 3_600_000)
const PROGRESS = process.env.CELLA_GAP_PROGRESS
/**
 * **每一支的時間上限**（毫秒；有設才啟用，第 215 刀）。步數上限擋不住「步數不多、每一步卻很貴」的程式
 *（`vector<int> d2[1000005]`：一支跑了二十分鐘以上還沒完，後面五十幾支全被擋住）。
 * 啟用時 Cella 判決改在子行程（`tests/helpers/cella-verdict-child.ts`）裡跑，逾時就砍掉重開，那一支記成 unknown（逾時）。
 */
const FILE_TIMEOUT = Number(process.env.CELLA_GAP_FILE_TIMEOUT_MS ?? 0)
const TIMED_OUT = '逾時（每支上限）'

type ChildVerdict = { verdict: { verdict: string; out: string; problems: { kind: string }[] } } | { error: string } | { timeout: true }

/** 常駐的判決子行程：逾時就砍掉，下一支再重開（重開要重新編譯 Cella 的模組，所以不每支都開）。 */
function verdictChild(): { ask: (program: unknown, stdin: string, steps: number) => Promise<ChildVerdict>; close: () => void } {
  let child: ChildProcess | null = null
  let ready: Promise<void> | null = null
  let pending: ((v: ChildVerdict) => void) | null = null
  let seq = 0
  // ⚠️ npx 底下還有一層 node：開成自己的行程群組（detached），砍的時候整組砍，否則砍到的只是 npx
  const kill = (c: ChildProcess | null): void => { if (c?.pid) try { process.kill(-c.pid, 'SIGKILL') } catch { /* 已經結束 */ } }
  const start = (): Promise<void> => {
    const c = spawn('npx', ['--no-install', 'tsx', path.join(ROOT, 'tests/helpers/cella-verdict-child.ts')], { cwd: ROOT, stdio: ['pipe', 'pipe', 'inherit'], detached: true })
    child = c
    return new Promise<void>((res, rej) => {
      readline.createInterface({ input: c.stdout! }).on('line', (line) => {
        const m = JSON.parse(line) as { ready?: boolean } & ChildVerdict
        if (m.ready) { res(); return }
        const p = pending; pending = null; p?.(m)
      })
      // 子行程自己結束（啟動失敗、記憶體耗盡）：不要讓等它的人永遠等下去
      c.on('exit', (code, sig) => {
        if (child === c) child = null
        rej(new Error(`判決子行程啟動前就結束（${code ?? sig}）`))
        const p = pending; pending = null; p?.({ error: `判決子行程結束（${code ?? sig}）` })
      })
    })
  }
  return {
    async ask(program, stdin, steps) {
      if (!child) ready = start()
      await ready
      return new Promise<ChildVerdict>((res) => {
        const timer = setTimeout(() => { pending = null; const c = child; child = null; kill(c); res({ timeout: true }) }, FILE_TIMEOUT)
        pending = (v) => { clearTimeout(timer); res(v) }
        child!.stdin!.write(JSON.stringify({ id: ++seq, program, stdin, steps }) + '\n')
      })
    },
    close() { const c = child; child = null; kill(c) },
  }
}

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

const read = (pkg: string | null, file: string): Uint8Array =>
  fs.readFileSync(path.join(ROOT, 'node_modules', pkg === null ? 'cella-lang' : `@cella-lang/${pkg}`, file))

const norm = (s: string): string => s.split('\n').map((l) => l.replace(/\s+$/, '')).join('\n').replace(/\n+$/, '')

type Js = { ok: true; out: string } | { ok: false; why: string }
type Cella =
  | { k: 'untranslated'; constructs: string[] }
  | { k: 'accept'; out: string }
  | { k: 'reject' | 'unknown' | 'invalid'; kinds: string[] }
interface Row { file: string; js: Js; cella: Cella; jsMs?: number; cellaMs?: number }

const FS = files()
let checker: CellaChecker
let rows: Row[] = []
let liftFail = 0

beforeAll(async () => {
  if (FS.length === 0) return
  await Parser.init({ locateFile: (s: string) => `${ROOT}/public/${s}` })
  const parser = new Parser()
  parser.setLanguage(await Language.load(`${ROOT}/public/tree-sitter-cpp.wasm`))
  registerCppLanguage()
  if (!FORMALIZE_ONLY && !FILE_TIMEOUT) checker = await createCellaChecker(read)
  const child = FILE_TIMEOUT && !FORMALIZE_ONLY ? verdictChild() : null
  for (const f of FS) {
    const src = fs.readFileSync(f, 'utf8')
    let tree: SemanticNode
    // ⚠️ 每一支一個新的 lifter：共用一個的話，前一支的狀態（宣告過的名字、型別）會漏進下一支——
    //    第一版就是這樣把 initializer_list 量成 111 支（逐支新建是 53 處）
    try { tree = createTestLifter().lift(parser.parse(src)!.rootNode as never) as SemanticNode } catch { liftFail++; continue }
    const stdin = makeStdin(readSchedule(tree), 1, 200)
    if (FORMALIZE_ONLY) {
      const fz = formalize(tree, { lang: 'cpp' })
      rows.push({ file: path.relative(DIR, f), js: { ok: true, out: '' }, cella: fz.program ? { k: 'accept', out: '' } : { k: 'untranslated', constructs: [...new Set((fz.unknown as { construct: string }[]).map((u) => u.construct))] } })
      continue
    }
    let js: Js
    const t0 = Date.now()
    try {
      const out: string[] = []
      const it = new SemanticInterpreter({ maxSteps: STEPS })
      it.setOutputCallback((x) => out.push(x))
      await it.execute(tree, stdin)
      js = { ok: true, out: out.join('') }
    } catch (e) {
      const m = String(e)
      js = { ok: false, why: m.includes('MAX_STEPS') ? '步數用盡' : m.slice(0, 80) }
    }
    const jsMs = Date.now() - t0
    let cella: Cella
    const t1 = Date.now()
    const fz = formalize(tree, { lang: 'cpp' })
    if (!fz.program) {
      cella = { k: 'untranslated', constructs: [...new Set((fz.unknown as { construct: string }[]).map((u) => u.construct))] }
    } else if (child) {
      const r = await child.ask(fz.program, stdin.map((l) => `${l}\n`).join(''), STEPS)
      cella = 'timeout' in r ? { k: 'unknown', kinds: [TIMED_OUT] }
        : 'error' in r ? { k: 'invalid', kinds: [`例外：${r.error.slice(0, 60)}`] }
        : r.verdict.verdict === 'accept' ? { k: 'accept', out: r.verdict.out }
        : { k: r.verdict.verdict as 'reject' | 'unknown' | 'invalid', kinds: [...new Set(r.verdict.problems.map((p) => p.kind))].filter((k) => k !== 'hole') }
    } else {
      try {
        const v = checker.verdict(fz.program, stdin.map((l) => `${l}\n`).join(''), STEPS)
        cella = v.verdict === 'accept' ? { k: 'accept', out: v.out } : { k: v.verdict, kinds: [...new Set(v.problems.map((p) => p.kind))].filter((k) => k !== 'hole') }
      } catch (e) {
        cella = { k: 'invalid', kinds: [`例外：${String(e).slice(0, 60)}`] }
      }
    }
    const row: Row = { file: path.relative(DIR, f), js, cella, jsMs, cellaMs: Date.now() - t1 }
    rows.push(row)
    if (PROGRESS) fs.appendFileSync(PROGRESS, JSON.stringify({ file: row.file, js: js.ok ? 'ok' : js.why, cella: cella.k, kinds: 'kinds' in cella ? cella.kinds : undefined, jsMs, cellaMs: row.cellaMs }) + '\n')
  }
  child?.close()
}, TIMEOUT)

describe.skipIf(FS.length === 0)('探針：JS 直譯器跑得動、Cella 給不出結果的（階段 6.0）', () => {
  it('★ 入口條件：兩百支以上載得進來', () => {
    expect(rows.length).toBeGreaterThan(200)
  })

  it('📏 四格與退步的原因（量測，不設門檻）', () => {
    const bucket = (r: Row): string => {
      if (!r.js.ok) return 'JS 自己跑不完'
      if (r.cella.k === 'accept') return norm(r.cella.out) === norm(r.js.out) ? '一致' : '輸出不同'
      if (r.cella.k === 'reject') return 'Cella 較嚴'
      return '退步'
    }
    const count = (xs: string[]): string => Object.entries(xs.reduce<Record<string, number>>((m, x) => ({ ...m, [x]: (m[x] ?? 0) + 1 }), {}))
      .sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join('｜')
    if (FORMALIZE_ONLY) {
      const un = rows.filter((r) => r.cella.k === 'untranslated')
      console.log([`StudyCpp ${FS.length} 支：載得進 ${rows.length}；翻得出 ${rows.length - un.length}、翻不出 ${un.length}`,
        `翻不出的構造（支數）：${count(un.flatMap((r) => (r.cella as { constructs: string[] }).constructs))}`].join('\n'))
      return
    }
    const by = rows.map(bucket)
    const regress = rows.filter((r) => bucket(r) === '退步')
    const why = regress.flatMap((r) => r.cella.k === 'untranslated' ? r.cella.constructs.map((c) => `翻不出：${c}`) : (r.cella as { kinds: string[] }).kinds.map((k) => `${r.cella.k}：${k}`))
    const strict = rows.filter((r) => bucket(r) === 'Cella 較嚴').flatMap((r) => (r.cella as { kinds: string[] }).kinds)
    const differ = rows.filter((r) => bucket(r) === '輸出不同')
    console.log([
      `StudyCpp ${FS.length} 支：載得進 ${rows.length}、lift 失敗 ${liftFail}`,
      `四格：${count(by)}`,
      `退步的原因（一支可有多個）：${count(why)}`,
      ...regress.slice(0, 40).map((r) => `  ✘ ${r.file}  ${r.cella.k === 'untranslated' ? r.cella.constructs.join('、') : (r.cella as { kinds: string[] }).kinds.join('、')}`),
      `Cella 較嚴的種類：${count(strict)}`,
      `輸出不同 ${differ.length}：`,
      ...differ.slice(0, 15).map((r) => `  ≠ ${r.file}  JS ${JSON.stringify((r.js as { out: string }).out.slice(0, 40))}  Cella ${JSON.stringify((r.cella as { out: string }).out.slice(0, 40))}`),
      `JS 自己跑不完的原因：${count(rows.filter((r) => !r.js.ok).map((r) => (r.js as { why: string }).why))}`,
      `Cella 最慢的十支（毫秒）：`,
      ...[...rows].sort((a, b) => (b.cellaMs ?? 0) - (a.cellaMs ?? 0)).slice(0, 10).map((r) => `  ${String(r.cellaMs).padStart(7)}  ${r.cella.k}${'kinds' in r.cella ? `（${r.cella.kinds.join('、')}）` : ''}  ${r.file}`),
    ].join('\n'))
    if (process.env.CELLA_GAP_OUT) fs.writeFileSync(process.env.CELLA_GAP_OUT, JSON.stringify(rows.map((r) => ({ file: r.file, bucket: bucket(r), js: r.js.ok ? 'ok' : r.js.why, cella: r.cella.k, detail: r.cella.k === 'untranslated' ? r.cella.constructs : r.cella.k === 'accept' ? undefined : r.cella.kinds })), null, 1))
    expect(by.length).toBe(rows.length)
  })
})
