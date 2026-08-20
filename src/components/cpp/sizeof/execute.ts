/** `cpp:sizeof` 的 **execute** 路——從共用檔原封剪過來（批次第三批：lift 是只產一種身分的具名策略）。 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('cpp:sizeof', async (node, ctx) => {
      const target = String(node.properties.target ?? 'int')
      const sizes: Record<string, number> = {
        'char': 1, 'bool': 1, 'short': 2,
        'int': 4, 'float': 4, 'long': 8,
        'double': 8, 'long long': 8, 'long double': 16,
      }
      if (target in sizes) return { type: 'int', value: sizes[target] }

      // `sizeof(3.14)` —— 目標是一個**字面值**。
      //
      // ⚠️ `sizeof(3.14f)` 之所以「已經對了」是**巧合**：float 是 4，
      // 而查不到時的退路也是 4。`sizeof(3.14)` 就露餡了——double 是 8。
      //
      // > **一個退路值若剛好等於某些正確答案，那些案例會看起來像通過的。**
      //
      // ⚠️ 這裡在 parse 一個字串，而那是既有的形狀（`target` 就是字串屬性）。
      // 正確的做法是讓 `target` 成為一個接點——與 `pair`／`new`／`vector` 同族，
      // 而那要一次改 lift／generate／render／extract 四路，不在這一刀的範圍。
      const literal = target.trim()
      if (/^[+-]?\d*\.\d+([eE][+-]?\d+)?$/.test(literal)) return { type: 'int', value: 8 }
      if (/^[+-]?\d*\.\d+([eE][+-]?\d+)?[fF]$/.test(literal)) return { type: 'int', value: 4 }
      if (/^[+-]?\d+[lL]{2}$/.test(literal)) return { type: 'int', value: 8 }
      if (/^[+-]?\d+$/.test(literal)) return { type: 'int', value: 4 }
      if (/^'.'$/.test(literal)) return { type: 'int', value: 1 }

      // `sizeof(a)` 的目標是一個**變數**時，回它佔的位元組數。
      // 原本一律回預設的 4——於是 `sizeof(a)/sizeof(a[0])` 這個算陣列長度的
      // 慣用寫法**永遠回 1**，而那個 1 看起來像一個合理的數字。
      if (ctx.scope.has(target)) {
        const v = ctx.scope.get(target)
        if (v.type === 'array') {
          const arr = v.value as unknown[]
          const elem = (arr[0] as { type?: string } | undefined)?.type ?? 'int'
          return { type: 'int', value: arr.length * (sizes[elem] ?? 4) }
        }
        return { type: 'int', value: sizes[v.type] ?? 4 }
      }
      return { type: 'int', value: 4 }
    })
}
