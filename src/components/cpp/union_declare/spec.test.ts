/**
 * `cpp:union_declare` 的自證測（2026-11-08，C 盲測第二輪）。
 * 判決形狀是 cella 給的：頂層 iUnion{d: sdef}、型別 tUnion（與結構對稱）。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../../../../tests/helpers/setup-lifter'
import { registerCppLanguage } from '../../../languages/cpp/generators'
import { generateCode } from '../../../core/projection/code-generator'
import { expectCellaOut } from '../../../../tests/helpers/cella-run'
import cStyle from '../../../languages/cpp/styles/c.json'
import apcs from '../../../languages/cpp/styles/apcs.json'
import type { SemanticNode, StylePreset } from '../../../core/types'

let parser: Parser
beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  registerCppLanguage()
})
const lift = (src: string): SemanticNode => createTestLifter().lift(parser.parse(src)!.rootNode as never) as SemanticNode
const ids = (n: SemanticNode, acc: string[] = []): string[] => { acc.push(n.componentId); Object.values(n.slots ?? {}).flat().forEach((c) => ids(c, acc)); return acc }
const C = '#include <stdio.h>\n'
const BASIC = C + 'union U {\n    int i;\n    char c;\n};\nint main(void) {\n    union U u;\n    u.i = 65;\n    printf("%d\\n", u.i);\n    return 0;\n}\n'
const TYPEDEF_ANON = C + 'typedef union {\n    int i;\n    float f;\n} Num;\nint main(void) {\n    Num n;\n    n.f = 1.5f;\n    printf("%.1f %d\\n", n.f, (int)sizeof(Num));\n    return 0;\n}\n'
const TYPEDEF_TAG = C + 'typedef union V {\n    int i;\n    char s[8];\n} Val;\nint main(void) {\n    Val a;\n    union V b;\n    a.i = 3;\n    b.i = 4;\n    printf("%d\\n", a.i + b.i);\n    return 0;\n}\n'
const CPP = '#include <iostream>\nusing namespace std;\nunion U {\n    int i;\n    double d;\n};\nint main() {\n    U u;\n    u.d = 2.5;\n    cout << u.d << endl;\n}\n'

describe('cpp:union_declare', () => {
  it('lift：是一顆 union，不是原文', () => {
    for (const src of [BASIC, TYPEDEF_ANON, TYPEDEF_TAG, CPP]) {
      const got = ids(lift(src))
      expect(got).toContain('cpp:union_declare')
      expect(got.filter((i) => i.includes('raw'))).toEqual([])
    }
  })
  it('typedef：匿名的 name 為空、帶標籤的兩個名字都在', () => {
    const anon = lift(TYPEDEF_ANON).slots!.body!.find((n) => n.componentId === 'cpp:union_declare')!
    expect(anon.properties).toMatchObject({ name: '', typedef_alias: 'Num' })
    const tag = lift(TYPEDEF_TAG).slots!.body!.find((n) => n.componentId === 'cpp:union_declare')!
    expect(tag.properties).toMatchObject({ name: 'V', typedef_alias: 'Val' })
  })
  it('產碼來回一字不差（C 與 C++ 風格）', () => {
    for (const src of [BASIC, TYPEDEF_ANON, TYPEDEF_TAG]) expect(generateCode(lift(src), 'cpp', cStyle as StylePreset).trimEnd()).toBe(src.trimEnd())
    expect(generateCode(lift(CPP), 'cpp', apcs as StylePreset).trimEnd()).toBe(CPP.trimEnd())
  })
  it('匿名 union 當結構成員、帶成員函式的 union：照原文降級', () => {
    const a = 'struct S {\n    union {\n        int i;\n        float f;\n    };\n};\n'
    expect(generateCode(lift(a), 'cpp', cStyle as StylePreset)).toContain('union {')
    const b = 'union W {\n    int i;\n    int get() { return i; }\n};\n'
    expect(ids(lift(b))).not.toContain('cpp:union_declare')
    expect(generateCode(lift(b), 'cpp', apcs as StylePreset)).toContain('int get()')
  })
  it('★ Cella 判得出：基本、typedef 兩種、sizeof 一個 typedef 名、C++', async () => {
    await expectCellaOut(BASIC, '65\n', { lang: 'c' })
    await expectCellaOut(TYPEDEF_ANON, '1.5 4\n', { lang: 'c' })
    await expectCellaOut(TYPEDEF_TAG, '7\n', { lang: 'c' })
    await expectCellaOut(CPP, '2.5\n')
  }, 120_000)
})
