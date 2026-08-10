/** `cpp:sizeof` 的 **execute** 路——從共用檔原封剪過來（批次第三批：lift 是只產一種身分的具名策略）。 */
import type { ConceptExecutor } from '../../../interpreter/executor-registry'

export function registerExecute(register: (concept: string, executor: ConceptExecutor) => void): void {
  register('cpp:sizeof', async (node, ctx) => {
      const target = String(node.properties.target ?? 'int')
      const sizes: Record<string, number> = {
        'char': 1, 'bool': 1, 'short': 2,
        'int': 4, 'float': 4, 'long': 8,
        'double': 8, 'long long': 8, 'long double': 16,
      }
      if (target in sizes) return { type: 'int', value: sizes[target] }

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
