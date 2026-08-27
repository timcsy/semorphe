/**
 * **一個 palette 項目要生出什麼形狀**——把工具箱的 `extraState` 翻譯成一小棵樹。
 *
 * ## 它從哪來（2026-08-27，使用者：「把 if 那三種變體補回去」）
 *
 * 工具箱替 `cpp_if` 列了三個入口，而它們的差別**只在積木的插槽**：
 *
 * ```
 * cpp_if {}                             CONDITION / THEN / TAIL
 * cpp_if {hasElse:true}                 …＋ ELSE
 * cpp_if {elseifCount:1,hasElse:true}   …＋ ELSEIF_CONDITION_0 / ELSEIF_THEN_0
 *
 * 🔴 而三者抽出來的語義樹【完全相同】：{condition:1, then_body:0, else_body:0}
 * ```
 *
 * > **`extraState` 決定積木長出哪些插槽，而樹只記錄插槽裡【有什麼】。
 * > 空的插槽在樹裡不存在。**
 *
 * ## 所以流程視圖不能照抄，而它也不需要
 *
 * 流程的接點是**宣告**出來的（`slotsOf`），永遠都在——「要不要一個 else 插槽」
 * 在那裡不是一個問題。⚠️ 而在此之前 `else_body` **根本沒有被宣告**
 * （`cpp:if` 的 `children` 只有 `condition` 與 `then_body`），
 * 於是流程視圖裡**做不出 else**——那是這一刀先修掉的一個真缺陷。
 *
 * ## 剩下的差別是【骨架】，而那是真的
 *
 * `else if` 在樹裡是**一顆巢狀的 `cpp:if`，帶 `isElseIf`**（實測 lifter 的產出）。
 * 學生不可能猜到「把另一個 if 放進 else 裡、再標一個旗標」。
 *
 * > **一個要靠內部規則才拼得出來的常見形狀，就該有一個現成的入口。**
 *
 * ## ⚠️ 這裡不做什麼
 *
 * - **不替「只是多一個空插槽」的變體開一個入口**——它與素的那顆生出同一棵樹，
 *   而兩顆做同一件事的按鈕比一顆更難用（那正是 08-27 去重要解決的事）。
 * - **不認識 C++**：規則寫成「哪個 `extraState` 鍵 → 哪個子槽長什麼」的宣告，
 *   而鍵名來自工具箱。加一個語言不必動這個檔的邏輯。
 */
import type { SemanticNode } from '../types'
import type { PaletteItem } from './palette'

let seq = 0
/** ⚠️ 不用 `Math.random()`：同一份輸入要產出同一份結果（測試與重播都靠這個）。 */
const newId = (): string => `new_${(seq += 1).toString(36)}`

/** 測試用：把流水號歸零，讓兩次比較拿得到同樣的 id。 */
export function resetPresetIds(): void {
  seq = 0
}

/** 一顆空的節點。 */
function node(componentId: string, properties: Record<string, unknown> = {}): SemanticNode {
  return { id: newId(), componentId, properties, children: {} } as unknown as SemanticNode
}

/**
 * **這一項要生出來的那棵樹**。
 *
 * 沒有 `extraState`（或那個狀態在樹裡沒有形狀）就是一顆光的節點。
 */
export function presetTree(componentId: string, extraState?: Record<string, unknown>): SemanticNode {
  const root = node(componentId)
  const n = Number(extraState?.elseifCount ?? 0)
  if (Number.isFinite(n) && n > 0) {
    // `else if` ＝ 一顆巢狀的 `cpp:if`，帶 `isElseIf`。多層就往裡面接。
    let tail = root
    for (let i = 0; i < n; i += 1) {
      const inner = node(componentId, { isElseIf: 'true' })
      tail.children.else_body = [inner]
      tail = inner
    }
  }
  return root
}

/**
 * 這一項在 palette 上叫什麼**後綴**——沒有就回 `null`（用元件自己的名字）。
 *
 * 🔴 後綴是**介面文字**，所以它走 `msg()`；而**判斷用的是 `extraState` 的鍵**，
 * 不是那段文字（`principles.md:126`：使用者看得到的所有文字都是介面）。
 */
export function presetSuffixKey(extraState?: Record<string, unknown>): string | null {
  const n = Number(extraState?.elseifCount ?? 0)
  return Number.isFinite(n) && n > 0 ? 'FLOW_PRESET_ELSEIF' : null
}

/**
 * 兩個 palette 項目**會不會生出同一棵樹**——去重用這個，不是用 `componentId`。
 *
 * ⚠️ 這是 08-27 去重那一刀的修正：當時的鍵是 `componentId`，於是三顆「如果」
 * 收成一顆——而其中**一顆是真的不同**（else-if 的骨架）。
 *
 * > **去重的鍵要等於「按下去會發生什麼」，不是「它是誰」。**
 */
export function presetKey(item: PaletteItem, componentId: string): string {
  const n = Number(item.extraState?.elseifCount ?? 0)
  return Number.isFinite(n) && n > 0 ? `${componentId}#elseif${n}` : componentId
}
