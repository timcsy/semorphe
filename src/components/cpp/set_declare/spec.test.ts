/**
 * **膠囊自證：集合的宣告，以及它的重複性那一軸。**
 *
 * 🔴 **它從哪來**：`multiset<` 在使用者學生的 218 支競賽練習裡出現 13 支，
 * 而 `multiset` 當時**根本沒有被登錄成容器樣板**——`ms.insert(3)` 兩次只留一個。
 *
 * 判準是 C++ 自己的：同一個方法名 `insert`，行為由**接收者的型別**決定。
 * 所以重複性住在這一顆（宣告）上，而不是拆成兩個 `insert`。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../../../../tests/helpers/setup-lifter'
import { registerCppLanguage } from '../../../languages/cpp/generators'
import { expectCellaOut, knownCellaGap } from '../../../../tests/helpers/cella-run'
import { setupTestRenderer } from '../../../../tests/helpers/setup-renderer'
import { renderToBlocklyState } from '../../../core/projection/block-renderer'
import { PatternExtractor } from '../../../core/projection/pattern-extractor'
import { BlockSpecRegistry } from '../../../core/blocks/block-spec-registry'
import { allCppComponents, allCppProjections } from '../../../languages/cpp/all-declarations'
import { registerCppExtractStrategies } from '../../../languages/cpp/extractors/extract-strategies'
import { generateCode } from '../../../core/projection/code-generator'
import apcs from '../../../languages/cpp/styles/apcs.json'
import type { SemanticNode, StylePreset } from '../../../core/types'

let parser: Parser
beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  registerCppLanguage()
  setupTestRenderer()
})

const lift = (c: string): SemanticNode =>
  createTestLifter().lift(parser.parse(c)!.rootNode as never) as SemanticNode
const collect = (n: SemanticNode, out: SemanticNode[] = []): SemanticNode[] => {
  out.push(n)
  for (const ks of Object.values(n.slots ?? {})) for (const k of ks) collect(k, out)
  return out
}
const ids = (n: SemanticNode): string[] => collect(n).map((x) => x.componentId)
const H = '#include <iostream>\n#include <set>\nusing namespace std;\n'
const S = apcs as unknown as StylePreset

describe('膠囊自證：集合的宣告與重複性', () => {
  it('★ lift：set 認得出來，而且不落進殘差', () => {
    const got = ids(lift(`${H}int main(){ set<int> s; }`))
    expect(got, '🔴 沒認出來 → 下面每一條都在驗空集合').toContain('cpp:set_declare')
    expect(got).not.toContain('cpp:raw_code')
  })

  it('★ multiset 走的是同一顆，而重複性是屬性不是身分', () => {
    const nodes = collect(lift(`${H}int main(){ multiset<int> ms; }`))
    const decl = nodes.find((n) => n.componentId === 'cpp:set_declare')
    expect(decl, '🔴 multiset 沒被登錄成容器樣板 → 它會掉成一般變數').toBeDefined()
    expect(decl!.properties.unique, '🔴 沒帶屬性 → 產碼與執行都會把它當 set').toBe('false')
  })

  it('★ 而 set 那一側要拿到相反的值（不是「沒有值」）', () => {
    const decl = collect(lift(`${H}int main(){ set<int> s; }`))
      .find((n) => n.componentId === 'cpp:set_declare')
    expect(decl!.properties.unique).toBe('true')
  })

  it('★ generate：兩種都吐得回去，一字不差', () => {
    expect(generateCode(lift(`${H}int main(){ set<int> s; }`), 'cpp', S)).toContain('set<int> s;')
    const ms = generateCode(lift(`${H}int main(){ multiset<int> ms; }`), 'cpp', S)
    expect(ms, '🔴 產成 set 的話：程式跑得動，而答案少一半').toContain('multiset<int> ms;')
  })

  it('★ 語義不動點：multiset 走一趟回來還是 multiset', () => {
    const once = generateCode(lift(`${H}int main(){ multiset<int> ms; }`), 'cpp', S)
    const twice = generateCode(lift(once), 'cpp', S)
    expect(twice).toBe(once)
  })

  it('★ execute：舊存檔沒有這個屬性時，它是 set（不留重複）', async () => {
    // 屬性缺席走的是同一條預設，而預設值寫在兩處（產碼與執行）——這一條盯的是後者。
    // spec 198（重構 6c-1）：執行的判準從 JS 直譯器換成 Cella（`tests/helpers/cella-run.ts`）
    await expectCellaOut(`${H}int main(){ set<int> s; s.insert(3); s.insert(3); cout << s.size(); }`, '1')
  })

  // 第 401 刀：`set<ll> st({0});`（唯一的建構引數是大括號清單）原本整句降級成原文（學生語料 2_11_AC）。
  // 它是 initializer_list 建構子，與 `st{0}` 同一件事 ⟹ 收成元素；產回去是 `= {0}`（同 `int a{5}` → `int a = {5}` 的正規化）
  it('建構引數是大括號清單：收成元素、不降級、Cella 判得出', async () => {
    const src = `${H}int main() {\n    multiset<long long> st({0, 5, 5});\n    cout << st.size() << endl;\n    return 0;\n}\n`
    const t = lift(src)
    expect(ids(t)).toContain('cpp:set_declare')
    expect(ids(t)).not.toContain('cpp:raw_code')
    const back = generateCode(t, 'cpp', S)
    expect(back).toContain('multiset<long long> st = {0, 5, 5};')
    expect(ids(lift(back)).filter((x) => x === 'cpp:set_declare')).toHaveLength(1)
    await expectCellaOut(src, '3\n')
  })
})

// 第 403 刀：一段範圍建起來的集合。set／multiset 沒有「幾個、每個是什麼」的建構子，兩個建構引數只可能是範圍。
describe('用一段範圍建立集合（403）', () => {
  const body = (line: string) => `${H}#include <vector>\nint main() {\n    vector<int> v = {3, 1, 3, 2};\n    int a[5] = {5, 1, 5, 2, 1};\n    ${line}\n    return 0;\n}\n`
  const decl = (t: SemanticNode) => collect(t).find((n) => n.componentId === 'cpp:set_declare')!

  it('★ lift：起點進 source、終點進 source_end，不降級', () => {
    const t = lift(body('set<int> s(v.begin(), v.end());'))
    expect(ids(t)).toContain('cpp:set_declare')
    expect(ids(t)).not.toContain('cpp:raw_code')
    expect(decl(t).slots.source).toHaveLength(1)
    expect(decl(t).slots.source_end).toHaveLength(1)
    const m = decl(lift(body('multiset<int> ms(a, a + 5);')))
    expect(m.properties.unique).toBe('false')
    expect(m.slots.source_end).toHaveLength(1)
  })

  it('★ generate 一字不差，再 lift 是同一棵', () => {
    for (const line of ['set<int> s(v.begin(), v.end());', 'multiset<int> ms(a, a + 5);']) {
      const back = generateCode(lift(body(line)), 'cpp', S)
      expect(back).toContain(line)
      expect(generateCode(lift(back), 'cpp', S)).toBe(back)
    }
  })

  it('三個引數（帶比較器）照舊整句降級：不得安靜丟掉第三個', () => {
    const t = lift(body('set<int> s(v.begin(), v.end(), less<int>());'))
    expect(ids(t)).toContain('cpp:raw_code')
    expect(generateCode(t, 'cpp', S)).toContain('set<int> s(v.begin(), v.end(), less<int>());')
  })

  // 第 409 刀起 vector 也有 source_end，但要兩個引數都是位置才算（這裡 a 是陣列 ⟹ 範圍；v.size() 是數 ⟹ 照舊）
  it('vector 的 (a, b) 要看引數是不是位置', () => {
    const t = lift(body('vector<int> w(a, a + 5);'))
    expect(collect(t).some((n) => (n.slots?.source_end?.length ?? 0) > 0)).toBe(true)
    const u = lift(body('vector<int> w(v.size(), 0);'))
    expect(collect(u).some((n) => (n.slots?.source_end?.length ?? 0) > 0)).toBe(false)
  })

  it('★ 積木：挑到範圍形態，走一趟積木回來一字不差', () => {
    const reg = new BlockSpecRegistry(); reg.loadFromSplit(allCppComponents(), allCppProjections())
    const ex = new PatternExtractor(); ex.loadBlockSpecs(reg.getAll()); registerCppExtractStrategies(ex)
    const t = lift(body('multiset<int> ms(a, a + 5);'))
    const state = renderToBlocklyState(t) as unknown as { blocks: { blocks: { next?: { block: unknown } }[] } }
    expect(JSON.stringify(state)).toContain('"cpp_set_declare_range"')
    const back: SemanticNode[] = []
    for (const b0 of state.blocks.blocks) {
      let cur: { next?: { block: unknown } } | undefined = b0
      while (cur) { const n = ex.extract(cur as never); if (n) back.push(n); cur = cur.next?.block as typeof cur }
    }
    const viaBlocks = generateCode({ id: 'r', componentId: 'cpp:program', properties: {}, slots: { body: back } } as SemanticNode, 'cpp', S)
    expect(viaBlocks).toBe(generateCode(t, 'cpp', S))
  })

  it('沒有終點的 set 仍是原本那顆積木', () => {
    const state = renderToBlocklyState(lift(`${H}int main(){ set<int> s; }`))
    expect(JSON.stringify(state)).toContain('"cpp_set_declare"')
    expect(JSON.stringify(state)).not.toContain('cpp_set_declare_range')
  })

  // Cella 的 set／multiset 模型還沒有範圍建構子（cella 2026-11-11 07:3x 收下，排在中午前後那一版）。發版後這一根會轉紅 → 改成一般的 expectCellaOut
  it('Cella：範圍建構子（等 Cella 下一版）', async () => {
    await knownCellaGap(/has no constructor for these arguments/, () =>
      expectCellaOut(body('multiset<int> ms(a, a + 5);\n    for (int x : ms) cout << x << " ";'), '1 1 2 5 5 '))
  })
})
