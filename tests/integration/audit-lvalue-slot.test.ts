/**
 * **第七十三條護欄**：一顆會【寫入】的元件，它的左值必須是接點。
 *
 * ## 它從哪來
 *
 * 使用者 2026-08-24 逐字：
 * 「**我的意思是 lvalue 的型態應該百百種吧，這樣不就寫死了？**」
 * 隔天：「我希望用『**的**』來做到 `.` 的功能……有時候我們要串好幾個 `.`」
 * ——**兩句是同一件事**。
 *
 * 左值的形狀是**開放集合**：
 * `x` · `a[i]` · `a[i][j]` · `o.x` · `p->x` · `*q` · `a.b.c` · `f().x` · `d["k"]`……
 * **每一種都是一個既有的運算式節點**。存成字串，等於把整個運算式文法
 * 壓進一個 `literal`。
 *
 * ```
 * 列舉式   「變數名的、陣列的、成員的、指標的、……」   → 下一個必然被漏掉，而且是靜默的
 * 扣除式   「左值是一個運算式」                      → 沒有下一個
 * ```
 *
 * 概念收在 `knowledge/concepts/左值.md`；設計脈絡在
 * `knowledge/draft/2026-08-25-lvalue的形狀被列舉了.md`。
 *
 * ## 🔴 症狀不是「壞掉」，是**假裝結構化**
 *
 * `o.x += 1` 存成 `name: "o.x"`，來回得回去（產生器是字串串接），
 * 於是殘差不動、測試全綠。**而積木上那一格是下拉**，列的是變數清單
 * ——學生點一下改成 `i`，成員存取就沒了，**沒有任何東西會出聲**。
 *
 * ## 🔴 自我否證
 *
 * > **如果「★ 注入①」那一段裡，一個【合成的】宣告——`writesTo` 指著一個
 * > 只存在於 `properties` 的名字——沒有被判成違規，代表判定函式壞了，
 * > 不是世界長這樣。**
 *
 * ⚠️ 錨在**合成輸入**上。而入口條件錨在**註冊表裡有幾顆元件**
 * （今天 300+）——它是一個合成量：
 * 🔴 **不錨在「宣告了 `writesTo` 的顆數」，更不錨在「字串左值的顆數」**
 * ——後者正是這條護欄要推向零的，**它會在成功的那天變紅**
 * （`build-guardrail` 簽名一與簽名三）。
 *
 * ## 硬性零還是棘輪
 *
 * ```
 * 留一筆規範還成立嗎？   ❌ 「左值是運算式」留一個例外就是假的
 * 修一筆要付多少？       🔴 貴——每一筆跨 lift／generate／execute／render 四條路徑，
 *                        而且動的是語義詞彙本身（principles.md:158），MUST 附一次性轉換
 * 別台機器一樣嗎？       ✅ 純讀宣告
 * ```
 * → **規範成立 ＋ 每一筆都要驗行為 ⟹ 棘輪，慢慢還。**（`build-guardrail` §6.8）
 *
 * ## 本護欄不檢測什麼
 *
 * - ❌ **只看得到宣告了 `traits.writesTo` 的元件**。一顆會寫入而**沒有宣告**的，
 *   對它不存在。→ 所以另有一欄「疑似漏宣告」，用**名字**當網子撈
 *   （`assign` / `increment` / `decrement`），**那是網子不是機制**，
 *   而它印出來的數字是要有人去看的。
 * - ❌ **不管「綁定一個新名字」**：`for (int x : v)` 的 `x`、函式參數名、
 *   宣告的名字——那些的文法**只允許識別字**，字串是對的。
 *   它們**刻意不宣告 `writesTo`**，而這條護欄因此看不到它們。
 * - ❌ **不檢測接點裡裝的東西對不對**——`writesTo` 指到一個接點就算過。
 * - ❌ **不檢測執行期**：一顆宣告了接點而執行器仍然只認一種形狀的元件，
 *   在這裡是綠的。那一半的判準在「左值解析器是扣除式的」。
 */
import { describe, it, expect } from 'vitest'
import { registeredComponents } from '../../src/core/component/registry'
import {
  loadBaseline, writeBaseline, printReport, assertRatchet, assertCorpus, RATCHET_NOTE,
} from '../helpers/guardrail'

const GUARD = 'lvalue-slot'

interface Decl {
  componentId: string
  writesTo: string
  /** `writesTo` 指到的是接點嗎 */
  isSlot: boolean
  /** 它指到的是屬性嗎——⚠️ 兩個都 false ＝ 指到一個不存在的名字 */
  isProp: boolean
}

/**
 * 判定——**保守**：`writesTo` 指到的名字兩邊都找不到時，
 * 歸「懸空」而**不計入安全**（`build-guardrail` 第 5 步）。
 */
export function classify(manifest: {
  componentId: string
  traits?: Record<string, unknown>
  properties?: { name: string }[]
  children?: Record<string, unknown>
}): Decl | null {
  const w = manifest.traits?.writesTo
  if (typeof w !== 'string' || !w) return null
  const props = new Set((manifest.properties ?? []).map((p) => p.name))
  const kids = new Set(Object.keys(manifest.children ?? {}))
  return { componentId: manifest.componentId, writesTo: w, isSlot: kids.has(w), isProp: props.has(w) }
}

/** 名字當網子——**撈的是「可能忘了宣告的」，不是判定機制**。 */
const NET = /(?:^|[:_])(?:var_)?(?:assign|increment|decrement)/

describe('第七十三條護欄：左值必須是接點', () => {
  it('★ 注入①：一個 `writesTo` 指著【只存在於 properties】的合成宣告，必須被判成違規', () => {
    const fake = classify({
      componentId: 'synthetic:assign_probe',
      traits: { writesTo: 'lhs' },
      properties: [{ name: 'lhs' }, { name: 'operator' }],
      children: { value: 'expression' },
    })
    expect(fake, '🔴 判定函式連合成宣告都認不出來').not.toBeNull()
    expect(fake!.isProp, '🔴 它指著一個屬性而判定說不是——判定壞了').toBe(true)
    expect(fake!.isSlot, '🔴 它不是接點而判定說是').toBe(false)
  })

  it('★ 注入②：一個 `writesTo` 指著【接點】的合成宣告，不得被亂報', () => {
    const ok = classify({
      componentId: 'synthetic:assign_ok',
      traits: { writesTo: 'target' },
      properties: [{ name: 'operator' }],
      children: { target: 'expression', value: 'expression' },
    })
    expect(ok!.isSlot, '🔴 它是接點而判定說不是——這條護欄會把正確的宣告罵一頓').toBe(true)
    expect(ok!.isProp).toBe(false)
  })

  it('★ 注入③：`writesTo` 指著一個【不存在的名字】要歸懸空，而不是歸安全', () => {
    const dangling = classify({
      componentId: 'synthetic:assign_dangling',
      traits: { writesTo: 'nope' },
      properties: [{ name: 'obj' }],
      children: { value: 'expression' },
    })
    expect(dangling!.isSlot, '🔴 懸空被判成接點＝一個打錯字的宣告會讓違規消失').toBe(false)
    expect(dangling!.isProp).toBe(false)
  })

  it('★ 沒有宣告 `writesTo` 的元件回 null——這條護欄不猜', () => {
    expect(classify({ componentId: 'synthetic:silent', properties: [{ name: 'obj' }] })).toBeNull()
  })

  it('棘輪：左值是字串的元件只准下降', () => {
    const all = registeredComponents()
    const decls = all
      .map((c) => classify(c.manifest as never))
      .filter((d): d is Decl => d !== null)

    const asString = decls.filter((d) => d.isProp)
    const dangling = decls.filter((d) => !d.isProp && !d.isSlot)
    const ok = decls.filter((d) => d.isSlot)
    const declared = new Set(decls.map((d) => d.componentId))
    const missing = all
      .map((c) => c.componentId)
      .filter((id) => NET.test(id) && !declared.has(id))

    // ⚠️ 報表印在 `loadBaseline` 之前——否則第一次跑會在**指名之前**就拋。
    printReport('左值是接點嗎', [
      `註冊表 ${all.length} 顆｜宣告了 writesTo 的 ${decls.length} 顆`,
      `🟢 接點 ${ok.length} ｜ 🔴 字串 ${asString.length} ｜ ⚠️ 懸空 ${dangling.length}`,
      '',
      ...asString.map((d) => `  🔴 ${d.componentId.padEnd(34)} writesTo=${d.writesTo}（屬性）`),
      ...dangling.map((d) => `  ⚠️ ${d.componentId.padEnd(34)} writesTo=${d.writesTo} —— 兩邊都找不到`),
      '',
      `⚠️ 疑似漏宣告 ${missing.length} 筆（名字像賦值而沒有 writesTo）——**網子不是機制**：`,
      ...missing.map((id) => `     ${id}`),
      '',
      '判準：左值的文法允許任意運算式 ⟹ 必須是接點。',
      '⚠️ 綁定一個新名字不算（for (int x : v) 的 x、參數名、宣告的名字）。',
    ])

    if (process.env.GENERATE_BASELINE) {
      writeBaseline(GUARD, {
        _meta: {
          note: '一顆會寫入的元件，它的左值必須是接點。\n'
            + '🔴 走棘輪不走硬性零：每一筆跨 lift／generate／execute／render 四條路徑，\n'
            + '   而且動的是語義詞彙本身（principles.md:158），MUST 附一次性轉換。\n'
            + '⚠️ 「疑似漏宣告」只是名字網子，不是判定機制——它是要有人去看的。',
          ratchet: RATCHET_NOTE,
        },
        '註冊表顆數': all.length,
        '左值是字串': asString.length,
        '左值懸空': dangling.length,
        '疑似漏宣告': missing.length,
        details: asString.map((d) => `${d.componentId}.${d.writesTo}`),
      })
      return
    }
    void loadBaseline(GUARD)
    // 🔴 入口條件錨在**註冊表顆數**——它不會因為左值被改成接點而變小。
    //    ⚠️ **不錨在「宣告了 writesTo 的顆數」**：那個數字包含缺陷，
    //    是 `build-guardrail` 簽名三說的「一個比較慢爛的錨」。
    assertCorpus([['註冊表顆數', all.length]], GUARD)
    assertRatchet(
      [['左值是字串', asString.length], ['左值懸空', dangling.length], ['疑似漏宣告', missing.length]],
      GUARD,
      { detail: asString.map((d) => `${d.componentId}.${d.writesTo}`) },
    )
  })
})
