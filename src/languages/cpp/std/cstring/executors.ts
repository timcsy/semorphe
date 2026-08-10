/**
 * `<cstring>` 的執行路——膠囊的第五面牆。
 *
 * 在此之前它住在 `src/interpreter/executors/strings.ts`，讓核心層認識了 10 個 C++ 專屬的概念身分。
 *
 * 見 specs/054-execute-into-capsules/
 */
import { RuntimeError, RUNTIME_ERRORS } from '../../../../interpreter/errors'
import type { ConceptExecutor } from '../../../../interpreter/executor-registry'
import type { SemanticNode } from '../../../../core/types'
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

export function registerExecutors(
  register: (concept: string, executor: ConceptExecutor) => void,
): void {












  /**
   * `strchr` / `strstr` 回傳**指向陣列中間的指標**。
   *
   * 這個直譯器的指標存的是「被指變數的名字」，表示不了「指向 s 的第 3 個
   * 字元」——那需要 (基底, 位移) 的表示法，是一個真的功能。
   *
   * ⚠️ **但原本的做法是靜默回傳 0**，於是 `strchr(s, 'l') != 0` 對一個
   * 找得到的字元也是假：`while ((p = strchr(...)) != 0)` **一次都不跑**，
   * 而程式照樣跑完、印出後面的東西。
   *
   * **出聲。** 使用者可以選擇跳過或中止，但不會拿到一個安靜的錯答案。
   * 這是「靜默降級是 bug 的藏身之處」的直接應用。
   */
  for (const c of ['cpp:cstring_find_char', 'cpp:cstring_find']) {
    register(c, async () => {
      throw new RuntimeError(RUNTIME_ERRORS.UNDEFINED_FUNCTION, {
        '%1': `${c.replace('cpp_', '')} 回傳指向陣列中間的指標，這個直譯器還表示不了`,
      })
    })
  }




}
