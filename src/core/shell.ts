/**
 * **一份鷹架宣告**——哪幾段程式碼組成程式的外框，以及它們為什麼在那裡。
 *
 * ## 它從哪來
 *
 * 2026-08-28 使用者問「**鷹架應該也不只一個吧？算不算是一種元件？**」。
 * 量完現況，答案是三層而其中一層是假的：
 *
 * | 這一格 | 誰決定 | 當時 |
 * |---|---|---|
 * | 哪些元件**是**鷹架 | 元件的性狀（`scaffold`／`scaffoldInMain`） | 🟢 真的宣告 |
 * | **露多少** | 課程組態（`hidden`／`ghost`／`editable`） | 🟢 同日接上 |
 * | 外框**長什麼樣** | `Target.entryShell` | 🔴 **值域只有 `'main'` 與 `'none'`** |
 *
 * 🔴 **`'none'` 不是「Arduino 的鷹架」，它是「沒有鷹架」**
 * ——`cpp-scaffold.ts` 有一行 `if (entryShell === 'none') return {…全空}`，
 * 而那讓「一種外框」與「沒有外框」在程式碼裡分不出來。
 *
 * ## 🔴 它不是一顆元件
 *
 * ```
 * 元件    使用者拖得到 · 可以有很多顆 · 位置由他決定
 * 鷹架    使用者拖不到 · 每支程式恰好一份 · 位置固定在最外層
 * ```
 *
 * 而 `#include`／`func_def(main)`／`return` **本來就都是元件**。
 *
 * > **鷹架不是一顆新積木，是「哪幾段組成外框，以及它們為什麼在那裡」。**
 *
 * ## 這個模組不做什麼
 *
 * - **不管 `imports`**——那一段是**依賴解析器算出來的**（你用了 `cout` 才有
 *   `<iostream>`），不是宣告的。宣告只管固定的那三段。
 * - **不知道任何語言**——`code` 對它只是一個字串。
 */

export interface ShellLine {
  /** 產出的那一行程式碼，逐字 */
  readonly code: string
  /**
   * 幽靈模式下顯示的理由（「為什麼這一行在這裡」）。
   *
   * ⚠️ **每一行都要有**——一行沒有理由的鷹架，與一行學生看不懂的雜訊
   * 長得一模一樣，而那正是 `ghost` 這個模式存在的意義。
   */
  readonly reason: string
}

export interface Shell {
  readonly id: string
  readonly name: string
  /** 進入點**之前**（`using namespace std;`） */
  readonly preamble: readonly ShellLine[]
  /** 進入點本身（`int main() {`） */
  readonly entryPoint: readonly ShellLine[]
  /** 進入點**之後**（`return 0;`／`}`） */
  readonly epilogue: readonly ShellLine[]
}

export function parseShell(raw: unknown): Shell {
  if (raw === null || typeof raw !== 'object') throw new Error('鷹架宣告不是一個物件')
  const o = raw as Record<string, unknown>
  if (typeof o.id !== 'string' || o.id === '') throw new Error('鷹架宣告缺 id')
  if (typeof o.name !== 'string' || o.name === '') throw new Error(`鷹架 ${o.id} 缺 name`)
  const lines = (v: unknown, seg: string): ShellLine[] => {
    if (!Array.isArray(v)) throw new Error(`鷹架 ${String(o.id)} 的 ${seg} 不是陣列`)
    return v.map((x, i) => {
      const l = x as Record<string, unknown>
      if (typeof l?.code !== 'string') throw new Error(`鷹架 ${String(o.id)} 的 ${seg}[${i}] 缺 code`)
      // 🔴 理由是必填——見 `ShellLine.reason` 的註解
      if (typeof l?.reason !== 'string' || l.reason === '') {
        throw new Error(`鷹架 ${String(o.id)} 的 ${seg}[${i}]（${l.code}）缺 reason`)
      }
      return { code: l.code, reason: l.reason }
    })
  }
  return {
    id: o.id, name: o.name,
    preamble: lines(o.preamble, 'preamble'),
    entryPoint: lines(o.entryPoint, 'entryPoint'),
    epilogue: lines(o.epilogue, 'epilogue'),
  }
}

const shells = new Map<string, Shell>()

/** 語言套件在載入時把自己的鷹架推進來。 */
export function registerShell(s: Shell): void {
  shells.set(s.id, s)
}

export function shellById(id: string): Shell | undefined {
  return shells.get(id)
}

export function allShells(): ReadonlyMap<string, Shell> {
  return shells
}
