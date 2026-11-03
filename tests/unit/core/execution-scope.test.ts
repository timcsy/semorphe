/**
 * 「加速」要跳過哪些節點——從語意樹算（`core/execution-scope.ts`，spec 205 T008）。
 * 錨點：Cella 會停在沒有自己積木的節點（`total + i` 的子節點）上，它們也要在跳過的範圍裡。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import path from 'node:path'
import { createTestLifter } from '../../helpers/setup-lifter'
import { registerCppLanguage } from '../../../src/languages/cpp/generators'
import { nodesInEnclosingScope } from '../../../src/core/execution-scope'
import type { SemanticNode } from '../../../src/core/types'

let tree: SemanticNode
const find = (n: SemanticNode, ok: (x: SemanticNode) => boolean): SemanticNode | undefined => {
  if (ok(n)) return n
  for (const kids of Object.values(n.slots ?? {})) for (const c of kids) { const r = find(c, ok); if (r) return r }
  return undefined
}
beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => path.resolve('public', s) })
  const parser = new Parser()
  parser.setLanguage(await Language.load(path.resolve('public/tree-sitter-cpp.wasm')))
  registerCppLanguage()
  tree = createTestLifter().lift(parser.parse('int main() { int total = 0; for (int i = 1; i <= 3; i++) { total = total + i; } cout << total << endl; return 0; }')!.rootNode as never) as SemanticNode
})

describe('加速的範圍（語意樹）', () => {
  it('★ 第 0 層（或更少）：只有目前這一顆', () => {
    expect(nodesInEnclosingScope(tree, 'x', 0)).toEqual(['x'])
  })
  it('🔴 第 1 層＝跳過整層：從迴圈體裡的子運算式出發，整個迴圈（含它自己的那幾格）都在範圍裡', () => {
    // ⚠️ 這種 for 會被認成「計數迴圈」（cpp:loop_count）——找任何一顆迴圈，不寫死身分
    const loop = find(tree, (n) => n.componentId.startsWith('cpp:loop_'))!
    const inner = find(loop.slots.body[0], (n) => n.properties?.name === 'i')!   // `total + i` 的 i
    const ids = new Set(nodesInEnclosingScope(tree, inner.id, 1))
    expect(ids.has(loop.id)).toBe(true)
    for (const [slot, kids] of Object.entries(loop.slots)) if (slot !== 'body') for (const n of kids) expect(ids.has(n.id), `${slot}（迴圈自己的那幾格）也要跳過`).toBe(true)
    const print = find(tree, (n) => n.componentId === 'cpp:print')!
    expect(ids.has(print.id), '迴圈後面的 cout 不在範圍裡').toBe(false)
  })
  it('🔴 停在迴圈這一顆本身（Cella 進迴圈之前先停在它）：第 1 層是它自己，不是包住它的 main', () => {
    const loop = find(tree, (n) => n.componentId.startsWith('cpp:loop_'))!
    const ids = new Set(nodesInEnclosingScope(tree, loop.id, 1))
    expect(ids.has(loop.slots.body[0].id)).toBe(true)
    const print = find(tree, (n) => n.componentId === 'cpp:print')!
    expect(ids.has(print.id), '迴圈後面的 cout 不在範圍裡——不然一按加速整支跑完').toBe(false)
  })
  it('★ 找不到那一顆：退回只有它自己（不猜）', () => {
    expect(nodesInEnclosingScope(tree, 'no-such', 3)).toEqual(['no-such'])
  })
  it('★ 第 2 層：再往外一層（這裡是 main）——迴圈後面的 cout 也在', () => {
    const loop = find(tree, (n) => n.componentId.startsWith('cpp:loop_'))!
    const inner = find(loop.slots.body[0], (n) => n.properties?.name === 'i')!
    const print = find(tree, (n) => n.componentId === 'cpp:print')!
    expect(new Set(nodesInEnclosingScope(tree, inner.id, 2)).has(print.id)).toBe(true)
  })
})
