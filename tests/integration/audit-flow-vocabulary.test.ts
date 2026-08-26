/**
 * **第七十八條護欄**：流程視圖上不得出現內部詞彙。
 *
 * ## 它從哪來
 *
 * 2026-08-26 使用者看著流程面板說「**上面的名稱要設計過**」。而畫面上是：
 *
 * ```
 * func_def      name: main    return_type: int
 * include       header: iostream
 * loop_count    from  to  inclusive: FALSE   var_name: i   body
 * ```
 *
 * 四處洩漏，而它們的來源都在 `core/flow/node-graph.ts`：
 *
 * ```
 * :178  title  = componentId 的後半段          → `func_def`
 * :120  fields = 宣告的 properties 的【原始鍵】 → `header:`／`inclusive:`
 * :120  fields 的【原始值】                     → `FALSE`（那是下拉的 value，不是顯示文字）
 * :146  接點的 label = 插槽的【原始名】          → `body`／`initializer`
 * ```
 *
 * 而 `principles.md:126` 逐字：
 *
 * > **使用者看得到的所有文字都是介面**，包含 mutator 彈窗內的 label
 *
 * ⚠️ **`FALSE` 比其他三個更糟**：它不只是內部詞彙，它是**下拉的 value**
 * ——而同一格在積木上顯示的是「到（不含）」。**同一個真實，兩個投影說不同的話。**
 *
 * ## 兩個數字，而它們回答不同的問題
 *
 * ```
 * 硬性零   內部詞彙有沒有上畫面        —— 這是原則，留一筆就是假的
 * 棘輪     還有幾顆【沒有設計過名字】   —— 這是進度，507 條文案寫不完在一刀裡
 * ```
 *
 * 🔴 **兩個分開，因為它們的修法不同**：前者靠**退路**（退到積木的整句話，
 * 那仍然是介面文字），後者靠**逐顆寫**。
 * 混成一個數字的話，「補一條退路」會看起來像「設計了 332 個名字」。
 *
 * ## ⚠️ 自我否證聲明
 *
 * > **如果「建出來的節點數」是 0，代表這支沒有真的把樹轉成圖，
 * > 這份報表不算數——不是「詞彙乾淨了」。**
 *
 * 錨在**這支自己造的合成樹產出幾個節點**上：它不隨任何缺陷被修好而變小。
 * 🔴 **刻意不錨在「還有幾處洩漏」**——那正是要推向零的。
 *
 * ## 這支不檢測什麼
 *
 * - **不檢測名字取得好不好**——「定義函式」與「函式定義」哪個好沒有機械判準。
 *   它只檢測**那個字是不是內部詞彙**。
 * - **不檢測值的正確性**——只檢測「下拉的值有沒有換成它的顯示文字」。
 * - **不檢測版面**（接點位置、連線）——那是別的事。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { buildNodeGraph } from '../../src/core/flow/node-graph'
import { allComponentDefs } from '../helpers/component-scan'
import { BlockSpecRegistry } from '../../src/core/block-spec-registry'
import { allCppComponents, allCppProjections } from '../../src/languages/cpp/all-declarations'
import type { SemanticNode } from '../../src/core/types'
import { designedTitle, labelSourceFromSpecs, type FlowLabelSource } from '../../src/core/flow/vocabulary'
import { printReport, assertRatchet, writeBaseline } from '../helpers/guardrail'

const GUARD = 'flow-vocabulary'

beforeAll(() => registerCppLanguage())

/** 合成**每一顆元件各一個節點**——⚠️ 不是真實語料，是為了掃遍詞彙。 */
function everyComponentNode(): SemanticNode[] {
  return allComponentDefs()
    .filter((d) => d.componentId.startsWith('cpp:'))
    .map((d, i) => {
      const properties: Record<string, unknown> = {}
      for (const p of d.properties ?? []) properties[p.name] = p.default ?? 'v'
      return { id: `n${i}`, componentId: d.componentId, properties, children: {} } as unknown as SemanticNode
    })
}

/**
 * 一個**顯示出來的字**是內部詞彙嗎——判準是「它是不是那個鍵本身」。
 *
 * ⚠️ `null` ＝ **什麼都不顯示**，那不是違規（沒設計過的位置就不畫名字）。
 * 🔴 第一版寫成 `looksInternal(label ?? key, key)`——**在測試裡自己退回那個鍵**，
 * 於是它報了 205 處而畫面上一處都沒有。
 * > **一個在判定前先補上預設值的護欄，量的是它自己補的那個值。**
 */
export function looksInternal(shown: string | null, rawKey: string): boolean {
  if (shown === null) return false
  if (shown === rawKey) return true
  // 🔴 **第二版補的**（2026-08-26，開瀏覽器抓到）：退路印出了 `%{BKY_C_INCLUDE_MSG0}`
  //    ——比原本的 `include` **更內部**，而第一版的判準（「等於那個鍵」）放它過了。
  //
  //    > **一條護欄的判準如果只認得缺陷的【一種寫法】，
  //    > 它會在缺陷換一種寫法的那天安靜地變綠。**
  //
  //    根因：`blockDef.message0` 是**原始的 JSON 字串**，`%{BKY_X}` 要等
  //    Blockly 的 `jsonInit` 才解析——而流程視圖沒有走那一步。
  if (/%\{|BKY_/.test(shown)) return true
  // 沒有翻譯過的常數（`FALSE`／`SNAKE_CASE`）——它們是值的代號，不是顯示文字
  if (/^[A-Z][A-Z0-9_]{2,}$/.test(shown)) return true
  return false
}

/**
 * 一份**與產品同形**的標籤埠——讀 blockDef，與 `flow-panel.labelSource()` 同一條路。
 *
 * 🔴 **少了它，這支護欄走不到「退路」那條路**：不接埠的話標題是 `null`，
 * 而 `null` 不是違規。2026-08-26 第一版就是這樣——**它綠著，而畫面上印著
 * `%{BKY_C_INCLUDE_MSG0}`**。
 *
 * > **一條護欄如果只驗「沒有宿主」那條路，它驗不到宿主接上之後的樣子。**
 */
function productLikeLabels(): FlowLabelSource {
  // ⚠️ **要真的登錄表**——`component.json` 裡沒有 `blockDef`（它在 `forms/blocks.json`）。
  // 🔴 而查找邏輯**與產品共用同一份**（`labelSourceFromSpecs`）：
  //    自己寫一份替身的代價當場付過——面板拿屬性名去比 `args0`，而欄位叫 `BOUND`，
  //    **替身犯一模一樣的錯，於是它誠實地回報「沒問題」**。
  const reg = new BlockSpecRegistry()
  reg.loadFromSplit(allCppComponents(), allCppProjections())
  return labelSourceFromSpecs((id) => reg.getByComponentId(id) as never)
}

describe('第七十八條護欄：流程視圖上不得出現內部詞彙', () => {
  const labels = productLikeLabels()
  const graph = buildNodeGraph(everyComponentNode(), labels)

  it('★ 入口條件：這支真的把樹轉成圖了', () => {
    expect(graph.nodes.length, '一個節點都沒建出來 → 下面的 0 是假的').toBeGreaterThan(100)
  })

  it('★ 注入：判準認得出「顯示的就是那個鍵本身」', () => {
    expect(looksInternal('func_def', 'func_def')).toBe(true)
    expect(looksInternal('定義函式', 'func_def')).toBe(false)
    expect(looksInternal(null, 'func_def'), 'null ＝ 什麼都不顯示，不是違規').toBe(false)
    expect(looksInternal('', 'func_def'), '空字串不是那個鍵').toBe(false)
    expect(looksInternal('%{BKY_C_INCLUDE_MSG0}', 'include'), '沒展開的 i18n 參照').toBe(true)
    expect(looksInternal('FALSE', 'inclusive'), '沒翻譯的常數').toBe(true)
    expect(looksInternal('到（不含）', 'inclusive'), '翻譯過的').toBe(false)
    expect(looksInternal('main', 'name'), '使用者自己打的字不是代號').toBe(false)
  })

  it('🔴 硬性零：節點標題不得是元件身分的後半段', () => {
    const bad = graph.nodes
      .filter((n) => looksInternal(n.title, n.componentId.split(':').pop() ?? ''))
      .map((n) => `${n.componentId} → 「${n.title}」`)
    expect(
      bad,
      `這些節點的標題就是身分本身。退路應該是**積木的那句話**（介面文字），不是代號：\n  ` +
        bad.slice(0, 12).join('\n  ') + (bad.length > 12 ? `\n  …共 ${bad.length} 顆` : ''),
    ).toEqual([])
  })

  it('🔴 棘輪：還沒設計過名字的，只准下降', () => {
    // ⚠️ 這個數字與上面兩個硬性零**回答不同的問題**：
    //    硬性零問「有沒有代號上畫面」（原則，補一條退路就成立）
    //    棘輪問「有幾顆真的被設計過」（進度，要逐顆寫）
    // 🔴 混成一個數字的話，**補一條退路會看起來像設計了 233 個名字**。
    const noTitle = graph.nodes.filter((n) => designedTitle(n.componentId) === null)
    const slots = new Set<string>()
    const namedSlots = new Set<string>()
    for (const n of graph.nodes) {
      for (const f of n.fields) {
        slots.add(f.key)
        if (f.label) namedSlots.add(f.key)
      }
      for (const p of n.ports) {
        if (p.key.startsWith('__')) continue
        slots.add(p.key)
        if (p.label) namedSlots.add(p.key)
      }
    }
    const undesignedTitles = noTitle.length
    const undesignedSlots = slots.size - namedSlots.size
    printReport('第七十八條：流程視圖的詞彙', [
      `建出節點           ${graph.nodes.length}`,
      `沒有設計過【標題】  ${undesignedTitles}（棘輪）`,
      `沒有設計過【位置】  ${undesignedSlots}（棘輪）`,
      `⚠️ 這兩個數字下降代表【有人寫了文案】；硬性零那兩支下降代表【退路接上了】。`,
    ])
    const rows: Array<[string, number]> = [
      ['undesignedTitles', undesignedTitles],
      ['undesignedSlots', undesignedSlots],
      ['builtNodes', graph.nodes.length],
    ]
    if (process.env.GENERATE_BASELINE) {
      writeBaseline(GUARD, Object.fromEntries(rows))
      return
    }
    assertRatchet(
      [
        ['undesignedTitles', undesignedTitles],
        ['undesignedSlots', undesignedSlots],
        // ★ 入口條件也進基線：節點數是**合成量**，不隨文案被寫而變小
        ['builtNodes', graph.nodes.length, graph.nodes.length],
      ],
      GUARD,
    )
  })

  it('🔴 硬性零：欄位與接點的名字不得是原始的鍵', () => {
    const bad: string[] = []
    for (const n of graph.nodes) {
      for (const f of n.fields) {
        if (looksInternal(f.label, f.key)) bad.push(`${n.componentId}.${f.key}（名字）`)
        // 🔴 值也要驗——`inclusive: FALSE` 的問題在【值】那一半。
        //    ⚠️ **判準不是「值等於鍵」**：第一版那樣寫，於是 `obj` 這種
        //    「宣告的預設值剛好等於鍵名」的合成輸入被報成違規（15 筆全是假的）。
        //    > **一個拿合成輸入的形狀當判準的護欄，量的是那份合成輸入。**
        //    真正的規則只有一條：**下拉的值必須顯示成它的選項文字**。
        // ⚠️ 只有**顯示文字與值不同**才是違規——加號的顯示文字就是加號本身。
        const asOption = labels.optionLabel(n.componentId, f.key, f.value)
        if (asOption !== null && asOption !== f.value) {
          bad.push(`${n.componentId}.${f.key} = 「${f.value}」應顯示為「${asOption}」`)
        }
      }
      for (const p of n.ports) {
        if (p.key.startsWith('__')) continue
        if (looksInternal(p.label, p.key)) bad.push(`${n.componentId} 接點 ${p.key}`)
      }
    }
    expect(
      bad,
      `這些位置顯示的是原始的鍵。**沒有設計過名字的位置應該不顯示名字**（只顯示值）——\n` +
        `因為位置沒有任何介面文字可以退（P4 漸進揭露）：\n  ` +
        bad.slice(0, 12).join('\n  ') + (bad.length > 12 ? `\n  …共 ${bad.length} 處` : ''),
    ).toEqual([])
  })
})
