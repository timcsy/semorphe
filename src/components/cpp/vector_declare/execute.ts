/**
 * `cpp:vector_declare` 的 **execute** 路
 *
 * 從 `src/languages/cpp/std/vector/executors.ts` **原封搬過來**——搬移不重寫。
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { evalInitializer } from '../../../interpreter/aggregate'
import type { RuntimeValue } from '../../../interpreter/types'

/** 深拷貝——每一格獨立，見下方 `fill` 的註解 */
function cloneValue(v: RuntimeValue): RuntimeValue {
  if (v.type === 'array' && Array.isArray(v.value)) {
    return { ...v, value: v.value.map((x) => cloneValue(x as RuntimeValue)) }
  }
  if (v.type === 'object' && v.value instanceof Map) {
    const m = new Map<string, RuntimeValue>()
    for (const [k, x] of v.value) m.set(k, cloneValue(x))
    return { ...v, value: m }
  }
  return { ...v }
}

export function registerExecute(
  register: (concept: string, executor: ComponentExecutor) => void,
): void {
  register('cpp:vector_declare', async (node, ctx) => {
    const name = String(node.properties.name)
    // 元素型別——`vector<pair<int,int>>` 的 `pair<int,int>`。
    const elemType = String(node.properties.type ?? 'int')
    // ⚠️ **初始化列表原本被完全忽略**——`vector<int> v = {3,1,4}` 建出一個
    // 空的向量，於是 `v[1]` 索引越界、`v.size()` 是 0。而**產出的程式碼也
    // 少了那段初始值**，所以來回轉換看起來「成功」了。
    // 初始值是一整個運算式（`vector<int> v = f()`）——求值後直接接管它的內容。
    // 不複製的話，`v` 與 `f()` 回傳的那個陣列會共用同一個物件。
    const source = (node.children.source ?? [])[0]
    if (source) {
      const produced = await ctx.evaluate(source)
      const copied = produced.type === 'array' && Array.isArray(produced.value)
        ? [...produced.value]
        : []
      ctx.scope.declare(name, { type: 'array', value: copied })
      return
    }
    // `vector<int> v(5)` —— **建構子引數：5 個預設值**。
    // ⚠️ 這個接點在 2026-08-13 之前不存在：lift 只把 `argument_list`「排除在
    // source 之外」（那是對的），**而排除之後沒有人接住它**，於是 `v` 建成空的，
    // `iota(v.begin(), v.end(), 1)` 立刻索引越界。
    const sizeNode = (node.children.size ?? [])[0]
    if (sizeNode) {
      const n = Number((await ctx.evaluate(sizeNode)).value)
      // `vector<int> v(5, 7)` —— 第二個引數是「每一格是什麼」。
      // ⚠️ **每一格都要獨立的複本**：`vector<vector<int>> g(2, vector<int>(3))`
      // 共用同一個列物件的話，`g[0][0] = 9` 會同時改到 `g[1][0]`。
      const fillNode = (node.children.fill ?? [])[0]
      const fill = fillNode ? await ctx.evaluate(fillNode) : null
      const cells = []
      for (let i = 0; i < (Number.isFinite(n) && n > 0 ? Math.trunc(n) : 0); i++) {
        cells.push(fill ? cloneValue(fill) : { type: 'int' as const, value: 0 })
      }
      ctx.scope.declare(name, { type: 'array', value: cells, elemType })
      return
    }

    const init = node.children.values ?? []
    const elems = []
    // ⚠️ `evalInitializer` 而不是 `evaluate`：`vector<S> v = {{3},{1}}` 的元素
    // 本身是一層 `{…}`，而那是**聚合初始化**——要按 `S` 的成員順序填。
    for (const n of init) elems.push(await evalInitializer(n, elemType, ctx))
    // **元素型別跟著值走**——`push_back({2,1})` 時手上只有變數名，
    // 而 `{2,1}` 要變成什麼取決於容器裝的是什麼。
    ctx.scope.declare(name, { type: 'array', value: elems, elemType })
  })
}
