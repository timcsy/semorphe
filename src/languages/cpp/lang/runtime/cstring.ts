/**
 * **C 字串的執行期表示** —— 與身分無關的演算法
 *
 * 從 `std/cstring/executors.ts` 提出來。那個模組的元件全部搬進膠囊之後，
 * 模組資料夾整個刪掉了（`history/047`：**模組是中途站，不是終點**），
 * 而 `writableArray`／`readCString`／`writeCString` 是**五顆膠囊共用的知識**
 * ——不屬於其中任何一顆。
 *
 * > **共用的是演算法，不是身分。**
 */
import type { SemanticNode } from '../../../../core/types'
import { RuntimeError, RUNTIME_ERRORS } from '../../../../interpreter/errors'
import type { RuntimeValue } from '../../../../interpreter/types'


/**
 * 取得「可以寫進去」的目標陣列。
 *
 * `strcpy(s, "hi")` 的 `dest` 是一個 `var_ref` 節點——**求值只會拿到副本**，
 * 要改變 `s` 必須從節點取變數名、再去 scope 拿那個陣列本身。
 *
 * **解析不了時擲錯，不回傳「沒事」**——原本這五個都是空操作，於是
 * `strcpy(s, "hi"); cout << s;` 印出 `[array]`，而使用者不知道發生什麼事。
 */
export function writableArray(
  ctx: { scope: { get(n: string): { type: string; value: unknown } | undefined } },
  node: SemanticNode | undefined,
  what: string,
): RuntimeValue[] {
  const name = String(node?.properties?.name ?? '')
  if (!name) throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, { '%1': `${what} 不是可寫入的變數` })
  const v = ctx.scope.get(name)
  if (!v || v.type !== 'array' || !Array.isArray(v.value)) {
    throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, { '%1': `${name} 不是字元陣列` })
  }
  return v.value as RuntimeValue[]
}

/** 把 RuntimeValue 讀成字串（字元陣列 → 到第一個 \0 為止） */
export function readCString(v: RuntimeValue): string {
  if (typeof v.value === 'string') return v.value
  if (Array.isArray(v.value)) {
    const out: string[] = []
    for (const c of v.value as RuntimeValue[]) {
      const s = String(c?.value ?? '')
      if (s === '' || s === '\0') break
      out.push(s)
    }
    return out.join('')
  }
  return String(v.value ?? '')
}

/** 把字串寫進字元陣列，補上結尾的 \0 */
export function writeCString(arr: RuntimeValue[], s: string, from = 0): void {
  for (let i = 0; i < s.length && from + i < arr.length; i++) {
    arr[from + i] = { type: 'char', value: s[i] }
  }
  if (from + s.length < arr.length) arr[from + s.length] = { type: 'char', value: '\0' }
}

