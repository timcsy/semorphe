/**
 * **護欄：階層下的來回一致**（vision〈分子：組合階層與粒度切換〉第 7 格；spec 190）。
 *
 * draft〈分子與粒度切換〉§八之 3 逐字：「**展開與收合不得改變語義**。護欄的形狀已經很熟：`分子 → 展開 → 收合 → 分子` 逐字相同。」
 * 收合是**檢視狀態**（不進語義樹），所以「逐字相同」在這裡有三層，每一層都拿**課文的真實語料**、對**每一顆收得起來的節點**量：
 *
 * ```
 * ① 框        收起一顆：框的埠＝它原本的對外接點；boundaryOf 一個 in、零個 out，且等於獨立算的 crossingEdges；
 *             子樹的節點一顆不畫、沒有一條線指進框裡
 * ② 語義      收合狀態怎麼動，樹與產出的程式碼一字不差（狀態不寫回真實）
 * ③ 對回去    鑰匙存下 → 重新 lift（id 全換）→ 對回【同一顆】；在最前面插一行（路徑全位移）→ 仍對回同一顆
 *             🔴 對到【別顆】是硬性零（`layout-key.ts`：寧可對不回去，不要對到別人身上）；對不回去的數字印出來、入棘輪
 * ```
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { createTestLifter } from '../helpers/setup-lifter'
import { sources } from '../helpers/binding-corpus'
import { buildNodeGraph } from '../../src/core/flow/node-graph'
import { boundaryOf, crossingEdges } from '../../src/core/molecule'
import { GranularityState } from '../../src/core/granularity'
import { generateCode } from '../../src/core/projection/code-generator'
import apcs from '../../src/languages/cpp/styles/apcs.json'
import type { SemanticNode, StylePreset } from '../../src/core/types'
import { loadBaseline, writeBaseline, assertRatchet, printReport } from '../helpers/guardrail'

const GUARD = 'collapse-roundtrip'

let parser: Parser
const lift = (code: string): SemanticNode => createTestLifter().lift(parser.parse(code)!.rootNode as never) as SemanticNode

beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  registerCppLanguage()
})

const kids = (n: SemanticNode): SemanticNode[] => Object.values(n.slots ?? {}).flatMap((ks) => (ks ?? []).filter(Boolean) as SemanticNode[])
function subtree(n: SemanticNode): SemanticNode[] { return [n, ...kids(n).flatMap(subtree)] }
/** 兩棵同形的樹，一顆對一顆（`offset`：根的 body 前面多了幾顆） */
function pairUp(a: SemanticNode, b: SemanticNode, offset = 0): Map<string, string> {
  const m = new Map<string, string>([[a.id, b.id]])
  const go = (x: SemanticNode, y: SemanticNode, shift: number): void => {
    for (const [slot, xs] of Object.entries(x.slots ?? {})) {
      const ys = y.slots?.[slot] ?? []
      ;(xs ?? []).forEach((xk, i) => {
        const yk = ys[i + shift]
        if (!xk || !yk || xk.componentId !== yk.componentId) return
        m.set(xk.id, yk.id)
        go(xk, yk, 0)
      })
    }
  }
  go(a, b, offset)
  return m
}

interface Tally { programs: number; collapsible: number; boxBad: string[]; semanticBad: string[]; relift: { ok: number; lost: number; wrong: string[] }; shifted: { ok: number; lost: number; wrong: string[] } }

let tally: Tally | null = null
function measure(): Tally {
  if (tally) return tally
  const t: Tally = { programs: 0, collapsible: 0, boxBad: [], semanticBad: [], relift: { ok: 0, lost: 0, wrong: [] }, shifted: { ok: 0, lost: 0, wrong: [] } }
  const style = apcs as unknown as StylePreset
  for (const s of sources()) {
    if (s.lang === 'c') continue
    const tree = lift(s.code)
    const body = tree.slots['body'] ?? []
    if (body.length === 0) continue
    t.programs++
    const full = buildNodeGraph(body)
    const code0 = generateCode(tree, 'cpp', style)
    const again = lift(s.code)
    const shiftedTree = lift(`int zz_pad = 0;\n${s.code}`)
    const sameMap = pairUp(tree, again)
    const shiftMap = pairUp(tree, shiftedTree, 1)
    const state = new GranularityState()
    for (const x of subtree(tree).slice(1)) {
      if (kids(x).length === 0) continue
      const inGraph = full.nodes.find((n) => n.id === x.id)
      t.collapsible++
      const where = `${s.id} ${x.componentId}`
      // ① 框
      if (inGraph) {
        const inside = new Set(subtree(x).slice(1).map((n) => n.id))
        const g = buildNodeGraph(body, undefined, { collapsed: new Set([x.id]) })
        const box = g.nodes.find((n) => n.id === x.id)
        const outer = inGraph.ports.filter((p) => p.key === '__in__' || p.key === '__next__' || p.key === '__out__').map((p) => p.key)
        const visibleInside = [...inside].filter((id) => full.nodes.some((n) => n.id === id))
        const ok = !!box && box.collapsed === inside.size
          && JSON.stringify(box.ports.map((p) => p.key)) === JSON.stringify(outer)
          && g.nodes.length === full.nodes.length - visibleInside.length
          && !g.wires.some((w) => inside.has(w.from.node) || inside.has(w.to.node))
        if (!ok) t.boxBad.push(where)
      }
      const b = boundaryOf(tree, subtree(x).map((n) => n.id))
      if (!b.ok || b.boundary.ports.length !== 1 || b.boundary.ports[0].side !== 'in' || crossingEdges(tree, subtree(x).map((n) => n.id)) !== 1) {
        t.boxBad.push(`${where}（邊界）`)
      }
      // ② 語義：收合狀態怎麼動，樹與程式碼都不變
      state.refresh(tree)
      state.set(x.id, true)
      const keys = state.list()
      if (generateCode(tree, 'cpp', style) !== code0) t.semanticBad.push(where)
      state.set(x.id, false)
      // ③ 對回去
      for (const [label, other, map, bucket] of [
        ['relift', again, sameMap, t.relift], ['shifted', shiftedTree, shiftMap, t.shifted],
      ] as const) {
        const st = new GranularityState()
        st.load(keys)
        const got = [...st.refresh(other)]
        const want = map.get(x.id)
        if (got.length === 0) bucket.lost++
        else if (got.length === 1 && got[0] === want) bucket.ok++
        else bucket.wrong.push(`${where}（${label}）`)
      }
    }
  }
  tally = t
  return t
}

describe('護欄：階層下的來回一致（收合 → 展開，課文語料上的每一顆）', () => {
  it('★ 入口條件：語料真的吃到東西', () => {
    const t = measure()
    expect(t.programs, '課文解答與 sketch 至少要有幾十支').toBeGreaterThan(50)
    expect(t.collapsible, '收得起來的節點要有上千顆，否則下面量的是空氣').toBeGreaterThan(1000)
    // ⏱ 這一支跑整份課文語料（measure 第一次算、後面的測試共用快取）：單獨約 25 秒，全套並行 2 時逼近 60 秒的預設上限
    //   ——2026-11-06 一天裡在長測試／護欄全跑時逾時三次，三次單獨重跑都綠。上限放寬到 120 秒，不是放寬判準
  }, 120_000)

  it('★ 注入：pairUp 真的分得出「對到別顆」——同一棵樹錯位一格就不能全中', () => {
    const tree = lift('int main() {\n    int a = 1;\n    int b = 2;\n    return 0;\n}\n')
    const again = lift('int main() {\n    int a = 1;\n    int b = 2;\n    return 0;\n}\n')
    const m = pairUp(tree, again)
    expect(m.size).toBe(subtree(tree).length)
    expect(pairUp(tree, again, 1).size, '錯位一格之後一顆都不該對上（根除外）').toBe(1)
  })

  it('🔴 硬性零：框的埠、邊界、子樹不畫——每一顆都對', () => {
    expect(measure().boxBad).toEqual([])
  })

  it('🔴 硬性零：收合狀態不改語義（產出的程式碼一字不差）', () => {
    expect(measure().semanticBad).toEqual([])
  })

  it('🔴 硬性零：鑰匙對回去，絕不對到別顆', () => {
    const t = measure()
    expect([...t.relift.wrong, ...t.shifted.wrong]).toEqual([])
  })

  it('棘輪：對不回去的只准下降（重新 lift、最前面插一行）', () => {
    const t = measure()
    const r = { relift_lost: t.relift.lost, shifted_lost: t.shifted.lost }
    printReport('階層下的來回一致', [
      `程式 ${t.programs} 支｜收得起來的節點 ${t.collapsible} 顆`,
      `重新 lift      對回 ${t.relift.ok}｜對不回 ${t.relift.lost}｜對錯 ${t.relift.wrong.length}`,
      `最前面插一行  對回 ${t.shifted.ok}｜對不回 ${t.shifted.lost}｜對錯 ${t.shifted.wrong.length}`,
    ])
    if (process.env.GENERATE_BASELINE) writeBaseline(GUARD, r)
    const b = loadBaseline<typeof r>(GUARD)
    assertRatchet([['重新 lift 對不回', r.relift_lost, b.relift_lost], ['最前面插一行對不回', r.shifted_lost, b.shifted_lost]])
  })
})
