/** `cpp:template_function` 的 **execute** 路——從共用檔原封剪過來（批次第二十五批：單一建立點 → 建構子）。 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  /** `template<typename T> R f(…)` —— 執行上與一般函式相同，型別參數不影響求值 */
    register('cpp:template_function', async (node, ctx) => {
      ctx.functions.set(String(node.properties.func_name), {
        name: String(node.properties.func_name),
        params: (node.children.params ?? []).map((p) => ({
          type: String(p.properties?.type ?? 'int'),
          name: String(p.properties?.name ?? ''),
        })),
        returnType: String(node.properties.return_type ?? 'T'),
        body: node.children.body ?? [],
      })
    })
}
