/**
 * **第七十三條護欄**：一顆會【寫入】的元件，它的左值必須**被結構表達**。
 *
 * ## 判準（2026-08-26 使用者拍板改寫，見 `history/157`）
 *
 * ```
 * 舊   左值【必須是接點】
 * 新   左值【必須被結構表達】
 * ```
 *
 * 舊的那句話把**一種特定的表達方式**當成了規範本身。而兩格合起來
 * **也是結構**：`cpp:array_assign` 的 `obj: 'a'`（一個真的原子）＋ `index` 接點，
 * 完整表達了 `a[i]`，一個字都沒有被壓扁。
 *
 * > **一條規範如果只認得一種形狀，它會把「另一種同樣誠實的形狀」判成缺陷。**
 *
 * 所以這條護欄量的是**性質**，不是形狀：
 *
 * > **左值的任何一格，都不得裝著一段【要 parse 回結構才能用】的文字。**
 *
 * ## 🔴 而它必須是【主動探測】，不能讀宣告
 *
 * 改寫前這條護欄讀 `traits.writesTo` 指到 `children` 還是 `properties`。
 * 那對新判準沒有用——`kind: 'identifier'` 只是一句**主張**：
 * `cpp:var_assign.obj` 曾經宣告成 identifier 而語料上裝著 `r.x`。
 *
 * 拍板當天餵合成樣本，兩顆**當場漏**：
 *
 * ```
 * *(p + 1) = 1     →  cpp:pointer_assign { obj: "(p + 1)" }
 * obj.arr[i] = 1   →  cpp:array_assign   { obj: "obj.arr" }
 * ```
 *
 * ⚠️ **第七十二條看不到它們**——它讀的是撿來的語料，而語料裡沒有那兩種寫法
 * （它自己的基線寫著：「語料乾淨不代表模型對」）。
 *
 * > **「這一格是原子」是一句主張，而主張要有人去試著推翻它。**
 *
 * ## 🔴 自我否證
 *
 * > **如果「★ 注入①」那一段裡，一個裝著 `(p + 1)` 的【合成】屬性
 * > 沒有被判成非原子，代表判定函式壞了，不是世界長這樣。**
 *
 * ⚠️ 入口條件錨在**探測樣本數**（合成量）——它不會因為缺陷被修好而變小。
 * 🔴 **不錨在「lift 出幾顆寫入節點」**：那個數字包含缺陷，是
 * `build-guardrail` 簽名三說的「一個比較慢爛的錨」。
 *
 * ## 硬性零還是棘輪
 *
 * ```
 * 留一筆規範還成立嗎？   ❌ 「左值不得裝文法」留一個例外就是假的
 * 修一筆要付多少？       🟡 **便宜**——今天四筆的修法都是
 *                        「加一條 constraint」或「把一格換成接點」
 * 別台機器一樣嗎？       ✅ 純解析，不碰外部工具
 * ```
 * → **硬性零。**（`build-guardrail` §6.8）
 *
 * ⚠️ 改寫前它是棘輪（12），而那是因為舊判準把四顆**誠實的**複合元件也算進去。
 * 換判準之後真正的違規只有四筆，當天全部修掉。
 * 🔴 而**「先判硬性零、動手後才發現修不動，是可以的」**——那時把它改回棘輪
 * 並記下原因，比硬撐著把一筆很貴的修完再說。
 *
 * ## 本護欄不檢測什麼
 *
 * - ❌ **只探測 C++**。Python 那側的左值由第七十二條與各膠囊自證測管。
 * - ❌ **只看得到宣告了 `traits.writesTo` 的元件**。一顆會寫入而沒宣告的，
 *   對它不存在——所以另有一欄「疑似漏宣告」用名字當網子撈，**那是網子不是機制**。
 * - ❌ **不管「綁定一個新名字」**（`for (int x : v)` 的 x、參數名、宣告的名字）
 *   ——那些的文法**只允許識別字**，字串是對的，而它們刻意不宣告 `writesTo`。
 * - ❌ **不檢測執行期**：一顆結構表達得好而執行器只認一種形狀的元件，
 *   在這裡是綠的。那一半的判準在「左值解析器是扣除式的」。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import { registeredComponents } from '../../src/core/component/registry'
import type { SemanticNode } from '../../src/core/types'
import {
  loadBaseline, writeBaseline, printReport, assertRatchet, assertCorpus, RATCHET_NOTE,
} from '../helpers/guardrail'

const GUARD = 'lvalue-structure'

/**
 * **一個原子**：一個識別字、一個數字、或一個運算子記號。
 *
 * ⚠️ 與第七十二條同一個判準，刻意重複——兩條護欄量的東西不同
 * （那條讀撿來的語料，這條餵合成的），而**共用一個判定函式會讓
 * 「兩條獨立的證據」變成一條**。
 */
export const ATOM = /^(?:[A-Za-z_]\w*|-?\d+(?:\.\d+)?|)$/

/**
 * **探測樣本**——刻意合成的左值，涵蓋每一種形狀**與它們的巢狀組合**。
 *
 * 🔴 **組合那幾行才是重點**：單層的每一種今天都過得了，
 * 而 `obj.arr[i]`／`*(p + 1)` 是「一格裝得下文法」的證據。
 */
export const LVALUE_PROBES: readonly string[] = [
  // 單層
  'i = 1;', 'a[i] = 1;', 'a[i][j] = 1;', 'o.x = 1;', 'p->x = 1;', '*q = 1;',
  // 巢狀組合——⚠️ 這幾行是這條護欄的理由
  'obj.arr[i] = 1;', '*(p + 1) = 1;', 'a[f(i)] = 1;', 'v[i].x = 1;', '(*p).x = 1;',
  'obj.arr[i][j] = 1;', 'm[k].y = 1;',
  // 複合指定與遞增走同一條路
  'obj.arr[i] += 1;', '*(p + 1) += 1;', 'obj.arr[i]++;', '*(p + 1)++;',
  // 讀進去的那一格也是左值
  'cin >> obj.arr[i];', 'getline(cin, obj.name);',
]

const PRELUDE = 'struct P { int x; int y; int arr[3]; char name[8]; };\n'
  + 'int a[3][3]; int i, j, k; P o; P* p; int* q; P v[3]; P m[3]; P obj;\n'
  + 'int f(int z) { return z; }\n'

export interface Leak { componentId: string; prop: string; value: string; probe: string }

/**
 * **左值的「基底名字」那幾格**——只有這些要是原子。
 *
 * 🔴 為什麼不是「所有屬性」：左值裡面**包得住 rvalue**。
 * `m["hello world"] = 1` 的索引是一個字串常值，它的 `value` 本來就不是原子
 * ——把它算進來會讓這條護欄報一個**正確的**東西。
 *
 * > **一個左值裡面裝著一個運算式，是正常的；
 * > 一個左值的【名字那一格】裝著一個運算式，才是病。**
 */
const NAME_PROPS = new Set(['obj', 'name', 'member'])

/**
 * 一個**左值區域**裡，有沒有哪一格的名字裝著非原子的值。
 *
 * 左值區域 = 這顆寫入節點自己 ＋ 它底下的每一顆，**但不含 `value` 插槽**
 * （那是被寫進去的東西，不是左值）。
 *
 * ⚠️ 這個定義是刻意的：`cin >> obj.arr[i]` 的目標是一個接點（✓），
 * 而**接點裡那顆 `cpp:array_at` 自己的 `obj` 裝著 `"obj.arr"`**
 * ——只看最外層的話這條護欄看不到它。
 */
export function leaksIn(
  node: SemanticNode, writers: ReadonlySet<string>, probe: string, out: Leak[] = [],
  insideLvalue = false,
): Leak[] {
  const isWriter = writers.has(node.componentId)
  const inRegion = isWriter || insideLvalue
  if (inRegion) {
    for (const [prop, v] of Object.entries(node.properties ?? {})) {
      if (typeof v !== 'string' || !NAME_PROPS.has(prop)) continue
      if (!ATOM.test(v)) out.push({ componentId: node.componentId, prop, value: v, probe })
    }
  }
  for (const [slot, kids] of Object.entries(node.children ?? {})) {
    // 🔴 `value` 是**被寫進去的東西**，不是左值——它底下的非原子是正常的。
    const nextInside = inRegion && slot !== 'value'
    for (const c of kids as SemanticNode[]) leaksIn(c, writers, probe, out, nextInside)
  }
  return out
}

/** 名字當網子——**撈的是「可能忘了宣告的」，不是判定機制**。 */
const NET = /(?:^|[:_])(?:var_)?(?:assign|increment|decrement)/

let parser: Parser

beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
}, 60_000)

describe('第七十三條護欄：左值必須被結構表達', () => {
  it('★ 注入①：一個裝著 `(p + 1)` 的合成屬性，必須被判成非原子', () => {
    const fake = {
      componentId: 'synthetic:assign_probe',
      properties: { obj: '(p + 1)' },
      children: {},
    } as unknown as SemanticNode
    const hits = leaksIn(fake, new Set(['synthetic:assign_probe']), 'synthetic')
    expect(hits.length, '🔴 判定函式連合成輸入都認不出來').toBe(1)
    expect(hits[0].value).toBe('(p + 1)')
  })

  it('★ 注入②：一個真的原子不得被亂報', () => {
    const ok = {
      componentId: 'synthetic:assign_ok',
      properties: { obj: 'arr', operator: '+=' },
      children: {},
    } as unknown as SemanticNode
    expect(leaksIn(ok, new Set(['synthetic:assign_ok']), 'synthetic'),
      '🔴 這條護欄會把正確的宣告罵一頓').toEqual([])
  })

  it('🔴 注入③：沒有宣告 `writesTo` 的元件不看——那是第七十二條的地盤', () => {
    const other = {
      componentId: 'synthetic:not_a_writer',
      properties: { obj: 'a.b.c' },
      children: {},
    } as unknown as SemanticNode
    expect(leaksIn(other, new Set(['synthetic:assign_ok']), 'synthetic')).toEqual([])
  })

  it('🔴 注入④：巢狀在接點裡的寫入節點也要找得到', () => {
    const nested = {
      componentId: 'synthetic:block',
      properties: {},
      children: { body: [{ componentId: 'w', properties: { obj: 'o.x' }, children: {} }] },
    } as unknown as SemanticNode
    expect(leaksIn(nested, new Set(['w']), 'synthetic').length).toBe(1)
  })

  it('🔴 注入⑤：左值【接點裡面】那一層也要看——只看最外層會漏掉它', () => {
    const w = {
      componentId: 'synthetic:writer',
      properties: {},
      children: { target: [{ componentId: 'inner', properties: { obj: 'obj.arr' }, children: {} }] },
    } as unknown as SemanticNode
    const hits = leaksIn(w, new Set(['synthetic:writer']), 'synthetic')
    expect(hits.length, '🔴 只看最外層 → `cin >> obj.arr[i]` 這一族全部漏掉').toBe(1)
    expect(hits[0].componentId).toBe('inner')
  })

  it('🔴 注入⑥：`value` 插槽底下的非原子是**正常的**，不得誤報', () => {
    const w = {
      componentId: 'synthetic:writer',
      properties: {},
      children: {
        target: [{ componentId: 'inner', properties: { obj: 'a' }, children: {} }],
        value: [{ componentId: 'lit', properties: { name: 'hello world' }, children: {} }],
      },
    } as unknown as SemanticNode
    expect(leaksIn(w, new Set(['synthetic:writer']), 'synthetic'),
      '🔴 把被寫進去的東西也算進左值 → 這條護欄會報一個正確的東西').toEqual([])
  })

  it('棘輪：左值的一格裝著文法的，只准下降', () => {
    const all = registeredComponents()
    const writers = new Set(
      all.filter((c) => typeof (c.manifest as { traits?: { writesTo?: string } })
        .traits?.writesTo === 'string').map((c) => c.componentId),
    )
    const declared = writers
    const missing = all.map((c) => c.componentId).filter((id) => NET.test(id) && !declared.has(id))

    const lifter = createTestLifter()
    const leaks: Leak[] = []
    let lifted = 0
    for (const probe of LVALUE_PROBES) {
      const tree = parser.parse(`${PRELUDE}int main() { ${probe} }`)
      if (!tree) continue
      const sem = lifter.lift(tree.rootNode as never) as SemanticNode | null
      if (!sem) continue
      lifted += 1
      leaksIn(sem, writers, probe, leaks)
    }
    // 同一顆元件的同一格只算一次——報表要指名元件，不是指名樣本
    const byKey = new Map<string, Leak>()
    for (const l of leaks) byKey.set(`${l.componentId}.${l.prop}`, l)
    const hits = [...byKey.values()].sort((x, y) => `${x.componentId}.${x.prop}`.localeCompare(`${y.componentId}.${y.prop}`))

    // ⚠️ 報表印在 `loadBaseline` 之前——否則第一次跑會在**指名之前**就拋。
    printReport('左值被結構表達了嗎', [
      `探測樣本 ${LVALUE_PROBES.length} 段｜lift 成功 ${lifted} 段｜宣告了 writesTo 的 ${writers.size} 顆`,
      `🔴 一格裝著文法的 ${hits.length} 筆`,
      '',
      ...hits.map((h) => `  🔴 ${`${h.componentId}.${h.prop}`.padEnd(30)} = ${JSON.stringify(h.value)}   ← ${h.probe}`),
      '',
      `⚠️ 疑似漏宣告 ${missing.length} 筆（名字像賦值而沒有 writesTo）——**網子不是機制**：`,
      ...missing.map((id) => `     ${id}`),
      '',
      '判準：**左值的任何一格，都不得裝著一段要 parse 回結構才能用的文字。**',
      '⚠️ 兩格合起來也是結構——`obj: "a"` ＋ `index` 接點完整表達了 `a[i]`。',
    ])

    if (process.env.GENERATE_BASELINE) {
      writeBaseline(GUARD, {
        _meta: {
          note: '一顆會寫入的元件，它的左值必須被**結構表達**。\n'
            + '🔴 2026-08-26 使用者拍板改寫判準（見 history/157）：舊的那句是「必須是接點」，\n'
            + '   而那把一種特定的形狀當成了規範本身——`obj + index` 兩格合起來也是結構。\n'
            + '🔴 而它因此從【讀宣告】改成【主動探測】：`kind: identifier` 只是一句主張。\n'
            + '⚠️ 「疑似漏宣告」只是名字網子，不是判定機制——它是要有人去看的。',
          ratchet: RATCHET_NOTE,
        },
        '探測樣本數': LVALUE_PROBES.length,
        '一格裝著文法': hits.length,
        '疑似漏宣告': missing.length,
        details: hits.map((h) => `${h.componentId}.${h.prop}`),
      })
      return
    }
    void loadBaseline(GUARD)
    // 🔴 入口條件錨在**探測樣本數**——它不會因為缺陷被修好而變小。
    assertCorpus([['探測樣本數', LVALUE_PROBES.length]], GUARD)
    // ★ 而樣本要真的走完 lift，否則上面量的是一堆空樹
    expect(lifted, '🔴 一段都沒 lift 起來 → 這條護欄什麼都沒量到').toBe(LVALUE_PROBES.length)
    // 🔴 **硬性零**——留一筆，「左值不得裝文法」這句話就是假的。
    expect(
      hits.map((h) => `${h.componentId}.${h.prop} = ${JSON.stringify(h.value)}   ← ${h.probe}`),
      '🔴 左值的一格裝著一段要 parse 回結構才能用的文字。\n'
        + '   修法有兩種，而**都不是「把它塞進去」**：\n'
        + '   ① 那一格換成接點（見 `cpp:array_at` 2026-08-26）\n'
        + '   ② 複合元件加一條 constraint，讓不合的形狀落到組合形式\n'
        + '     （見 `cpp:pointer_assign` 的 `identifier` 判別）',
    ).toEqual([])
    assertRatchet([['疑似漏宣告', missing.length]], GUARD)
  }, 60_000)
})
