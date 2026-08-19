/**
 * 一條**共同的**診斷時間軸。
 *
 * ## 🔴 為什麼需要它
 *
 * 2026-08-19 查「Cmd+Z 之後 `int x;` 跑到檔案最後」時，卡在這裡：
 * 積木事件與檔案寫入各自有一份環形紀錄，**而它們沒有共同的順序**。
 *
 * ```
 * 最近被判成使用者編輯的積木事件：  create｜cpp_var_declare｜頂層 2 顆
 * 最近的寫入：                      ✏️ 2–10 → 5 行｜6 → 7 行
 * ```
 *
 * ⚠️ 那個 `create` 是在那次寫入**之前**還是**之後**？兩份表都答不出來
 * ——而那正是判斷因果的唯一問題。
 *
 * > **兩份各自正確的日誌，如果沒有共同的順序，
 * > 它們合起來能講的故事比任何一份單獨講的還少。**
 *
 * 🔴 而最關鍵的那一則本來**誰都沒有記**：**「重畫」發生在哪裡**。
 * 一則積木事件屬於重畫前還是重畫後的世界，決定了它是不是合法的使用者動作。
 *
 * ## 為什麼是全域而不是傳進去
 *
 * 記錄的兩端（積木面板、程式碼視圖）**互相不認識**，而它們都不該為了
 * 診斷去多接一個相依。這是**環境**不是組態——同 `main.ts` 對 Blockly media 的處置。
 */

/** 保留幾則。⚠️ 太少的話重畫會把有用的那幾則擠掉。 */
const CAPACITY = 40

const lines: string[] = []
let seq = 0
let lastAt = 0

/**
 * 記一則。
 *
 * 每一則帶**序號**與**距離上一則幾毫秒**——⚠️ 後者不是效能量測，
 * 是用來看「這幾則是同一批（0–2 ms）還是分開的動作（幾百 ms）」。
 */
export function diagNote(line: string): void {
  const now = Date.now()
  const gap = lastAt === 0 ? 0 : now - lastAt
  lastAt = now
  seq += 1
  lines.push(`${String(seq).padStart(3, ' ')}｜+${String(gap).padStart(5, ' ')}ms｜${line}`)
  while (lines.length > CAPACITY) lines.shift()
}

export function diagLines(): readonly string[] {
  return lines
}
