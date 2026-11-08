/**
 * `cpp:var_declare` 的**自證測**——推導不出來的語義（共同測從 `component.json` 推導，不放這裡）。
 *
 * 第 331 刀撞到：一行宣告好幾個類別物件、各帶建構子引數（`F a(1, 2), b(1, 3);`），外層那顆沒有 `init_style`，
 * 引擎的通用形狀逐一翻宣告子時不經過「類別的直接初始化」那條 ⟹ Cella 判「找不到相符的建構子」（分成兩行就判得出）。
 */
import { describe, it, expect } from 'vitest'
import { expectCellaOut } from '../../../../tests/helpers/cella-run'

const H = '#include <iostream>\nusing namespace std;\nstruct F { int n, d; F(int a, int b) : n(a), d(b) {} };\n'

describe('cpp:var_declare 自證測', () => {
  it('一行宣告兩個類別物件、各帶建構子引數（區域）', async () => {
    await expectCellaOut(H + 'int main() { F a(1, 2), b(1, 3); cout << a.n << b.d; return 0; }', '13')
  })

  it('同上（全域），而一般的多宣告照舊', async () => {
    await expectCellaOut(H + 'F g1(4, 5), g2(6, 7);\nint main() { int x = 1, y = 2; cout << g1.d << g2.n << x << y; return 0; }', '5612')
  })
})

// ── 第 332 刀：建構子形式走一趟積木，引數不掉 ─────────────────────────────────────
describe('建構子形式在積木上裝得下（形態 cpp_var_declare_constructor）', () => {
  it('🔴 `P p(3, 4)`／`P q(1, 2), r(5, 6)`／`int k(7)` 走一趟積木回來一字不差（原本第二個引數以後在渲染那一步就掉了）', async () => {
    const { Parser, Language } = await import('web-tree-sitter')
    const { createTestLifter } = await import('../../../../tests/helpers/setup-lifter')
    const { setupTestRenderer } = await import('../../../../tests/helpers/setup-renderer')
    const { registerCppLanguage } = await import('../../../languages/cpp/generators')
    const { generateCode } = await import('../../../core/projection/code-generator')
    const { renderToBlocklyState } = await import('../../../core/projection/block-renderer')
    const { PatternExtractor } = await import('../../../core/projection/pattern-extractor')
    const { BlockSpecRegistry } = await import('../../../core/blocks/block-spec-registry')
    const { allCppComponents, allCppProjections } = await import('../../../languages/cpp/all-declarations')
    const { registerCppExtractStrategies } = await import('../../../languages/cpp/extractors/extract-strategies')
    const apcs = (await import('../../../languages/cpp/styles/apcs.json')).default
    await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
    const p = new Parser()
    p.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
    const lifter = createTestLifter()
    registerCppLanguage()
    setupTestRenderer()
    const reg = new BlockSpecRegistry()
    reg.loadFromSplit(allCppComponents(), allCppProjections())
    const ex = new PatternExtractor()
    ex.loadBlockSpecs(reg.getAll())
    registerCppExtractStrategies(ex)

    const body = '    P p(3, 4);\n    P q(1, 2), r(5, 6);\n    int k(7);\n    int m = 1, n = 2;\n    const P c(8, 9);\n'
    const code = `struct P {\n    int x, y;\n    P(int a, int b) : x(a), y(b) {\n    }\n};\nint main() {\n${body}    return 0;\n}`
    const tree = lifter.lift(p.parse(code)!.rootNode as never) as never
    const state = renderToBlocklyState(tree) as { blocks: { blocks: unknown[] } }
    // 在積木那一側：建構子形式各是一顆新形態，引數一個都沒少
    const ctor: { fields: Record<string, string>; extraState: { argCount: number } }[] = []
    const walk = (b: any): void => { if (!b) return; if (b.type === 'cpp_var_declare_constructor') ctor.push(b); for (const v of Object.values(b.inputs ?? {})) walk((v as any).block); walk(b.next?.block) }
    for (const b of state.blocks.blocks) walk(b)
    const ctorConst: any[] = []
    const walkC = (b: any): void => { if (!b) return; if (b.type === 'cpp_var_declare_const_constructor') ctorConst.push(b); for (const v of Object.values(b.inputs ?? {})) walkC((v as any).block); walkC(b.next?.block) }
    for (const b of state.blocks.blocks) walkC(b)
    expect(ctorConst.map((b) => `${b.fields.NAME}:${b.extraState?.argCount}`), 'const 版同一個形態').toEqual(['c:2'])
    expect(ctor.map((b) => `${b.fields.NAME}:${b.extraState.argCount}`)).toEqual(['p:2', 'q:2', 'r:2', 'k:1'])
    // 抽回來、產碼：與原文一字不差
    const back = state.blocks.blocks.flatMap((b) => ex.extractStatementChain(b as never))
    const out = generateCode({ id: 'root', componentId: 'cpp:program', properties: {}, slots: { body: back } } as never, 'cpp', apcs as never)
    expect(out).toContain('    P p(3, 4);\n    P q(1, 2);\n    P r(5, 6);\n    int k(7);\n    int m = 1, n = 2;\n    const P c(8, 9);\n')
  })
})

// ── 344：一層的函式指標裝得下（變數與參數）───────────────────────────────────────
// 型別寫成抽象宣告子 `int (*)(int, int)`、名字另放；產碼把名字放回 `(*` 之後。
// 判決的形狀是 cella 2026-11-08 給的：tPtr(tFunc{ret, params})、呼叫變數走 eCallE、函式名當值由 Cella 解析成 eFunc。
describe('函式指標（344）', () => {
  const C = '#include <stdio.h>\n'
  const FP = 'int add(int a, int b) {\n    return a + b;\n}\nint apply(int (*f)(int, int), int x) {\n    return f(x, x);\n}\nint main(void) {\n    int (*g)(int, int) = add;\n    int (*s)(int, int) = &add;\n    void (*h)(void);\n    printf("%d %d %d\\n", g(2, 3), s(1, 1), apply(add, 4));\n    return 0;\n}\n'

  it('lift：名字與抽象型別分開；產碼與積木來回一字不差', async () => {
    const { Parser, Language } = await import('web-tree-sitter')
    const { createTestLifter } = await import('../../../../tests/helpers/setup-lifter')
    const { setupTestRenderer } = await import('../../../../tests/helpers/setup-renderer')
    const { registerCppLanguage } = await import('../../../languages/cpp/generators')
    const { generateCode } = await import('../../../core/projection/code-generator')
    const { renderToBlocklyState } = await import('../../../core/projection/block-renderer')
    const { PatternExtractor } = await import('../../../core/projection/pattern-extractor')
    const { BlockSpecRegistry } = await import('../../../core/blocks/block-spec-registry')
    const { allCppComponents, allCppProjections } = await import('../../../languages/cpp/all-declarations')
    const { registerCppExtractStrategies } = await import('../../../languages/cpp/extractors/extract-strategies')
    const cStyle = (await import('../../../languages/cpp/styles/c.json')).default
    await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
    const p = new Parser()
    p.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
    registerCppLanguage()
    setupTestRenderer()
    const reg = new BlockSpecRegistry()
    reg.loadFromSplit(allCppComponents(), allCppProjections())
    const ex = new PatternExtractor()
    ex.loadBlockSpecs(reg.getAll())
    registerCppExtractStrategies(ex)

    const tree = createTestLifter().lift(p.parse(FP)!.rootNode as never) as any
    const props: string[] = []
    const walk = (n: any): void => { if (n.componentId === 'cpp:var_declare' || n.componentId === 'param_decl') props.push(`${n.properties.type}|${n.properties.name}`); Object.values(n.slots ?? {}).flat().forEach(walk) }
    walk(tree)
    expect(props).toEqual(expect.arrayContaining(['int (*)(int, int)|f', 'int (*)(int, int)|g', 'int (*)(int, int)|s', 'void (*)(void)|h']))
    const gen = (t: any): string => generateCode(t, 'cpp', cStyle as never)
    expect(gen(tree)).toContain('int apply(int (*f)(int, int), int x) {')
    expect(gen(tree)).toContain('    int (*g)(int, int) = add;\n    int (*s)(int, int) = &add;\n    void (*h)(void);\n')
    // 走一趟積木
    const state = renderToBlocklyState(tree) as { blocks: { blocks: unknown[] } }
    const back = state.blocks.blocks.flatMap((b) => ex.extractStatementChain(b as never))
    const out = gen({ id: 'root', componentId: 'cpp:program', properties: {}, slots: { body: back } })
    expect(out).toContain('int apply(int (*f)(int, int), int x) {')
    expect(out).toContain('    int (*g)(int, int) = add;\n    int (*s)(int, int) = &add;\n    void (*h)(void);\n')
  })

  it('★ Cella 判得出：變數、取址、參數、C++ 也一樣；呼叫空的函式指標判 reject', async () => {
    await expectCellaOut(C + FP, '5 2 8\n', { lang: 'c' })
    await expectCellaOut('#include <iostream>\nusing namespace std;\nint add(int a, int b) { return a + b; }\nint apply(int (*op)(int, int)) { return op(3, 4); }\nint main() { cout << apply(add) << endl; }\n', '7\n')
    const { runCella } = await import('../../../../tests/helpers/cella-run')
    const r = await runCella(C + 'int main(void) {\n    int (*f)(int) = 0;\n    printf("%d\\n", f(1));\n    return 0;\n}\n', { lang: 'c' })
    expect(r.verdict).toBe('reject')
  }, 120_000)

  it('多層的照舊整句原文（函式指標陣列、指向陣列的指標）', async () => {
    const { Parser, Language } = await import('web-tree-sitter')
    const { createTestLifter } = await import('../../../../tests/helpers/setup-lifter')
    const { registerCppLanguage } = await import('../../../languages/cpp/generators')
    const { generateCode } = await import('../../../core/projection/code-generator')
    const cStyle = (await import('../../../languages/cpp/styles/c.json')).default
    await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
    const p = new Parser()
    p.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
    registerCppLanguage()
    const src = 'int main(void) {\n    int (*tbl[3])(int, int);\n    int (*row)[4] = 0;\n    return 0;\n}\n'
    const out = generateCode(createTestLifter().lift(p.parse(src)!.rootNode as never) as never, 'cpp', cStyle as never)
    expect(out).toContain('    int (*tbl[3])(int, int);\n    int (*row)[4] = 0;\n')
  })
})

describe('void*（344）', () => {
  it('★ qsort 的比較函式（const void* 參數、函式名當引數）判得出', async () => {
    await expectCellaOut('#include <stdio.h>\n#include <stdlib.h>\nint cmp(const void *a, const void *b) {\n    return *(const int *)a - *(const int *)b;\n}\nint main(void) {\n    int v[4] = {3, 1, 4, 2};\n    qsort(v, 4, sizeof(int), cmp);\n    printf("%d %d %d %d\\n", v[0], v[1], v[2], v[3]);\n    return 0;\n}\n', '1 2 3 4\n', { lang: 'c' })
  }, 120_000)
})
