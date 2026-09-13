/**
 * **一份模板**——沒選課程時的起始程式。
 *
 * ## 它填的是哪一格
 *
 * ```
 * 沒選課程   目標 · 課程 · 【模板】 · 風格 · 語言 · 版面
 * 選了課程   目標 · 課程 · 【章節】 · 風格 · 語言 · 版面
 * ```
 *
 * ⚠️ 那一格今天不是真的空——有一個**隱形的預設**在跑（目標的 `skeleton`
 * ＋ 一支空的 `int main()`）。
 *
 * > 🎯 **這一刀真正做的是：把一個隱形的預設變成一個看得見的選項。**
 *
 * ## 🔴 它與課差在一格
 *
 * | | 課 | 模板 |
 * |---|---|---|
 * | 有順序 | ✅ | ❌ 平的 |
 * | **收窄可見元件** | ✅ `components` | ❌ **不收窄——它是「拿去改」** |
 * | 程式碼住哪 | 課文的 `## 完成的樣子` | **它自己** |
 *
 * 「不收窄」是關鍵：`draft/工具箱裡的範例` 逐字寫著「**範例過不了預組那條判準**
 * ——沒有人會『裝錯』一個範例，範例的價值不在防錯」。同理，
 * **一個把工具箱關掉的範例，學生改不動它**。
 */

export interface Template {
  /** 資料夾名，例如 `01-空白程式` */
  readonly id: string
  readonly name: string
  readonly description?: string
  /** 這份模板跑在哪個目標上——選了它就切過去 */
  readonly target: string
  /**
   * 選單裡的分組（`基本`／`輸入輸出`／`硬體`…）。
   *
   * 🔴 形狀抄 **Arduino IDE 的 Examples 選單**（使用者 2026-08-28：
   * 「這就很像是 ArduinoIDE 提供的那種範例」）——它分成
   * Basics／Digital／Analog／Communication…，而**那個分組本身就是一種教學順序**。
   */
  readonly group?: string
  /** 選單裡的順序，小的在前 */
  readonly order: number
  /** 起始程式（來自 `code.*`，**一個真的檔案**） */
  readonly code: string
}

export function parseTemplate(id: string, raw: unknown, code: string): Template {
  if (raw === null || typeof raw !== 'object') throw new Error(`模板 ${id}：不是一個物件`)
  const o = raw as Record<string, unknown>
  if (typeof o.name !== 'string' || o.name === '') throw new Error(`模板 ${id}：缺 name`)
  if (typeof o.target !== 'string' || o.target === '') throw new Error(`模板 ${id}：缺 target`)
  // 🔴 **沒有程式碼的模板不是模板**——它就是「什麼都不做」，而那已經是預設了。
  if (code.trim() === '') throw new Error(`模板 ${id}：起始程式是空的`)
  return {
    id,
    name: o.name,
    description: typeof o.description === 'string' ? o.description : undefined,
    target: o.target,
    group: typeof o.group === 'string' ? o.group : undefined,
    order: typeof o.order === 'number' ? o.order : 1e9,
    code,
  }
}
