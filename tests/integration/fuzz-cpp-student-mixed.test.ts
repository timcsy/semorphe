/**
 * **模糊測試：學生解題風格的完整程式**（第 402 刀，2026-11-11）
 *
 * 八支程式由隔離的出題者寫（不知道 semorphe 的實作；APCS／ZeroJudge 風格：STL 混用、struct 排序、字串、遞迴、BFS、Dijkstra），
 * 預期輸出由 clang++ 跑出來（`#include <bits/stdc++.h>` 指到 tests/fixtures/refcc-shim），存在 tests/fixtures/fuzz-cpp-student-mixed.json。
 * 學生語料（StudyCpp 218 支）在 401 之後只剩一支翻不出——這一輪是為了找語料以外的缺口。
 *
 * 抓到的，修了的：
 * ① `toupper`／`tolower`／`isdigit` 三顆元件沒有產生器：從程式碼來的節點帶原文、產碼退回原文所以看起來對，
 *    **一走積木就變成 `⟨cpp:char_to_upper⟩`**（fuzz_5、fuzz_7）。護欄補在 tests/unit/core/component-paths-contract。
 * ② `int qs[][2] = {{0, 2}, …}`（外層沒寫長度）被當成運算式長度送 tArrE，Cella 照實說「帶初值的 VLA」→ unknown（fuzz_3、fuzz_4）。
 *
 * 照實記下、這一刀不做的：
 * - `multiset<int> ms(arr, arr + 10)`（迭代器範圍建構）整句降級原文（fuzz_8）——set 那顆沒有範圍建構的槽，學生語料 0 筆。
 * - 走一趟積木：多宣告子拆成多行、`rep(i, 0, n)` 寫回成 `for`、多餘的括號拿掉——意思相同，下面比的是 Cella 的輸出。
 * - fuzz_5 判 unknown：只含 <string>／<map> 時未限定的 `size_t` 有沒有被宣告，看標準庫實作（Cella 照實說）。
 *
 * 等 Cella（11-11 回報，knownCellaGap 釘著）：fuzz_1 含 string 成員的聚合初始化、fuzz_6 memset 整個二維陣列，兩支都被判 reject。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import { setupTestRenderer } from '../helpers/setup-renderer'
import { runCella, knownCellaGap, describeCellaResult } from '../helpers/cella-run'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { generateCode } from '../../src/core/projection/code-generator'
import { renderToBlocklyState } from '../../src/core/projection/block-renderer'
import { PatternExtractor } from '../../src/core/projection/pattern-extractor'
import { BlockSpecRegistry } from '../../src/core/blocks/block-spec-registry'
import { allCppComponents, allCppProjections } from '../../src/languages/cpp/all-declarations'
import { registerCppExtractStrategies } from '../../src/languages/cpp/extractors/extract-strategies'
import apcs from '../../src/languages/cpp/styles/apcs.json'
import type { SemanticNode, StylePreset } from '../../src/core/types'

const PROGS = JSON.parse(readFileSync(process.cwd() + '/tests/fixtures/fuzz-cpp-student-mixed.json', 'utf8')) as { id: string; code: string; expected: string }[]
const P = (id: string) => PROGS.find((p) => p.id === id)!
const S = apcs as unknown as StylePreset
let parser: Parser
let ex: PatternExtractor
beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  registerCppLanguage()
  setupTestRenderer()
  const reg = new BlockSpecRegistry()
  reg.loadFromSplit(allCppComponents(), allCppProjections())
  ex = new PatternExtractor()
  ex.loadBlockSpecs(reg.getAll())
  registerCppExtractStrategies(ex)
}, 120_000)
const lift = (c: string): SemanticNode => createTestLifter().lift(parser.parse(c)!.rootNode as never) as SemanticNode
const all = (n: SemanticNode, o: SemanticNode[] = []): SemanticNode[] => { o.push(n); for (const k of Object.values(n.slots ?? {})) for (const c of k) all(c, o); return o }
const shape = (n: SemanticNode): unknown => [n.componentId, n.properties, Object.fromEntries(Object.entries(n.slots ?? {}).map(([k, v]) => [k, v.map(shape)]))]
const count = (t: SemanticNode, id: string) => all(t).filter((n) => n.componentId === id).length
function viaBlocks(t: SemanticNode): string {
  const state = renderToBlocklyState(t) as unknown as { blocks: { blocks: { next?: { block: unknown } }[] } }
  const back: SemanticNode[] = []
  for (const b0 of state.blocks.blocks) {
    let cur: { next?: { block: unknown } } | undefined = b0
    while (cur) {
      const n = ex.extract(cur as never)
      if (n) back.push(n)
      cur = cur.next?.block as typeof cur
    }
  }
  return generateCode({ id: 'r', componentId: 'cpp:program', properties: {}, slots: { body: back } } as SemanticNode, 'cpp', S)
}

const ACCEPTED = ['fuzz_2', 'fuzz_3', 'fuzz_4', 'fuzz_7']

describe('模糊測試：學生解題風格', () => {
  it('入口條件：八支都在、每一支都有預期輸出', () => {
    expect(PROGS.map((p) => p.id)).toEqual(['fuzz_1', 'fuzz_2', 'fuzz_3', 'fuzz_4', 'fuzz_5', 'fuzz_6', 'fuzz_7', 'fuzz_8'])
    expect(PROGS.every((p) => p.expected.length > 0)).toBe(true)
  })

  it.each(PROGS.map((p) => [p.id, p] as const))('★ %s：再 lift 不漂移、走一趟積木沒有產不出來的節點', (id, p) => {
    const t = lift(p.code)
    expect(all(t).length).toBeGreaterThan(50)
    expect(count(t, 'cpp:raw_code')).toBe(id === 'fuzz_8' ? 1 : 0)
    expect(shape(lift(generateCode(t, 'cpp', S)))).toEqual(shape(t))
    expect(viaBlocks(t)).not.toContain('⟨')
  })

  it('① 字元函式三顆：身分對、走一趟積木回來仍是 toupper／tolower／isdigit', async () => {
    expect(count(lift(P('fuzz_5').code), 'cpp:char_to_upper')).toBe(1)
    expect(count(lift(P('fuzz_7').code), 'cpp:char_is_digit')).toBe(1)
    expect(viaBlocks(lift(P('fuzz_5').code))).toContain('p.second[0] = toupper(p.second[0]);')
    expect(viaBlocks(lift(P('fuzz_7').code))).toContain('isdigit(s[pos])')
    const src = '#include <bits/stdc++.h>\nusing namespace std;\nint main() {\n    char c = \'a\';\n    c = toupper(c);\n    cout << c << (isdigit(c) ? 1 : 0) << (char)tolower(c);\n    return 0;\n}\n'
    const back = viaBlocks(lift(src))
    expect(back).toContain('tolower(c)')
    const r = await runCella(back)
    expect([r.verdict, r.out]).toEqual(['accept', 'A0a'])
  })

  it.each(ACCEPTED)('★ %s：Cella 判 accept、輸出與 clang++ 相同；走一趟積木回來的程式也一樣', async (id) => {
    const p = P(id)
    const r = await runCella(p.code)
    expect([r.verdict, r.out]).toEqual(['accept', p.expected])
    const b = await runCella(viaBlocks(lift(p.code)))
    expect([b.verdict, b.out]).toEqual(['accept', p.expected])
  })

  it('② 外層沒寫長度的二維陣列：是二維陣列那顆、不是 VLA（fuzz_3 的 qs、fuzz_4 的 edges）', async () => {
    const t = lift(P('fuzz_4').code)
    expect(all(t).some((n) => n.componentId === 'cpp:array_2d_declare' && n.properties?.name === 'edges')).toBe(true)
    const r = await runCella('int main() {\n    int qs[][2] = {{0, 2}, {1, 6}};\n    return qs[1][1] - 6;\n}\n')
    expect(r.verdict).toBe('accept')
  })

  it('fuzz_5：未限定的 size_t 只含 <string>／<map> 時照實 unknown（看標準庫實作）', async () => {
    const r = await runCella(P('fuzz_5').code)
    expect(r.verdict).toBe('unknown')
    expect(r.problems.map((q) => q.reason).join('；')).toMatch(/size_t/)
  })

  it('fuzz_8：multiset 的迭代器範圍建構照實降級、Cella 照實說翻不出', async () => {
    const raws = all(lift(P('fuzz_8').code)).filter((n) => n.componentId === 'cpp:raw_code')
    expect(raws.map((n) => n.metadata?.rawCode ?? n.properties?.code)).toEqual(['multiset<int> ms(arr, arr + 10);'])
    expect((await runCella(P('fuzz_8').code)).verdict).toBe('untranslated')
  })

  it('等 Cella：fuzz_1 含 string 成員的聚合初始化被判 reject（11-11 回報）', async () => {
    await knownCellaGap(/no matching constructor for initialization of 'Stu'/, async () => {
      const r = await runCella(P('fuzz_1').code)
      expect(r.verdict, describeCellaResult(r)).toBe('accept')
      expect(r.out).toBe(P('fuzz_1').expected)
    })
  })

  it('等 Cella：fuzz_6 memset 整個二維陣列被判 reject（11-11 回報）', async () => {
    await knownCellaGap(/invalid argument to a library function/, async () => {
      const r = await runCella(P('fuzz_6').code)
      expect(r.verdict, describeCellaResult(r)).toBe('accept')
      expect(r.out).toBe(P('fuzz_6').expected)
    })
  })
})
