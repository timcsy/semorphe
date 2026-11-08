/**
 * 膠囊自證：`cpp:enum` 的 formalize（spec 202 檔案範圍；第 238 刀區域的列舉與列舉名當型別）——期望值都是 g++ 印的。
 * 形狀照 cella 2026-11-03 給的：檔案範圍 iEnum、區塊裡 sType{d: tdEnum}、型別 tEnum、列舉值是指向 enumC 的 eVar。
 */
import { describe, it, expect } from 'vitest'
import { expectCellaOut, runCella } from '../../../../tests/helpers/cella-run'

const H = '#include <iostream>\nusing namespace std;\n'

describe('膠囊自證：列舉', () => {
  it('★ 檔案範圍：沒寫值的接著前一個 +1', async () => {
    await expectCellaOut(H + 'enum Color { RED, GREEN = 5, BLUE };\nint main() { cout << RED << GREEN << BLUE; }\n', '056')
  }, 300_000)
  it('★ 列舉名當型別，用在 switch', async () => {
    await expectCellaOut(H + 'enum Color { RED, GREEN = 5, BLUE };\nint main() { Color c = GREEN;\n  switch (c) { case GREEN: cout << "g"; break; default: cout << "x"; }\n}\n', 'g')
  }, 300_000)
  it('★ 寫在函式裡的列舉（負的值）', async () => {
    await expectCellaOut(H + 'int main() { enum Level { LOW = -1, HIGH = 1 }; Level v = HIGH; cout << LOW << " " << v; }\n', '-1 1')
  }, 300_000)
})

// ── 344：列舉常數的值是常數運算式——拆成運算式交給 Cella 算（const-expr.ts；cella 2026-11-08）──
describe('列舉常數的運算式值（344）', () => {
  const C = '#include <stdio.h>\n'
  it('★ 位移、前一個常數、括號、一元、字元字面、巨集都判得出', async () => {
    await expectCellaOut(C + "enum { A = 1 << 2, B = A + 1, C, D = (B * 2) % 7, E = -A, F = ~0, G = 'a' };\nint main(void) {\n    printf(\"%d %d %d %d %d %d %d\\n\", A, B, C, D, E, F, G);\n    return 0;\n}\n", '4 5 6 3 -4 -1 97\n', { lang: 'c' })
    await expectCellaOut(C + '#define BASE 10\nenum Lv { LOW = BASE, HIGH = BASE * 2 };\nint main(void) {\n    enum Lv x = HIGH;\n    printf("%d %d\\n", LOW, x);\n    return 0;\n}\n', '10 20\n', { lang: 'c' })
    await expectCellaOut('#include <iostream>\nint main() {\n    enum { P = 3, Q = P * P };\n    std::cout << Q << "\\n";\n}\n', '9\n')
  }, 120_000)
  it('不是常數的值由 Cella 判 reject；拆不了的（三元）照實標翻不出', async () => {
    const bad = await runCella(C + 'int n = 3;\nenum { Z = n };\nint main(void) {\n    return 0;\n}\n', { lang: 'c' })
    expect(bad.untranslated).toEqual([])
    expect(bad.verdict).toBe('reject')
    const t = await runCella(C + 'enum { T = 1 ? 2 : 3 };\nint main(void) {\n    return 0;\n}\n', { lang: 'c' })
    expect(t.verdict).toBe('untranslated')
    expect(t.untranslated?.[0]?.reason).toMatch(/拆不成認得的常數運算式/)
  }, 120_000)
})

// ── 2026-11-08：typedef enum 與匿名列舉（union 盲測的覆蓋缺口：fuzz_3／4／6）──
describe('typedef enum 與匿名列舉', () => {
  const C = '#include <stdio.h>\n'
  const ANON = C + 'typedef enum { SHAPE_SQUARE, SHAPE_CIRCLE } ShapeKind;\nint main(void) {\n    ShapeKind k = SHAPE_CIRCLE;\n    printf("%d\\n", k);\n    return 0;\n}\n'
  const TAG = C + 'typedef enum Color { RED = 2, GREEN } Color_t;\nint main(void) {\n    Color_t a = GREEN;\n    enum Color b = RED;\n    printf("%d %d\\n", a, b);\n    return 0;\n}\n'
  const PLAIN = C + 'enum { A = 1 << 2, B };\nenum { C = 7 };\nint main(void) {\n    printf("%d %d\\n", B, C);\n    return 0;\n}\n'

  it('lift：是一顆列舉、別名在 typedef_alias、匿名的 name 為空（不再編 MyEnum）；產碼與積木來回一字不差', async () => {
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
    const enums = (t: any): any[] => t.slots.body.filter((n: any) => n.componentId === 'cpp:enum').map((n: any) => n.properties)
    const lift = (src: string): any => createTestLifter().lift(p.parse(src)!.rootNode as never)
    expect(enums(lift(ANON))).toEqual([{ name: '', values: 'SHAPE_SQUARE, SHAPE_CIRCLE', typedef_alias: 'ShapeKind' }])
    expect(enums(lift(TAG))).toEqual([{ name: 'Color', values: 'RED = 2, GREEN', typedef_alias: 'Color_t' }])
    expect(enums(lift(PLAIN)).map((e) => e.name)).toEqual(['', ''])
    for (const src of [ANON, TAG, PLAIN]) {
      const t = lift(src)
      expect(generateCode(t, 'cpp', cStyle as never).trimEnd()).toBe(src.trimEnd())
      const state = renderToBlocklyState(t) as { blocks: { blocks: unknown[] } }
      const back = state.blocks.blocks.flatMap((b) => ex.extractStatementChain(b as never))
      expect(generateCode({ id: 'r', componentId: 'cpp:program', properties: {}, slots: { body: back } } as never, 'cpp', cStyle as never).trimEnd()).toBe(src.trimEnd())
    }
  })

  it('★ Cella 判得出：匿名 typedef、帶標籤的 typedef（兩個名字都能當型別）、兩個匿名列舉', async () => {
    await expectCellaOut(ANON, '1\n', { lang: 'c' })
    await expectCellaOut(TAG, '3 2\n', { lang: 'c' })
    await expectCellaOut(PLAIN, '5 7\n', { lang: 'c' })
  }, 120_000)
})
