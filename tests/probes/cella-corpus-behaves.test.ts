/**
 * **探針：直譯器對 clang 的嚴謹度**（2026-10-11）
 *
 * ## 它從哪來
 *
 * 使用者看完 cella 的執行速度量測後，擔心我們的 JS 直譯器不夠嚴謹（JS 的數字是 double、
 * int 溢位、long long 超過 2^53、越界讀到 undefined 照跑、浮點格式、迭代器失效）。他的決定：
 * **先拿 cella 的差分語料量一次；效果不好就讓 Cella 直接當直譯器、semorphe 負責 render。**
 *
 * 語料是 cella 為這次量測寫的「學生形狀」程式（一案一支、`int main()`、輸入走 cin），
 * 每案附 clang＋ASan／UBSan＋libc++ hardening 的預期結果，以及產生器**照 C++17 標準**算的
 * `standardUB`（已與 clang 停不停交叉檢查，不一致 0）。
 *
 * ## 🔴 判準：兩類不得合併
 *
 * ```
 * 行為有定義（standardUB=false）   一致 ／ 輸出不同 ／ 不該停卻停下   ← 這才是「直譯器算錯」
 * 標準是 UB（standardUB=true）      直譯器也停下 ／ 直譯器照跑          ← 「直譯器不偵測 UB」
 * 不支援                            lift 有不認得的節點、或直譯器說不認得 ← 覆蓋，不是行為
 * ```
 *
 * ⚠️ 直譯器**刻意**不模擬 long long 溢位（`src/interpreter/int64.ts`：「我們算得比它準
 * ——往安全的方向錯」），所以「UB 照跑」那一欄本來就會很多。它與「有定義卻算錯」是兩件事，
 * 合成一個「不一致率」的話，使用者會拿錯的數字做決定。
 *
 * ⚠️ `sanitizerMisses: true` 的那幾支（標準是 UB 而 clang 照跑）**以 `standardUB` 為準**
 * ——直譯器照跑時歸「UB 照跑」，不算「與 clang 一致」。
 *
 * ⚠️ 需要語料目錄（`CELLA_CORPUS_DIR`，cella repo 的 `target/semorphe-corpus/`，不進 git）。
 * 沒有就跳過——而**有指定卻讀不到案例**是紅，不是綠（StudyCpp 被 /tmp 清掉那次的形狀）。
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import { SemanticInterpreter } from '../../src/interpreter/interpreter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { unreadSlots } from '../../src/core/component/slot-check'
import type { SemanticNode } from '../../src/core/types'

const DIR = process.env.CELLA_CORPUS_DIR ?? ''
const CATS = ['int', 'vec', 'iter', 'fmt', 'cin'] as const

interface Expected {
  id: string
  category: string
  note?: string
  verdict: 'ok' | 'ub' | 'exception' | 'crash'
  stdout: string
  standardUB: boolean
  sanitizerMisses?: boolean
  ubKind?: string
  exceptionType?: string
}

type Kind =
  | '有定義・一致' | '有定義・輸出不同' | '有定義・不該停卻停下'
  | 'UB・直譯器也停下' | 'UB・直譯器照跑'
  | '不支援'

/**
 * 直譯器說「不認得」的那幾種錯——它們是覆蓋問題，不是行為問題。
 *
 * 🔴 `UNDECLARED_VAR`／`STREAM_NOT_VARIABLE` 也在這裡（2026-10-11，第一輪量完才加的）：
 * 語料**每一支都編得過 clang**，所以「未宣告的變數」不可能是程式的錯——它一定是我們
 * 不認得某個標準函式庫的名字（`showpos`、`hex`、`setw`、`v.at(i)`、`reserve`、`cin.fail()`）。
 * 第一輪把這 82 支歸成「有定義卻停下」，而那會讓「直譯器算錯」的數字虛胖。
 */
const UNSUPPORTED_ERRS = ['UNKNOWN_COMPONENT', 'UNRECOGNIZED_CODE', 'UNDEFINED_FUNC', 'UNDECLARED_VAR', 'STREAM_NOT_VARIABLE']

const norm = (s: string): string =>
  s.split('\n').map((l) => l.replace(/\s+$/, '')).join('\n').replace(/\n+$/, '')

/** 這棵樹裡第一個「讀不懂」的節點（raw_code／unresolved 那類）——有的話這支算不支援。 */
function unreadIn(n: SemanticNode): string | null {
  const u = unreadSlots(n)
  return u.length > 0 ? u[0]!.componentId + (u[0]!.parent ? ` 在 ${u[0]!.parent.componentId}.${u[0]!.parent.slot}` : '') : null
}

const cases = (): { cat: string; base: string }[] => {
  if (!DIR || !fs.existsSync(DIR)) return []
  const out: { cat: string; base: string }[] = []
  for (const cat of CATS) {
    const d = path.join(DIR, cat)
    if (!fs.existsSync(d)) continue
    for (const f of fs.readdirSync(d)) if (f.endsWith('.cpp')) out.push({ cat, base: path.join(d, f.slice(0, -4)) })
  }
  return out
}

describe.skipIf(!DIR)('探針：直譯器對 clang 的嚴謹度（cella 的差分語料）', () => {
  it('★ 入口條件：指定了語料目錄，就要讀得到案例，而且五類都在', () => {
    const cs = cases()
    expect(cs.length, `🔴 CELLA_CORPUS_DIR=${DIR} 讀不到任何 .cpp —— 目錄被清掉或路徑錯了，不是全綠`).toBeGreaterThan(0)
    for (const cat of CATS) expect(cs.some((c) => c.cat === cat), `🔴 少了 ${cat} 那一類`).toBe(true)
  })

  it('🔴 分兩類報：行為有定義卻輸出不同 ／ 標準是 UB 而直譯器照跑（不支援另報）', async () => {
    registerCppLanguage()
    await Parser.init({ locateFile: (f: string) => `${process.cwd()}/public/${f}` })
    const parser = new Parser()
    parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
    const lifter = createTestLifter()

    const rows: { id: string; cat: string; pattern: string; kind: Kind; detail: string; exp: Expected }[] = []
    for (const { cat, base } of cases()) {
      const src = fs.readFileSync(base + '.cpp', 'utf8')
      const stdinText = fs.existsSync(base + '.in') ? fs.readFileSync(base + '.in', 'utf8') : ''
      const exp = JSON.parse(fs.readFileSync(base + '.expected.json', 'utf8')) as Expected
      const pattern = exp.id.replace(/^[a-z]+-\d+-/, '')
      const push = (kind: Kind, detail = ''): void => { rows.push({ id: exp.id, cat, pattern, kind, detail, exp }) }

      const parsed = parser.parse(src)
      let tree: SemanticNode | null = null
      try { tree = lifter.lift(parsed!.rootNode as never) as SemanticNode | null } finally { parsed?.delete() }
      if (!tree) { push('不支援', 'lift 沒有產出樹'); continue }
      const unread = unreadIn(tree)
      if (unread) { push('不支援', `lift 不認得：${unread}`); continue }

      const out: string[] = []
      const interp = new SemanticInterpreter({ maxSteps: 10_000_000 })
      interp.setOutputCallback((x) => out.push(x))
      let err = ''
      try {
        await interp.execute(tree, stdinText.split('\n').filter((l, i, a) => i < a.length - 1 || l !== ''))
      } catch (e) { err = String(e) }
      const got = out.join('')
      const errKey = (err.match(/RUNTIME_ERR_[A-Z_]+/) ?? [err ? 'JS:' + err.slice(0, 50) : ''])[0]
      if (err && (UNSUPPORTED_ERRS.some((k) => errKey.includes(k)) || errKey.startsWith('JS:'))) {
        push('不支援', `執行：${errKey}`); continue
      }

      if (exp.standardUB) {
        push(err ? 'UB・直譯器也停下' : 'UB・直譯器照跑', err ? errKey : `印出 ${JSON.stringify(norm(got).slice(0, 40))}`)
      } else if (exp.verdict === 'exception') {
        // at() 越界：C++ 丟 out_of_range（未接住 → terminate）。直譯器停下就算一致。
        push(err ? '有定義・一致' : '有定義・輸出不同', err ? errKey : '應該丟例外而照跑')
      } else if (err) {
        push('有定義・不該停卻停下', errKey)
      } else if (norm(got) === norm(exp.stdout)) {
        push('有定義・一致')
      } else {
        push('有定義・輸出不同', `clang ${JSON.stringify(norm(exp.stdout).slice(0, 50))} ／ 我們 ${JSON.stringify(norm(got).slice(0, 50))}`)
      }
    }

    // ── 報表 ────────────────────────────────────────────────────────
    const KINDS: Kind[] = ['有定義・一致', '有定義・輸出不同', '有定義・不該停卻停下', 'UB・直譯器也停下', 'UB・直譯器照跑', '不支援']
    const lines: string[] = [`\n╔══ 直譯器對 clang：${rows.length} 支 ══╗`]
    lines.push('類別    ' + KINDS.map((k) => k.padStart(10)).join(''))
    for (const cat of [...CATS, '合計']) {
      const rs = cat === '合計' ? rows : rows.filter((r) => r.cat === cat)
      lines.push(cat.padEnd(6) + KINDS.map((k) => String(rs.filter((r) => r.kind === k).length).padStart(10)).join(''))
    }
    for (const k of ['有定義・輸出不同', '有定義・不該停卻停下', 'UB・直譯器照跑', '不支援'] as Kind[]) {
      const fam = new Map<string, typeof rows>()
      for (const r of rows.filter((x) => x.kind === k)) {
        const key = k === '不支援' ? r.detail : `${r.cat}/${r.pattern}`
        fam.set(key, [...(fam.get(key) ?? []), r])
      }
      lines.push(`\n── ${k}：${rows.filter((x) => x.kind === k).length} 支，${fam.size} 族（依支數）`)
      for (const [key, rs] of [...fam].sort((a, b) => b[1].length - a[1].length).slice(0, 25)) {
        const ex = rs[0]!
        lines.push(`  ${String(rs.length).padStart(5)}  ${key}${ex.exp.ubKind ? `  [${ex.exp.ubKind}]` : ''}`)
        lines.push(`         例 ${ex.id}：${ex.exp.note ?? ''}  ${k === '不支援' ? '' : ex.detail}`)
      }
    }
    console.log(lines.join('\n'))
    if (process.env.CELLA_CORPUS_OUT) fs.writeFileSync(process.env.CELLA_CORPUS_OUT, JSON.stringify(rows.map(({ exp, ...r }) => ({ ...r, note: exp.note, ubKind: exp.ubKind, sanitizerMisses: exp.sanitizerMisses })), null, 1))

    // 這一支是量測，不是閘門——只要求它真的量到了東西
    expect(rows.length, '一支都沒跑').toBeGreaterThan(0)
    expect(rows.filter((r) => r.kind !== '不支援').length, '🔴 全部都是「不支援」——lift 或註冊壞了，量到的是空氣').toBeGreaterThan(0)
  }, 3_600_000)
})
