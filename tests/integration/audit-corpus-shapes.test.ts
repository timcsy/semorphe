/**
 * 第五十三條護欄：**語料自己夠不夠。**
 *
 * ## 為什麼有這一支（使用者 2026-08-22 問「為何你之前沒有發現」）
 *
 * 一元二次方程式畫出來一半是灰的，而那一刻的量測是
 * **語料 95 段、五軸全零、降級節點 0**。查下去：**95 段裡帶括號子運算式的有 0 段。**
 * 護欄沒有壞——是**語料裡沒有那種程式**。
 *
 * > **一份由寫實作的人寫的語料，量得出功能缺口，量不出【形狀】缺口
 * > ——因為它的形狀就是那個人的形狀。**
 *
 * ## 這一支補的是第三層
 *
 * ```
 * 第一層  實作對不對    護欄            判準是【我們】定的
 * 第二層  判準對不對    參照實作        答案是【第三方】定的（`python3`／`g++`）
 * 第三層  樣本夠不夠    ← 這一支        全集是【第三方】定的
 * ```
 *
 * ## 一個取樣點，可以有好幾個全集——而它們互補
 *
 * | 維度 | 全集 | 它抓得到什麼 |
 * |---|---|---|
 * | **語法形狀** | 文法的 `node-types.json` | **我們從來沒宣告過**的東西（括號就是這樣漏的） |
 * | **宣告的元件** | 元件登錄表 | **宣告了卻沒有人跑過**的東西 |
 *
 * 🔴 **第一個的全集刻意不是我們列的**——我們列一份的話，
 * 它會與我們的盲點同形。第二個的全集是我們的**沒關係**：
 * 那一維要抓的不是盲點，是**沒被行使的宣告**。
 *
 * ## 而零的那一格必須是【判過的】，不是【沒想到的】
 *
 * 這是這個 repo 既有的作法（可拿性、課程收錄、宣告完整性、靜默回退都是
 * 「全集 ＋ 具名判定」），而**語料是唯一一個沒有全集的取樣點**。
 *
 * > **從「我想到了什麼」變成「這個全集裡的每一格，我對它做過決定」。**
 *
 * ## 這條護欄不檢測什麼
 *
 * - **語料的程式寫得好不好**——那是人的判斷。
 * - **碰到了就等於支援**——一個形狀出現在語料裡而整段降級，
 *   是第五十條那三軸的事。這裡只問「有沒有碰到」。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { Parser, Language } from 'web-tree-sitter'
import { PYTHON_CORPUS } from '../assets/python-corpus'
import { PythonParser } from '../../src/languages/python/parser'
import { liftPython, componentIdsOf } from '../helpers/python-lift'
import { allComponentDefs } from '../helpers/component-scan'
import { printReport, assertRatchet, REPO_ROOT } from '../helpers/guardrail'
import { backtickSpans } from '../helpers/backtick-corpus'

/** 判定的封閉詞彙——**刻意沒有「還沒想到」**。 */
type cause =
  | '該補進語料'
  | '語言有而這個工具不做'
  | '過時的語法'
  | '只在降級時出現'
  // ⚠️ 2026-08-23 加的第五個：**文法的宣告與文法的產出不是同一件事**。
  //    `pure_virtual_clause` 在 `node-types.json` 裡，而裝的這一版解析
  //    `virtual void f() = 0;` 產出的是 `field_declaration` ＋ `default_value`
  //    ——那一格**補不進語料**，而它也不是「我們不做」。
  //    🔴 沒有這個原因的話，它只能被塞進一個說謊的格子。
  | '文法宣告了而這個版本不產生'
interface decision { type: string; cause: cause; reason: string }

const load = (f: string): decision[] =>
  JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'tests/assets', f), 'utf8')) as decision[]

/**
 * 文法**自己宣告**的具體節點型別。
 *
 * ⚠️ **上位型別要剔掉**（帶 `subtypes` 的那些，例如 `expression`）
 * ——它們不會有實例，不是一個「形狀」。
 */
function grammarShapes(pkg: string): Set<string> {
  const u = JSON.parse(
    fs.readFileSync(path.join(REPO_ROOT, `node_modules/${pkg}/src/node-types.json`), 'utf8'),
  ) as { type: string; named: boolean; subtypes?: unknown[] }[]
  return new Set(u.filter((n) => n.named && !n.subtypes).map((n) => n.type))
}

function collect(root: unknown, into: Set<string>): void {
  const walk = (n: { type: string; namedChildCount: number; namedChild(i: number): unknown }): void => {
    into.add(n.type)
    for (let i = 0; i < n.namedChildCount; i++) walk(n.namedChild(i) as never)
  }
  walk(root as never)
}

/**
 * 一個維度的判定：**每一格要嘛有見證，要嘛有判定**。
 *
 * @returns 報表用的行 ＋ 「該補」的數量（棘輪盯它）
 */
function judge(
  title: string, universe: Set<string>, seen: Set<string>, decisions: decision[],
): { lines: string[]; todo: string[]; unjudged: string[]; orphan: string[]; noReason: string[] } {
  const gap = [...universe].filter((t) => !seen.has(t)).sort()
  const decided = new Map(decisions.map((d) => [d.type, d]))
  const unjudged = gap.filter((t) => !decided.has(t))
  const orphan = decisions.filter((d) => !gap.includes(d.type)).map((d) => d.type)
  const noReason = decisions.filter((d) => !d.reason?.trim()).map((d) => d.type)
  const by = (c: cause): string[] => gap.filter((t) => decided.get(t)?.cause === c)
  return {
    lines: [
      `── ${title}`,
      `   全集 ${universe.size}｜語料碰到 ${universe.size - gap.length}｜沒碰到 ${gap.length}`,
      `   🔴 該補進語料 ${by('該補進語料').length}  ← 棘輪盯這一欄`,
      `      刻意不做   ${by('語言有而這個工具不做').length}`,
      `      過時的語法 ${by('過時的語法').length}`,
      `      只在降級時 ${by('只在降級時出現').length}`,
      `      文法宣告而不產 ${by('文法宣告了而這個版本不產生').length}`,
      `   ⚠️ 還沒判定  ${unjudged.length}  ← 硬性零`,
      ...(unjudged.length > 0 ? ['      ' + unjudged.join('  ')] : []),
      '',
    ],
    todo: by('該補進語料'), unjudged, orphan, noReason,
  }
}

let py: { shapes: Set<string>; seen: Set<string>; components: Set<string>; used: Set<string> }
let cpp: { shapes: Set<string>; seen: Set<string> }

beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })

  const p = new PythonParser()
  await p.init(`${process.cwd()}/public`)
  const seen = new Set<string>()
  const used = new Set<string>()
  for (const [, code] of PYTHON_CORPUS) {
    collect((await p.parse(code) as { rootNode: unknown }).rootNode, seen)
    for (const id of componentIdsOf(await liftPython(code))) used.add(id)
  }
  py = {
    shapes: grammarShapes('tree-sitter-python'),
    seen,
    components: new Set(allComponentDefs().map((d) => String(d.componentId)).filter((i) => i.startsWith('python:'))),
    used,
  }

  // C++ 那一側的語料是**從測試檔刮出來的**——不同的來源，同一種病
  //（它被「我們測了什麼」塑形）。所以它也要對著文法量一次。
  const cp = new Parser()
  cp.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  const cseen = new Set<string>()
  for (const c of cppCorpus()) collect(cp.parse(c)!.rootNode, cseen)
  cpp = { shapes: grammarShapes('tree-sitter-cpp'), seen: cseen }
}, 180_000)

/** C++ 的語料：測試檔裡的程式碼片段（與第三十一條護欄同一份來源）。 */
function cppCorpus(): string[] {
  const dir = path.join(REPO_ROOT, 'tests/integration')
  const out: string[] = []
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.test.ts')) continue
    for (const c of backtickSpans(fs.readFileSync(path.join(dir, f), 'utf8'))) {
      if (!/[;{]/.test(c) || c.includes('${')) continue
      out.push(c)
    }
  }
  return out
}

describe('第五十三條護欄：語料自己夠不夠', () => {
  it('★ 錨點：三個全集與語料都不是空的（否則下面每一個零都是假的）', () => {
    expect(py.shapes.size, 'Python 文法的節點型別讀不到').toBeGreaterThan(100)
    expect(cpp.shapes.size, 'C++ 文法的節點型別讀不到').toBeGreaterThan(100)
    expect(py.components.size, '元件登錄表是空的').toBeGreaterThan(50)
    expect([...py.seen].filter((t) => py.shapes.has(t)).length).toBeGreaterThan(40)
    expect([...cpp.seen].filter((t) => cpp.shapes.has(t)).length).toBeGreaterThan(40)
  })

  it('★ 注入：語料沒碰到的形狀【必須】被列出來，碰到的不得被誤報', () => {
    expect(py.shapes.has('yield') && !py.seen.has('yield'), '換一個沒被碰到的來當注入').toBe(true)
    const gap = [...py.shapes].filter((t) => !py.seen.has(t))
    expect(gap).toContain('yield')
    expect(py.seen.has('binary_operator'), '語料連四則運算都沒有 → 掃描壞了').toBe(true)
    expect(gap).not.toContain('binary_operator')
  })

  it('🔴 硬性零：沒碰到的每一格都要有【判定】，不得是「沒想到」', () => {
    const dims = [
      judge('Python · 語法形狀（全集＝tree-sitter-python 的 node-types）', py.shapes, py.seen, load('corpus-shape-decisions.json')),
      judge('Python · 宣告的元件（全集＝元件登錄表）', py.components, py.used, load('corpus-component-decisions.json')),
      judge('C++ · 語法形狀（全集＝tree-sitter-cpp 的 node-types）', cpp.shapes, cpp.seen, load('corpus-shape-decisions-cpp.json')),
    ]
    printReport('語料自己夠不夠（一個取樣點，好幾個全集）', [
      ...dims.flatMap((d) => d.lines),
      '⚠️ 「碰到了」不等於「支援」——那是第五十條那三軸的事。這裡只問有沒有碰到。',
    ])
    expect(dims.flatMap((d) => d.noReason), '沒有理由的判定是把「懶得看」寫成「看過了」').toEqual([])
    expect(dims.flatMap((d) => d.orphan), '判定過期了——語料已經碰到它，那一筆該退場').toEqual([])
    expect(dims.flatMap((d) => d.unjudged), '零的那一格必須是【判過的】，不是【沒想到的】').toEqual([])
  })

  it('棘輪：三個維度的「該補進語料」都只准下降', () => {
    const a = judge('', py.shapes, py.seen, load('corpus-shape-decisions.json'))
    const b = judge('', py.components, py.used, load('corpus-component-decisions.json'))
    const c = judge('', cpp.shapes, cpp.seen, load('corpus-shape-decisions-cpp.json'))
    assertRatchet([
      ['Python 語法形狀該補', a.todo.length],
      ['Python 元件該補', b.todo.length],
      ['C++ 語法形狀該補', c.todo.length],
    ], 'corpus-shapes', { detail: [...a.todo, ...b.todo, ...c.todo] })
  })
})
