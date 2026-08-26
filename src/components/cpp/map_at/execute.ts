/** `cpp:map_at` 的 **execute** 路——從共用檔原封剪過來（批次第十四批：subscript_expression 的分支）。 */
import type { ComponentExecutor, ExecutionContext } from '../../../interpreter/executor-registry'
import { declareLvalue } from '../../../core/component/lvalue-nodes'
import { defaultValue } from '../../../interpreter/types'
import { mapFind, makePair, pairParts, mapInsertSorted } from '../../../languages/cpp/core/runtime/map'
import { RuntimeError, RUNTIME_ERRORS } from '../../../interpreter/errors'
import type { RuntimeValue } from '../../../interpreter/types'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  registerLvalue()
  register('cpp:map_at', async (node, ctx) => {
      const name = String(node.properties.obj)
      const keyNodes = node.children.key ?? []
      if (keyNodes.length === 0) return defaultValue('int')
      const keyVal = await ctx.evaluate(keyNodes[0])
      const map = ctx.scope.get(name)
      if (map.type !== 'array' || !Array.isArray(map.value)) {
        return defaultValue('int')
      }
      const idx = mapFind(map.value, keyVal)
      if (idx === -1) {
        // C++ map auto-inserts default on access
        const newVal = defaultValue('int')
        // 🔴 `std::map` 是**有序的**（2026-08-26）
        mapInsertSorted(map.value, makePair(keyVal, newVal))
        return newVal
      }
      return pairParts(map.value[idx])?.value ?? defaultValue('int')
    })
}

/**
 * **我可以被寫回**——`m[k] = v`／`m[k]++`。
 *
 * 🔴 **它是 2026-08-26 補的，而它是一個迴歸的修法**：`cpp:increment` 的運算元
 * 改成接點之後，`freq[c]++` 走 `resolvePlace`，而這顆**沒有宣告怎麼被寫回**
 * ——於是丟「這個東西不能被指定值」。
 *
 * ⚠️ 而**沒有任何測試變紅**：抓到它的是第三十二條護欄，
 * 而那條護欄當時正被一個壞掉的語料收集器藏著一半的語料。
 *
 * > **兩個缺陷疊在一起時，上面那個會讓下面那個看不見。**
 *
 * ⚠️ **`map[k]` 讀不到時會【新增一格】**（C++ 的 `operator[]` 就是這樣），
 * 所以這裡解析時就把那一格建好——與求值那一側同一個決定。
 */
export function registerLvalue(): void {
  declareLvalue('cpp:map_at', async (node, ctx: ExecutionContext) => {
    const name = String(node.properties.obj)
    const keyNodes = node.children.key ?? []
    if (keyNodes.length === 0) {
      throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, { '%1': '這個對應表存取沒有鍵' })
    }
    const keyVal = await ctx.evaluate(keyNodes[0])
    const map = ctx.scope.get(name)
    if (map.type !== 'array' || !Array.isArray(map.value)) {
      throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, { '%1': `${name} 不是一個對應表` })
    }
    const cells = map.value as RuntimeValue[]
    let idx = mapFind(cells, keyVal)
    if (idx === -1) {
      // 🔴 `std::map` 是**有序的**（2026-08-26）——插入位置就是之後要寫的那一格
      idx = mapInsertSorted(cells, makePair(keyVal, defaultValue('int')))
    }
    return {
      read: () => pairParts(cells[idx])?.value ?? defaultValue('int'),
      write: (v) => { cells[idx] = makePair(keyVal, v as RuntimeValue) },
    }
  })
}
