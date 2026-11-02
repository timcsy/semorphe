/**
 * `cpp:bits_declare` 的自證測——**一排固定長度的位元**（`bitset<N>`）。
 *
 * ## 🔴 它從語料來
 *
 * `bitset<` 在 218 支學生程式裡 **4 處 / 3 支**，而三支**全部**只缺這一族：
 * `AP325/3/3_11`（滑動視窗的去重）· `tioj/25_toj126`（整排位移的可達性）·
 * `AP325/2/2_7_TLE`（一陣列的 bitset ＋ 互斥或）。
 *
 * ## 🔴 而它最大的設計決定是「執行期長什麼樣」
 *
 * **一排位元 ＝ `type: 'array'` ＋ `elemType: 'bit'`。**
 * 那讓索引的讀與寫**免費**（同族那顆取第幾格的元件要求 `type === 'array'`，而它早就有
 * 左值解析器），而 `elemType` 那一章讓位元運算子分得出
 * 「一排位元」與「一個 `vector<int>`」——後者的 `a ^ b` 在 C++ 裡不合法。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../../../../tests/helpers/setup-lifter'
import { registerCppLanguage } from '../../../languages/cpp/generators'
import { expectCellaOut } from '../../../../tests/helpers/cella-run'
import { formalize } from '../../../providers/cella/formalize'
import { generateCode } from '../../../core/projection/code-generator'
import apcs from '../../../languages/cpp/styles/apcs.json'
import type { SemanticNode, StylePreset } from '../../../core/types'

let parser: Parser
beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  registerCppLanguage()
})

const H = '#include <bits/stdc++.h>\nusing namespace std;\n'
const lift = (body: string): SemanticNode =>
  createTestLifter().lift(parser.parse(`${H}int main(){ ${body} return 0; }`)!.rootNode as never) as SemanticNode
const ids = (n: SemanticNode, out: string[] = []): string[] => {
  out.push(n.componentId)
  for (const ks of Object.values(n.slots ?? {})) for (const k of ks) ids(k, out)
  return out
}
const gen = (body: string): string => generateCode(lift(body), 'cpp', apcs as unknown as StylePreset)
// spec 198（重構 6c-1）：執行的判準從 JS 直譯器換成 Cella（`tests/helpers/cella-run.ts`）
const run = (body: string, expected: string) => expectCellaOut(`${H}int main(){ ${body} return 0; }`, expected)
const dig = (n: SemanticNode, id: string): SemanticNode | null => {
  if (n.componentId === id) return n
  for (const ks of Object.values(n.slots ?? {})) for (const k of ks) { const r = dig(k, id); if (r) return r }
  return null
}

describe('膠囊自證：一排位元', () => {
  it('★ lift：認得出來，而且沒有降級', () => {
    const got = ids(lift('bitset<8> bs;'))
    expect(got).toContain('cpp:bits_declare')   // ← 正向錨點先釘
    expect(got).not.toContain('cpp:raw_code')
  })

  /**
   * 🔴 **大小進【接點】，不是進一個叫 `type` 的字串屬性。**
   * 共用的容器宣告路把樣板引數當型別讀（`vector<int>` → `type: "int"`），
   * 而把一個大小裝進 `type` 正是第七十二條護欄追的那一族。
   */
  it('🔴 lift：樣板引數是大小，它進 `size` 接點', () => {
    const node = dig(lift('bitset<26> bs;'), 'cpp:bits_declare')!
    expect(node.slots.size?.length, '🔴 大小掉了').toBe(1)
    expect(node.properties.type, '🔴 大小被裝進 `type` 字串屬性了').toBeUndefined()
    expect(node.properties.name).toBe('bs')
  })

  /** ★ 正向錨點：**同族不得被弄壞**——`vector<int>` 的樣板引數仍然是型別。 */
  it('★ lift：`vector<int>` 的樣板引數照舊是型別', () => {
    const node = dig(lift('vector<int> v;'), 'cpp:vector_declare')!
    expect(node.properties.type).toBe('int')
  })

  it('★ generate：產回去一字不差', () => {
    expect(gen('bitset<26> bs;')).toContain('bitset<26> bs;')
  })

  it('★ round-trip：產回去再 lift，身分不變', () => {
    const once = gen('bitset<26> bs;')
    const twice = generateCode(
      createTestLifter().lift(parser.parse(once)!.rootNode as never) as SemanticNode,
      'cpp', apcs as unknown as StylePreset)
    expect(twice).toBe(once)
    expect(ids(createTestLifter().lift(parser.parse(once)!.rootNode as never) as SemanticNode))
      .toContain('cpp:bits_declare')
  })

  it('★ execute：每一格從 0 開始，而索引讀寫都會', async () => {
    await run('bitset<8> bs; bs[3]=1; cout << bs[3] << bs[0] << bs[7];', '100')
  })

  /** 🔴 語料 `AP325/2/2_7_TLE` 的形狀：**一陣列的 bitset**。 */
  it('🔴 execute：一陣列的 bitset，每一格都是一排', async () => {
    await run('bitset<26> d[3]; d[0][2]=1; cout << d[0][2] << d[1][2] << d[2][25];', '100')
  })

  /**
   * 🔴 沒有大小要出聲——不得默默建一個空的（那會讓 `bs[0]` 說「索引超出範圍」）。
   * 這是一棵【程式碼寫不出來】的樹（積木拖出來、大小接點空著），所以不走 `expectCellaOut`：
   * 直接問 formalize——它必須拒絕翻譯，並指回那一顆宣告（「說得出是誰」＝ nodeId）。
   */
  it('🔴 execute：沒有大小要出聲，而且說得出是誰', () => {
    const t = createTestLifter().lift(parser.parse(`${H}int main(){ bitset<8> bs; return 0; }`)!.rootNode as never) as SemanticNode
    const node = dig(t, 'cpp:bits_declare')!
    node.slots.size = []
    const fz = formalize(t, { lang: 'cpp' })
    expect(fz.program, '🔴 沒有大小卻翻出了一支程式').toBeNull()
    expect(fz.unknown.map((u) => u.nodeId), '🔴 說不出是哪一顆宣告').toContain(node.id)
    expect(fz.unknown.map((u) => u.construct)).toContain('cpp:bits_declare')
  })

  /**
   * 🔴 **建構子的寫法 `b(42)`：不得安靜地丟掉引數**（spec 203，與參照編譯器交叉比對時抓到）。
   * `size` 這一格是樣板引數（`<8>`），建構引數沒有地方放 ⟹ 原本轉一圈變成 `bitset<8> b;`，判決印 0 而參照編譯器印 42。
   * 現在整句降級成原文。
   */
  it('🔴 `bitset<8> b(42)`：轉一圈原文一字不差（收不下就整句降級，不丟引數）', () => {
    expect(gen('bitset<8> b(42); cout << b.to_ulong();'), '🔴 修之前這裡是 `bitset<8> b;`').toContain('bitset<8> b(42);')
    expect(gen('bitset<8> a(0xF0UL);')).toContain('bitset<8> a(0xF0UL);')
    expect(ids(lift('bitset<8> b(42);'))).toContain('cpp:raw_code')
    // 正向錨點：沒有建構引數的照舊是這顆身分
    expect(ids(lift('bitset<8> c;'))).toContain('cpp:bits_declare')
  })
})

