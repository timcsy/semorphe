/**
 * `cpp:class_declare` 自證測——類別的前置宣告（`class C;`／`struct C;`）。
 *
 * 量到的缺口（2026-11-06，元件管線 311 的盲測）：原本建成一個空的類別定義，產回去 `class C { };`，
 * 後面真正的定義就成了重複定義；311 先改成誠實降級成原文，這一顆讓它成為積木。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../../../../tests/helpers/setup-lifter'
import { setupTestRenderer } from '../../../../tests/helpers/setup-renderer'
import { registerCppLanguage } from '../../../languages/cpp/generators'
import { generateCode } from '../../../core/projection/code-generator'
import { renderToBlocklyState } from '../../../core/projection/block-renderer'
import { formalize } from '../../../providers/cella/formalize'
import { expectCellaOut } from '../../../../tests/helpers/cella-run'
import type { Lifter } from '../../../core/lift/lifter'
import type { SemanticNode, StylePreset } from '../../../core/types'
import apcs from '../../../languages/cpp/styles/apcs.json'

const style = apcs as unknown as StylePreset
let tsParser: Parser
let lifter: Lifter

beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  tsParser = new Parser()
  tsParser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  lifter = createTestLifter()
  registerCppLanguage()
  setupTestRenderer()
})

const lift = (code: string): SemanticNode | null => lifter.lift(tsParser.parse(code)!.rootNode as never)
function ids(n: SemanticNode | null, out: string[] = []): string[] {
  if (!n) return out
  out.push(n.componentId)
  for (const kids of Object.values(n.slots ?? {})) for (const k of kids as SemanticNode[]) ids(k, out)
  return out
}
function find(n: SemanticNode | null, id: string, out: SemanticNode[] = []): SemanticNode[] {
  if (!n) return out
  if (n.componentId === id) out.push(n)
  for (const kids of Object.values(n.slots ?? {})) for (const k of kids as SemanticNode[]) find(k, id, out)
  return out
}
const H = '#include <bits/stdc++.h>\nusing namespace std;\n'
const run = (code: string, expected: string) => expectCellaOut(H + code, expected)
const MUTUAL = 'class B;\nclass A {\npublic:\n    B* other;\n    int v;\n};\nclass B {\npublic:\n    A* other;\n    int w;\n};\n'

describe('cpp:class_declare 自證測', () => {
  it('身分：class C; 與 struct C; 都是這一顆，不降級，種類記得住', () => {
    const t = lift(H + 'class A;\nstruct N;\nint main() {\n}\n')
    const fw = find(t, 'cpp:class_declare')
    expect(fw.map((n) => [n.properties.keyword, n.properties.name])).toEqual([['class', 'A'], ['struct', 'N']])
    expect(ids(t)).not.toContain('raw_code')
  })

  it('身分：有本體的照舊是類別定義；欄位與變數宣告裡的 struct 型別不被搶走', () => {
    const t = lift('struct Node {\n    int v;\n    struct Node* next;\n};\nint main() {\n    struct Node n;\n}\n')
    expect(ids(t)).toContain('cpp:struct_declare')
    expect(ids(t)).not.toContain('cpp:class_declare')
  })

  it('產碼：一字不差，再 lift 是同一棵樹', () => {
    const src = H + MUTUAL + 'int main() {\n    A a;\n    B b;\n    a.other = &b;\n    b.other = &a;\n    b.w = 3;\n    cout << a.other->w;\n    return 0;\n}\n'
    const out = generateCode(lift(src)!, 'cpp', style)
    expect(out.trim()).toBe(src.trim())
    expect(generateCode(lift(out)!, 'cpp', style)).toBe(out)
  })

  it('交給 Cella：之後有定義就不送（定義代表它）；從未定義送 iClassDecl', () => {
    const defined = JSON.stringify(formalize(lift(H + MUTUAL + 'int main() {\n}\n')!, {}).program)
    expect(defined).toContain('"name":"B"')
    expect(defined).not.toContain('iClassDecl')
    const never = formalize(lift(H + 'class Helper;\nstruct Box;\nint main() {\n    Helper* p = nullptr;\n}\n')!, {})
    expect(never.unknown).toEqual([])
    const s = JSON.stringify(never.program)
    expect(s).toMatch(/"k":"iClassDecl","n":"[^"]+","name":"Helper","isClass":true/)
    expect(s).toMatch(/"k":"iClassDecl","n":"[^"]+","name":"Box","isClass":false/)
  })

  it('積木：畫得出「先宣告類別」那一顆，下拉與名字都對', () => {
    const state = JSON.stringify(renderToBlocklyState(lift('struct Box;\n')!))
    expect(state).toContain('"type":"cpp_class_declare"')
    expect(state).toMatch(/"KEYWORD":"struct"/)
    expect(state).toMatch(/"NAME":"Box"/)
  })

  it('執行：互相指到的兩個類別', async () => {
    await run(MUTUAL + 'int main() { A a; B b; a.other = &b; b.other = &a; b.w = 3; a.v = 4; cout << a.other->w << b.other->v; }', '34')
  })
  it('執行：從未定義的類別只拿來宣告指標', async () => {
    await run('class Helper;\nint main() { Helper* p = nullptr; cout << (p == nullptr); }', '1')
  })
  it('執行：宣告兩次也合法', async () => {
    await run('struct N;\nstruct N;\nstruct N { int v; };\nint main() { N n; n.v = 5; cout << n.v; }', '5')
  })
})
