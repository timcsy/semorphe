/** `cpp:map_at` 的 **execute** 路——從共用檔原封剪過來（批次第十四批：subscript_expression 的分支）。 */
import type { ComponentExecutor, ExecutionContext } from '../../../interpreter/executor-registry'
import { receiverOf } from '../../../interpreter/receiver'
import { declareLvalue } from '../../../core/component/lvalue-nodes'
import { defaultValue } from '../../../interpreter/types'
import { mapFind, makePair, pairParts, mapInsertSorted } from '../../../languages/cpp/lang/runtime/map'
import { containerDefaultFor } from '../../../languages/cpp/lang/runtime/container-defaults'
import { RuntimeError, RUNTIME_ERRORS } from '../../../interpreter/errors'
import type { RuntimeValue } from '../../../interpreter/types'


/**
 * **鍵不存在時，那一格該長什麼樣。**
 *
 * 🔴 在此之前一律是 `int 0`，而相鄰串列的標準寫法當場斷掉：
 *
 * ```cpp
 * map<int, vector<int>> g;
 * g[a].push_back(b);     // 我們：「這不是一個容器」  g++：好的
 * ```
 *
 * 🟢 **2026-09-18：種類的性質也跟著來了。** 這裡原本只給「空」這件事，
 * 於是 `map<int, set<int>>` 的內層集合拿不到「不留重複」——它會在第一次
 * `insert` 時出聲（那是誠實的，但它擋住了一個真的寫法）。
 *
 * 修法**不是在這裡多寫一段**：「集合不留重複」是宣告那顆元件的知識，
 * 所以它自己登記一個「我的空實例長什麼樣」，這裡只負責問。
 * 見 `runtime/container-defaults` 的檔頭。
 *
 * > **一個「不經過宣告也會被建出來」的東西，
 * > 它的形狀仍然屬於宣告它的那顆元件——只是需要一個問得到的地方。**
 */
function defaultForValueType(t: string): RuntimeValue {
  // 🟢 **種類的性質也跟著來了**（2026-09-18）：`map<string, set<int>>` 的那一格
  //    現在是一個真的**集合**（不留重複），不再只是「一個空陣列」。
  //    形狀由宣告那顆元件自己登記——見 `runtime/container-defaults` 的檔頭。
  return containerDefaultFor(t) ?? defaultValue(t)
}

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  registerLvalue()
  register('cpp:map_at', async (node, ctx) => {
      const name = String(node.properties.obj)
      const keyNodes = node.slots.key ?? []
      if (keyNodes.length === 0) return defaultValue('int')
      const keyVal = await ctx.evaluate(keyNodes[0])
      const map = receiverOf(ctx.scope, name)
      if (map.type !== 'array' || !Array.isArray(map.value)) {
        return defaultValue('int')
      }
      const idx = mapFind(map.value, keyVal)
      if (idx === -1) {
        // C++ map auto-inserts default on access
        const newVal = defaultForValueType(String(map.valueType ?? 'int'))
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
    const keyNodes = node.slots.key ?? []
    if (keyNodes.length === 0) {
      throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, { '%1': '這個對應表存取沒有鍵' })
    }
    const keyVal = await ctx.evaluate(keyNodes[0])
    const map = receiverOf(ctx.scope, name)
    if (map.type !== 'array' || !Array.isArray(map.value)) {
      throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, { '%1': `${name} 不是一個對應表` })
    }
    const cells = map.value as RuntimeValue[]
    let idx = mapFind(cells, keyVal)
    if (idx === -1) {
      // 🔴 `std::map` 是**有序的**（2026-08-26）——插入位置就是之後要寫的那一格
      idx = mapInsertSorted(cells, makePair(keyVal, defaultForValueType(String(map.valueType ?? 'int'))))
    }
    return {
      read: () => pairParts(cells[idx])?.value ?? defaultValue('int'),
      write: (v) => { cells[idx] = makePair(keyVal, v as RuntimeValue) },
    }
  })
}
