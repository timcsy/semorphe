/**
 * **模糊測試：friend**（元件管線 389，2026-11-10）
 *
 * 四支程式由隔離的出題者寫（不知道 semorphe 的實作），預期輸出由 g++ 跑出來，存在 tests/fixtures/fuzz-cpp-friend.json。
 * ⚠️ fuzz_1 的原稿編不過，補了一行朋友函式原型（fixture 的 description 有寫）。
 *
 * 結果：零缺陷。兩種 friend 都認得；帶本體、限定名的 friend 照實降級成原文，產回去編得過、輸出相同。
 * 翻不出（untranslated）的三支各有原因，下面逐支釘住——那些洞補上時這幾條會紅，紅了就轉成判決相同的斷言。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { generateCode } from '../../src/core/projection/code-generator'
import { expectCellaOut, runCella } from '../helpers/cella-run'
import type { SemanticNode, StylePreset } from '../../src/core/types'
import apcs from '../../src/languages/cpp/styles/apcs.json'

const PROGS = JSON.parse(readFileSync(`${process.cwd()}/tests/fixtures/fuzz-cpp-friend.json`, 'utf8')) as { id: string; code: string; expected: string }[]
const S = apcs as unknown as StylePreset
let parser: Parser
beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  registerCppLanguage()
}, 120_000)
const lift = (c: string): SemanticNode => createTestLifter().lift(parser.parse(c)!.rootNode as never) as SemanticNode
const all = (n: SemanticNode, o: SemanticNode[] = []): SemanticNode[] => { o.push(n); for (const k of Object.values(n.slots ?? {})) for (const c of k) all(c, o); return o }
const shape = (n: SemanticNode): unknown => [n.componentId, n.properties, Object.fromEntries(Object.entries(n.slots ?? {}).map(([k, v]) => [k, v.map(shape)]))]
const prog = (id: string) => PROGS.find((p) => p.id === id)!

/** [朋友類別數, 朋友函式數, 降級成原文的段數] */
const COUNT: Record<string, [number, number, number]> = { fuzz_1: [1, 4, 0], fuzz_2: [0, 4, 0], fuzz_3: [0, 0, 2], fuzz_4: [1, 0, 2] }
const ALLOWED = /帶本體、限定名或其他修飾的 friend|成員初始化列裡有多個引數/

describe('模糊測試：friend', () => {
  it('入口條件：四支都在、每一支都有預期輸出', () => {
    expect(PROGS.map((p) => p.id)).toEqual(['fuzz_1', 'fuzz_2', 'fuzz_3', 'fuzz_4'])
    expect(PROGS.every((p) => p.expected.length > 0)).toBe(true)
  })

  it.each(PROGS.map((p) => [p.id, p] as const))('★ %s：元件身分、降級只有登記過的兩種、再 lift 不漂移', (id, p) => {
    const nodes = all(lift(p.code))
    const [fc, ff, raw] = COUNT[id]
    expect(nodes.filter((n) => n.componentId === 'cpp:friend_class')).toHaveLength(fc)
    expect(nodes.filter((n) => n.componentId === 'cpp:friend_function')).toHaveLength(ff)
    const degraded = nodes.filter((n) => /raw_code|unresolved|raw_expression/.test(n.componentId))
    expect(degraded).toHaveLength(raw)
    expect(degraded.map((n) => String(n.metadata?.rawCode ?? n.properties?.code ?? '')).filter((w) => !ALLOWED.test(w))).toEqual([])
    const t = lift(p.code)
    expect(shape(lift(generateCode(t, 'cpp', S)))).toEqual(shape(t))
  })

  // ⚠️ 原稿的 size_t 只 include 了 iostream／vector／string：標準不保證那幾個標頭宣告它，Cella 判 unknown 是對的。
  //    這裡要量的是 friend，所以把迴圈變數換成 int，輸出不變
  it('★ Cella：同一個朋友函式宣告在兩個類別（fuzz_1）判 accept、輸出與 g++ 相同', async () => {
    await expectCellaOut(prog('fuzz_1').code.replace('size_t i', 'int i'), prog('fuzz_1').expected)
  })

  it('★ Cella：朋友函式 operator<< 寫到 ostream（fuzz_2）判 accept、輸出與 g++ 相同', async () => {
    await expectCellaOut(prog('fuzz_2').code.replace('size_t i', 'int i'), prog('fuzz_2').expected)
  })

  it.each([
    ['fuzz_3', '成員函式當朋友、帶本體的朋友函式都還是原文'],
    ['fuzz_4', '限定名的朋友與成員初始化列的多引數都還是原文'],
  ])('🟡 %s 照實翻不出：%s', async (id) => {
    const r = await runCella(prog(id).code)
    expect(r.verdict).toBe('untranslated')
  })
})
