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
export interface MethodConceptShape {
  conceptId: string
  /**
   * 引數依序放進哪些子節點槽。空陣列 = 這個方法不吃引數（`s.length()`）。
   *
   * ⚠️ **槽名是契約**，與 `component.json` 的 `children` 必須一致，
   * 否則產生器讀不到——而那是安靜的（子節點是空陣列，不是錯誤）。
   */
  argSlots: string[]
  來源: string
}

const 表 = new Map<string, MethodConceptShape>()

/**
 * 登錄一個方法名。
 *
 * @param 方法名 C++ 的方法名（`find_first_not_of`…）
 * @param conceptId 對應的元件身分——**寫成字面字串**，別用樣板組
 * @param 來源 誰登錄的——膠囊填自己的資料夾
 */
export function registerMethodConcept(
  方法名: string,
  conceptId: string,
  來源: string,
  argSlots: string[] = ['arg'],
): void {
  const 先來的 = 表.get(方法名)
  if (先來的 && 先來的.conceptId !== conceptId) {
    throw new Error(
      `方法名「${方法名}」被登錄兩次且指向不同身分：` +
        `${先來的.conceptId}（${先來的.來源}）與 ${conceptId}（${來源}）。` +
        `不自動取其一——靜默覆蓋的症狀是「某個方法被辨識成另一個概念」。`,
    )
  }
  表.set(方法名, { conceptId, argSlots, 來源 })
}

/** 方法名 → 元件身分。認不得回傳 `undefined`（不是猜一個看起來合理的）。 */
export function conceptForMethod(方法名: string): string | undefined {
  return 表.get(方法名)?.conceptId
}


/** 方法名 → 完整形狀（含引數槽名）。 */
export function methodConceptFor(方法名: string): MethodConceptShape | undefined {
  return 表.get(方法名)
}

/** 護欄用：每一筆是誰登錄的。 */
export function methodConceptSources(): [方法名: string, 來源: string][] {
  return [...表.entries()].map(([k, v]) => [k, v.來源])
}

/**
 * **容器方法**的登錄表——與上面那張分開，因為**查詢點不同**。
 *
 * ⚠️ 上面那張（`methodConceptFor`）在路由器**早期**被查，直接建節點。
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
const 容器方法表 = new Map<string, { conceptId: string; 來源: string }>()

export function registerContainerMethodConcept(方法名: string, conceptId: string, 來源: string): void {
  const 先來的 = 容器方法表.get(方法名)
  if (先來的 && 先來的.conceptId !== conceptId) {
    throw new Error(
      `容器方法「${方法名}」被登錄兩次且指向不同身分：` +
        `${先來的.conceptId}（${先來的.來源}）與 ${conceptId}（${來源}）。`,
    )
  }
  容器方法表.set(方法名, { conceptId, 來源 })
}

/** 容器方法名 → 元件身分。認不得回傳 `undefined`。 */
export function containerMethodConcept(方法名: string): string | undefined {
  return 容器方法表.get(方法名)?.conceptId
}
