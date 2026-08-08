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
function writableArray(
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
function readCString(v: RuntimeValue): string {
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
function writeCString(arr: RuntimeValue[], s: string, from = 0): void {
  for (let i = 0; i < s.length && from + i < arr.length; i++) {
    arr[from + i] = { type: 'char', value: s[i] }
  }
  if (from + s.length < arr.length) arr[from + s.length] = { type: 'char', value: '\0' }
}

export function registerExecutors(
  register: (concept: string, executor: ConceptExecutor) => void,
): void {
  register('cpp:strlen', async (node, ctx) => {
    const strNodes = node.children.str ?? []
    if (strNodes.length === 0) return { type: 'int', value: 0 }
    const val = await ctx.evaluate(strNodes[0])
    return { type: 'int', value: String(val.value).length }
  })

  register('cpp:strcmp', async (node, ctx) => {
    const s1Nodes = node.children.s1 ?? []
    const s2Nodes = node.children.s2 ?? []
    const s1 = s1Nodes.length > 0 ? String((await ctx.evaluate(s1Nodes[0])).value) : ''
    const s2 = s2Nodes.length > 0 ? String((await ctx.evaluate(s2Nodes[0])).value) : ''
    if (s1 < s2) return { type: 'int', value: -1 }
    if (s1 > s2) return { type: 'int', value: 1 }
    return { type: 'int', value: 0 }
  })

  register('cpp:strcpy', async (node, ctx) => {
    const dest = writableArray(ctx as never, (node.children.dest ?? [])[0], 'strcpy 的目標')
    writeCString(dest, readCString(await ctx.evaluate((node.children.src ?? [])[0])))
  })

  register('cpp:strcat', async (node, ctx) => {
    const dest = writableArray(ctx as never, (node.children.dest ?? [])[0], 'strcat 的目標')
    const cur = readCString({ type: 'array', value: dest } as RuntimeValue)
    writeCString(dest, cur + readCString(await ctx.evaluate((node.children.src ?? [])[0])))
  })

  register('cpp:strncpy', async (node, ctx) => {
    const dest = writableArray(ctx as never, (node.children.dest ?? [])[0], 'strncpy 的目標')
    const n = ctx.toNumber(await ctx.evaluate((node.children.n ?? [])[0]))
    const src = readCString(await ctx.evaluate((node.children.src ?? [])[0]))
    // strncpy 的語義：只複製 n 個字元，**不保證結尾有 \0**
    for (let i = 0; i < n && i < dest.length; i++) {
      dest[i] = { type: 'char', value: src[i] ?? '\0' }
    }
  })

  register('cpp:strncmp', async (node, ctx) => {
    const s1Nodes = node.children.s1 ?? []
    const s2Nodes = node.children.s2 ?? []
    const nNodes = node.children.n ?? []
    const s1 = s1Nodes.length > 0 ? String((await ctx.evaluate(s1Nodes[0])).value) : ''
    const s2 = s2Nodes.length > 0 ? String((await ctx.evaluate(s2Nodes[0])).value) : ''
    const n = nNodes.length > 0 ? ctx.toNumber(await ctx.evaluate(nNodes[0])) : 0
    const sub1 = s1.substring(0, n)
    const sub2 = s2.substring(0, n)
    if (sub1 < sub2) return { type: 'int', value: -1 }
    if (sub1 > sub2) return { type: 'int', value: 1 }
    return { type: 'int', value: 0 }
  })

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
  for (const c of ['cpp:strchr', 'cpp:strstr']) {
    register(c, async () => {
      throw new RuntimeError(RUNTIME_ERRORS.UNDEFINED_FUNCTION, {
        '%1': `${c.replace('cpp_', '')} 回傳指向陣列中間的指標，這個直譯器還表示不了`,
      })
    })
  }

  register('cpp:memset', async (node, ctx) => {
    const arr = writableArray(ctx as never, (node.children.ptr ?? [])[0], 'memset 的目標')
    const v = await ctx.evaluate((node.children.value ?? [])[0])
    const size = ctx.toNumber(await ctx.evaluate((node.children.size ?? [])[0]))
    // 目標是字元陣列時要存**字元**——`'a'` 求值成數字 97，直接塞進去會讓
    // `cout << s` 印出 `979797`。
    const asChar = arr.length > 0 && arr[0]?.type === 'char'
    const fill: RuntimeValue = asChar
      ? { type: 'char', value: typeof v.value === 'number' ? String.fromCharCode(v.value) : String(v.value) }
      : { ...v }
    for (let i = 0; i < size && i < arr.length; i++) arr[i] = { ...fill }
  })

  register('cpp:memcpy', async (node, ctx) => {
    const dest = writableArray(ctx as never, (node.children.dest ?? [])[0], 'memcpy 的目標')
    const srcNode = (node.children.src ?? [])[0]
    const src = writableArray(ctx as never, srcNode, 'memcpy 的來源')
    const size = ctx.toNumber(await ctx.evaluate((node.children.size ?? [])[0]))
    for (let i = 0; i < size && i < dest.length && i < src.length; i++) dest[i] = { ...src[i] }
  })
}
