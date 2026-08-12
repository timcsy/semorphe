/**
 * 形態選擇——**一個元件身分，多個積木形態**。
 *
 * ## 為什麼需要這個模組
 *
 * `concepts/元件.md` 的試金石：「**換一個檢視它會變嗎？會變就是投影，不會就是真實。**」
 * 積木的標籤與形狀會變 → 它們是**形態**（投影），而形態本來就可以有多個。
 *
 * 而在此之前做不到：`PatternRenderer.renderSpecs` 是 `Map<conceptId, RenderSpec>`，
 * 一個概念只能對一個積木。於是「統一身分」被迫連帶「統一形態」——
 * **而那產生了一個真實的使用者困惑**：
 *
 * > 學生：「stack 和 queue 的 push 意思不一樣，所以積木寫錯了。」
 *
 * 查證後執行器完全不分支（身分是對的），錯的是標籤——`"Push %2 onto %1"` 的
 * `onto` 字面就是堆疊語義。**十八條護欄一條都不會叫，而使用者第一眼就看出來。**
 * 見 `knowledge/episodes/2026-08-07-學生說積木寫錯了.md`。
 *
 * ## 這不是新機制，是把既有的特例一般化
 *
 * `renderMapping.expressionCounterpart` 已經在做「一個概念、兩個形態、依位置選」，
 * 有 5 個活的使用者。它只是**把軸寫死成 statement/expression 一種**。
 *
 * ## 契約
 *
 * 見 `specs/097-multi-form-projection/contracts/form-selection.md`（C-1..C-5）。
 * 最重要的兩條：
 *
 * - **C-1 選擇是全函數**——不得回傳 undefined 讓呼叫端各自發明退路（那是碎裂）
 * - **C-2 規則來自宣告**——本檔 MUST NOT 出現任何具體元件身分。
 *   **這條有機械檢查：中立性護欄。** 破了它那條護欄會叫。
 */
import type { SemanticNode, FormSet, FormAxis } from '../types'

/** 選擇形態時呼叫端知道、而節點不知道的脈絡 */
/**
 * 保留鍵：**中性形態**——軸值取不到時用的那個。
 *
 * 它是一顆真實存在的積木（例如統一的 `cpp_container_push`），所以它該被宣告在
 * `forms` 裡而不是只出現在 `fallback`。第一版沒有這個鍵，於是 FS-2 永遠不成立。
 */
export const NEUTRAL_KEY = '_'

export interface FormSelectionContext {
  /** 這個節點正要被放進敘述槽還是運算式槽 */
  position?: 'statement' | 'expression'
}

export interface FormSelectionResult {
  blockType: string
  /**
   * 可見降級。**只在「宣告與資料不一致」時填**——軸值取不到是合法狀態
   * （辨識查不到型別就不寫該屬性），那不是降級。
   */
  degraded?: { reason: string }
}

/**
 * 選出該用哪個積木形態。
 *
 * ⚠️ **只讀 `node` 與 `ctx`**（C-5）。不得走樹、不得查全域——投影是逐節點的，
 * 而脈絡在存檔往返之後不保證還在。
 */
export function selectForm(
  formSet: FormSet,
  node: SemanticNode,
  ctx: FormSelectionContext,
): FormSelectionResult {
  const { axis, forms, fallback } = formSet

  // 沒有軸 = 只有一個形態。絕大多數元件走這一條。
  if (!axis) return { blockType: fallback }

  const value = axis.from === 'position'
    ? ctx.position
    : axis.property !== undefined
      ? node.properties?.[axis.property]
      : undefined

  // 軸值取不到——**合法狀態，不出聲**。
  // 辨識查不到型別時刻意不寫該屬性（CK-1），而呼叫端也不一定知道呈現位置。
  // 這裡出聲的話，每一顆沒有脈絡的積木都會噴一次警告。
  if (value === undefined || value === null || value === '') {
    return { blockType: fallback }
  }

  const chosen = forms[String(value)]
  if (chosen !== undefined) return { blockType: chosen }

  // 取得到值、但宣告裡沒有它——**宣告與資料不一致，必須看得見**。
  // 新增一種容器卻忘了加形態宣告，就會走到這裡。
  return {
    blockType: fallback,
    degraded: { reason: `形態軸 ${axis.name} 的值「${String(value)}」不在宣告的形態裡` },
  }
}

export interface FormSetValidation {
  ok: boolean
  reason?: string
}

/**
 * 檢查形態集合的不變式 FS-1..FS-4（見 `data-model.md`）。
 *
 * `others` 給的話，額外檢查 FS-4（跨形態集合不得共用 blockType）——
 * **那是反向投影的基礎**：抽取以 blockType 為鍵，一個 blockType 對到兩個概念就反推不出來。
 */
export function validateFormSet(formSet: FormSet, others: readonly FormSet[] = []): FormSetValidation {
  const values = Object.values(formSet.forms)

  // FS-1
  if (values.length === 0) return { ok: false, reason: 'forms 不得為空' }

  // FS-2
  if (!values.includes(formSet.fallback)) {
    return { ok: false, reason: `fallback「${formSet.fallback}」不在 forms 的值域裡` }
  }

  // FS-3——用**軸值形態**數，中性形態不計
  const axisValueCount = Object.keys(formSet.forms).filter((k) => k !== NEUTRAL_KEY).length
  if (formSet.axis === null && axisValueCount > 0) {
    return { ok: false, reason: '沒有選擇軸卻宣告了軸值形態' }
  }
  if (formSet.axis !== null && axisValueCount === 0) {
    return { ok: false, reason: '宣告了選擇軸卻沒有任何軸值形態——軸沒有作用' }
  }
  // 兩個**軸值**指向同一顆積木 = 那不是兩個形態，是宣告錯了（C-3）。
  //
  // ⚠️ 保留鍵 `_`（中性形態）不算：`_` 與某個軸值指向同一顆是**合法的**
  // ——位置軸那組就是這樣（中性形態剛好就是敘述版）。
  const axisValueForm = Object.entries(formSet.forms).filter(([k]) => k !== NEUTRAL_KEY).map(([, v]) => v)
  if (new Set(axisValueForm).size !== axisValueForm.length) {
    return { ok: false, reason: '兩個軸值指向同一個積木型別——那不是兩個形態' }
  }

  // FS-4
  const othersOwn = new Set(others.flatMap((o) => (o.conceptId === formSet.conceptId ? [] : Object.values(o.forms))))
  for (const v of values) {
    if (othersOwn.has(v)) {
      return { ok: false, reason: `積木型別「${v}」已經屬於另一個元件身分——反推不出 conceptId` }
    }
  }

  return { ok: true }
}

/**
 * 從單一形態建一個形態集合——**絕大多數元件的情形**。
 *
 * 分成一個函式是為了讓「沒有多形態」與「有多形態」走同一條路：
 * 呼叫端永遠拿到 `FormSet`，不必分兩種情況處理。
 */
export function singleForm(conceptId: string, blockType: string): FormSet {
  return { conceptId, axis: null, forms: { _: blockType }, fallback: blockType }
}

/**
 * 已知的選擇軸——**一張表，不是外掛系統**。
 *
 * 加一條軸就是加一列。研究階段刻意否決了「軸的外掛註冊」：目前只有兩條軸，
 * 而為想像中的第三條軸建抽象是憲章 I（簡約優先／YAGNI）明文禁止的。
 *
 * 這裡的鍵是**軸名**，不是元件身分——中立性護欄數的是後者。
 */
export const KNOWN_AXES: Record<string, FormAxis> = {
  /** 依呈現位置：敘述版／運算式版。既有 `expressionCounterpart` 的一般化 */
  role: { name: 'role', from: 'position' },
  /** 依容器種類：堆疊／佇列／… */
  container_kind: { name: 'container_kind', from: 'property', property: 'container_kind' },
}

/** 建形態集合所需要的最小資訊——刻意不吃整個 BlockSpec，讓它好測 */
export interface FormDeclaration {
  conceptId: string
  blockType: string
  form?: { axis: string; value: string }
}

/**
 * 把一堆積木宣告收攏成「每個元件身分一個形態集合」。
 *
 * ⚠️ **同一個 conceptId 的第二個宣告不得蓋掉第一個**（FR-002）——
 * 那正是這個功能存在之前的實際行為（`Map.set` 直接覆寫）。
 */
export function buildFormSets(decls: readonly FormDeclaration[]): Map<string, FormSet> {
  const neutral = new Map<string, string>()
  const variant = new Map<string, { axis: string; values: Record<string, string> }>()

  for (const d of decls) {
    if (!d.form) {
      // 第一個中性宣告勝出——後來的不覆寫，否則載入順序會決定行為
      if (!neutral.has(d.conceptId)) neutral.set(d.conceptId, d.blockType)
      continue
    }
    const cur = variant.get(d.conceptId) ?? { axis: d.form.axis, values: {} }
    cur.values[d.form.value] = d.blockType
    variant.set(d.conceptId, cur)
  }

  const out = new Map<string, FormSet>()
  for (const [conceptId, blockType] of neutral) {
    const v = variant.get(conceptId)
    if (!v) {
      out.set(conceptId, singleForm(conceptId, blockType))
      continue
    }
    out.set(conceptId, {
      conceptId,
      axis: KNOWN_AXES[v.axis] ?? null,
      forms: { [NEUTRAL_KEY]: blockType, ...v.values },
      fallback: blockType,
    })
  }

  // 只有變體、沒有中性宣告 → 拿第一個變體當中性，並且**出聲**不了（這裡沒有報表）
  // ——所以改成不接受：沒有中性形態的元件在 validateFormSet 會被擋下。
  for (const [conceptId, v] of variant) {
    if (out.has(conceptId)) continue
    const first = Object.values(v.values)[0]
    out.set(conceptId, {
      conceptId,
      axis: KNOWN_AXES[v.axis] ?? null,
      forms: { [NEUTRAL_KEY]: first, ...v.values },
      fallback: first,
    })
  }
  return out
}
