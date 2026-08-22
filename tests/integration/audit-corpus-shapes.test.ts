/**
 * 第五十三條護欄：**語料自己覆蓋了這個語言的多少形狀。**
 *
 * ## 為什麼有這一支（使用者 2026-08-22 問「為何你之前沒有發現」）
 *
 * 一元二次方程式畫出來一半是灰的，而那一刻的量測是
 * **語料 95 段、五軸全零、降級節點 0**。
 *
 * 查下去：**95 段裡帶括號子運算式的有 0 段。** 護欄沒有壞
 * ——是**語料裡沒有那種程式**。
 *
 * > **一份由寫實作的人寫的語料，量得出功能缺口，量不出【形狀】缺口
 * > ——因為它的形狀就是那個人的形狀。**
 *
 * ## 這一支補的是第三層
 *
 * ```
 * 第一層  實作對不對    護欄            判準是我們定的
 * 第二層  判準對不對    參照直譯器      答案是第三方定的（`python3`）  ← 第五十條那一軸
 * 第三層  樣本夠不夠    ← 這一支        全集是第三方定的（文法本身）
 * ```
 *
 * 🔴 **全集刻意不是我們列的**：`node_modules/tree-sitter-python/src/node-types.json`
 * ——那是**文法自己宣告**的節點型別。我們列一份的話，它會漏掉我們沒想到的，
 * 而那正是這條護欄要治的病。
 *
 * ⚠️ **上位型別要剔掉**（`node-types.json` 裡帶 `subtypes` 的那些，
 * 例如 `expression`／`_simple_statement`）——它們不會有實例，不是一個「形狀」。
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
 * - **碰到了就等於支援**——一個節點型別出現在語料裡而整段降級，
 *   是第五十條那三軸的事（它們會說話）。這裡只問「有沒有碰到」。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { Parser } from 'web-tree-sitter'
import { PYTHON_CORPUS } from '../assets/python-corpus'
import { PythonParser } from '../../src/languages/python/parser'
import { printReport, assertRatchet, REPO_ROOT } from '../helpers/guardrail'

const GUARD = 'corpus-shapes'
const DECISIONS = path.join(REPO_ROOT, 'tests/assets/corpus-shape-decisions.json')

/** 判定的封閉詞彙——**刻意沒有「還沒想到」**。 */
type cause = '該補進語料' | '語言有而這個工具不做' | 'Python 2 的語法'

interface decision { type: string; cause: cause; reason: string }

/** 文法**自己宣告**的具體節點型別（剔掉上位型別）。 */
function grammarShapes(): Set<string> {
  const u = JSON.parse(
    fs.readFileSync(path.join(REPO_ROOT, 'node_modules/tree-sitter-python/src/node-types.json'), 'utf8'),
  ) as { type: string; named: boolean; subtypes?: unknown[] }[]
  return new Set(u.filter((n) => n.named && !n.subtypes).map((n) => n.type))
}

let seen: Set<string>
let shapes: Set<string>

beforeAll(async () => {
  shapes = grammarShapes()
  await Parser.init()
  const p = new PythonParser()
  await p.init(`${process.cwd()}/public`)
  seen = new Set<string>()
  for (const [, code] of PYTHON_CORPUS) collect(await p.parse(code), seen)
}, 60_000)

function collect(tree: unknown, into: Set<string>): void {
  const walk = (n: { type: string; namedChildCount: number; namedChild(i: number): unknown }): void => {
    into.add(n.type)
    for (let i = 0; i < n.namedChildCount; i++) walk(n.namedChild(i) as never)
  }
  walk((tree as { rootNode: never }).rootNode)
}

describe('第五十三條護欄：語料覆蓋了這個語言的多少形狀', () => {
  it('★ 錨點：全集與語料都不是空的（否則下面每一個零都是假的）', () => {
    expect(shapes.size, '文法的節點型別讀不到 → 全集壞了').toBeGreaterThan(100)
    expect([...seen].filter((t) => shapes.has(t)).length, '語料一個形狀都沒碰到 → 掃描壞了').toBeGreaterThan(40)
  })

  it('★ 注入：語料沒碰到的形狀【必須】被列出來', async () => {
    // `yield` 不在語料裡——它必須出現在「沒碰到」那一格
    expect(shapes.has('yield')).toBe(true)
    expect(seen.has('yield'), '這個形狀居然在語料裡 → 換一個來當注入').toBe(false)
    expect(missing()).toContain('yield')
  })

  it('★ 注入②：語料碰得到的不得被誤報', () => {
    expect(seen.has('binary_operator'), '語料連四則運算都沒有 → 掃描壞了').toBe(true)
    expect(missing(), '碰到了卻被算成沒碰到').not.toContain('binary_operator')
  })

  it('🔴 硬性零：沒碰到的每一格都要有【判定】，不得是「沒想到」', () => {
    const decisions: decision[] = fs.existsSync(DECISIONS)
      ? (JSON.parse(fs.readFileSync(DECISIONS, 'utf8')) as decision[])
      : []
    const decided = new Map(decisions.map((d) => [d.type, d]))
    const gap = missing()
    const unjudged = gap.filter((t) => !decided.has(t))
    // ⚠️ 判定過期也要說：那個形狀已經被語料碰到了，判定該退場
    const orphan = decisions.filter((d) => !gap.includes(d.type)).map((d) => d.type)
    const noReason = decisions.filter((d) => !d.reason?.trim()).map((d) => d.type)
    const byCause = (c: cause): number => decisions.filter((d) => gap.includes(d.type) && d.cause === c).length

    printReport('語料的形狀覆蓋（全集＝文法自己宣告的節點型別）', [
      `全集 ${shapes.size} 個具體形狀｜語料 ${PYTHON_CORPUS.length} 段碰到 ${shapes.size - gap.length}`,
      `沒碰到 ${gap.length}`,
      '',
      `  🔴 該補進語料          ${byCause('該補進語料')}  ← 棘輪盯這一欄`,
      `     語言有而這個工具不做 ${byCause('語言有而這個工具不做')}`,
      `     Python 2 的語法      ${byCause('Python 2 的語法')}`,
      `  ⚠️ 還沒判定            ${unjudged.length}  ← 硬性零`,
      ...(unjudged.length > 0 ? ['', '  ' + unjudged.join('  ')] : []),
      '',
      '⚠️ 「碰到了」不等於「支援」——那是第五十條那三軸的事。這裡只問有沒有碰到。',
    ])

    expect(noReason, '沒有理由的判定是把「懶得看」寫成「看過了」').toEqual([])
    expect(orphan, '判定過期了——語料已經碰到它，那一筆該退場').toEqual([])
    expect(unjudged, '零的那一格必須是【判過的】，不是【沒想到的】').toEqual([])
  })

  it('棘輪：「該補進語料」只准下降', () => {
    const decisions: decision[] = JSON.parse(fs.readFileSync(DECISIONS, 'utf8')) as decision[]
    const gap = new Set(missing())
    const todo = decisions.filter((d) => gap.has(d.type) && d.cause === '該補進語料')
    assertRatchet([['該補進語料', todo.length]], GUARD, { detail: todo.map((d) => d.type) })
  })
})

function missing(): string[] {
  return [...shapes].filter((t) => !seen.has(t)).sort()
}
