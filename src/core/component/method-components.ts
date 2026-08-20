/**
 * 「C++ 方法名 → 元件身分」的登錄表——**共用路由器的 case 塌成登錄**
 *
 * ## 為什麼需要它
 *
 * `cpp:string_find_first_not_of` 的 lift 是 `lifters/io.ts` 一個 switch 的
 * **兩個 case 標籤**，而身分是**樣板字串組出來的**：
 *
 * ```ts
 * case 'find_first_not_of':
 * case 'find_last_not_of':
 *   return createNode(`cpp:string_${method}`, { obj }, { arg: … })
 * ```
 *
 * ⚠️ 那一行的註解記著它害過一次：**模板字串組出來的身分，掃描器看不到**
 * ——命名空間遷移時它還組著舊前綴，而那不是字串字面，
 * 於是**兩顆概念安靜地建不出來**。
 *
 * 搬進膠囊順帶治了那個病：**身分變成字面字串，掃描器看得到。**
 *
 * ## 與 `single-arg-functions` 的差別
 *
 * 那張表是**自由函式**（`isalpha(x)`）；這張是**方法呼叫**（`s.find(x)`），
 * 節點多一個 `obj` 屬性。判別邏輯（找 field_expression、取 obj 與引數）
 * 留在共用檔，**資料**回到膠囊。
 *
 * ## ⚠️ 核心給機制、套件給資料
 *
 * 表是空的。與 `container-templates.ts`／`single-arg-functions.ts` 同一個處置。
 */

/** 一個方法名對應的節點形狀。 */
export interface MethodComponentShape {
  componentId: string
  /**
   * 引數依序放進哪些子節點槽。空陣列 = 這個方法不吃引數（`s.length()`）。
   *
   * ⚠️ **槽名是契約**，與 `component.json` 的 `children` 必須一致，
   * 否則產生器讀不到——而那是安靜的（子節點是空陣列，不是錯誤）。
   */
  argSlots: string[]
  source: string
}

const table = new Map<string, MethodComponentShape>()

/**
 * 登錄一個方法名。
 *
 * @param methodName C++ 的方法名（`find_first_not_of`…）
 * @param componentId 對應的元件身分——**寫成字面字串**，別用樣板組
 * @param source 誰登錄的——膠囊填自己的資料夾
 */
export function registerMethodComponent(
  methodName: string,
  componentId: string,
  source: string,
  argSlots: string[] = ['arg'],
): void {
  const existing = table.get(methodName)
  if (existing && existing.componentId !== componentId) {
    throw new Error(
      `方法名「${methodName}」被登錄兩次且指向不同身分：` +
        `${existing.componentId}（${existing.source}）與 ${componentId}（${source}）。` +
        `不自動取其一——靜默覆蓋的症狀是「某個方法被辨識成另一個概念」。`,
    )
  }
  table.set(methodName, { componentId, argSlots, source })
}

/** 方法名 → 元件身分。認不得回傳 `undefined`（不是猜一個看起來合理的）。 */
export function componentForMethod(methodName: string): string | undefined {
  return table.get(methodName)?.componentId
}


/** 方法名 → 完整形狀（含引數槽名）。 */
export function methodComponentFor(methodName: string): MethodComponentShape | undefined {
  return table.get(methodName)
}

/** 護欄用：每一筆是誰登錄的。 */
export function methodComponentSources(): [methodName: string, source: string][] {
  return [...table.entries()].map(([k, v]) => [k, v.source])
}

/**
 * **容器方法**的登錄表——與上面那張分開，因為**查詢點不同**。
 *
 * ⚠️ 上面那張（`methodComponentFor`）在路由器**早期**被查，直接建節點。
 * 而容器方法要先做兩件事才建得出正確的節點：
 *
 * 1. **依接收者型別分派**（`s.clear()` 是字串版、`v.clear()` 是容器版）
 * 2. **記下 `container_kind`**——`st.push(x)` 與 `q.push(x)` 行為相同，
 *    而積木上該說「推到頂端」還是「加到尾端」不同。那是形態的事。
 *
 * 塞進同一張表的話，早期那次查詢會**先攔截**，於是型別分派與
 * `container_kind` 都不會發生——**而那不會報錯，只會安靜地產生一個少了資訊的節點。**
 *
 * > **兩個查詢點就是兩張表。**
 */
const containerMethodTable = new Map<string, { componentId: string; source: string }>()

export function registerContainerMethodComponent(methodName: string, componentId: string, source: string): void {
  const existing = containerMethodTable.get(methodName)
  if (existing && existing.componentId !== componentId) {
    throw new Error(
      `容器方法「${methodName}」被登錄兩次且指向不同身分：` +
        `${existing.componentId}（${existing.source}）與 ${componentId}（${source}）。`,
    )
  }
  containerMethodTable.set(methodName, { componentId, source })
}

/** 容器方法名 → 元件身分。認不得回傳 `undefined`。 */
export function containerMethodComponent(methodName: string): string | undefined {
  return containerMethodTable.get(methodName)?.componentId
}

/**
 * **依接收者型別分派**的方法表——第三張，理由同樣是**查詢點不同**。
 *
 * `s.clear()` 是字串版、`v.clear()` 是容器版；`pq.top()` 回傳**最大的**，
 * 而通用的 `top` 回傳最後推入的。這些差別只有**型別查得到時**才成立。
 *
 * ⚠️ 型別查不到時**不猜**——留在通用版。
 * **猜一個錯的專屬身分比誠實降級更糟**（原註解的原話）。
 */
const typeMethodTable = new Map<string, Map<string, { componentId: string; source: string }>>()

export function registerTypedMethodComponent(type: string, methodName: string, componentId: string, source: string): void {
  const m = typeMethodTable.get(type) ?? new Map()
  const existing = m.get(methodName)
  if (existing && existing.componentId !== componentId) {
    throw new Error(
      `「${type}.${methodName}」被登錄兩次且指向不同身分：` +
        `${existing.componentId}（${existing.source}）與 ${componentId}（${source}）。`,
    )
  }
  m.set(methodName, { componentId, source })
  typeMethodTable.set(type, m)
}

/** 型別 ＋ 方法名 → 元件身分。查不到回 `undefined`——**不猜**。 */
export function typedMethodComponent(type: string, methodName: string): string | undefined {
  return typeMethodTable.get(type)?.get(methodName)?.componentId
}
