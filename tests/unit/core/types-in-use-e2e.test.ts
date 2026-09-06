/**
 * **SC-001 的端對端那一條：真的解析一段程式，看型別出不出得來。**
 *
 * ## ⚠️ 為什麼另開一個檔
 *
 * `audit-types-grow-with-code` 用的是**手造的樹**——它驗的是「列舉對不對」，
 * 而那條路刻意不碰解析器（快，而且不會因為文法變動誤紅）。
 *
 * 🔴 **而手造的樹證明不了「宣告節點真的帶著 `type`」**——那是這一支的工作，
 * 而它要付 wasm 的代價。
 *
 * > **一個用假輸入驗過的函式，還沒有被驗過的是【真的輸入長不長那樣】。**
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../../helpers/setup-lifter'
import { typesInUse } from '../../../src/core/types-in-use'
import type { SemanticNode } from '../../../src/core/types'

let parser: Parser
beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
})

const H = '#include <iostream>\nusing namespace std;\n'
const lift = (body: string): SemanticNode =>
  createTestLifter().lift(parser.parse(H + body)!.rootNode as never) as SemanticNode

describe('SC-001／SC-002：真的解析之後，型別掃得出來', () => {
  it('🔴 `struct Point { … }; Point p;` → `Point` 掃得到', () => {
    const types = typesInUse(lift('struct Point { int x; int y; };\nint main() { Point p; return 0; }'))
    expect(types, '🔴 學生宣告過的型別掃不出來 → 他在下拉裡也選不到（那正是這一刀）')
      .toContain('Point')
  })

  it('`unsigned int n = 5;` → 多字的型別也掃得到', () => {
    expect(typesInUse(lift('int main() { unsigned int n = 5; return 0; }'))).toContain('unsigned int')
  })

  /**
   * ⚠️ **界線測試**：容器與指標的 `type` 是**元素型別**，
   * 而那是對的——容器那一層的資訊住在**身分**裡（`cpp:vector_declare`）。
   *
   * 🟢 釘住它，不然下一個人會以為掃描漏了東西。
   */
  it('★ 界線：`vector<int>` 掃到的是 `int`——刻意的，不是漏掉', () => {
    const types = typesInUse(lift('#include <vector>\nint main() { vector<int> v; return 0; }'))
    expect(types).toContain('int')
    expect(types, '⚠️ 如果哪天這裡真的出現 `vector<int>`，那是形狀變了——\n'
      + '   去讀 `src/core/types-in-use.ts` 的那一段，然後決定要不要改').not.toContain('vector<int>')
  })
})
