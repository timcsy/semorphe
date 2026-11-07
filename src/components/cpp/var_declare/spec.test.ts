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
