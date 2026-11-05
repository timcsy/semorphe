/**
 * **Round-trip：`cpp:this`**（元件管線 311，2026-11-06）
 *
 * 每支程式量四件：① 語義樹裡真的有 `cpp:this`、沒有降級（元件身分）② 產碼一字不差 ③ 產出的碼再 lift 是同一棵樹（不動點）
 * ④ Cella 判 accept 且輸出相同（預期輸出照手算，並用本機 clang 對過一次）。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { generateCode } from '../../src/core/projection/code-generator'
import { expectCellaOut } from '../helpers/cella-run'
import type { SemanticNode, StylePreset } from '../../src/core/types'
import apcs from '../../src/languages/cpp/styles/apcs.json'

const S = apcs as unknown as StylePreset
let parser: Parser
beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  registerCppLanguage()
}, 120_000)

const lift = (code: string): SemanticNode => createTestLifter().lift(parser.parse(code)!.rootNode as never) as SemanticNode
function find(n: SemanticNode, id: string, out: SemanticNode[] = []): SemanticNode[] {
  if (n.componentId === id) out.push(n)
  for (const kids of Object.values(n.slots ?? {})) for (const k of kids) find(k, id, out)
  return out
}
/** 結構指紋：身分、屬性、子節點——不含 id 與來源位置 */
function shape(n: SemanticNode): unknown {
  return [n.componentId, n.properties, Object.fromEntries(Object.entries(n.slots ?? {}).map(([k, v]) => [k, v.map(shape)]))]
}

const H = '#include <bits/stdc++.h>\nusing namespace std;\n'
const CASES: [string, string, string, number][] = [
  ['取成員', 'struct P {\n    int x;\n    int get() {\n        return this->x;\n    }\n};\nint main() {\n    P p;\n    p.x = 7;\n    cout << p.get();\n}\n', '7', 1],
  ['建構子裡參數遮蔽成員', 'struct P {\n    int x;\n    P(int x) {\n        this->x = x;\n    }\n};\nint main() {\n    P p(5);\n    cout << p.x;\n}\n', '5', 1],
  ['呼叫自己的方法', 'struct P {\n    int x;\n    int twice() {\n        return 2 * x;\n    }\n    int g() {\n        return this->twice();\n    }\n};\nint main() {\n    P p;\n    p.x = 4;\n    cout << p.g();\n}\n', '8', 1],
  ['回傳自己串接呼叫', 'struct P {\n    int x;\n    P& inc() {\n        x++;\n        return *this;\n    }\n};\nint main() {\n    P p;\n    p.x = 1;\n    p.inc().inc();\n    cout << p.x;\n}\n', '3', 1],
  ['比較是不是同一個物件', 'struct P {\n    int x;\n    bool same(P* o) {\n        return this == o;\n    }\n};\nint main() {\n    P a;\n    P b;\n    cout << a.same(&a) << b.same(&a);\n}\n', '10', 1],
]

describe('round-trip：cpp:this', () => {
  it.each(CASES)('★ %s：元件身分、產碼一字不差、不動點', (_name, body, _out, nThis) => {
    const src = H + body
    const tree = lift(src)
    expect(find(tree, 'cpp:this'), '元件身分').toHaveLength(nThis)
    expect(find(tree, 'raw_code').concat(find(tree, 'unresolved')), '降級了').toEqual([])
    const out = generateCode(tree, 'cpp', S)
    expect(out.trim()).toBe(src.trim())
    expect(shape(lift(out))).toEqual(shape(tree))
  })

  it.each(CASES)('★ %s：Cella 判 accept、輸出相同', async (_name, body, expected) => {
    await expectCellaOut(H + body, expected)
  })
})
