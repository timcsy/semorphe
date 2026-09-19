/**
 * **一排位元：四個面向**——`cpp:bits_declare`／`cpp:bits_fill`／`cpp:bits_count`（2026-09-19）。
 *
 * ## 它從語料來
 *
 * `bitset<` 在 218 支學生程式裡 **4 處 / 3 支**，而三支**全部**只缺這一族。
 *
 * ## 四個面向，而這一關量的是【積木那一側】
 *
 * 階段二量的是①②⑤（產碼／不動點／跑起來）。③④ 一次都沒量，
 * 而這一刀**新增兩顆積木 ＋ 改了第三顆的插槽名**。
 *
 * | 面向 | 這裡怎麼量 | 紅了的症狀 |
 * |---|---|---|
 * | ① 產出的程式碼 | lift → 產碼 | `bs.reset()` 變成 `bs.clear()`——**編不過** |
 * | ② 語義的不動點 | lift → 產碼 → 再 lift | 來回一趟就變 |
 * | ③ 載得進工作區 | render → Blockly load | **一片空白**（不是少一行） |
 * | ④ 走一趟積木回來 | render → extract → 產碼 | 學生一動積木，程式碼就變了 |
 *
 * 🔴 **④ 這一族有三格特別危險**：
 *
 * ```
 * bits_fill.METHOD    掉了 → set() 變成 reset()，而【產出的碼仍然合法】，它把整排歸零
 * bits_count.FORM     掉了 → bs.count() 變成 __builtin_popcount(bs)，那連編都編不過
 * bits_declare.SOURCE 常態留空 ——【空的】與【掉了】長得一樣，所以兩種都要測
 * ```
 *
 * ## 🔴 而這一關抓到的東西不在積木上，在遷移機制裡
 *
 * `cpp_bits_count` 的插槽從 `VALUE` 改名成 `OBJ`，我照慣例寫了一筆
 * `SHAPE_CHANGES_V23 { retiredFields: ['VALUE'] }`——**而它是一個 no-op**：
 *
 * `staleShapeIn` 只讀 `n.fields` 與 `n.extraState`。它**遞迴進** `n.inputs`
 * 去找巢狀積木，卻從來不看那些 input 叫什麼名字。
 *
 * > **一個只看得見欄位的失效判定，看不見「同一顆積木換了接點的名字」。**
 *
 * ⚠️ 而症狀不是報錯：舊存檔裡接在 `VALUE` 的那顆積木**安靜地消失**。
 * 🟢 機制因此多一格 `retiredInputs`（`migrations/block-shape-changes.ts`）。
 *
 * ⚠️ 第五個面向（跑起來與 g++ 一不一樣）在
 * `tests/integration/interpreter-matches-compiler.test.ts`（16 條）。
 *
 * ## ⚠️ 判準裡不得放未定義行為
 *
 * `bitset<26>` 上索引 26 以上是 UB，而**消毒器證不出來**
 *（實測：g++ 印 1、UBSan／ASan 一個字都沒印——`bitset::operator[]` 沒有邊界檢查）。
 * **「我們會出聲而 g++ 不會」不寫進判準。**
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import * as Blockly from 'blockly'
import { registerFieldMultilineInput } from '@blockly/field-multilineinput'
import { registerDynamicDropdownField, declareDropdownSource } from '../../src/ui/dynamic-dropdown-field'
import { createTestLifter } from '../helpers/setup-lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { generateCode } from '../../src/core/projection/code-generator'
import { BlockSpecRegistry } from '../../src/core/blocks/block-spec-registry'
import { allCppProjections } from '../../src/languages/cpp/all-declarations'
import { allComponentDefs } from '../helpers/component-scan'
import { componentLabels } from '../../src/core/component/labels'
import i18nBlocks from '../../src/i18n/zh-TW/blocks.json'
import { PatternRenderer } from '../../src/core/projection/pattern-renderer'
import { RenderStrategyRegistry } from '../../src/core/registry'
import { registerCppRenderStrategies } from '../../src/languages/cpp/renderers/strategies'
import { renderToBlocklyState, setPatternRenderer } from '../../src/core/projection/block-renderer'
import { setDegradationLanguage } from '../../src/core/blocks/degradation-blocks'
import { PatternExtractor } from '../../src/core/projection/pattern-extractor'
import { registerCppExtractStrategies } from '../../src/languages/cpp/extractors/extract-strategies'
import apcs from '../../src/languages/cpp/styles/apcs.json'
import type { SemanticNode, StylePreset } from '../../src/core/types'

import { staleShapeIn, SHAPE_CHANGES_V23 } from '../../src/migrations/block-shape-changes'

/**
 * **從語料蒸餾出來的形狀**，不是抄一整支——
 * `STUDYCPP_DIR` 沒設時那些探針會跳過，而**跳過的護欄與不存在的護欄長得一樣**。
 */
const SHAPES: readonly [string, string][] = [
  // ── 語料真的有的（3 支全部落在這幾種裡）──
  ['語料：宣告（AP325/3/3_11）', '  bitset<200007> seen;'],
  ['語料：索引讀（AP325/3/3_11）', '  cout << bs[3];'],
  ['語料：索引寫（AP325/3/3_11）', '  bs[3] = 1;'],
  ['語料：整排歸零（tioj/25_toj126）', '  bs.reset();'],
  ['語料：整排位移合成（tioj/25_toj126）', '  bs = bs >> n | (bs << n);'],
  ['語料：一陣列的 bitset（AP325/2/2_7_TLE）', '  bitset<26> rows[3];'],
  ['語料：兩層索引寫（AP325/2/2_7_TLE）', '  d1[1][2] = 1;'],
  ['語料：互斥或（AP325/2/2_7_TLE）', '  bs2 = d1[0] ^ d1[1];'],
  ['語料：數 1 的個數（AP325/2/2_7_TLE）', '  cout << bs2.count();'],
  // ── 同一顆身分的另外兩個值（語料 0 處，而積木做得出來）──
  ['整排：設為 1', '  bs.set();'],
  ['整排：反轉', '  bs.flip();'],
  ['某一格：設為 1', '  bs.set(3);'],
  ['某一格：歸零', '  bs.reset(3);'],
  // ── 帶初始值的宣告 ──
  ['宣告帶初始值', '  bitset<8> b3 = bs2;'],
  // ── ★ 正向錨點：既有的寫法不得被弄壞 ──
  ['★ 內建的數 1 照舊', '  cout << __builtin_popcount(n);'],
  ['★ 一般陣列照舊', '  int a[3] = {1, 2, 3};'],
]

const wrap = (body: string): string =>
  '#include <bits/stdc++.h>\nusing namespace std;\n'
  + 'int main() {\n  int n = 5;\n  bitset<200007> bs;\n  bitset<26> bs2;\n  bitset<26> d1[3];\n'
  + `${body}\n  return 0;\n}\n`

const S = apcs as unknown as StylePreset

let parser: Parser
let blockExtractor: PatternExtractor

beforeAll(async () => {
  await Parser.init({ locateFile: (f: string) => `${process.cwd()}/public/${f}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  registerCppLanguage()

  registerFieldMultilineInput()
  registerDynamicDropdownField()
  // ⚠️ **產品宣告哪些，這裡就要宣告哪些**——少一個的症狀是「每一支都紅」，
  //    而那是護欄壞了，不是產品壞了。
  for (const k of ['names', 'vars', 'funcs', 'arrays',
    'cpp_var_types', 'cpp_param_types', 'cpp_return_types', 'python_types']) {
    declareDropdownSource(k, () => [])
  }
  const reg = new BlockSpecRegistry()
  reg.loadFromSplit(allComponentDefs(), allCppProjections())
  const ws = new Blockly.Workspace()
  Object.assign(Blockly.Msg as Record<string, string>, i18nBlocks, componentLabels('zh-TW'))
  const { BlockRegistrar } = await import('../../src/ui/block-registrar')
  new BlockRegistrar(reg).registerAll({ getWorkspace: () => ws })
  const rsr = new RenderStrategyRegistry()
  registerCppRenderStrategies(rsr)
  const renderer = new PatternRenderer()
  renderer.setRenderStrategyRegistry(rsr)
  renderer.loadBlockSpecs(reg.getAll())
  setPatternRenderer(renderer)
  setDegradationLanguage('cpp')
  blockExtractor = new PatternExtractor()
  blockExtractor.loadBlockSpecs(reg.getAll())
  registerCppExtractStrategies(blockExtractor)
}, 180_000)

const lift = (src: string): SemanticNode =>
  createTestLifter().lift(parser.parse(src)!.rootNode as never) as SemanticNode
const squash = (x: string): string => x.replace(/\s+/g, '')
const ids = (n: SemanticNode, out: string[] = []): string[] => {
  out.push(n.componentId)
  for (const ks of Object.values(n.slots ?? {})) for (const k of ks) ids(k, out)
  return out
}
/**
 * 只留下這一段自己那幾行——骨架的宣告不比。
 * ⚠️ **不照原文過濾**（範圍那一族踩過，18 支全紅）：走一趟積木回來之後
 *    `set<int> st{1,2,3}, s{4,5};` 會被攤成兩顆積木，而那是對的。
 * > **當一個新的檢查連【正向錨點】都紅的時候，先懷疑那個檢查。**
 */
const SCAFFOLD = /^(#include|using namespace|int main)|^\}$|^return 0;$|^int n = 5;$|^bitset<(200007|26)> (bs|bs2|d1\[3\]);$/
const meat = (code: string): string =>
  code.split('\n').map((l) => l.trim()).filter((l) => l && !SCAFFOLD.test(l)).join(' ')


function chainOf(b0: unknown): SemanticNode[] {
  const acc: SemanticNode[] = []
  let cur = b0 as { next?: { block: unknown } } | undefined
  while (cur) {
    const n = blockExtractor.extract(cur as never)
    if (n) acc.push(n)
    cur = (cur.next?.block ?? undefined) as typeof cur
  }
  return acc
}
/** 走一趟積木回來，拿到那一段的語義節點。 */
const throughBlocks = (body: string): SemanticNode[] => {
  const { blockMappings: _drop, ...state } = renderToBlocklyState(lift(wrap(body)))
  return (state.blocks.blocks as unknown[]).flatMap(chainOf)
}
/** 從一串節點裡挖出某個身分的全部。 */
const pick = (ns: SemanticNode[], id: string): SemanticNode[] => {
  const out: SemanticNode[] = []
  const dig = (n: SemanticNode): void => {
    if (n.componentId === id) out.push(n)
    for (const ks of Object.values(n.slots ?? {})) for (const k of ks) dig(k)
  }
  ns.forEach(dig)
  return out
}

describe('一排位元：四個面向', () => {
  it('★ 入口條件——這條路真的跑得動（否則下面每一條都在驗空氣）', () => {
    const got = ids(lift(wrap('  bitset<8> z; z.reset(); cout << z.count();')))
    expect(got).toContain('cpp:bits_declare')
    expect(got).toContain('cpp:bits_fill')
    expect(got).toContain('cpp:bits_count')
    expect(got).not.toContain('cpp:raw_code')
  })

  describe('① 產出的程式碼：lift → 產碼，一字不差', () => {
    it.each(SHAPES)('%s', (_name, body) => {
      const out = meat(generateCode(lift(wrap(body)), 'cpp', S))
      expect(squash(out), '🔴 產出的程式碼變了').toBe(squash(body))
    })
  })

  describe('② 語義的不動點：再 lift 一次還是同一棵', () => {
    it.each(SHAPES)('%s', (_name, body) => {
      const once = generateCode(lift(wrap(body)), 'cpp', S)
      expect(generateCode(lift(once), 'cpp', S), '🔴 來回一趟就走樣了').toBe(once)
    })
  })

  describe('③ 載得進工作區（紅了是一片空白，不是少一行）', () => {
    it.each(SHAPES)('%s', (_name, body) => {
      const { blockMappings: _drop, ...state } = renderToBlocklyState(lift(wrap(body)))
      const ws = new Blockly.Workspace()
      let err: string | null = null
      try { Blockly.serialization.workspaces.load(state, ws) }
      catch (e) { err = e instanceof Error ? e.message : String(e) }
      finally { ws.dispose() }
      expect(err, '🔴 載不進去——使用者看到的不是少一行，是一片空白').toBeNull()
    })
  })

  describe('④ 走一趟積木回來（紅了是學生一動積木程式就變了）', () => {
    it.each(SHAPES)('%s', (_name, body) => {
      const { blockMappings: _drop, ...state } = renderToBlocklyState(lift(wrap(body)))
      const backs = (state.blocks.blocks as unknown[]).flatMap(chainOf)
      const rebuilt = { componentId: 'cpp:program', properties: {}, slots: { body: backs } } as SemanticNode
      expect(
        squash(meat(generateCode(rebuilt, 'cpp', S))),
        '🔴 走一趟積木之後那一段變了——**學生一動積木，他的程式就變了**。',
      ).toBe(squash(body))
    })

    /**
     * 🔴 **三格單獨再釘一次**——上面那一族比的是整段文字，
     * 而**文字相同不代表那一格是從積木上讀回來的**（它可能被預設值補回去）。
     */
    it('🔴 `METHOD` 走一趟回來不得掉（掉了 set() 會變成 reset()，而碼仍然合法）', () => {
      for (const m of ['reset', 'set', 'flip'] as const) {
        const backs = throughBlocks(`  bs.${m}();`)
        const found = pick(backs, 'cpp:bits_fill')
        expect(found.length, `🔴 ${m} 那一顆整個掉了`).toBe(1)
        expect(found[0].properties.method, `🔴 ${m} 走一趟回來變成別的`).toBe(m)
      }
    })

    it('🔴 寫法那一格走一趟回來不得掉（掉了 bs.count() 會變成一段編不過的碼）', () => {
      for (const [body, written] of [
        ['  cout << bs2.count();', 'count'],
        ['  cout << __builtin_popcount(n);', '__builtin_popcount'],
      ] as const) {
        const found = pick(throughBlocks(body), 'cpp:bits_count')
        expect(found.length, `🔴 ${written} 那一顆整個掉了`).toBe(1)
        expect(found[0].properties.method, `🔴 ${written} 走一趟回來變成別的`).toBe(written)
      }
    })

    /**
     * 🔴 **把 `POS` 拔掉——不得產出 `set(0)`。**（2026-09-20 瀏覽器驗收量到，補成常駐）
     *
     * 上面那幾條測的是「插槽本來就是空的」。這一條測的是**使用者把它拔掉**，
     * 而兩者在資料上長得一樣、在**缺陷上不一樣**：
     *
     * ```
     * 積木           程式碼        意思
     * 第 3 格 設為 1  bs.set(3)    只把第 3 格設成 1
     * 第 ▢ 格 設為 1  bs.set()     🟢 整排設成 1
     * 第 ▢ 格 設為 1  bs.set(0)    🔴 只把第 0 格設成 1——**碼仍然合法，而它做的是別的事**
     * ```
     *
     * ⚠️ 判準是「拔掉之後**產出的碼**」，不是「屬性還在不在」——
     * 一個把空插槽補成預設 `0` 的產生器，屬性那一側是看不出來的。
     */
    it('🔴 把 `POS` 拔掉要變回 `set()`——不得產出 `set(0)`', () => {
      /** 把整棵 Blockly 狀態裡某個具名接點拔掉——**使用者拖走那顆積木的樣子**。 */
      const unplug = (node: unknown, input: string): void => {
        const b = node as { inputs?: Record<string, unknown>; next?: { block: unknown } }
        if (b?.inputs) {
          delete b.inputs[input]
          for (const v of Object.values(b.inputs)) unplug((v as { block?: unknown }).block, input)
        }
        if (b?.next?.block) unplug(b.next.block, input)
      }
      const { blockMappings: _drop, ...state } = renderToBlocklyState(lift(wrap('  bs.set(3);')))
      const tops = state.blocks.blocks as unknown[]
      // ★ 正向錨點：拔之前它真的是 `set(3)`，否則下面量到的是「本來就沒接」
      const before = { componentId: 'cpp:program', properties: {}, slots: { body: tops.flatMap(chainOf) } } as SemanticNode
      expect(squash(meat(generateCode(before, 'cpp', S))), '🔴 拔之前就不是 set(3)——這條在驗空氣').toBe('bs.set(3);')

      tops.forEach((t) => unplug(t, 'POS'))
      const after = { componentId: 'cpp:program', properties: {}, slots: { body: tops.flatMap(chainOf) } } as SemanticNode
      const out = squash(meat(generateCode(after, 'cpp', S)))
      expect(out, '🔴 拔掉那一格之後產出 set(0)——碼仍然合法，而它做的是別的事').not.toBe('bs.set(0);')
      expect(out, '🔴 拔掉那一格之後不是 set()').toBe('bs.set();')
    })

    /**
     * 🔴 **`SOURCE` 是常態留空的，而【空的】與【掉了】長得一樣**——兩種都要測。
     */
    it('🔴 `SIZE` 與 `SOURCE` 兩個接點走一趟回來不得掉', () => {
      /** ⚠️ 骨架自己宣告了三排位元——**只看這一段自己那一顆**，否則量到的是骨架。 */
      const mine = (ns: SemanticNode[], nm: string): SemanticNode[] =>
        pick(ns, 'cpp:bits_declare').filter((n) => n.properties.name === nm)
      const withSrc = mine(throughBlocks('  bitset<8> b3 = bs2;'), 'b3')
      expect(withSrc.length).toBe(1)
      expect(withSrc[0].slots.size?.length, '🔴 大小掉了').toBe(1)
      expect(withSrc[0].slots.source?.length, '🔴 初始值掉了').toBe(1)

      const noSrc = mine(throughBlocks('  bitset<8> b4;'), 'b4')
      expect(noSrc.length).toBe(1)
      expect(noSrc[0].slots.size?.length, '🔴 大小掉了').toBe(1)
      expect(noSrc[0].slots.source?.length ?? 0, '🔴 空的初始值不得憑空長出東西').toBe(0)
    })
  })
})

/**
 * **舊存檔打不打得開**——`cpp_bits_count` 的插槽從 `VALUE` 改名成 `OBJ`。
 *
 * 🔴 **這一段是這一關最值錢的東西**：第一版寫的是
 * `SHAPE_CHANGES_V23 { retiredFields: ['VALUE'] }`，而 `VALUE` 是一個
 * `input_value` **不是** 一個 field——`staleShapeIn` 只讀 `n.fields`／`n.extraState`，
 * 於是那一筆**完全不會命中**，而舊存檔裡接在 `VALUE` 的積木會安靜地消失。
 */
describe('舊存檔：插槽改名之後還打得開嗎', () => {
  const oldSave = {
    blocks: {
      languageVersion: 0,
      blocks: [{
        type: 'cpp_bits_count',
        inputs: { VALUE: { block: { type: 'cpp_literal_number', fields: { VALUE: '7' } } } },
      }],
    },
  }

  it('🔴 舊形狀要被認出來（認不出來 → 那顆積木安靜地消失）', () => {
    expect(
      staleShapeIn(oldSave, SHAPE_CHANGES_V23),
      '🔴 沒認出來——而 `retiredFields` 看不見接點的名字，那是一整類的缺口',
    ).not.toBeNull()
  })

  it('★ 新形狀不得被誤判（誤判的話每次開檔都丟一次快取）', () => {
    const newSave = {
      blocks: {
        languageVersion: 0,
        blocks: [{
          type: 'cpp_bits_count',
          fields: { FORM: 'builtin' },
          inputs: { OBJ: { block: { type: 'cpp_literal_number', fields: { VALUE: '7' } } } },
        }],
      },
    }
    expect(staleShapeIn(newSave, SHAPE_CHANGES_V23)).toBeNull()
  })

  it('★ 別的積木身上有 `VALUE` 接點不得被掃到（合取：型別 ＋ 那個名字）', () => {
    const other = {
      blocks: {
        languageVersion: 0,
        blocks: [{ type: 'cpp_print', inputs: { VALUE: { block: { type: 'cpp_literal_number' } } } }],
      },
    }
    expect(staleShapeIn(other, SHAPE_CHANGES_V23)).toBeNull()
  })
})

/**
 * **多餘的括號會被收掉，而那是【正規化】不是走樣。**
 *
 * 語料寫 `bs = (bs >> x | bs << x);`，而產出是 `bs = bs >> x | (bs << x);`
 * ——外層那對括號是多餘的（指定式的右邊本來就整段），而內層那對是**必要的**。
 *
 * ⚠️ 判準的第三層：**文字不同 ≠ 錯，行為不同才是**（`CLAUDE.md` 逐字）。
 * 🔴 **而它必須被釘住而不是被略過**：正規化與走樣的差別只在
 * 「收掉的是不是多餘的那一對」。
 */
describe('一排位元：括號的正規化', () => {
  const NORMALISED: readonly [string, string, string][] = [
    ['語料原文的位移合成', '  bs = (bs >> n | bs << n);', 'bs=(bs>>n|(bs<<n));'],
    ['語料原文的互斥或', '  bs2 = (d1[0] ^ d1[1]);', 'bs2=(d1[0]^d1[1]);'],
  ]
  it.each(NORMALISED)('%s', (_name, body, expected) => {
    const once = generateCode(lift(wrap(body)), 'cpp', S)
    expect(squash(meat(once)), '🔴 正規化的落點變了').toBe(squash(expected))
    expect(generateCode(lift(once), 'cpp', S), '🔴 正規化之後又走樣＝那個落點不合法').toBe(once)
  })

  /**
   * 🔴 **而位移【放進 `cout <<`】時那對括號是必要的**——這一條是這一關抓到的缺陷。
   *
   * ```
   * 寫的               走一趟積木回來（修之前）   後果
   * cout << (n << 1);  cout << n << 1;          印 51 而不是 10
   * ```
   *
   * `<<` 與串流的 `<<` 同一個優先級而左結合，所以那個位移會**整個消失**。
   * ⚠️ 程式碼那一路一直是對的（括號由 `layoutHints` 帶），而**積木上沒有 metadata**
   * ——與第 197 刀那三顆一元運算子是**同一個病的第四次**。
   */
  it('🔴 `cout << (n << 1)` 走一趟積木回來，那對括號不得掉', () => {
    const backs = throughBlocks('  cout << ((n << 1));')
    const rebuilt = { componentId: 'cpp:program', properties: {}, slots: { body: backs } } as SemanticNode
    const out = squash(meat(generateCode(rebuilt, 'cpp', S)))
    expect(out, '🔴 括號掉了——那不是排版，是它印出別的東西').toContain('(n<<1)')
    expect(out, '🔴 位移變成了兩次串流插入').not.toBe('cout<<n<<1;')
  })
})

/**
 * 🟠 **`cout <<` 的雙層括號——一個既有的排版疣，量出來記下來，不修。**
 *
 * ```
 * 寫的                 產出                走一趟積木回來
 * cout << (n & 1);     cout << ((n & 1));  cout << (n & 1);
 * ```
 *
 * 兩對括號各有來源：`needsParensInCout` 加一對（因為 `&` 的優先級低於 `<<`），
 * 而 `layoutHints` 把使用者原本那一對也帶回來。走一趟積木之後
 * metadata 沒了，於是**剩下正確的那一對**。
 *
 * 🟢 **三者都合法、都同義、而且都是不動點**——照判準第三層
 *（「文字不同 ≠ 錯，行為不同才是」）這不是缺陷。
 *
 * **為什麼不是現在**：要修的是「排版提示與優先級規則各自加一次括號」，
 * 而那要動共用的產生器——**語料今天走樣 0，動它的風險大於這個排版疣**。
 * **何時該修**：下一次有人碰 `cout <<` 的排版。
 */
describe('🟠 `cout <<` 的雙層括號（既有排版疣，不是缺陷）', () => {
  it('產出多一對，走一趟積木之後剩正確的那一對——而三者都是不動點', () => {
    const body = '  cout << (n & 1);'
    const once = generateCode(lift(wrap(body)), 'cpp', S)
    expect(squash(meat(once)), '🔴 排版疣的落點變了').toBe('cout<<((n&1));')
    expect(generateCode(lift(once), 'cpp', S), '🔴 不動點破了').toBe(once)

    const backs = throughBlocks(body)
    const rebuilt = { componentId: 'cpp:program', properties: {}, slots: { body: backs } } as SemanticNode
    expect(squash(meat(generateCode(rebuilt, 'cpp', S))), '🔴 走一趟積木之後連必要的那一對都掉了')
      .toBe('cout<<(n&1);')
  })
})
