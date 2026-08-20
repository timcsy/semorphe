/**
 * spec 155：**獨立區塊的身分由語言套件宣告，而核心不得 import 它。**
 *
 * ## 這一支怎麼來的
 *
 * `core/lift/lifter.ts` 原本直接 `import { buildBlock } from '.../components/cpp/block/lift'`
 * ——**核心 import 了一顆 C++ 元件**，而 P9 原文逐字寫著
 * 「拔掉 C++……**無 `languages/cpp/` import**」。
 *
 * 🔴 **而拿掉宣告之後，既有的測試一支都沒紅**（spec 155 注入實測）
 * ——因為**沒有任何測試走過那條 `standalone` 路徑**。
 *
 * > **一條「主路徑」如果沒有測試走過，它壞掉的時候是靜默的。**
 *
 * ⚠️ 而它壞掉的樣子最貴：`lifter` 每次都會走，猜一個身分會**靜靜地產生錯的語義樹**。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import type { Lifter } from '../../src/core/lift/lifter'
import type { SemanticNode } from '../../src/core/types'

let tsParser: Parser
let lifter: Lifter

beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  tsParser = new Parser()
  tsParser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  lifter = createTestLifter()
})

function conceptsIn(node: SemanticNode, out: string[] = []): string[] {
  out.push(node.conceptId)
  for (const kids of Object.values(node.children ?? {})) {
    for (const k of kids as SemanticNode[]) conceptsIn(k, out)
  }
  return out
}

describe('spec 155 · 獨立區塊', () => {
  it('★ 錨點：一般的程式 lift 得起來（否則下面在測空樹）', () => {
    const t = lifter.lift(tsParser.parse('int main(){ int x = 1; return 0; }').rootNode as never)
    expect(t, 'lift 回了 null').not.toBeNull()
    expect(conceptsIn(t!)).toContain('cpp:var_declare')
  })

  it('🔴 一段獨立的 `{ … }` 會包成 `cpp:block`——而那個身分是【宣告】來的', () => {
    // 這是 `lifter.ts` 那條 `if (standalone)` 唯一的入口。
    const src = 'int main(){\n  {\n    int inner = 1;\n  }\n  return 0;\n}'
    const t = lifter.lift(tsParser.parse(src).rootNode as never)
    expect(t, 'lift 回了 null').not.toBeNull()
    expect(conceptsIn(t!),
      '獨立區塊沒有變成 cpp:block——⚠️ 若是「語言套件沒宣告建構子」，它會拋錯；'
      + '而若是它靜靜地換了個身分，那正是這一支要擋的')
      .toContain('cpp:block')
  })
})
