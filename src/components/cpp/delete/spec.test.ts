/**
 * `cpp:delete` 的**自證測**——第 331 刀：`delete[] p` 的 `[]` 原本 lift 不記、產碼不寫、formalize 一律送 `arr: false`
 *（對稱的資料遺失：來回比對一直綠，Cella 照實判 ubFree）。屬性 `is_array` 記住它；舊快取沒有那一格 → V27 作廢。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../../../../tests/helpers/setup-lifter'
import { registerCppLanguage } from '../../../languages/cpp/generators'
import { generateCode } from '../../../core/projection/code-generator'
import { expectCellaOut } from '../../../../tests/helpers/cella-run'
import { staleShapeIn, SHAPE_CHANGES_V27 } from '../../../migrations/block-shape-changes'
import type { Lifter } from '../../../core/lift/lifter'
import type { SemanticNode, StylePreset } from '../../../core/types'
import apcs from '../../../languages/cpp/styles/apcs.json'

let tsParser: Parser
let lifter: Lifter
beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  tsParser = new Parser()
  tsParser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  lifter = createTestLifter()
  registerCppLanguage()
})

const lift = (code: string): SemanticNode => lifter.lift(tsParser.parse(code)!.rootNode as never) as SemanticNode
const find = (n: SemanticNode, id: string, out: SemanticNode[] = []): SemanticNode[] => {
  if (n.componentId === id) out.push(n)
  for (const kids of Object.values(n.slots ?? {})) for (const k of kids as SemanticNode[]) find(k, id, out)
  return out
}
const H = '#include <iostream>\nusing namespace std;\n'
const CODE = `${H}int main() {
    int* a = new int[3];
    int* b = new int(7);
    a[0] = *b;
    cout << a[0] << endl;
    delete[] a;
    delete b;
    return 0;
}`

describe('cpp:delete 自證測', () => {
  it('lift：陣列與單一物件分得出來', () => {
    const ds = find(lift(CODE), 'cpp:delete')
    expect(ds.map((d) => d.properties.is_array)).toEqual(['true', 'false'])
  })

  it('產碼一字不差（`[]` 不再走一趟就不見）', () => {
    expect(generateCode(lift(CODE), 'cpp', apcs as unknown as StylePreset)).toBe(CODE)
  })

  it('執行：delete[] 釋放 new[] 的陣列，Cella 不再判 ubFree', async () => {
    await expectCellaOut(CODE, '7\n')
  })

  it('舊快取：沒有 IS_ARRAY 的 cpp_delete 判成舊形狀；有的不算', () => {
    const old = { blocks: { blocks: [{ type: 'cpp_delete', inputs: { PTR: { block: { type: 'cpp_var_ref', fields: { NAME: 'a' } } } } }] } }
    const now = { blocks: { blocks: [{ type: 'cpp_delete', fields: { IS_ARRAY: 'true' }, inputs: {} }] } }
    const other = { blocks: { blocks: [{ type: 'cpp_var_ref', fields: { NAME: 'a' } }] } }
    expect(staleShapeIn(old, SHAPE_CHANGES_V27)?.blockType).toBe('cpp_delete')
    expect(staleShapeIn(now, SHAPE_CHANGES_V27)).toBeNull()
    expect(staleShapeIn(other, SHAPE_CHANGES_V27)).toBeNull()
  })
})
