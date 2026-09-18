/**
 * **一個「可以下標的序列」怎麼被宣告出來**——`vector` 與 `deque` 共用的那一份。
 *
 * ## 🔴 它從哪來（2026-09-18）
 *
 * `deque` 在此之前**沒有宣告元件**，於是 `deque<pair<int,int>> q;` 掉進
 * `cpp:var_declare`，`type` 裝著一整串 `deque<pair<int,int>>`——那個容器
 * **沒有 `elemType`**，所以 `q.push_back({1,2})` 放進去的是一串普通的格子，
 * 而 `q[0].first` 說「（不是一個結構）」。
 *
 * 🔴 **而這件事早就被寫在程式碼裡等人來修**：`cpp:vector_push` 的執行器註解
 * 逐字寫著「（`deque` 至今沒有被登錄成容器樣板，所以它的 `elemType` 是空的。）」
 *
 * ## ⚠️ 為什麼是共用的一份，不是抄一份
 *
 * `deque` 的宣告與 `vector` **每一個建構形式都一樣**（初始化列、複製自、
 * `(n)`、`(n, x)`）——差別只在**兩端都能進出**，而那是
 * `cpp:container_push_front`／`cpp:container_pop_front` 的事，不是宣告的事。
 *
 * > **兩份逐字相同的實作會漂移，而它們漂移的那天沒有人會發現
 * > ——第三十八條護欄（共用檔的殼與重複）就是為這件事存在的。**
 *
 * 所以**判別與行為共用，而身分留在各自的膠囊裡**（`template` 那個參數）。
 */
import type { ExecutionContext } from '../../../../interpreter/executor-registry'
import type { NodeGenerator } from '../../../../core/projection/code-generator'
import type { SemanticNode } from '../../../../core/types'
import { indent, generateExpression } from '../../../../core/projection/code-generator'
import { evalInitializer } from '../../../../interpreter/aggregate'
import { cloneValue } from '../../../../interpreter/clone'
import { defaultValue } from '../../../../interpreter/types'
import { containerDefaultFor } from './container-defaults'

/** 產碼：`template<T> name;`／`= {…}`／`= e`／`(n)`／`(n, x)` 五種形式。 */
export function generateSequenceDeclare(
  template: string, fallbackName: string,
): NodeGenerator {
  return (node, ctx) => {
    const type = node.properties.type ?? 'int'
    const name = node.properties.name ?? fallbackName
    // 初始化列表要一起產回去。**少了它的話，來回轉換會靜靜地把
    // `vector<int> v = {3,1,4}` 變成 `vector<int> v;`**——那是合法程式，
    // 只是不是使用者寫的那一段。
    const values = node.slots.values ?? []
    if (values.length > 0) {
      const items = values.map((v) => generateExpression(v, ctx)).join(', ')
      return `${indent(ctx)}${template}<${type}> ${name} = {${items}};\n`
    }
    // 初始值是一整個運算式（`= f()`）——與上面同一個病，同一個處方
    const source = (node.slots.source ?? [])[0]
    if (source) {
      return `${indent(ctx)}${template}<${type}> ${name} = ${generateExpression(source, ctx)};\n`
    }
    // `vector<int> v(5)` —— 建構子引數。⚠️ 原本產不回來（lift 也接不住，**兩邊對稱**）。
    const size = (node.slots.size ?? [])[0]
    if (size) {
      // `vector<int> v(5, 7)` —— 第二個引數是「每一格是什麼」。
      // ⚠️ 少了它的話產出 `v(5)`，那**編得過而且看起來很像**，只是每一格變成 0。
      const fill = (node.slots.fill ?? [])[0]
      const args = fill
        ? `${generateExpression(size, ctx)}, ${generateExpression(fill, ctx)}`
        : generateExpression(size, ctx)
      return `${indent(ctx)}${template}<${type}> ${name}(${args});\n`
    }
    return `${indent(ctx)}${template}<${type}> ${name};\n`
  }
}

/** 執行：把那個序列真的建出來，而**元素型別跟著值走**。 */
export async function declareSequence(node: SemanticNode, ctx: ExecutionContext): Promise<void> {
  const name = String(node.properties.name)
  // 元素型別——`vector<pair<int,int>>` 的 `pair<int,int>`。
  const elemType = String(node.properties.type ?? 'int')
  // 初始值是一整個運算式（`vector<int> v = f()`）——求值後直接接管它的內容。
  // 不複製的話，`v` 與 `f()` 回傳的那個陣列會共用同一個物件。
  const source = (node.slots.source ?? [])[0]
  if (source) {
    const produced = await ctx.evaluate(source)
    const copied = produced.type === 'array' && Array.isArray(produced.value)
      ? [...produced.value]
      : []
    // ⚠️ 複製來的也要記住元素型別——`vt[0] = {3,4}` 靠它照形狀填
    ctx.scope.declare(name, { type: 'array', value: copied, elemType })
    return
  }
  // `vector<int> v(5)` —— **建構子引數：5 個預設值**。
  const sizeNode = (node.slots.size ?? [])[0]
  if (sizeNode) {
    const n = Number((await ctx.evaluate(sizeNode)).value)
    // `vector<int> v(5, 7)` —— 第二個引數是「每一格是什麼」。
    // ⚠️ **每一格都要獨立的複本**：`vector<vector<int>> g(2, vector<int>(3))`
    // 共用同一個列物件的話，`g[0][0] = 9` 會同時改到 `g[1][0]`。
    const fillNode = (node.slots.fill ?? [])[0]
    const fill = fillNode ? await ctx.evaluate(fillNode) : null
    const cells = []
    for (let i = 0; i < (Number.isFinite(n) && n > 0 ? Math.trunc(n) : 0); i++) {
      /**
       * 🔴 **沒有填充值的時候要照【元素型別】給預設值**（2026-09-16）。
       *
       * 在此之前這裡寫死 `int 0`，於是 `vector<pair<int,int>> vt(n);`
       * 的每一格都是 0 而不是一對——`cin >> vt[i].first` 因此拋錯。
       * 實測 218 支學生程式裡 8 支撞在這裡。
       *
       * > **一個「沒給就補 0」的預設值，在元素不是數字的時候補的是一個錯的形狀。**
       */
      cells.push(fill ? cloneValue(fill) : (containerDefaultFor(elemType) ?? defaultValue(elemType)))
    }
    ctx.scope.declare(name, { type: 'array', value: cells, elemType })
    return
  }

  const init = node.slots.values ?? []
  const elems = []
  // ⚠️ `evalInitializer` 而不是 `evaluate`：`vector<S> v = {{3},{1}}` 的元素
  // 本身是一層 `{…}`，而那是**聚合初始化**——要按 `S` 的成員順序填。
  for (const n of init) elems.push(await evalInitializer(n, elemType, ctx))
  // **元素型別跟著值走**——`push_back({2,1})` 時手上只有變數名，
  // 而 `{2,1}` 要變成什麼取決於容器裝的是什麼。
  ctx.scope.declare(name, { type: 'array', value: elems, elemType })
}
