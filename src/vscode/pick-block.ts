/**
 * 挑一顆積木放上空白畫布——**而判準全部是結構性的**。
 *
 * ## 🔴 這個檔裡不得出現任何 conceptId 字串
 *
 * 兩個理由指向同一件事：
 *
 * ```
 * 規格   FR-004：那顆積木的定義 MUST 來自登錄表
 *        ⚠️ 手寫一顆假的也能讓畫布上有東西——而那證明的是「Blockly 能跑」，
 *           不是「Semorphe 的核搬得過去」。那是兩件完全不同的事。
 * 護欄   第二十八條（膠囊就近性）反向問「資料夾裡的東西都屬於這顆元件嗎」
 *        → 寫死 'cpp:…' 會紅
 * ```
 *
 * > **護欄與規格在這裡指向同一件事，那通常表示判準是對的。**
 *
 * ## ⚠️ 而「取第一顆」是錯的，那有病歷
 *
 * `lift-branches.ts:26` 逐字：
 *
 * > 「登錄順序來自 `import.meta.glob` 的檔名排序，**那不是任何人設計的**」
 *
 * **一個依賴載入順序的挑選，會在有人新增一顆膠囊的那天安靜地換一顆積木。**
 * 所以下面的排序有一個**必然唯一**的尾鍵（`blockDef.type` 字典序）。
 */
import type { BlockSpec } from '../core/types'

interface RawBlockDef {
  type?: string
  message0?: string
  args0?: unknown[]
  previousStatement?: unknown
  nextStatement?: unknown
}

const defOf = (spec: BlockSpec): RawBlockDef => (spec.blockDef ?? {}) as RawBlockDef

/** 欄位數——愈少愈「簡單」。 */
const argCount = (spec: BlockSpec): number => (defOf(spec).args0 ?? []).length

/**
 * 放得上空白畫布的候選。
 *
 * 四個條件，⚠️ **後兩個都不顯然，而第四個是實測撞出來的**：
 *
 * 1. 有 `blockDef.type`——沒有的話 Blockly 註冊不了
 * 2. 是**中性形態**（`form` 未宣告）——`block-spec-registry.ts:76` 記著
 *    「一個元件身分可以有多個形態」
 * 3. ⚠️ **站得住**：有 `previousStatement` 或 `nextStatement`。
 *    運算式形態只有 `output`——它在空白畫布上**接不到任何東西**，
 *    放上去會讓人以為積木壞了。
 * 4. 🔴 **JSON 真的描述了這顆積木**：`message0` 存在。
 *
 * ## 第四條的由來（2026-08-17 實測）
 *
 * 第一版沒有這一條，於是「欄位最少」挑到 `cpp_array_2d_declare`——
 * **而它的 `blockDef` 沒有 `message0` 也沒有 `args0`**：
 *
 * ```
 * 我以為   args0 長度 0 = 最簡單
 * 實際     args0 長度 0 = 這份 JSON 根本沒在描述這顆積木
 * ```
 *
 * 它的真正定義是命令式的，住在 `ui/block-registrar.ts:503`
 * （動態插槽要 `+`／`-` 按鈕，宣告式的 `args0` 描述不了）。
 *
 * > **一顆定義住在別處的積木，證明不了「積木來自登錄表」。**
 *
 * 而 FR-004 要證的正是那件事。實測：209 筆規格裡
 * 「JSON 完整描述且站得住」的有 **103** 顆。
 */
export function placeableSpecs(specs: BlockSpec[]): BlockSpec[] {
  return specs.filter((spec) => {
    if (spec.form) return false
    const def = defOf(spec)
    if (!def.type || !def.message0) return false
    return 'previousStatement' in def || 'nextStatement' in def
  })
}

/**
 * 挑最簡單的那一顆。
 *
 * @throws 候選為空時**拋錯**——⚠️ 回 `undefined` 的話呼叫端會在別的地方炸，
 *         而錯誤出現在離根因很遠的地方（`experience`「靜默降級反模式」）。
 */
export function pickSimplestBlock(specs: BlockSpec[]): BlockSpec {
  const candidates = placeableSpecs(specs)
  if (candidates.length === 0) {
    throw new Error(
      `登錄表裡沒有放得上空白畫布的積木（收到 ${specs.length} 筆規格）。` +
        '若這個數字是 0，代表膠囊登錄表根本沒被打包進來——見 core/component/registry.ts 檔頭。',
    )
  }
  // ⚠️ 尾鍵是**必然唯一**的（blockDef.type 是積木的主鍵），
  // 所以整個排序對輸入順序不敏感。
  return candidates.reduce((best, spec) => {
    const d = argCount(spec) - argCount(best)
    if (d !== 0) return d < 0 ? spec : best
    return defOf(spec).type! < defOf(best).type! ? spec : best
  })
}
