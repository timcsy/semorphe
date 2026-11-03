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

describe('② struct 的基底', () => {
  const SRC = `${H}struct A {\n    int x;\n};\nstruct B : A {\n    int y;\n};\nint main() {\n    return 0;\n}\n`
  it('🔴 語意樹記下基底；來回一趟一字不差（struct 不寫存取時是 public，產回也不寫）', () => {
    const b = nodes(lift(SRC), 'cpp:struct_declare').find((n) => n.properties.name === 'B')!
    expect(b.properties.base_class).toBe('A')
    expect(gen(SRC)).toContain('struct B : A {')
  })
  it('★ 寫了存取的照寫回', () => {
    expect(gen(`${H}struct A {};\nstruct B : private A {};\nint main() {\n    return 0;\n}\n`)).toContain('struct B : private A {')
  })
  it('★ 積木：基底名字在欄位上', () => {
    expect(blocks(SRC, 'cpp_struct_declare')).toEqual(expect.arrayContaining([expect.objectContaining({ NAME: 'B', BASE_CLASS: 'A' })]))
  })
  it('🔴 執行：struct 繼承之後的 override 對得到基底，經參照分派', async () => {
    await expectCellaOut(`${H}struct A { virtual void hi() { cout << "A"; } };
struct B : A { void hi() override { cout << "B"; } };
void call(A& a) { a.hi(); }
int main() { A a; B b; call(a); call(b); return 0; }`, 'AB')
  })
  it('🔴 class 不寫存取時是 private 繼承——不得被改寫成 public', () => {
    expect(gen(`${H}class A {};\nclass B : A {};\nint main() {\n    return 0;\n}\n`)).not.toContain('public A')
  })
  it('🔴 多重繼承、virtual 繼承：不支援就照實降級，不得只留一個基底', () => {
    for (const s of [`${H}struct A {};\nstruct C {};\nstruct B : A, C {};\nint main() {\n    return 0;\n}\n`, `${H}struct A {};\nstruct B : virtual A {};\nint main() {\n    return 0;\n}\n`]) {
      const out = gen(s)
      expect(out, '原文必須完整保留').toMatch(/struct B : (A, C|virtual A)/)
    }
  })
})

describe('① 經過指標呼叫方法 `p->m()`', () => {
  const SRC = `${H}class A {\npublic:\n    int v() {\n        return 1;\n    }\n};\nint main() {\n    A a;\n    A* p = &a;\n    p->v();\n    cout << p->v();\n    return 0;\n}\n`
  it('🔴 語意樹記下箭號；來回一趟一字不差（敘述與運算式兩個位置）', () => {
    expect(nodes(lift(SRC), 'cpp:method_call').map((n) => n.properties.arrow)).toEqual(['true', 'true'])
    expect(gen(SRC)).toContain('    p->v();')
    expect(gen(SRC)).toContain('cout << p->v();')
  })
  it('★ 反向：點照舊是點', () => {
    const s = `${H}class A {\npublic:\n    int v() {\n        return 1;\n    }\n};\nint main() {\n    A a;\n    a.v();\n    return 0;\n}\n`
    expect(nodes(lift(s), 'cpp:method_call')[0].properties.arrow).toBe('false')
    expect(gen(s)).toContain('    a.v();')
  })
  it('★ 積木：箭號下拉照實（敘述版與運算式版）', () => {
    expect(blocks(SRC, 'cpp_method_call')).toEqual([expect.objectContaining({ METHOD: 'v', ARROW: 'true' })])
    expect(blocks(SRC, 'cpp_method_call_expression')).toEqual([expect.objectContaining({ METHOD: 'v', ARROW: 'true' })])
  })
  it('🔴 執行：虛擬分派經過基底的指標', async () => {
    await expectCellaOut(`${H}class A { public: virtual int v() { return 1; } virtual ~A() {} };
class B : public A { public: int v() override { return 2; } };
int main() { A a; B b; A* p = &a; cout << p->v(); p = &b; cout << p->v(); return 0; }`, '12')
  })
})

describe('`final`：還不支援就照實說（spec 209 T005）', () => {
  // cella 2026-11-03：Cella 還沒有 final 的形狀，不得送成 virtual／override——否則覆寫 final 方法的錯程式會被接受
  it.each([
    ['方法上的 final', `${H}class A { public: virtual void f() {} };\nclass B : public A { public: void f() final {} };\nint main() { return 0; }\n`, 'void f() final'],
    ['override final', `${H}class A { public: virtual void f() {} };\nclass B : public A { public: void f() override final {} };\nint main() { return 0; }\n`, 'void f() override final'],
    ['類別上的 final', `${H}class A final {};\nint main() { return 0; }\n`, 'class A final'],
  ])('🔴 %s：原文保留，而且判決說得出還不支援', async (_name, code, kept) => {
    expect(gen(code), '安靜地丟掉 final ＝ 改了程式的意思').toContain(kept)
    const { runCella } = await import('../helpers/cella-run')
    const r = await runCella(code)
    expect(r.verdict, '不得被當成沒有 final 的程式判 accept').not.toBe('accept')
  })
})

describe('舊存檔：沒有新屬性的節點照樣載入（spec 209 T006）', () => {
  // 舊存檔存的是語意樹；這四顆在 spec 209 之前沒有 arrow／base_class／is_virtual／is_const——由宣告的 default 補，不寫遷移
  it('★ 四種舊節點：產碼取預設值（點、沒有基底、非 virtual、非 const），積木渲染不丟節點', async () => {
    const { createNode } = await import('../../src/core/semantic-tree')
    const call = createNode('cpp:method_call', { method: 'f' }, { obj: [createNode('cpp:var_ref', { name: 'o' })], args: [] })
    const st = createNode('cpp:struct_declare', { name: 'S' }, { members: [] })
    const dt = createNode('cpp:destructor', { class_name: 'C' }, { body: [] })
    const vm = createNode('cpp:method_virtual', { return_type: 'int', name: 'g' }, { params: [], body: [] })
    const prog = createNode('cpp:program', {}, { body: [st, createNode('cpp:class_def', { name: 'C' }, { public: [dt, vm], private: [], protected: [] }), call] })
    const code = generateCode(prog, 'cpp', apcs as unknown as StylePreset)
    expect(code).toContain('o.f()')
    expect(code).toContain('struct S {')
    expect(code).toContain('~C()')
    expect(code).not.toContain('virtual ~C')
    expect(code).toContain('virtual int g() {')
    const state = renderToBlocklyState(prog) as unknown as { blocks: { blocks: unknown[] } }
    const types: string[] = []
    const walk = (b: unknown): void => { if (!b || typeof b !== 'object') return; const o = b as Record<string, unknown>; if (typeof o.type === 'string') types.push(o.type); for (const v of Object.values(o)) if (v && typeof v === 'object') walk(v) }
    walk(state.blocks.blocks)
    for (const t of ['cpp_struct_declare', 'cpp_destructor', 'cpp_method_virtual']) expect(types, `${t} 沒畫出來`).toContain(t)
  })
})
