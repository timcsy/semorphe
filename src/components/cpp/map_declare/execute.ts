/** `cpp:map_declare` 的 **execute** 路——從共用檔原封剪過來（批次第七批：容器樣板過渡表退場）。 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { cloneValue } from '../../../interpreter/clone'
import { registerContainerDefault } from '../../../languages/cpp/lang/runtime/container-defaults'
import type { RuntimeValue } from '../../../interpreter/types'
import { isAggregateList } from '../../../core/component/aggregate-nodes'
import { evalInitializer } from '../../../interpreter/aggregate'
import { RuntimeError, RUNTIME_ERRORS } from '../../../interpreter/errors'
import { makePair, mapFind, mapInsertSorted } from '../../../languages/cpp/lang/runtime/map'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  /** 🔴 同 `set` 那一顆：對照表也可能不經宣告就被建出來（見 `container-defaults`）。 */
  for (const name of ['map', 'unordered_map']) {
    registerContainerDefault(name, (inner) => ({
      type: 'array', value: [], keyed: true,
      // `map<int, vector<int>>` 的 `inner` 是 `int, vector<int>`——值型別是逗號後面那一半
      ...(inner.includes(',') ? { valueType: inner.slice(inner.indexOf(',') + 1).trim() } : {}),
    }))
  }
  register('cpp:map_declare', async (node, ctx) => {
      const name = String(node.properties.name)
      // 🔴 **`keyed` 說的是「我的條目是鍵值對」**（2026-09-17）。
      //    在此之前對應表與集合在執行期完全分不出來，而共用同一個方法名的
      //    `insert` 只能靠「翻開條目看它是不是一對」——那在空容器上失效，
      //    在 `multiset<pair<int,int>>` 上會答錯。
      /**
       * 🔴 **用另一個容器建起來**（2026-09-17）——`map<char,int> r = f();`。
       * 理由與複製的分寸見同族那顆集合的註解（`cloneValue`，不是接管）。
       */
      const source = (node.slots.source ?? [])[0]
      /**
       * 🔴 **大括號初始化不是「另一個容器」**（2026-09-18，盲測抓到）：
       *
       * ```cpp
       * map<string,int> cnt{{"a", 1}, {"b", 2}};
       * ```
       *
       * 那一格與「用另一個容器建起來」共用同一個接點，而**兩者要做的事不同**：
       * 一個是把來源的條目複製過來，一個是**把每一層大括號變成一對鍵值**。
       * 原樣接管的話每一格是「兩個值的一串」，而 `insert` 在它上面找不到鍵
       * ——`cnt.insert({"a", 99})` 於是回報「插進去了」，而 g++ 說沒有。
       *
       * > **兩件不同的事共用一個接點時，分辨它們的責任落在讀那一格的人身上
       * > ——而他很容易只寫得出其中一件。**
       */
      const allowsDup = String(node.properties.unique ?? 'true') === 'false'
      const braced = source ? isAggregateList(source.componentId) : false
      const cells: RuntimeValue[] = []
      if (braced) {
        const keyType = String(node.properties.key_type ?? 'int')
        const valType = String(node.properties.value_type ?? 'int')
        for (const entry of source!.slots.values ?? []) {
          const pairKids = isAggregateList(entry.componentId) ? (entry.slots.values ?? []) : []
          if (pairKids.length !== 2) {
            throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, {
              '%1': `對照表的大括號初始化每一格要是「鍵, 值」`,
            })
          }
          const k = await evalInitializer(pairKids[0], keyType, ctx)
          const v = await evalInitializer(pairKids[1], valType, ctx)
          if (allowsDup || mapFind(cells, k) === -1) mapInsertSorted(cells, makePair(k, v))
        }
      } else {
        const initial = source ? await ctx.evaluate(source) : null
        if (initial && initial.type === 'array' && Array.isArray(initial.value)) {
          for (const c of initial.value as RuntimeValue[]) cells.push(cloneValue(c))
        }
      }
      // 🔴 **值的型別要跟著對照表走**——`m[k]` 自動建一格時要照它的形狀補
      //    （見 `RuntimeValue.valueType` 的檔頭）。
      const valueType = String(node.properties.value_type ?? 'int')
      /**
       * 🔴 **一個鍵能不能有多個值，是容器的性質**（2026-09-18）——`multimap` 可以。
       * 與同族集合那顆的重複性同一個做法：跟著宣告走，而 `insert` 只負責讀它。
       */
      const allowsDuplicates = String(node.properties.unique ?? 'true') === 'false'
      ctx.scope.declare(name, { type: 'array', value: cells, keyed: true, valueType, allowsDuplicates })
    })
}
