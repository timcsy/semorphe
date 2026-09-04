/**
 * **跑之前先猜一下。**
 *
 * ## 🔴 目的是「他想過」，不是評量
 *
 * 使用者 2026-09-04：「總之**目的是要使用者想過**就是」。
 * 那句話把很多設計推掉了——沒有分數、沒有猜對率、沒有全班統計。
 *
 * 理論上它是 PRIMM 的第一個 P，而機制是**意外**：
 * 你猜過了，機器做的跟你想的不一樣，你才**想知道為什麼**。
 * 沒有猜的話，跑出來的東西你就只是接受它。
 *
 * > **一個預測錯了的學生，比一個沒有預測的學生更接近學會。**
 *
 * ## 🟢 而預測不是一個新功能，是【已經有的每一種回饋的前半段】
 *
 * ```
 * 輸出        → 猜輸出        揭曉：主控台 ＋ compareOutput   （裁判做好了）
 * 跑幾次      → 猜跑幾次      揭曉：×N 徽章                   （第三刀做的）
 * 哪些沒跑到  → 猜哪些沒跑到  揭曉：琥珀虛線框                （第二刀，還沒接）
 * 變數的值    → 猜最後的值    揭曉：變數面板                  （本來就有，還沒接）
 * ```
 *
 * 這一刀做前兩個——**它們的製作成本是零**：答案分別是 `check.stdout`
 * 與執行時本來就在數的次數，一課都不用改。
 *
 * ## 選擇題（2026-09-04 稍晚補上）
 *
 * 它的價值**全在「這個干擾項是哪個誤解」**——所以宣告裡的每一個錯選項
 * **必須**附上 `why`（`parseChoices` 會擋），而學生選錯時我們說的是
 * 那句 `why`，不是「不對」。
 *
 * ⚠️ **它不會被自動判定選中**：一個自動生成的干擾項只是一個隨機的錯答案，
 * 而學生選完之後你也不知道要跟他說什麼。**只有作者寫了才有。**
 */
import { loopNodes } from './iterations'
import type { LessonTask, PredictChoice } from './lesson'
import type { SemanticNode } from './types'

/** 宣告裡寫得出來的形式。⚠️ `none` 是**說出口的「這一題不問」**，不是漏掉。 */
export type PredictKind = 'output' | 'iterations' | 'none' | 'choice'

export interface PredictQuestion {
  readonly kind: 'output' | 'iterations' | 'choice'
  /** 問句本身。 */
  readonly prompt: string
  /** `iterations` 專用：問的是**哪一顆**迴圈——揭曉時那顆的徽章就在旁邊。 */
  readonly nodeId?: string
  /** `choice` 專用：那幾個選項（順序就是宣告的順序）。 */
  readonly choices?: readonly PredictChoice[]
}

/**
 * 這一次要問什麼——**問不出好問題就不要問**（回 `undefined`）。
 *
 * ## 自動判定的三條，而它們是【難度】不是口味
 *
 * ```
 * 恰好一顆迴圈       → 猜跑幾次   答案是一個數字，最好猜、最好答、最好比，
 *                                 而它正是差一錯誤住的地方
 * 沒有迴圈、輸出短   → 猜輸出
 * 其餘               → 不問
 * ```
 *
 * 🔴 **多顆迴圈時不問「跑幾次」**：那時「哪一顆」本身就是一個問題，
 * 而一個有歧義的問句拿到的答案沒有意義。
 *
 * 🔴 **輸出超過三行不問「猜輸出」**：叫學生預測 12 行輸出，那不是預測，
 * 那是抄寫——工作記憶會爆掉，而他學到的是「這個框很煩」。
 */
export const MAX_PREDICTABLE_LINES = 3

export function predictionFor(
  tree: SemanticNode | null | undefined,
  task: LessonTask | undefined,
): PredictQuestion | undefined {
  if (!tree || !task || task.predict === 'none') return undefined

  // 🔴 **選擇題只在作者寫了的時候才有**——`parseChoices` 已經擋掉
  //    「說是 choice 而沒有選項」，所以到這裡一定有。
  if (task.predict === 'choice' && task.choices) {
    return { kind: 'choice', prompt: '它會印出什麼？', choices: task.choices }
  }

  const loops = loopNodes(tree)
  const wantIterations = task.predict === 'iterations'
    || (task.predict === undefined && loops.length === 1)
  if (wantIterations) {
    // ⚠️ 宣告說要問，而樹上剛好不只一顆（或一顆都沒有）⟹ **不問**，
    //    不要挑一顆來問。宣告寫在課程上，而學生的程式是他自己的。
    if (loops.length !== 1 || loops[0]?.id === undefined) return undefined
    return { kind: 'iterations', prompt: '這個迴圈會跑幾次？', nodeId: loops[0].id }
  }

  const want = task.check?.stdout ?? ''
  const lines = want.replace(/\n+$/, '').split('\n')
  if (task.predict === 'output') {
    // 宣告明說要問輸出——⚠️ 那就問，**不用長度那一關**：
    //    課程作者比自動判定更知道這一課的學生撐不撐得住。
    return want === '' ? undefined : { kind: 'output', prompt: '它會印出什麼？' }
  }
  if (want === '' || lines.length > MAX_PREDICTABLE_LINES) return undefined
  return { kind: 'output', prompt: '它會印出什麼？' }
}

/**
 * **這支程式是不是還是剛才那一支。**
 *
 * 🔴 預測只在「你還不知道答案」時有意義——跑過一次之後再問同一件事，
 * 那是儀式，而學生一眼看穿。所以只在**程式改過之後的第一次執行**問。
 *
 * ⚠️ 屬性值要算進去：`i < 3` 改成 `i < 4` 是**另一支程式**，
 * 而它正是差一錯誤住的地方——漏掉的話那一次就不會問了。
 */
export function programSignature(tree: SemanticNode | null | undefined): string {
  if (!tree) return ''
  const parts: string[] = []
  const walk = (n: SemanticNode): void => {
    parts.push(n.componentId)
    for (const [k, v] of Object.entries(n.properties ?? {})) parts.push(`${k}=${String(v)}`)
    for (const [slot, list] of Object.entries(n.children ?? {})) {
      parts.push(`[${slot}`)
      for (const c of list ?? []) if (c) walk(c)
      parts.push(']')
    }
  }
  walk(tree)
  return parts.join('|')
}
