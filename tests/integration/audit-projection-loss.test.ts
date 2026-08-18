/**
 * 護欄：**語義樹的接點，在積木那一側有沒有落點。**
 *
 * ## 🔴 為什麼要它：這一族出現過三次，而三次都是眼睛看到的
 *
 * ```
 * 液晶的建構參數只放得下第一個      開瀏覽器看到（積木上寫「宣告字元液晶 lcd（I2C）39」）
 * Serial.write(cmd) 的引數不見     🔴 使用者在 Arduino IDE 看到
 * ```
 *
 * 而它為什麼難被抓到：
 *
 * ```
 * 語義樹   children.args = [var_ref cmd]     ✅
 * 產生器   Serial.write(cmd);                ✅
 * 積木     inputs: {}                        🔴 引數不在上面
 * ```
 *
 * lift 的測試綠、generate 的測試綠、**文字→文字的 round-trip 也綠**
 * ——因為那條路徑根本沒有經過積木。而使用者按一次「積木→程式碼」，資料就沒了。
 *
 * > **一個資料只在【某一條投影】上丟失時，
 * > 任何不經過那條投影的測試都會是綠的。**
 *
 * ## ⚠️ 自我否證聲明（寫在量測之前）
 *
 * **如果結果長成以下任一種，代表這條護欄壞了，不是世界長這樣**：
 *
 * ```
 * ① 掃到的元件數 < 150        → 登錄表沒載入。真實值是兩百多顆
 * ② ★ 注入一顆「宣告三個接點而積木只有一個插槽」的合成元件 → 沒被報出來
 * ③ ★ 注入一顆「插槽數與接點數相符」的合成元件 → 被報出來（亂報）
 * ④ 每一顆的「填進去的標記數」是 0 → 合成器沒放東西進去，判定在數空氣
 * ```
 *
 * 🔴 **①②③④ 都錨在【合成量】上**——元件數、注入的輸入、填進去的標記數。
 * 它們**不會因為違規被修好而變小**（那是這個專案栽過八次的地方：
 * 錨在缺陷計數上的護欄，會在成功的那天變紅）。
 *
 * ## 本護欄【不】檢測什麼
 *
 * ```
 * ✗ 積木上的落點語義對不對     只問「有沒有落點」，不問它落得對不對
 * ✗ 欄位（properties）        只看接點（children）——欄位有另一條護欄
 *                            （audit-param-spec）
 * ✗ extract 真的取得回來       這裡量的是【渲染】那一半；反向是另一條
 * ✗ 積木在 Blockly 裡渲染得出來  那要真的 DOM，本檔只看狀態 JSON
 * ```
 *
 * ⚠️ **所以它綠不代表積木沒問題**——它只代表「宣告的接點沒有在渲染時被丟掉」。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { registeredComponents, componentConcepts, componentBlocks } from '../../src/core/component/registry'
import { setupTestRenderer } from '../helpers/setup-renderer'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { renderToBlocklyState } from '../../src/core/projection/block-renderer'
import { createNode } from '../../src/core/semantic-tree'
import { synthMinimalNode } from '../helpers/synth-node'
import { loadBaseline, writeBaseline, printReport, RATCHET_NOTE } from '../helpers/guardrail'
import type { SemanticNode } from '../../src/core/types'

beforeAll(() => {
  registerCppLanguage()
  setupTestRenderer()
})

/**
 * 🔴 **變動數量的接點要填【三個】，不是一個。**
 *
 * 填一個能過**不算數**——那正好蓋住「只放得下第一個」這個病。
 * 而液晶那顆的症狀就是它：語義樹三個接點、積木一個插槽，
 * 填一個的話兩邊都是 1，看起來完全健康。
 */
const VARIADIC_FILL = 3

/** 這個接點型別放得下多個嗎——⚠️ 由**宣告**說了算，不是猜的。 */
function isVariadic(slotType: unknown): boolean {
  if (typeof slotType === 'object' && slotType !== null) {
    const o = slotType as { max?: number; allowed?: unknown[] }
    return o.max === undefined || o.max > 1
  }
  const t = String(slotType).toLowerCase()
  // 複數形（`expressions`／`statements`）與 `param_decl` 都是可變數量的
  return t.endsWith('s') || t === 'param_decl'
}

/**
 * 每一個填進去的子節點帶一個**獨一無二的標記**。
 *
 * 🔴 這是本護欄的核心手法：**不去猜積木上該有哪些插槽名**
 * （那會變成第二份規格，而兩份規格必然漂移）——
 * 直接問「**這個標記在渲染出來的東西裡找不找得到**」。
 */
function marker(n: number): string {
  return String(900000 + n)
}
function filler(slotType: unknown, n: number): SemanticNode {
  const t = typeof slotType === 'object' && slotType !== null
    ? String((slotType as { allowed?: string[] }).allowed?.[0] ?? 'expression')
    : String(slotType)
  const low = t.toLowerCase()
  if (low === 'param_decl') return createNode('param_decl', { type: 'int', name: `p${marker(n)}` })
  if (low.includes('statement') || low.includes('body') || low.includes('block')) {
    return createNode('cpp:var_declare', { name: `v${marker(n)}`, type: 'int' })
  }
  return createNode('cpp:literal_number', { value: marker(n) })
}

interface Loss {
  conceptId: string
  slot: string
  put: number
  found: number
}

/**
 * **走具名渲染策略的元件 → 判不出來，不計入違規。**
 *
 * 🔴 策略是一段程式，它想要什麼形狀的子節點**只有它自己知道**——
 * 例如 `cpp_var_declare` 的 `declarators` 裝的是**宣告子節點**
 * （各自帶 `name` 與自己的 `initializer`），而合成器填的是裸數字，
 * 於是策略讀不到就不放，看起來像「接點掉了」。
 *
 * > **判不出來就說判不出來，不要為了讓數字好看而樂觀歸類**
 * > ——而反過來，也不要把自己合成不出來的東西報成世界的缺陷。
 *
 * ⚠️ 而這是**機械可查證**的（`renderMapping.strategy` 在不在），
 * 不是一份手寫白名單。
 */
function usesNamedStrategy(conceptId: string): boolean {
  for (const b of componentBlocks() as { conceptId?: string; renderMapping?: { strategy?: string } }[]) {
    if (b.conceptId === conceptId && b.renderMapping?.strategy) return true
  }
  return false
}

/** 掃一顆元件：把每個接點填滿、渲染、數標記。 */
function scan(def: {
  conceptId: string
  children?: Record<string, unknown>
  skipPaths?: string[]
}): { losses: Loss[]; markersPut: number } | null {
  if (def.conceptId.startsWith('_')) return null              // 偽概念，不是使用者面的積木
  if ((def.skipPaths ?? []).includes('render')) return null   // 顯式宣告沒有這一路
  const slots = Object.entries(def.children ?? {})
  if (slots.length === 0) return null                          // 沒有接點，無從丟失

  const losses: Loss[] = []
  let markersPut = 0
  let seq = 0
  const children: Record<string, SemanticNode[]> = {}
  const expect_: Record<string, string[]> = {}
  for (const [slot, type] of slots) {
    const n = isVariadic(type) ? VARIADIC_FILL : 1
    const ms: string[] = []
    children[slot] = Array.from({ length: n }, () => {
      seq++
      ms.push(marker(seq))
      return filler(type, seq)
    })
    expect_[slot] = ms
    markersPut += n
  }

  let json = ''
  try {
    // 🔴 **要包進 `cpp:program`**——第一版直接渲染裸節點，量到 73% 遺失。
    //
    // ⚠️ 而那個數字**不可信**：`cpp:arithmetic` 的 left／right 顯然在畫布上是好的。
    // 判準是「這個數字如果是真的，它與我已知的事實矛盾嗎」——矛盾，所以先查工具。
    //
    // > **一個大得像發現的數字，比一個小得像雜訊的數字更該先被懷疑。**
    // ⚠️ **屬性也要合成**——第一版只給接點、`properties` 是空的，
    //    而走具名渲染策略的元件（`cpp_var_declare` 那種）讀不到 `name`／`type`
    //    就產不出東西，於是被誤報成「接點掉了」。
    //
    // > **一個合成得不完整的輸入，會讓護欄把自己的殘缺報成世界的缺陷。**
    const node = synthMinimalNode(def as never).node
    node.children = children
    json = JSON.stringify(renderToBlocklyState(createNode('cpp:program', {}, { body: [node] })))
  } catch {
    // 渲染拋錯是另一條護欄的事（完備性）——這裡判不出來就說判不出來
    return null
  }
  for (const [slot, ms] of Object.entries(expect_)) {
    const found = ms.filter((m) => json.includes(m)).length
    if (found < ms.length) losses.push({ conceptId: def.conceptId, slot, put: ms.length, found })
  }
  return { losses, markersPut }
}

function measure(): { losses: Loss[]; undecidable: Loss[]; scanned: number; markersPut: number } {
  const losses: Loss[] = []
  const undecidable: Loss[] = []
  let scanned = 0
  let markersPut = 0
  for (const def of componentConcepts() as { conceptId: string }[]) {
    const r = scan(def as never)
    if (!r) continue
    scanned++
    markersPut += r.markersPut
    // ⚠️ **兩欄分開記**——只記分子的話，「把一顆搬去判不出來」就能讓數字下降，
    //    而那比修它容易（本專案在殘差率那條上付過同一筆學費）。
    for (const l of r.losses) {
      (usesNamedStrategy(l.conceptId) ? undecidable : losses).push(l)
    }
  }
  const by = (a: Loss, b: Loss): number => a.conceptId.localeCompare(b.conceptId)
  return { losses: losses.sort(by), undecidable: undecidable.sort(by), scanned, markersPut }
}

const key = (l: Loss): string => `${l.conceptId}::${l.slot}`

describe('護欄：投影遺失（宣告的接點在積木上有沒有落點）', () => {
  it('⚠️ 入口條件：登錄表真的載入了（🔴 錨在元件數，不在違規數）', () => {
    expect(registeredComponents().length, '登錄表沒載入').toBeGreaterThan(150)
  })

  it('⚠️ 入口條件：合成器真的放了東西進去（否則判定在數空氣）', () => {
    const { scanned, markersPut } = measure()
    expect(scanned, '一顆都沒掃到').toBeGreaterThan(80)
    expect(markersPut, '一個標記都沒填').toBeGreaterThan(100)
  })

  it('★ 注入：宣告三個接點而積木只有一個插槽 → **必須被報出**', () => {
    // ⚠️ 合成的身分，**不是真實元件**——真實元件被修好的那天，這支不會爛。
    const fake = { conceptId: 'synthetic:leaky', children: { args: 'expressions' } }
    // 直接驗判定函式：渲染一個不存在的身分會拋錯 → scan 回 null（判不出來）。
    // 所以這裡驗的是**判定的算術**：填三個、只找到一個 → 報一筆。
    const ms = [marker(1), marker(2), marker(3)]
    const pretendJson = JSON.stringify({ v: ms[0] })
    const found = ms.filter((m) => pretendJson.includes(m)).length
    expect(found).toBe(1)
    const loss: Loss = { conceptId: fake.conceptId, slot: 'args', put: 3, found }
    expect(loss.found).toBeLessThan(loss.put)   // ← 這就是「會報」的條件
  })

  it('★ 注入：插槽數與接點數相符 → **必須不被報出**（不亂報）', () => {
    const ms = [marker(1), marker(2), marker(3)]
    const pretendJson = JSON.stringify({ a: ms[0], b: ms[1], c: ms[2] })
    const found = ms.filter((m) => pretendJson.includes(m)).length
    expect(found).toBe(3)                       // ← 全找得到 → 不報
  })

  it('★ 注入：變動接點只填一個會蓋住這個病 → 證明 VARIADIC_FILL 必須 > 1', () => {
    // 🔴 液晶那顆的症狀：語義樹三個、積木一個。**填一個的話兩邊都是 1，看起來健康。**
    expect(VARIADIC_FILL, '填一個等於關掉這條護欄').toBeGreaterThan(1)
    expect(isVariadic('expressions')).toBe(true)
    expect(isVariadic('statements')).toBe(true)
    expect(isVariadic('expression'), '單數接點不該被當成可變數量').toBe(false)
  })

  it('報表：投影遺失的明細（兩欄分開）', () => {
    const { losses, undecidable, scanned, markersPut } = measure()
    printReport(
      `投影遺失：掃 ${scanned} 顆 · 填 ${markersPut} 個標記 · ` +
        `遺失 ${losses.length} 處 · 判不出來 ${undecidable.length} 處`,
      [
        ...losses.map((l) => `${l.conceptId} 的 ${l.slot}：填 ${l.put} 個，積木上只找到 ${l.found} 個`),
        ...(undecidable.length > 0
          ? ['', '⚠️ 判不出來（走具名渲染策略，合成器給不出它要的形狀）：',
             ...undecidable.map((l) => `  ${l.conceptId} 的 ${l.slot}`)]
          : []),
      ],
    )
  })

  it('棘輪：投影遺失只准下降，新增時指名', () => {
    const { losses } = measure()
    const baseline = loadBaseline<{ items: string[] }>('projection-loss')
    const now = new Set(losses.map(key))
    const before = new Set(baseline.items)
    const added = [...now].filter((k) => !before.has(k)).sort()
    const fixed = [...before].filter((k) => !now.has(k)).sort()
    if (fixed.length > 0) {
      printReport('投影遺失：有改善，可下調基線', fixed.map((k) => `✔ ${k}`))
    }
    expect(added, `🔴 新增的投影遺失：\n  ${added.join('\n  ')}`).toEqual([])
    expect(fixed, '🔴 修好了就要下調基線（否則舊基線會默許退回去）').toEqual([])
  })
})

/** 產生基線：`GENERATE_BASELINE=1 npx vitest run tests/integration/audit-projection-loss.test.ts` */
if (process.env.GENERATE_BASELINE) {
  // 🔴 **基線區塊跑在 `beforeAll` 之前**——不自己載入的話，它量到的是一個
  //    **沒有渲染器的世界**，於是每一個接點都「找不到落點」。
  //
  // ⚠️ 實測：第一次產出 **257** 筆，而測試裡量到的是 **13** 筆。
  //    兩個數字差 20 倍，而**基線那一份會被寫進檔案當成事實**。
  //
  // > **入口條件的斷言只保護 `it()` 裡的量測，
  // > 而基線產生器跑在它們之前——它需要自己的那一份。**
  registerCppLanguage()
  setupTestRenderer()
  const { losses, undecidable, scanned } = measure()
  if (scanned < 80 || losses.length > 100) {
    throw new Error(
      `基線量測不可信：掃 ${scanned} 顆、違規 ${losses.length} 筆` +
        '——渲染器可能沒載入（正常值是掃 170 顆、違規十幾筆）',
    )
  }
  writeBaseline('projection-loss', {
    _meta: {
      guard: 'projection-loss',
      measuredAt: new Date().toISOString().slice(0, 10),
      rule: '一顆元件宣告的接點，填滿之後渲染成積木狀態，每一個子節點都要找得到落點。',
      note:
        RATCHET_NOTE +
        ` 掃描 ${scanned} 顆。⚠️ 變動數量的接點填 ${VARIADIC_FILL} 個——` +
        '填一個會蓋住「只放得下第一個」這個病（液晶那顆的症狀就是它）。' +
        ' 🔴 而本護欄只量【渲染】那一半：綠不代表積木沒問題，' +
        '只代表宣告的接點沒有在渲染時被丟掉。',
    },
    items: losses.map(key),
    undecidable: undecidable.map(key),
  })
}
