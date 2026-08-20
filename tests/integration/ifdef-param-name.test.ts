/**
 * `#ifdef` 的巨集名：**產生與執行必須讀同一個參數**
 *
 * ## 這支測試的來歷
 *
 * 參數規格護欄（第二十三條）逼出來的：
 *
 * | 路徑 | 讀哪個參數 |
 * |---|---|
 * | 產生（`core/generators/statements.ts`） | `properties.name` |
 * | 執行（`core/executors/preprocessor.ts`） | `properties.condition` |
 *
 * **同一顆元件，兩條路各讀各的。** 沒有人發現，是因為辨識器**兩個都寫**
 * （`createNode(component, { condition: name, name }, …)`）——那不是相容層，
 * 是重複，而重複讓分歧變成隱形的。
 *
 * 只要有一條路徑只產出其中一個（例如抽取器，或未來的重構），
 * 另一條就會**靜靜地退到 `'MACRO'`**——產出一段語法正確而語義錯誤的程式碼。
 *
 * 已收斂成 `condition`。這支測試釘住那個收斂。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { generateCode } from '../../src/core/projection/code-generator'
import { createNode } from '../../src/core/semantic-tree'
import type { SemanticNode } from '../../src/core/types'
import apcs from '../../src/languages/cpp/styles/apcs.json'

let treeParser: Parser

beforeAll(async () => {
  await Parser.init({ locateFile: (f: string) => `${process.cwd()}/public/${f}` })
  treeParser = new Parser()
  treeParser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  registerCppLanguage()
})

const SRC = '#ifdef DEBUG_MODE\n#include <iostream>\n#endif\nint main(){ return 0; }\n'

function lift(src: string): SemanticNode {
  const tree = treeParser.parse(src)
  if (!tree) throw new Error('parse 失敗')
  return createTestLifter().lift(tree.rootNode as never) as SemanticNode
}

function find(node: SemanticNode, id: string): SemanticNode | undefined {
  if (node?.componentId === id) return node
  for (const l of Object.values(node?.children ?? {})) {
    for (const c of l ?? []) {
      const hit = find(c as SemanticNode, id)
      if (hit) return hit
    }
  }
  return undefined
}

describe('#ifdef 的巨集名只用一個參數名', () => {
  it('★ 辨識只寫 `condition`，不再重複寫 `name`', () => {
    const n = find(lift(SRC), 'cpp:ifdef')
    expect(n, 'cpp_ifdef 辨識不出來').toBeDefined()
    expect(n!.properties.condition).toBe('DEBUG_MODE')
    expect(
      n!.properties.name,
      '兩個名字裝同一個值——重複讓兩條路的分歧變成隱形的',
    ).toBeUndefined()
  })

  it('★ 產生讀得到它——**只有 `condition` 的節點也要產得對**', () => {
    // ⚠️ 這是關鍵那一支：手動合成一個**只有 `condition`** 的節點。
    // 產生器若還讀 `name`，這裡會拿到 `#ifdef MACRO`——
    // 語法正確、語義錯誤，而來回轉換測試不一定抓得到。
    const node = createNode('cpp:program', {}, {
      body: [createNode('cpp:ifdef', { condition: 'ONLY_CONDITION' }, { body: [] })],
    })
    const code = generateCode(node, 'cpp', apcs as never)
    expect(code, '產生器退到了預設值 MACRO → 它讀的是另一個參數名').toContain('#ifdef ONLY_CONDITION')
    expect(code).not.toContain('MACRO')
  })

  it('★ 來回轉換：巨集名不變', () => {
    const code = generateCode(lift(SRC), 'cpp', apcs as never)
    expect(code).toContain('#ifdef DEBUG_MODE')
    expect(code).not.toContain('⟨')
  })
})
