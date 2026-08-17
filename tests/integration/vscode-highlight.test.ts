/**
 * 行 ↔ 節點反查的自證測。
 *
 * ## ⚠️ 自我否證
 *
 * > **如果樹上一個節點都沒有 `sourceRange`，
 * > 「找不到就回 null」那幾支會全綠——而那代表反查根本沒在運作。**
 *
 * 所以先釘正向錨點：真的語料上兩個方向都要**找得到東西**。
 *
 * ## 🔴 而 1.5% 的缺口有專屬的一支
 *
 * 實測 1516 個節點裡有 23 個沒有 `sourceRange`。
 * 高亮在那些節點上**會安靜地沒有反應**——所以退路（往上找祖先）
 * 必須被測到，而**找不到時要回 `null` 而不是靜默**。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { nodeIdAtLine, rangeOfNodeId } from '../../src/vscode/webview/highlight'
import type { SemanticNode } from '../../src/core/types'

const PROGRAM = `#include <iostream>
int main() {
    int x = 1;
    int y = 2;
    std::cout << x + y;
    return 0;
}
`

let parser: Parser
let tree: SemanticNode
beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  registerCppLanguage()
  tree = createTestLifter().lift(parser.parse(PROGRAM)!.rootNode as never) as SemanticNode
}, 30000)

describe('雙向反查', () => {
  it('正向錨點：樹上真的有帶範圍的節點', () => {
    let withRange = 0
    const walk = (n: SemanticNode): void => {
      if ((n as { metadata?: { sourceRange?: unknown } }).metadata?.sourceRange) withRange++
      for (const ks of Object.values(n.children ?? {})) for (const k of ks) walk(k)
    }
    walk(tree)
    expect(withRange, '🔴 一個範圍都沒有 → 下面的測試是空過的').toBeGreaterThan(3)
  })

  it('程式碼 → 積木：游標在某一行，找得到節點', () => {
    // 第 2 行是 `int x = 1;`（0-based）
    expect(nodeIdAtLine(tree, 2)).toBeTruthy()
  })

  it('🔴 挑【涵蓋這一行而且最小】的，不是最外層的', () => {
    // ⚠️ 不挑最小的話永遠會挑到 program（它涵蓋全部），
    //    而那讓高亮「看起來有反應但沒有意義」。
    const atLine2 = nodeIdAtLine(tree, 2)
    const atLine5 = nodeIdAtLine(tree, 5)
    expect(atLine2).not.toBe(atLine5)
    expect(atLine2).not.toBe(tree.id)
  })

  it('積木 → 程式碼：節點找得到它的行範圍', () => {
    const id = nodeIdAtLine(tree, 2)!
    const r = rangeOfNodeId(tree, id)
    expect(r).not.toBeNull()
    expect(r!.startLine).toBeLessThanOrEqual(2)
    expect(r!.endLine).toBeGreaterThanOrEqual(2)
  })

  it('兩個方向互為反函式（在有範圍的節點上）', () => {
    for (const line of [2, 3, 5]) {
      const id = nodeIdAtLine(tree, line)!
      const r = rangeOfNodeId(tree, id)!
      expect(r.startLine).toBeLessThanOrEqual(line)
      expect(r.endLine).toBeGreaterThanOrEqual(line)
    }
  })

  it('🔴 節點沒有範圍時往上找祖先——那 1.5% 的退路', () => {
    // 合成一個沒有 sourceRange 的子節點，掛在一個有範圍的父節點下
    const parent = { ...tree, children: { ...tree.children } } as SemanticNode
    const orphan = { id: 'orphan-1', conceptId: 'x', properties: {}, children: {} } as SemanticNode
    parent.children = { ...parent.children, body: [...(parent.children.body ?? []), orphan] }
    const r = rangeOfNodeId(parent, 'orphan-1')
    // 祖先（program）有範圍 → 找得到，而不是靜默沒反應
    expect(r).not.toBeNull()
  })

  it('⚠️ 完全找不到時回 null——呼叫端要說得出來，不是什麼都不做', () => {
    expect(rangeOfNodeId(tree, '這個-id-不存在')).toBeNull()
  })

  it('行號超出範圍 → null（不得回一個「差不多」的節點）', () => {
    expect(nodeIdAtLine(tree, 9999)).toBeNull()
  })

  it('純函式：不改動輸入', () => {
    const before = JSON.stringify(tree)
    nodeIdAtLine(tree, 2)
    rangeOfNodeId(tree, tree.id)
    expect(JSON.stringify(tree)).toBe(before)
  })
})
