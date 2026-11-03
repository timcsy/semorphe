/**
 * **OOP 的四種寫法，來回一趟一字不差，而且由 Cella 跑出 C++ 的結果**（spec 209）。
 *
 * spec 208 T002 補 OOP 語義的 Cella 測試時量到：`p->m()`、`struct B : A`、`virtual ~A()`、虛擬／覆寫方法的尾端 const，
 * 轉積木再轉回來都會變成另一支程式。直譯器對它們要嘛照樣跑、要嘛什麼都不做，所以一直沒有人發現。
 * 每一段：① 語意樹記下了（專屬的屬性）② 產回的程式碼一字不差 ③ 積木上看得到 ④ Cella 照 C++ 跑。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { generateCode } from '../../src/core/projection/code-generator'
import { renderToBlocklyState } from '../../src/core/projection/block-renderer'
import { setupTestRenderer } from '../helpers/setup-renderer'
import { expectCellaOut } from '../helpers/cella-run'
import apcs from '../../src/languages/cpp/styles/apcs.json'
import type { SemanticNode, StylePreset } from '../../src/core/types'

let parser: Parser
beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  registerCppLanguage()
  setupTestRenderer()
})
const lift = (code: string): SemanticNode => createTestLifter().lift(parser.parse(code)!.rootNode as never) as SemanticNode
const gen = (code: string): string => generateCode(lift(code), 'cpp', apcs as unknown as StylePreset)
const nodes = (t: SemanticNode, id: string): SemanticNode[] => {
  const out: SemanticNode[] = []
  const walk = (n: SemanticNode): void => { if (n.componentId === id) out.push(n); for (const k of Object.values(n.slots ?? {})) k.forEach(walk) }
  walk(t)
  return out
}
const blocks = (code: string, type: string): Record<string, string>[] => {
  const state = renderToBlocklyState(lift(code)) as unknown as { blocks: { blocks: unknown[] } }
  const found: Record<string, string>[] = []
  const walk = (b: unknown): void => {
    if (!b || typeof b !== 'object') return
    const o = b as Record<string, unknown>
    if (o.type === type) found.push(o.fields as Record<string, string>)
    for (const v of Object.values(o)) if (v && typeof v === 'object') walk(v)
  }
  walk(state.blocks.blocks)
  return found
}
const H = '#include <iostream>\nusing namespace std;\n'

describe('④ 虛擬／覆寫方法的尾端 const', () => {
  const SRC = `${H}class A {\npublic:\n    virtual int v() const {\n        return 1;\n    }\n};\nclass B : public A {\npublic:\n    int v() const override {\n        return 2;\n    }\n};\nint main() {\n    return 0;\n}\n`
  it('🔴 語意樹記下 const', () => {
    const t = lift(SRC)
    expect(nodes(t, 'cpp:method_virtual').map((n) => n.properties.is_const)).toEqual(['true'])
    expect(nodes(t, 'cpp:method_override').map((n) => n.properties.is_const)).toEqual(['true'])
  })
  it('🔴 來回一趟一字不差', () => {
    expect(gen(SRC)).toContain('virtual int v() const {')
    expect(gen(SRC)).toContain('int v() const override {')
  })
  it('★ 反向：沒有 const 的照舊沒有', () => {
    const t = lift(`${H}class A { public: virtual void f() {} };\nclass B : public A { public: void f() override {} };\nint main() { return 0; }\n`)
    expect(nodes(t, 'cpp:method_virtual')[0].properties.is_const).toBe('false')
    expect(nodes(t, 'cpp:method_override')[0].properties.is_const).toBe('false')
  })
  it('★ 積木：const 下拉照實', () => {
    expect(blocks(SRC, 'cpp_method_virtual')).toEqual([expect.objectContaining({ NAME: 'v', IS_CONST: 'true' })])
    expect(blocks(SRC, 'cpp_method_override')).toEqual([expect.objectContaining({ NAME: 'v', IS_CONST: 'true' })])
  })
  it('🔴 執行：在 const 參照上呼叫虛擬的 const 方法', async () => {
    await expectCellaOut(`${H}class A { public: virtual int v() const { return 1; } virtual ~A() {} };
class B : public A { public: int v() const override { return 2; } };
int f(const A& a) { return a.v(); }
int main() { A a; B b; cout << f(a) << f(b); return 0; }`, '12')
  })
})

describe('③ 虛擬解構子', () => {
  const SRC = `${H}class A {\npublic:\n    virtual ~A() {\n        cout << "a";\n    }\n};\nint main() {\n    return 0;\n}\n`
  it('🔴 語意樹記下 virtual；來回一趟一字不差', () => {
    expect(nodes(lift(SRC), 'cpp:destructor').map((n) => n.properties.is_virtual)).toEqual(['true'])
    expect(gen(SRC)).toContain('    virtual ~A() {')
  })
  it('★ 反向：一般的解構子照舊不是 virtual', () => {
    const s = `${H}class A {\npublic:\n    ~A() {\n    }\n};\nint main() {\n    return 0;\n}\n`
    expect(nodes(lift(s), 'cpp:destructor')[0].properties.is_virtual).toBe('false')
    expect(gen(s)).not.toContain('virtual')
  })
  it('★ 積木：virtual 下拉照實', () => {
    expect(blocks(SRC, 'cpp_destructor')).toEqual([expect.objectContaining({ CLASS_NAME: 'A', IS_VIRTUAL: 'true' })])
  })
  it('🔴 執行：經基底的指標 delete，衍生類別的解構子也跑（先衍生、再基底）', async () => {
    await expectCellaOut(`${H}class A { public: virtual ~A() { cout << "a"; } };
class B : public A { public: ~B() { cout << "b"; } };
int main() { A* p = new B(); delete p; return 0; }`, 'ba')
  })
})
