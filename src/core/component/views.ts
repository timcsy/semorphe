/**
 * **視圖與格子**——`component.json` 的 `paths` 怎麼宣告「這顆元件有哪幾路」（spec 181，重構階段 2）。
 *
 * ```json
 * "paths": {
 *   "views": {
 *     "blocks": { "render": "./forms/blocks.json", "lift": "./forms/blocks.json" },
 *     "code":   { "render": "./generate.ts", "lift": "./lift-pattern.json" }
 *   },
 *   "formalize": "./formalize.ts",
 *   "execute": "./execute.ts"
 * }
 * ```
 *
 * ## 為什麼是「視圖 → 一對 render／lift」
 *
 * 舊的四個動詞（`render` 畫成積木、`extract` 從積木抽回、`generate` 產程式碼、`lift` 從程式碼辨識）
 * 把**哪個視圖**編進了動詞——加一個視圖就得發明兩個新動詞。使用者的理由：未來有程式以外的領域。
 * 現在動詞只有兩個（render、lift），視圖是宣告裡的鍵。
 *
 * ## 🔴 雙向還是單向，是**視圖**的性質
 *
 * 舊的紀律是「每一路都要列出，沒有的寫 `null` ＋ 理由」——分辨**顯式的空**與**遺漏的空**。
 * 若以「元件沒寫 lift」表示單向，遺漏的 lift 就會被當成單向而安靜放行。
 * 所以方向寫在下面的視圖表：雙向視圖兩個鍵都要列，單向視圖不得有 lift（research R4）。
 */

/** 一個視圖的方向。 */
export type ViewDirection = 'both' | 'render-only'

/** 視圖表：視圖名 → 方向。 */
export type ViewTable = Readonly<Record<string, ViewDirection>>

/**
 * 今天的視圖。**加一個視圖 ＝ 在這裡加一筆**（再到各元件的宣告裡寫它的 render／lift），不加動詞。
 */
export const VIEWS: ViewTable = {
  blocks: 'both',
  code: 'both',
}

/**
 * 格子：「一顆元件的一路」的統一名字——判定者對照、覆蓋護欄、實作檔掃描共用。
 * `<視圖>.<方向>` 對應 `paths.views.<視圖>.<方向>`；`formalize`／`execute` 不在 views 裡。
 */
export type Cell =
  | 'blocks.render' | 'blocks.lift'
  | 'code.render' | 'code.lift' | 'code.liftStrategy'
  | 'formalize' | 'execute'

export const CELLS: readonly Cell[] = [
  'blocks.render', 'blocks.lift', 'code.render', 'code.lift', 'code.liftStrategy', 'formalize', 'execute',
]

/** 一個視圖底下的宣告。 */
export interface ViewPaths {
  render: string | null
  lift?: string | null
  liftStrategy?: string
  [why: `_${string}_why`]: string | undefined
}

/** `component.json` 的 `paths`。 */
export interface ComponentPaths {
  views: Record<string, ViewPaths>
  formalize?: string
  execute: string | null
  _execute_why?: string
}

/** 舊的平鋪鍵——出現就擋（P8 不留轉接層）。 */
const RETIRED = ['render', 'extract', 'generate', 'lift', 'liftStrategy']

/**
 * 某一格宣告的檔案路徑；`null`（顯式的空）與沒宣告都回 `null`。
 * ⚠️ 讀 `paths` 的程式碼一律走這一支——不要再用字串拼鍵（舊鍵退場時沒有人會發現拼錯）。
 */
export function cellPath(paths: unknown, cell: Cell): string | null {
  const p = paths as Partial<ComponentPaths> | undefined
  if (!p) return null
  if (cell === 'formalize' || cell === 'execute') {
    const v = p[cell]
    return typeof v === 'string' ? v : null
  }
  const [view, dir] = cell.split('.') as [string, keyof ViewPaths]
  const v = p.views?.[view]?.[dir]
  return typeof v === 'string' ? v : null
}

/**
 * 驗證 `paths`（data-model 的五條）。**違反就 throw**，訊息說出是哪一顆、哪個視圖。
 * 登錄表在載入每一顆時呼叫它（C3）。
 */
export function checkPaths(paths: unknown, where: string, views: ViewTable = VIEWS): void {
  if (!paths || typeof paths !== 'object') throw new Error(`${where}：缺少 paths`)
  const p = paths as Record<string, unknown>

  const flat = RETIRED.filter((k) => k in p)
  if (flat.length > 0) {
    throw new Error(`${where}：paths 還有舊的平鋪鍵 ${flat.join('、')}——改成 paths.views.<視圖>.render／lift（spec 181）`)
  }

  const vs = p.views
  if (!vs || typeof vs !== 'object' || Object.keys(vs).length === 0) {
    throw new Error(`${where}：缺少 paths.views（至少一個視圖）`)
  }
  for (const [name, decl] of Object.entries(vs as Record<string, unknown>)) {
    const dirn = views[name]
    if (!dirn) throw new Error(`${where}：視圖「${name}」不在視圖表上——加一個視圖要先在 core/component/views.ts 的 VIEWS 加一筆`)
    const d = (decl ?? {}) as Record<string, unknown>
    if (!('render' in d)) throw new Error(`${where}：視圖「${name}」少了 render 鍵（沒有也要寫 null ＋ _render_why）`)
    if (dirn === 'both' && !('lift' in d)) {
      throw new Error(`${where}：視圖「${name}」是雙向的，少了 lift 鍵——沒有也要寫 null ＋ _lift_why（不然顯式的空與遺漏的空分不出來）`)
    }
    if (dirn === 'render-only' && 'lift' in d) throw new Error(`${where}：視圖「${name}」是單向的，不得有 lift`)
    for (const dir of ['render', 'lift']) {
      if (d[dir] === null && !d[`_${dir}_why`]) throw new Error(`${where}：視圖「${name}」的 ${dir} 是 null，必須在 _${dir}_why 說明理由`)
    }
  }

  if (!('execute' in p)) throw new Error(`${where}：paths 少了 execute（沒有也要寫 null ＋ _execute_why）`)
  if (p.execute === null && !p._execute_why) throw new Error(`${where}：paths.execute 是 null，必須在 _execute_why 說明理由`)
}
