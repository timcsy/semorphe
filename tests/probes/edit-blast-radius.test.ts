/**
 * **探測（不是護欄）**：改一顆積木，**要重寫幾行程式碼**。
 *
 * ## 它要回答一個【已經被記下來的觸發條件】
 *
 * [history/080](../../knowledge/history/080-ArduinoIDE吃VSCode擴充而那不是一個平台是一個位置.md)§六
 * 給「範圍編輯」留了一個觸發條件，逐字：
 *
 * > 觸發　有人真的在用之後，量一件事：【一次積木編輯平均動到幾行】
 * >       多數是一兩行  → 範圍編輯的收益很大，值得做
 * >       動輒半個檔案  → 範圍編輯自動退化成整份重寫，不急
 *
 * ## 🔴 而量的東西必須是「範圍編輯【真的會寫】的那個範圍」
 *
 * 不是「有幾行的內容不一樣」——那是 diff 的問法。
 * 範圍編輯做的是 **一次 `replace(range, text)`**，所以它寫的範圍是：
 *
 * ```
 * 去掉共同的開頭幾行、去掉共同的結尾幾行 → 中間【必須整段重寫】的那一段
 * ```
 *
 * ⚠️ 兩者會差很多：改動兩個相隔 50 行的地方，diff 說「2 行」，
 * 而單一範圍的重寫是 **52 行**。**後者才是成本。**
 *
 * ## ⚠️ 自我否證
 *
 * > **如果「產生了變化的編輯」數量是 0，這份報表不算數**
 * > ——那代表突變根本沒有投影到程式碼上，而不是「範圍很小」。
 *
 * 錨在**合成量**（語料段數 ＋ 有效編輯數），🔴 **不錨在跨距**
 * ——那正是要量的東西。
 *
 * ## 這支不檢測什麼
 *
 * - **不檢測積木 UI**——它在語義樹上突變，不經過 Blockly。
 *   ⚠️ 而那是**保守的方向**：真實的積木編輯只會更侷部。
 * - **不檢測正確性**——突變後的程式可能沒有意義，而**跨距與意義無關**。
 * - **不檢測 VSCode 的寫回**——那還沒做。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { generateCode } from '../../src/core/projection/code-generator'
import apcs from '../../src/languages/cpp/styles/apcs.json'
import type { SemanticNode, StylePreset } from '../../src/core/types'

const S = apcs as unknown as StylePreset
const CORPUS = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), 'tests/probes/arduino-realistic-corpus.json'), 'utf8'),
) as Record<string, { board: string; topic: string; code: string }>

/**
 * 範圍編輯**真的會寫**的那一段有幾行。
 *
 * 去頭去尾之後剩下的行數 —— ⚠️ 取 `max(舊段, 新段)`，因為要寫的範圍
 * 是舊的那一段，而寫進去的內容是新的那一段，**成本看兩者較大的**。
 */
function rewriteSpan(before: string, after: string): number {
  const a = before.split('\n')
  const b = after.split('\n')
  let head = 0
  while (head < a.length && head < b.length && a[head] === b[head]) head++
  let tail = 0
  while (tail < a.length - head && tail < b.length - head &&
         a[a.length - 1 - tail] === b[b.length - 1 - tail]) tail++
  return Math.max(a.length - head - tail, b.length - head - tail)
}

/** 深拷貝——突變不能污染原樹。 */
const clone = (n: SemanticNode): SemanticNode => JSON.parse(JSON.stringify(n)) as SemanticNode

function walk(n: SemanticNode, fn: (x: SemanticNode) => void): void {
  fn(n)
  for (const ks of Object.values(n.children ?? {})) for (const k of ks) walk(k, fn)
}

/** 把第 `idx` 個節點的第一個字串／數字屬性改掉。回傳有沒有改成。 */
function mutateProperty(root: SemanticNode, idx: number): boolean {
  const nodes: SemanticNode[] = []
  walk(root, (n) => nodes.push(n))
  const n = nodes[idx]
  if (!n?.properties) return false
  for (const [k, v] of Object.entries(n.properties)) {
    if (typeof v === 'string' && v.length > 0) {
      // 只改「像識別字或字面」的值，不動 `type`／`op` 這種會換掉語義形狀的
      if (k === 'op' || k === 'operator') continue
      n.properties[k] = /^\d+$/.test(v) ? String(Number(v) + 7) : `${v}Z`
      return true
    }
    if (typeof v === 'number') {
      n.properties[k] = v + 7
      return true
    }
  }
  return false
}

/** 刪掉某個 body 裡的一個語句——**結構編輯**，會讓下面的行號位移。 */
function deleteStatement(root: SemanticNode, idx: number): boolean {
  const bodies: SemanticNode[][] = []
  walk(root, (n) => {
    for (const ks of Object.values(n.children ?? {})) {
      if (Array.isArray(ks) && ks.length > 1) bodies.push(ks as SemanticNode[])
    }
  })
  const body = bodies[idx % Math.max(1, bodies.length)]
  if (!body || body.length < 2) return false
  body.splice(idx % body.length, 1)
  return true
}

const pct = (n: number, d: number): string => `${((n / d) * 100).toFixed(1)}%`

function report(label: string, spans: number[], totals: number[]): string {
  if (spans.length === 0) return `  ${label}：（零筆有效編輯）`
  const sorted = [...spans].sort((x, y) => x - y)
  const q = (p: number): number => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))]
  const le = (k: number): string => pct(spans.filter((s) => s <= k).length, spans.length)
  const ratio = spans.map((s, i) => s / totals[i])
  const avgRatio = ratio.reduce((a, b) => a + b, 0) / ratio.length
  return (
    `  ${label}（${spans.length} 筆）\n` +
    `    重寫跨距　中位 ${q(0.5)} 行｜p90 ${q(0.9)} 行｜最大 ${q(1)} 行\n` +
    `    ≤1 行 ${le(1)}｜≤2 行 ${le(2)}｜≤5 行 ${le(5)}｜≤10 行 ${le(10)}\n` +
    `    佔整檔比例　平均 ${(avgRatio * 100).toFixed(1)}%`
  )
}

let parser: Parser
beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  registerCppLanguage()
}, 30000)

describe('探測：改一顆積木要重寫幾行', () => {
  it('★ 範圍編輯的重寫跨距', () => {
    const fieldSpans: number[] = [], fieldTotals: number[] = []
    const structSpans: number[] = [], structTotals: number[] = []
    let programs = 0, noop = 0, whole = 0
    const worst: string[] = []

    for (const [id, g] of Object.entries(CORPUS)) {
      const tree = parser.parse(g.code)
      if (!tree) continue
      const root = createTestLifter().lift(tree.rootNode as never) as SemanticNode
      if (!root) continue
      const base = generateCode(root, 'cpp', S)
      const baseLines = base.split('\n').length
      programs++

      let count = 0
      walk(root, () => count++)

      // ① 欄位編輯——每 3 個節點取一個，避免同一支程式灌爆分佈
      for (let i = 0; i < count; i += 3) {
        const c = clone(root)
        if (!mutateProperty(c, i)) continue
        let out: string
        try { out = generateCode(c, 'cpp', S) } catch { continue }
        if (out === base) { noop++; continue }
        const span = rewriteSpan(base, out)
        fieldSpans.push(span); fieldTotals.push(baseLines)
        if (span > baseLines * 0.5) {
          whole++
          if (worst.length < 6) worst.push(`  ✘ ${id} 欄位編輯 → 跨距 ${span}/${baseLines} 行`)
        }
      }

      // ② 結構編輯——刪一個語句
      for (let i = 0; i < 4; i++) {
        const c = clone(root)
        if (!deleteStatement(c, i)) continue
        let out: string
        try { out = generateCode(c, 'cpp', S) } catch { continue }
        if (out === base) { noop++; continue }
        const span = rewriteSpan(base, out)
        structSpans.push(span); structTotals.push(baseLines)
        if (span > baseLines * 0.5 && worst.length < 6) {
          worst.push(`  ✘ ${id} 結構編輯 → 跨距 ${span}/${baseLines} 行`)
        }
      }
    }

    console.log(
      `\n  語料 ${programs} 段｜無投影的突變 ${noop} 筆（改了樹而程式碼沒變）\n` +
      report('① 欄位編輯', fieldSpans, fieldTotals) + '\n' +
      report('② 結構編輯（刪一句）', structSpans, structTotals) + '\n' +
      `  🔴 跨距 > 半個檔案的：${whole} 筆\n` +
      (worst.length ? worst.join('\n') : '  （沒有大範圍的）'))

    // ★ 入口條件——錨在合成量，🔴 不錨在跨距
    expect(programs, '🔴 語料沒讀到 → 報表不算數').toBeGreaterThanOrEqual(15)
    expect(
      fieldSpans.length + structSpans.length,
      '🔴 零筆有效編輯 → 突變沒有投影到程式碼上，這不代表「跨距很小」',
    ).toBeGreaterThan(50)
  }, 120000)
})
