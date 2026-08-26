/**
 * **流程視圖上那些字叫什麼**——標題、位置名、值的顯示文字。
 *
 * ## 為什麼需要它（2026-08-26，使用者：「上面的名稱要設計過」）
 *
 * 在此之前流程節點直接印內部詞彙：
 *
 * ```
 * func_def      name: main    return_type: int
 * loop_count    from  to  inclusive: FALSE   var_name: i   body
 * ```
 *
 * 而 `principles.md:126` 逐字：
 * 「**使用者看得到的所有文字都是介面**，包含 mutator 彈窗內的 label」。
 *
 * ⚠️ **`FALSE` 比其他三個更糟**：它是那個下拉的 **value**，
 * 而同一格在積木上顯示的是「到（不含）」。
 * > **同一個真實，兩個投影說不同的話。**
 *
 * ## 🔴 為什麼不能直接借積木的 `message0`
 *
 * `U_FUNC_DEF_MSG0` 是「定義函式 %1（%2）回傳 %3」——**一句話**，
 * 因為積木本身就是那句話，空格內嵌在裡面。
 * 而流程節點是**一個盒子**：一個名詞 ＋ 幾列具名欄位。
 *
 * > **積木是一句話，流程節點是一張表。同一份文案餵不了兩種形。**
 *
 * ⚠️ 而「砍掉第一個 `%` 之前那一段」也不行：**233 顆裡 96 顆的開頭是空的**
 * （`cpp:bits_count` 的訊息以 `%1` 開頭），砍出來是空字串。
 *
 * ## 兩層，而它們的修法不同
 *
 * ```
 * 設計過的   膠囊宣告 `FLOW_TITLE_<SCOPE>_<NAME>`／`FLOW_SLOT_<KEY>`   ← 逐顆寫
 * 退路       積木的【整句話】，插槽換成「…」                          ← 一條退路
 * ```
 *
 * 🔴 **退路仍然是介面文字**，所以「不出現代號」那條原則**現在就成立**，
 * 不必等 507 條文案寫完。而「還有幾顆在用退路」由棘輪盯著
 * ——第七十八條護欄把這兩個數字**分開**，因為
 * **混在一起的話「補一條退路」會看起來像「設計了 233 個名字」**。
 *
 * ## ⚠️ 位置名沒有退路，所以沒設計過就【不顯示】
 *
 * 標題退得到積木那句話，而**一個插槽（`initializer`／`body`）在積木上根本沒有名字**
 * ——它是句子裡的一個空格。硬要顯示只能顯示 `initializer`，那就是代號。
 *
 * → 沒有設計過的位置**只顯示值，不顯示名字**（P4 漸進揭露）。
 */
import { msg } from '../messages'

/**
 * **問積木那張表**——流程視圖要拿「那句話」與「下拉的顯示文字」。
 *
 * 🔴 它是一個**埠**：`core/flow` 不認識 `BlockSpecRegistry`，
 * 宿主把它接上來（`vision.md` 那條「面板只 import 協定」的 `appearance` 那一格）。
 * 沒接的宿主（Node、`examples/bring-your-own-view/`）兩支都回 `null`，
 * 而那時退路是「不顯示名字」——**不是顯示代號**。
 */
export interface FlowLabelSource {
  /** 這顆積木的整句話（含 `%1` 這種佔位符）。 */
  blockLabel(componentId: string): string | null
  /** 這個欄位的這個值，在積木上顯示成什麼（下拉才有）。 */
  optionLabel(componentId: string, field: string, value: string): string | null
}

/** `cpp:func_def` → `CPP_FUNC_DEF`。⚠️ **冒號換底線**，不丟掉 scope。 */
function keyOf(componentId: string): string {
  return componentId.replace(/[^A-Za-z0-9]/g, '_').toUpperCase()
}

const NOT_DESIGNED = ''

/**
 * 把積木的**原始** `message0` 收成一個標題。
 *
 * ⚠️ **`%{BKY_X}` 不是已經展開的**——它是 Blockly 在 `jsonInit` 時才解析的
 * i18n 參照，而流程視圖沒有走那一步。2026-08-26 第一版假設它展開過，
 * 於是畫面上印出 `%{BKY_C_INCLUDE_MSG0}`——**比原本的 `include` 更內部**。
 *
 * > **一個「拿到時應該已經處理過」的假設，寫在註解裡不會讓它成真。**
 *
 * 🔴 而那三版護欄都放它過了（判準只認「等於那個鍵」）——
 * 抓到它的是**開瀏覽器看**。
 */
export function collapseBlockMessage(raw: string): string {
  return raw
    .replace(/%\{BKY_([A-Za-z0-9_]+)\}/g, (_, k: string) => msg(k, ''))
    .replace(/%\d+/g, '…')
    .replace(/…(\s*…)+/g, '…')
    .replace(/\s+/g, ' ')
    .trim()
}

/** 設計過的節點標題；沒有就回 `null`。 */
export function designedTitle(componentId: string): string | null {
  return msg(`FLOW_TITLE_${keyOf(componentId)}`, NOT_DESIGNED) || null
}

/**
 * 設計過的位置名（欄位或接點都走這裡——**它們是同一份詞彙**：
 * 「這個具名的位置叫什麼」，是屬性還是接點是結構差別不是命名差別）。
 *
 * 先問這顆自己的覆蓋，再問共用的那份。
 */
export function designedSlotName(componentId: string, key: string): string | null {
  const k = keyOf(key)
  return (
    msg(`FLOW_SLOT_${keyOf(componentId)}_${k}`, NOT_DESIGNED) ||
    msg(`FLOW_SLOT_${k}`, NOT_DESIGNED) ||
    null
  )
}

/**
 * **節點標題**：設計過的優先，否則退到積木那句話（插槽換成「…」）。
 *
 * ⚠️ 連積木那句話都拿不到時回 `null`——呼叫端要**畫一個沒有標題的盒子**，
 * 而不是把身分印上去。
 */
export function flowTitle(componentId: string, src?: FlowLabelSource): string | null {
  const designed = designedTitle(componentId)
  if (designed) return designed
  const raw = src?.blockLabel(componentId)
  if (!raw) return null
  return collapseBlockMessage(raw) || null
}

/** **位置名**：設計過的才顯示。沒有就回 `null`（＝這一列只顯示值）。 */
export function flowSlotName(componentId: string, key: string): string | null {
  return designedSlotName(componentId, key)
}

/**
 * **值的顯示文字**：下拉的話問積木顯示什麼，否則原樣。
 *
 * 🔴 這一格修的是 `inclusive: FALSE`——`FALSE` 是 value，
 * 而積木上那一格顯示「到（不含）」。
 */
export function flowValue(
  componentId: string,
  field: string,
  raw: string,
  src?: FlowLabelSource,
): string {
  return src?.optionLabel(componentId, field, raw) ?? raw
}

/** 一份積木宣告裡，這個埠需要的那幾格。⚠️ **結構型別**——core 不認識 `BlockSpecRegistry`。 */
export interface BlockSpecLike {
  blockDef?: { message0?: unknown; args0?: unknown }
  renderMapping?: { fields?: Record<string, string> }
}

/**
 * **把一份積木登錄表接成流程視圖的標籤埠**——面板與護欄**共用這一份**。
 *
 * 🔴 兩邊各寫一份的代價 2026-08-26 當場付了：面板拿屬性名 `inclusive` 去比
 * `args0` 的名字，而那個欄位叫 `BOUND`（對映寫在 `renderMapping.fields`）。
 * **護欄的替身犯一模一樣的錯，所以它看不見那個缺陷**——畫面上 `FALSE` 還在，
 * 而報表說 0。
 *
 * > **一個與被測者犯同樣錯誤的替身，會誠實地回報「沒問題」。**
 */
export function labelSourceFromSpecs(
  get: (componentId: string) => BlockSpecLike | undefined,
): FlowLabelSource {
  return {
    blockLabel: (componentId) => {
      const m = get(componentId)?.blockDef?.message0
      return typeof m === 'string' ? m : null
    },
    optionLabel: (componentId, property, value) => {
      const spec = get(componentId)
      if (!spec) return null
      // 屬性名 → 積木欄位名。`renderMapping.fields` 是 `欄位 → 屬性`，這裡要反過來查。
      const map = spec.renderMapping?.fields ?? {}
      const fieldNames = Object.entries(map)
        .filter(([, prop]) => prop === property)
        .map(([field]) => field)
      // ⚠️ 沒有對映時**退回屬性名本身**——有些積木的欄位名就等於屬性名。
      const candidates = fieldNames.length > 0 ? fieldNames : [property]
      const args = spec.blockDef?.args0
      if (!Array.isArray(args)) return null
      for (const a of args as Array<Record<string, unknown>>) {
        if (!candidates.includes(String(a.name)) || !Array.isArray(a.options)) continue
        for (const opt of a.options as Array<[string, string]>) {
          if (opt[1] === value) {
            // 選項的顯示文字也可能是 `%{BKY_X}`
            return /^%\{BKY_/.test(opt[0]) ? collapseBlockMessage(opt[0]) : opt[0]
          }
        }
      }
      return null
    },
  }
}
