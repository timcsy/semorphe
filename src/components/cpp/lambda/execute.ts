/** `cpp:lambda` 的 **execute** 路——從共用檔原封剪過來（批次第四批：閉包提升之後才搬得動的三顆）。 */
import type { ConceptExecutor } from '../../../interpreter/executor-registry'
import type { RuntimeValue, Callable } from '../../../interpreter/types'
import { installLambda } from '../../../languages/cpp/core/runtime/lambda'

export function registerExecute(register: (concept: string, executor: ConceptExecutor) => void): void {
  register('cpp:lambda', async (node, ctx) => {
      installLambda(ctx)
      const raw = String(node.properties.capture ?? '&')
      const capture: Callable['capture'] = raw.includes('&') ? '&' : raw.includes('=') ? '=' : ''

      const params = (node.children.params ?? []).map((p) => ({
        name: String(p.properties?.name ?? ''),
        type: String(p.properties?.type ?? 'int'),
      }))

      // `=` 是**定義當下**拍快照——晚一步拍就不是值捕捉了
      const snapshot = capture === '=' ? new Map(ctx.scope.getAll()) : undefined

      const callable: Callable = {
        params,
        body: node.children.body ?? [],
        capture,
        closure: ctx.scope,
        snapshot,
      }
      return { type: 'function', value: callable } as RuntimeValue
    })
}
