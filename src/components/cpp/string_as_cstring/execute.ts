/** `cpp:string_as_cstring` 的 **execute** 路——從共用檔原封剪過來（批次第五批：lift 是 io.ts 的方法 case（純資料））。 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('cpp:string_as_cstring', async (node, ctx) => {
      const obj = String(node.properties.obj)
      const val = ctx.scope.get(obj)
      return { type: 'string', value: String(val.value) }
    })
}
