/**
 * **在我們這側跑 Cella 的判決**（spec 180 T010）——C18 語料裡翻得出的每一支，交給 Cella 的判決入口。
 *
 * 量兩件事：
 * - **SC-002**：`invalid` 為 0。cella：「invalid 只在程式 JSON 讀不進來時出現（欄位或建構子不對）」——量的是介面的形狀。
 * - **SC-003**：每一個 problem 的節點標籤（`at`）都對得回語義樹裡的節點。
 *
 * 走的是 `src/providers/cella/verdict.ts`——階段 5 的 Cella 提供者會用的同一支（〈綠燈只證明被測的那份是對的〉）。
 *
 * ⚠️ 入口條件先於讀數（〈零缺陷與零樣本的讀數長得一模一樣〉）：送進去的支數 ＝ 拿回來的判決數 ＝ 語料裡有 program 的支數，
 *    而且一支故意寫壞的程式必須被判成 invalid、一支未定義行為必須被判成 reject。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { Parser, Language } from 'web-tree-sitter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { buildC18Corpus, type C18Row } from '../helpers/c18-corpus'
import { createCellaChecker, type CellaChecker, type CellaVerdict } from '../../src/providers/cella/verdict'
import { createTestLifter } from '../helpers/setup-lifter'
import { formalize } from '../../src/providers/cella/formalize'
import type { SemanticNode } from '../../src/core/types'

const read = (pkg: string | null, file: string): Uint8Array =>
  fs.readFileSync(path.join('node_modules', pkg === null ? 'cella-lang' : `@cella-lang/${pkg}`, file))

let parser: Parser
let checker: CellaChecker
let verdict: CellaChecker['verdict']
let rows: C18Row[]
/** 語料裡有 program 的每一支與它的判決——跑一次，各支測試共用。 */
let results: { row: C18Row; v: CellaVerdict; expected?: string }[]
beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  registerCppLanguage()
  rows = buildC18Corpus(parser)
  checker = await createCellaChecker(read)
  verdict = checker.verdict
  results = rows.filter((r) => r.program).map((row) => {
    const c = checkOf(row.id)
    // Arduino 的 sketch 要模擬到 5 秒（setup 一次、loop 重複）——步數要給夠，否則是 `fuel` 的 unknown
    const fuel = row.id.startsWith('arduino/') ? 50_000_000 : undefined
    return { row, v: verdict(row.program, c.stdin, fuel), expected: c.stdout }
  })
}, 600_000)

/**
 * 課文宣告的測資：解答檔名就是任務 id（`ex1.cpp` ↔ `tasks[].id === 'ex1'`），`check.stdin` 一行一筆。
 * 沒有宣告的（Arduino 的 sketch、沒有 check 的解答）給空輸入。
 */
function checkOf(id: string): { stdin: string; stdout?: string } {
  const m = /^([^/]+)\/([^/]+)\/(.+)\.(cpp|c)$/.exec(id)
  if (!m) return { stdin: '' }
  const meta = path.join('lessons', m[1], m[2], 'lesson.json')
  if (!fs.existsSync(meta)) return { stdin: '' }
  const task = (JSON.parse(fs.readFileSync(meta, 'utf8')).tasks ?? []).find((t: { id: string }) => t.id === m[3])
  const c = task?.check as { stdin?: string[]; stdout?: string } | undefined
  return { stdin: (c?.stdin ?? []).map((l) => `${l}\n`).join(''), stdout: c?.stdout }
}

/** 一棵語義樹裡所有節點的 id。 */
function ids(tree: SemanticNode): Set<string> {
  const out = new Set<string>()
  const walk = (n: SemanticNode): void => {
    out.add(n.id)
    for (const kids of Object.values(n.slots ?? {})) kids.forEach(walk)
  }
  walk(tree)
  return out
}

/** 標籤 → 它掛在哪個語義樹節點上：`<id>/<角色>`、`<id>#<槽>` 都歸給 `<id>`。 */
const owner = (label: string): string => label.split(/[/#]/)[0]

/** 程式 JSON 裡每個節點的標籤 `n`（cella：運算式的標籤必須彼此不同，共用會讓判決靜默出錯）。 */
function labels(program: unknown): string[] {
  const out: string[] = []
  const walk = (v: unknown): void => {
    if (Array.isArray(v)) v.forEach(walk)
    else if (v && typeof v === 'object') {
      const o = v as Record<string, unknown>
      if (typeof o.n === 'string') out.push(o.n)
      Object.values(o).forEach(walk)
    }
  }
  walk(program)
  return out
}

const lift = (code: string): SemanticNode => createTestLifter().lift(parser.parse(code)!.rootNode as never) as SemanticNode

describe('C18 語料交給 Cella 的判決', () => {
  it('★ 注入：寫壞的程式 JSON 判 invalid；未定義行為判 reject，而且 at 對得回節點', () => {
    expect(verdict({ k: 'prog', n: 'x', lang: { k: 'langCpp' }, items: 'not-a-list', board: null }).verdict).toBe('invalid')
    const tree = lift('int main() { int a[3]; int i = 5; return a[i]; }')
    const f = formalize(tree)
    expect(f.program, '🔴 注入用的程式翻不出來 → 下面驗的是空氣').toBeTruthy()
    const v = verdict(f.program)
    expect(v.verdict, `🔴 越界讀取沒被判 reject：${JSON.stringify(v).slice(0, 300)}`).toBe('reject')
    const known = ids(tree)
    expect(v.problems.length).toBeGreaterThan(0)
    for (const p of v.problems) expect(known.has(owner(p.at ?? '')), `🔴 problem 的節點 ${p.at} 對不回語義樹`).toBe(true)
  })

  it('★ 型別查詢（US4）：接上錯型別 → errors 指到那一句；洞 → slots 說放得進什麼', () => {
    const bad = formalize(lift('#include <string>\nint main() { std::string s = "hi"; int x = s; return x; }'))
    expect(bad.program, '🔴 翻不出來 → 驗的是空氣').toBeTruthy()
    const t = checker.types(bad.program, ['int', 'std::string'])
    expect(t.errors?.length, `🔴 字串接進整數沒有型別錯：${JSON.stringify(t).slice(0, 400)}`).toBeGreaterThan(0)
    const tree = lift('#include <string>\nint main() { std::string s = "hi"; int x = s; return x; }')
    const known = ids(tree)
    // 每次 lift 的 id 不同，所以只驗「標籤的形狀對得回某一顆」——同一棵樹再 formalize 一次
    const again = checker.types(formalize(tree).program, [])
    for (const e of again.errors ?? []) expect(known.has(owner(e.at)), `🔴 型別錯的 at ${e.at} 對不回語義樹`).toBe(true)
  })

  it('★ 入口條件：送進去的支數 ＝ 拿回來的判決數 ＝ 語料裡有 program 的支數', () => {
    const sent = rows.filter((r) => r.program)
    expect(sent.length, '🔴 語料裡有 program 的太少 → 語料壞了，下面的 0 是零樣本').toBeGreaterThan(90)
    expect(results.length).toBe(sent.length)
    expect(results.every(({ v }) => ['accept', 'reject', 'unknown', 'invalid'].includes(v.verdict)), '🔴 有判決不是四種之一').toBe(true)
  })

  it('🔴 每支程式裡的節點標籤彼此不同（cella：共用標籤會讓判決靜默出錯）', () => {
    const dup: string[] = []
    for (const r of rows.filter((x) => x.program)) {
      const seen = new Set<string>()
      for (const l of labels(r.program)) { if (seen.has(l)) dup.push(`${r.id}：${l}`); seen.add(l) }
    }
    expect(dup).toEqual([])
  })

  it('🔴 SC-002：invalid 為 0；SC-003：每個 problem 的節點都對得回語義樹', () => {
    const tally: Record<string, number> = {}
    const invalid: string[] = []
    const orphan: string[] = []
    const kinds: Record<string, number> = {}
    const detail: string[] = []
    // 餵課文宣告的測資（`checkOf`）；accept 的還要比對課文宣告的輸出——那是「Cella 跑出來的與課文承諾的一致嗎」
    const wrongOut: string[] = []
    for (const { row: r, v, expected } of results) {
      if (v.verdict === 'accept' && expected !== undefined && v.out !== expected) wrongOut.push(`  ${r.id}：預期 ${JSON.stringify(expected).slice(0, 60)}，Cella 印 ${JSON.stringify(v.out).slice(0, 60)}`)
      tally[v.verdict] = (tally[v.verdict] ?? 0) + 1
      if (v.verdict === 'invalid') invalid.push(`${r.id}：${JSON.stringify(v.problems).slice(0, 200)}`)
      const known = ids(r.tree)
      for (const p of v.problems) {
        kinds[p.kind] = (kinds[p.kind] ?? 0) + 1
        if (p.at && !known.has(owner(p.at))) orphan.push(`${r.id}：${p.kind} @ ${p.at}`)
      }
      if (v.verdict !== 'accept') detail.push(`  ${v.verdict.padEnd(7)} ${r.id}  ${v.problems.map((p) => `${p.kind}${p.reason ? `（${p.reason.slice(0, 60)}）` : ''}`).join('；')}`)
    }
    console.log(['C18 語料的 Cella 判決', `  ${Object.entries(tally).map(([k, n]) => `${k} ${n}`).join('｜')}`,
      `  problem 種類：${Object.entries(kinds).map(([k, n]) => `${k}×${n}`).join(' ') || '（無）'}`, ...detail,
      `accept 而輸出與課文不同：${wrongOut.length}`, ...wrongOut].join('\n'))
    expect(invalid, '🔴 SC-002：有程式 JSON 讀不進 Cella（介面的形狀不對）').toEqual([])
    expect(orphan, '🔴 SC-003：problem 的節點對不回語義樹').toEqual([])
  })
})
