/**
 * 形態選擇——**一個元件身分，多個積木形態**。
 *
 * ## 為什麼需要這個模組
 *
 * `components/元件.md` 的試金石：「**換一個檢視它會變嗎？會變就是投影，不會就是真實。**」
 * 積木的標籤與形狀會變 → 它們是**形態**（投影），而形態本來就可以有多個。
 *
 * 而在此之前做不到：`PatternRenderer.renderSpecs` 是 `Map<componentId, RenderSpec>`，
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
/** 形態表的鍵。⚠️ **帶軸名**——兩條軸可能有同名的值。 */
export function formKey(axisName: string, value: string): string {
  return `${axisName}:${value}`
}

/**
 * 這條軸在這個節點／脈絡上取到什麼值。取不到回 `undefined`。
 *
 * ⚠️ **只讀 `node` 與 `ctx`**（C-5）。
 */
function axisValue(
  axis: FormAxis,
  node: SemanticNode,
  ctx: FormSelectionContext,
): string | undefined {
  const raw = axis.from === 'position'
    ? ctx.position
    : axis.property !== undefined
      ? node.properties?.[axis.property]
      : undefined
  if (raw === undefined || raw === null || raw === '') return undefined
  return String(raw)
}

export function selectForm(
  formSet: FormSet,
  node: SemanticNode,
  ctx: FormSelectionContext,
): FormSelectionResult {
  const { axes, forms, fallback } = formSet

  // 沒有軸 = 只有一個形態。絕大多數元件走這一條。
  if (axes.length === 0) return { blockType: fallback }

  // 🔴 **依 priority 依序問，第一個問得出形態的贏**（2026-09-21，第 219 刀）。
  //
  //    在此之前一個身分只能有一條軸，於是 `cpp:container_push` 的
  //    「運算式版」被混進「容器種類」那條軸，變成它的一個值——
  //    而運算式位置因此挑不到形態、退成灰色逃生艙。
  //
  // ⚠️ **不做笛卡兒積**（`stack × expression` 那種組合形態）：那要宣告 6 顆積木，
  //    而其中大部分不會有人用。憲章 I（簡約優先）。
  //    代價說在明處：一顆**堆疊**的 push 出現在運算式位置時，用的是
  //    **一般的**運算式形態（標籤是中性的「放進」而不是「推入堆疊」）。
  //
  // > **兩條軸都說得上話的時候，先聽那條決定「放不放得進去」的
  // > ——標籤說錯是讀起來怪，插槽不合是根本畫不出來。**
  //
  // 🔴 **而上面那兩句寫得太寬**（2026-09-25 兩次修正）。
  //
  //    **第一次**（拿 3D 域填一遍）：軟體的組合形態之所以不必要，是因為
  //    **標籤可以中性**——「放進」對堆疊與佇列都讀得通。而 3D 不是：
  //
  //    ```
  //    detailed × 列印   watertight、要能印     ← 兩個【真的不同】的網格
  //    detailed × 顯示   低面數、法線平滑       ← 不是同一顆換個標籤
  //    ```
  //
  //    當時的結論是「軸的組合方式**是領域相依的**」。
  //
  //    🔴 **第二次**（讀 `Transformers learn factored representations`，
  //    arXiv 2602.02385）：那不是領域的事，**是一個說得出口的性質**——
  //
  //    ```
  //    因子化（各軸各出一份、組起來）   🟢 軸之間【條件獨立】時【無損】,維度線性
  //    乘積（每個組合一顆）             軸不獨立時才需要,維度指數
  //    ```
  //
  //    對回這兩個實例，兩個判斷都對，而理由換了：
  //
  //    ```
  //    stack × expression   「它是堆疊」與「它在運算式位置」互不透露 ⟹ 獨立 ⟹ 不必乘積
  //    detailed × 列印       watertight 與細分程度【會互相影響】     ⟹ 不獨立 ⟹ 要乘積
  //    ```
  //
  // > **一個「刻意不做」的決定，它的理由通常只在做決定的那個域裡成立，
  // > 而它會被寫成一條通則。**
  //
  // ## 🔴 而更該知道的是：這支函式做的是【第三種】，不是因子化
  //
  //    ```
  //    乘積      每個組合一顆              維度爆炸
  //    因子化    各軸各出一份、組起來      🟢 獨立時無損
  //    🔴 這裡    依 priority【取一個軸】,其餘的【丟掉】
  //    ```
  //
  //    而那個「丟掉」的代價，正是這個 repo 最有名的一個缺陷：
  //    **堆疊的 push 在運算式位置用中性標籤「放進」**——`container_kind`
  //    的資訊被丟了，而十八條護欄一條都不叫、學生第一眼看出來。
  //
  //    🟢 **正確的做法是因子化**：標籤從 `container_kind` 來（「推入堆疊」），
  //    形狀從 `role` 來（運算式）——**組起來**，而不是二選一。
  //
  //    ⚠️ 而動之前要先驗一件事：**我們的軸真的條件獨立嗎？** 看起來是，
  //    而那是猜的，沒量過。
  //
  // ## ⚠️ 而那篇論文還給了一個警告，它正好打中我們
  //
  //    > models ... continue to favor [factored representations] even when noise or
  //    > hidden dependencies undermine conditional independence, reflecting an
  //    > **inductive bias toward factoring at the cost of fidelity**.
  //
  //    我們在第 219 刀寫下「不做笛卡兒積，憲章 I（簡約優先）」，而它在 3D 域是錯的。
  //
  // > **對因子化的偏好是一種歸納偏誤。
  // > 我們跟 transformer 犯了同一個，而且把它寫成了一條通則。**
  const ordered = [...axes].sort((a, b) => a.priority - b.priority)
  const missed: string[] = []
  for (const axis of ordered) {
    const value = axisValue(axis, node, ctx)
    // 軸值取不到——**合法狀態，不出聲**。
    // 辨識查不到型別時刻意不寫該屬性（CK-1），而呼叫端也不一定知道呈現位置。
    if (value === undefined) continue
    const chosen = forms[formKey(axis.name, value)]
    if (chosen !== undefined) return { blockType: chosen }
    missed.push(`${axis.name} 的值「${value}」`)
  }

  // 每一條軸都取得到值、而沒有一條宣告了它——**宣告與資料不一致，必須看得見**。
  // 新增一種容器卻忘了加形態宣告，就會走到這裡。
  //
  // ⚠️ 而**只要有一條軸取不到值就不算降級**：那是合法狀態（見上）。
  if (missed.length > 0 && missed.length === ordered.length) {
    return {
      blockType: fallback,
      degraded: { reason: `形態軸 ${missed.join('、')}不在宣告的形態裡` },
    }
  }
  return { blockType: fallback }
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
  if (formSet.axes.length === 0 && axisValueCount > 0) {
    return { ok: false, reason: '沒有選擇軸卻宣告了軸值形態' }
  }
  if (formSet.axes.length > 0 && axisValueCount === 0) {
    return { ok: false, reason: '宣告了選擇軸卻沒有任何軸值形態——軸沒有作用' }
  }
  // 🔴 **每一條軸都要有自己的軸值形態**（2026-09-21）——一條沒有任何形態的軸
  //    只是一個沒有作用的宣告，而它會讓「這個身分有兩條軸」這句話變成假的。
  for (const a of formSet.axes) {
    const has = Object.keys(formSet.forms).some((k) => k.startsWith(`${a.name}:`))
    if (!has) return { ok: false, reason: `選擇軸「${a.name}」沒有任何軸值形態` }
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
  const othersOwn = new Set(others.flatMap((o) => (o.componentId === formSet.componentId ? [] : Object.values(o.forms))))
  for (const v of values) {
    if (othersOwn.has(v)) {
      return { ok: false, reason: `積木型別「${v}」已經屬於另一個元件身分——反推不出 componentId` }
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
export function singleForm(componentId: string, blockType: string): FormSet {
  return { componentId, axes: [], forms: { _: blockType }, fallback: blockType }
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
  /**
   * 依呈現位置：敘述版／運算式版。
   *
   * 🪦 它曾經是 `expressionCounterpart` 的一般化，而**那個舊機制 2026-09-14 退場了**
   * ——在此之前兩套並存，而且只有舊的那套真的在跑（這一條軸的 13 顆宣告全部落回中性）。
   * 軸值由渲染端餵：`PatternRenderer.render(node, ctx, position)`。
   */
  // 🔴 `priority: 1`——**它先問**。理由見 `FormAxis.priority` 的檔頭：
  //    這條軸決定的是「放不放得進那個插槽」，而另一條只換標籤。
  role: { name: 'role', from: 'position', priority: 1 },
  /** 依容器種類：堆疊／佇列／…。**只換標籤，所以後問。** */
  container_kind: { name: 'container_kind', from: 'property', property: 'container_kind', priority: 2 },
}

/** 建形態集合所需要的最小資訊——刻意不吃整個 BlockSpec，讓它好測 */
export interface FormDeclaration {
  componentId: string
  blockType: string
  form?: { axis: string; value: string }
}

/**
 * 把一堆積木宣告收攏成「每個元件身分一個形態集合」。
 *
 * ⚠️ **同一個 componentId 的第二個宣告不得蓋掉第一個**（FR-002）——
 * 那正是這個功能存在之前的實際行為（`Map.set` 直接覆寫）。
 */
export function buildFormSets(decls: readonly FormDeclaration[]): Map<string, FormSet> {
  const neutral = new Map<string, string>()
  /** 身分 → 軸名 → 軸值 → 積木型別。**兩層**，因為一個身分可以有不只一條軸。 */
  const variant = new Map<string, Map<string, Record<string, string>>>()

  for (const d of decls) {
    if (!d.form) {
      // 第一個中性宣告勝出——後來的不覆寫，否則載入順序會決定行為
      if (!neutral.has(d.componentId)) neutral.set(d.componentId, d.blockType)
      continue
    }
    // 🔴 **依軸分開收**（2026-09-21，第 219 刀）。
    //
    //    在此之前這裡是 `{ axis: d.form.axis, values: {…} }`：**第一條軸的名字
    //    寫進去之後就不再更新**，而後來每一條軸的值都被倒進同一個 `values`。
    //    於是 `cpp:container_push` 的 `role:expression` 變成
    //    `container_kind` 上的一個叫 `expression` 的值——永遠選不到。
    //
    // > **一個「只記得第一個」的欄位，在第二個出現的那天不會報錯
    // > ——它會安靜地把第二個當成第一個的一部分。**
    const byAxis = variant.get(d.componentId) ?? new Map<string, Record<string, string>>()
    const values = byAxis.get(d.form.axis) ?? {}
    values[d.form.value] = d.blockType
    byAxis.set(d.form.axis, values)
    variant.set(d.componentId, byAxis)
  }

  /** 把「軸名 → 軸值 → 型別」攤成 `forms` 的鍵，並收出用到的軸。 */
  const spread = (byAxis: Map<string, Record<string, string>>): {
    axes: FormAxis[]
    forms: Record<string, string>
  } => {
    const axes: FormAxis[] = []
    const forms: Record<string, string> = {}
    for (const [axisName, values] of byAxis) {
      const axis = KNOWN_AXES[axisName]
      // ⚠️ 認不得的軸名**整條丟掉**（連同它的形態）——留下來的話那些形態
      //    永遠選不到，而 `validateFormSet` 會說「沒有選擇軸卻宣告了軸值形態」。
      //    🔴 而它不是靜默的：`audit-lift-grammar` 那一族在宣告那一側擋著拼錯的軸名。
      if (!axis) continue
      axes.push(axis)
      for (const [v, blockType] of Object.entries(values)) forms[formKey(axisName, v)] = blockType
    }
    return { axes, forms }
  }

  const out = new Map<string, FormSet>()
  for (const [componentId, blockType] of neutral) {
    const byAxis = variant.get(componentId)
    if (!byAxis) {
      out.set(componentId, singleForm(componentId, blockType))
      continue
    }
    const { axes, forms } = spread(byAxis)
    if (axes.length === 0) { out.set(componentId, singleForm(componentId, blockType)); continue }
    out.set(componentId, {
      componentId,
      axes,
      forms: { [NEUTRAL_KEY]: blockType, ...forms },
      fallback: blockType,
    })
  }

  // 只有變體、沒有中性宣告 → 拿第一個變體當中性。
  // ⚠️ 那是一個**壞掉的宣告**，而這裡補不出聲——由 `validateFormSet` 擋下。
  for (const [componentId, byAxis] of variant) {
    if (out.has(componentId)) continue
    const { axes, forms } = spread(byAxis)
    const first = Object.values(forms)[0]
    if (first === undefined) continue
    out.set(componentId, {
      componentId,
      axes,
      forms: { [NEUTRAL_KEY]: first, ...forms },
      fallback: first,
    })
  }
  return out
}
