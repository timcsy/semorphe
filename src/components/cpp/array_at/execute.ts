/** `cpp:array_at` 的 **execute** 路——從共用檔原封剪過來（批次第三十八批）。 */
import type { ComponentExecutor, ExecutionContext } from '../../../interpreter/executor-registry'
import type { RuntimeValue } from '../../../interpreter/types'
import { declareLvalue } from '../../../core/component/lvalue-nodes'
import { resolvePlace } from '../../../interpreter/lvalue'
import { defaultValue } from '../../../interpreter/types'
import { mapFind, makePair, pairParts, mapInsertSorted } from '../../../languages/cpp/lang/runtime/map'
import { containerDefaultFor } from '../../../languages/cpp/lang/runtime/container-defaults'
import { RuntimeError, RUNTIME_ERRORS } from '../../../interpreter/errors'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  // 🔴 **與執行器同一個生命週期**——左值解析要用到執行環境，
  //    而「這種節點可以被寫回」與「這種節點怎麼求值」是同一顆元件的兩面。
  registerLvalue()

  register('cpp:array_at', async (node, ctx) => {
      // 🟢 容器是一顆節點（2026-08-26）——`obj.arr[i]` 本來會去查一個叫 `obj.arr` 的變數
      const objNodes = node.slots.obj ?? []
      const name = String(objNodes[0]?.properties?.name ?? '')
      const indexNodes = node.slots.index
      if (!indexNodes || indexNodes.length === 0) return defaultValue('int')

      const indexVal = await ctx.evaluate(indexNodes[0])
      const index = ctx.toNumber(indexVal)
      const container = objNodes.length > 0 ? await ctx.evaluate(objNodes[0]) : ctx.scope.get(name)

      // String subscript: s[i] returns char
      if (container.type === 'string' && typeof container.value === 'string') {
        /**
         * 🔴 **`s[s.size()]` 不是越界——C++11 起它【有定義】，回一個空字元。**
         *（2026-09-20，語料 `AP325/7/7_4.cpp`）
         *
         * ```cpp
         * string s = "1";
         * cout << (int)s[1];   g++ 印 0        ← 標準規定的，不是 UB
         * cout << (int)s[2];   🔴 這一個才是 UB
         * ```
         *
         * 語料那一支拿 `d2[i][j]` 掃一張格子圖，而餵進去的測資讓某一列比較短
         * ——於是 `j == size()` 命中，g++ 讀到 `'\0'`（判斷為「不是 `'0'`」），
         * 而我們**丟出越界**，整支程式停在那裡。
         *
         * > **一條「超過長度就是錯」的規則，對【剛好等於長度】那一格說了一個
         * > 標準沒有說的話——而它比標準嚴格的地方，看起來與缺陷一模一樣。**
         *
         * ⚠️ **只有【讀】是這樣**：寫進 `s[s.size()]` 仍然是 UB。
         *    這一段是讀的那一路（寫的那一路在下面 `place()` 裡，它照舊）。
         */
        if (index < 0 || index > container.value.length) {
          throw new RuntimeError(RUNTIME_ERRORS.INDEX_OUT_OF_RANGE, { '%1': String(index) })
        }
        if (index === container.value.length) return { type: 'char', value: '\0' }
        return { type: 'char', value: container.value[index] }
      }

      if (container.type !== 'array' || !Array.isArray(container.value)) {
        throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, { '%1': 'array' })
      }
      /**
       * 🔴 **一個 keyed 容器的下標是【鍵】，不是位置**（2026-09-18，盲測抓到）。
       *
       * `map<int, map<int,int>> g; g[1][2] = 3;` 的外層 `g[1]` 由對照表那一顆
       * 認走（它的根是一個名字，型別查得到），而**內層的 `[2]` 落到這裡**
       * ——因為 lift 期看不出 `g[1]` 是什麼種類（`getType("g[1]")` 查不到）。
       *
       * 🟢 **而執行期看得出來**：那個值自己帶著 `keyed`。
       * ⚠️ 用的是**同一組**對照表函式（`runtime/map`），不是第二份實作
       * ——`m[k]` 在鍵不存在時要新增一格，那條規則只能有一份。
       *
       * > **辨識期分不出來的東西，執行期常常分得出來
       * > ——而把判斷放在分得出來的那一邊，比在另一邊猜便宜。**
       */
      if (container.keyed === true) {
        const cells = container.value as RuntimeValue[]
        const at = mapFind(cells, indexVal)
        if (at !== -1) return pairParts(cells[at])?.value ?? defaultValue('int')
        const fresh = containerDefaultFor(String(container.valueType ?? '')) ?? defaultValue(String(container.valueType ?? 'int'))
        mapInsertSorted(cells, makePair(indexVal, fresh))
        return fresh
      }
      if (index < 0 || index >= container.value.length) {
        throw new RuntimeError(RUNTIME_ERRORS.INDEX_OUT_OF_RANGE, { '%1': String(index) })
      }
      return container.value[index]
    })
}

/**
 * **我可以被寫回**——下標存取（`a[i]`）。
 *
 * ⚠️ **索引在解析的當下求一次值，之後不再求**——
 * `swap(a[i], a[j])` 若在寫回時重新求 `i`，中途被改掉的 `i` 會讓它寫到別格。
 *
 * 🟢 **巢狀自然成立**：`a[i][j]` 的容器是 `a[i]`，而求它的值回傳的是
 * **同一個陣列**（值型別用參照語義）——所以這裡先問接點、再退回名字。
 */
export function registerLvalue(): void {
  declareLvalue('cpp:array_at', async (node, ctx: ExecutionContext) => {
    // 先問接點（`a[i][j]` 的外層容器是一顆節點），沒有才退回字串屬性。
    const objNode = (node.slots.obj ?? [])[0]
    const name = String(objNode?.properties?.name ?? '')
    if (!objNode) throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, { '%1': '這個下標沒有容器' })
    // 🔴 **容器本身也解成一個位置**，不只求值——字串那一格要寫回去時
    //    得把整個字串重建再寫回**變數**（這個直譯器裡字串是不可變的）。
    const containerPlace = await resolvePlace(objNode, ctx)
    const container = containerPlace.read()
    const idxNode = (node.slots.index ?? [])[0]
    const idx = idxNode ? Math.trunc(ctx.toNumber(await ctx.evaluate(idxNode))) : 0

    // `s[i] -= 7` —— C++ 的 `string::operator[]` 回的是參照，所以它**是**左值。
    if (container.type === 'string' && typeof container.value === 'string') {
      const text = container.value
      if (idx < 0 || idx >= text.length) {
        throw new RuntimeError(RUNTIME_ERRORS.INDEX_OUT_OF_RANGE, { '%1': String(idx) })
      }
      return {
        // ⚠️ **回碼位**——`char` 在這個直譯器裡是碼位（見 `cpp:string_at`）
        read: (): RuntimeValue => ({ type: 'char', value: text.charCodeAt(idx) }),
        write: (v) => {
          const code = (v as RuntimeValue).type === 'char'
            ? Number((v as RuntimeValue).value)
            : ctx.toNumber(v as RuntimeValue)
          const chars = text.split('')
          chars[idx] = String.fromCharCode(Math.trunc(code))
          containerPlace.write({ type: 'string', value: chars.join('') })
        },
      }
    }

    if (container.type !== 'array' || !Array.isArray(container.value)) {
      throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, { '%1': `${name || '這個東西'} 不是容器` })
    }
    const cells = container.value as RuntimeValue[]
    /**
     * 🔴 **keyed 容器的下標是鍵**——與求值那一側同一條（見那裡的檔頭）。
     * ⚠️ 讀那一側修了而寫這一側沒修的話，症狀是**讀得到而寫不進去**。
     */
    if (container.keyed === true) {
      const keyVal = idxNode ? await ctx.evaluate(idxNode) : defaultValue('int')
      let at = mapFind(cells, keyVal)
      if (at === -1) {
        const fresh = containerDefaultFor(String(container.valueType ?? ''))
          ?? defaultValue(String(container.valueType ?? 'int'))
        at = mapInsertSorted(cells, makePair(keyVal, fresh))
      }
      return {
        read: () => pairParts(cells[at])?.value ?? defaultValue('int'),
        write: (v) => { cells[at] = makePair(keyVal, v as RuntimeValue) },
      }
    }
    if (idx < 0 || idx >= cells.length) {
      throw new RuntimeError(RUNTIME_ERRORS.INDEX_OUT_OF_RANGE, { '%1': String(idx) })
    }
    return { read: () => cells[idx], write: (v) => { cells[idx] = v as RuntimeValue } }
  })
}
