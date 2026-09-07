/**
 * **這一課你改了哪一邊**——積木 N 次、程式碼 M 次。
 *
 * ## 🔴 它是「拆輪子」看得見的那一格
 *
 * 使用者原話：「我希望這成為學生的**輔助輪**，最終是可以看懂程式碼的」。
 * 而一個輔助輪要拆得掉，**得先有人看得到它還在**。
 *
 * > 🟢 副作用可能比主作用大：**積木工具最缺的就是「我變強了」看得見**
 * > ——積木很有成就感，而學生說不出自己進步在哪。
 *
 * ## ⚠️ 只留在本機，而那不是「還沒做」
 *
 * 送出去就破〈離線可用〉的硬性零，而且**那個數字的價值在於它是給學生
 * 自己看的進度**，不是給我們看的數據。
 *
 * ## 🔴 而它刻意【不】走一層「學習訊號」的抽象
 *
 * `progress.ts` 的檔頭在 2026-09-04 就決定過同一件事，逐字：
 *
 * > 🔴 **先只做第三個**。把三件事一次抽象成「學習訊號」會長出一個
 * > 「什麼都裝得下」的介面，而那是假的父概念（沒有剪枝力）。
 *
 * ⚠️ 2026-09-07 一度有人（我）把「一層薄的學習訊號」寫成一條驗收，
 * 而用 `verify-before-deciding` 一驗就撞上這段註解。
 *
 * > **一條「我們該有一層抽象」的驗收，要先問【今天有幾個消費者】
 * > ——兩個以下，那層抽象裝得下的東西比它擋掉的多。**
 *
 * 🟢 所以它與 `progress` 共用的是**那個埠**（`KeyValueStore`），不是一個介面。
 */
import { MemoryKeyValueStore, type KeyValueStore } from './host/key-value-store'

const KEY = 'semorphe-edit-tally'

/**
 * 一次編輯來自哪一邊。
 *
 * ⚠️ 值域刻意**只有兩個**：`flow` 的編輯今天也記成 `blocks`
 * ——🔴 因為這個計數要回答的是「**他還在用圖形介面嗎**」，
 * 而流程圖與積木在那個問題上是同一邊。
 *
 * > **一個計數的值域，要跟著它要回答的那個問題走，
 * > 不是跟著資料的來源走。**
 */
export type EditSide = 'blocks' | 'code'

/** `<課程 id>` → `{ blocks: N, code: M }` */
export type Tally = Record<string, { blocks: number; code: number }>

let store: KeyValueStore = new MemoryKeyValueStore()

/** 組裝點在啟動時呼叫一次——⚠️ 與 `setProgressStore` 同一個時機。 */
export function setEditTallyStore(s: KeyValueStore): void {
  store = s
}

/** ⚠️ 讀壞掉的資料回空，不要丟錯——少幾個數字不值得讓整個應用停下來。 */
function read(): Tally {
  try {
    const raw = store.read(KEY)
    if (raw === null) return {}
    const o: unknown = JSON.parse(raw)
    if (o === null || typeof o !== 'object') return {}
    const out: Tally = {}
    for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
      if (v === null || typeof v !== 'object') continue
      const r = v as Record<string, unknown>
      const b = typeof r['blocks'] === 'number' ? r['blocks'] : 0
      const c = typeof r['code'] === 'number' ? r['code'] : 0
      if (b > 0 || c > 0) out[k] = { blocks: b, code: c }
    }
    return out
  } catch {
    return {}
  }
}

function write(t: Tally): void {
  try {
    store.write(KEY, JSON.stringify(t))
  } catch {
    // 無痕視窗、配額滿了——⚠️ 記不下來不該讓編輯失敗
  }
}

/**
 * 記一次編輯。
 *
 * ⚠️ **沒有課程 id 時什麼都不做**——自由練習不算進曲線裡，
 * 🔴 因為「拆輪子」是**一條課程的軌跡**，而不在課程裡的編輯沒有位置可放。
 */
export function tallyEdit(lessonId: string | undefined, side: EditSide): void {
  if (lessonId === undefined || lessonId === '') return
  const t = read()
  const mine = t[lessonId] ?? { blocks: 0, code: 0 }
  t[lessonId] = { ...mine, [side]: mine[side] + 1 }
  write(t)
}

/** 這一課的計數。⚠️ 沒有記錄時回兩個零，不是 `undefined`——呼叫端不必分兩種情況。 */
export function tallyOf(lessonId: string): { blocks: number; code: number } {
  return read()[lessonId] ?? { blocks: 0, code: 0 }
}

/**
 * 整條軌道加起來。
 *
 * 🔴 **它是「畢業」那個問題的資料**（「你最後五課有 80% 是直接寫程式碼的」）
 * ——⚠️ 而**要不要顯示、顯示在哪還沒拍板**：一個「你還在用積木」的數字，
 * 寫不好會變成**羞辱**而不是鼓勵。所以這一支只算，不決定怎麼講。
 *
 * > **一個關於使用者的數字，算得出來與該不該給他看，是兩個決定。**
 */
export function tallyOfTrack(trackId: string): { blocks: number; code: number } {
  const t = read()
  let blocks = 0
  let code = 0
  for (const [lessonId, v] of Object.entries(t)) {
    if (!lessonId.startsWith(`${trackId}/`)) continue
    blocks += v.blocks
    code += v.code
  }
  return { blocks, code }
}

/** 🔴 換一班學生——⚠️ 與 `clearProgress` 要**一起**被呼叫，不然清了一半。 */
export function clearEditTally(): void {
  try {
    store.remove(KEY)
  } catch {
    // 同上
  }
}
