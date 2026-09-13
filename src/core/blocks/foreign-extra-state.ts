/**
 * **一顆積木的 `extraState` 不是只有它自己的東西。**
 *
 * ## 症狀
 *
 * ```python
 * def area(r: float) -> float:  # 圓面積      ← 貼進來
 * def area(r: float) -> float:                ← 按一下「積木→程式碼」，註解不見了
 * ```
 *
 * ## 為什麼
 *
 * 渲染那一路把**標註**（行末註解）與**降級原因**放進 `extraState`
 * （見 `block-renderer` 的 `attachMetaToExtraState`），而有 mutation 的積木
 * **自己實作了 `saveExtraState`／`loadExtraState`**：
 *
 * ```
 * load  ←  { paramCount: 1, annotations: [...] }     只讀走 paramCount
 * save  →  { paramCount: 1 }                          annotations 沒了
 * ```
 *
 * > **一個「我只認得我自己那幾個鍵」的還原函式，會把別人的鍵吃掉
 * > ——而它們正是使用者打的字。**
 *
 * ## 做法
 *
 * 包一層：載入時把**自己認不得的鍵**留著，存檔時原樣帶回去。
 * 「自己的鍵」不必宣告——**載入之後問一次 `saveExtraState()` 就知道**。
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

const WRAPPED = '__semorpheForeignExtraState'

/** 替一個積木原型接上「別人的鍵原樣帶著走」。**重複呼叫沒有副作用**。 */
export function preserveForeignExtraState(proto: any): void {
  if (!proto || proto[WRAPPED]) return
  const save = proto.saveExtraState
  const load = proto.loadExtraState

  // 🔴 **一顆【沒有 mutation】的積木，會把整份 `extraState` 丟掉**（2026-08-26）。
  //
  // 這裡本來寫 `if (typeof save !== 'function' …) return`——理由看起來很直觀：
  // 「沒有自己的鍵，就沒有『吃掉別人的鍵』這回事」。**而那是反的**：
  // Blockly 對一顆沒有 `save/loadExtraState` 的積木**根本不保存 extraState**
  // （實測：載入 `{ unresolved: true }` 再存回去，得到的是 `{}`）。
  //
  // 於是這個模組的檔頭寫的那個症狀——**使用者打的註解在「積木→程式碼」
  // 之後不見了**——在**宣告式積木上一直沒有被修**，而只有 mutation 積木被修了。
  //
  // ⚠️ 而它**每退一顆命令式定義就大一分**：那些積木退場之後全部變成宣告式。
  //
  // > **一個「有自己的鍵才需要保護別人的鍵」的判斷，
  // > 漏掉的正是「連自己的鍵都沒有」的那一大群。**
  if (typeof save !== 'function' || typeof load !== 'function') {
    proto[WRAPPED] = true
    proto.loadExtraState = function (state: any): void {
      this.foreignExtra_ = state && Object.keys(state).length > 0 ? state : undefined
    }
    // ⚠️ **沒有東西時回 `null`**——回 `{}` 的話每一顆積木的存檔都會多一格空的
    //    `extraState`，而那是一次無聲的存檔格式改動。
    proto.saveExtraState = function (): unknown {
      return this.foreignExtra_ ?? null
    }
    return
  }
  proto[WRAPPED] = true

  proto.loadExtraState = function (state: any, ...rest: unknown[]): void {
    load.call(this, state, ...rest)
    // ⚠️ **「我的鍵」是問出來的不是宣告的**——宣告一份就會與實作漂開
    const mine = new Set(Object.keys(save.call(this) ?? {}))
    const foreign: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(state ?? {})) {
      if (!mine.has(k)) foreign[k] = v
    }
    this.foreignExtra_ = Object.keys(foreign).length > 0 ? foreign : undefined
  }

  // 🔴 **包起來的那一份要留得下來**：有一條護欄靠**讀 `saveExtraState` 的原始碼**
  //    量「這顆積木存了哪些鍵」（宣告與命令式的比對），而一個包裝函式的原始碼
  //    裡一個鍵都沒有——症狀是**那一維整個瞎掉，而它不會變紅**。
  //    ⚠️ 那正是那條護欄自己的檔頭寫的：「一條只擋『變差』的棘輪，擋不住『量得更少』」。
  const wrapper = function (this: any, ...args: unknown[]): unknown {
    const mine = save.apply(this, args)
    const foreign = this.foreignExtra_
    if (!foreign) return mine
    // ⚠️ 自己那份是 `null`（例如零參數）時也要把別人的鍵留住
    return { ...((mine as Record<string, unknown>) ?? {}), ...foreign }
  }
  ;(wrapper as unknown as { __semorpheInner?: unknown }).__semorpheInner = save
  proto.saveExtraState = wrapper
}
