/** `cpp:queue_declare` 的 **execute** 路——從共用檔原封剪過來（批次第七批：容器樣板過渡表退場）。 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('cpp:queue_declare', async (node, ctx) => {
      const name = String(node.properties.name)
            /**
       * 🔴 **容器要記得住自己裝什麼**（2026-09-18）——`elemType` 跟著**值**走，
       * 因為 `q.push({1,2})` 時手上只有變數名，而 `{1,2}` 要變成什麼
       * 取決於這個容器裝的是什麼。同族的列表宣告 2026-09-16 就這樣做了。
       */
      const elemType = String(node.properties.type ?? 'int')
      ctx.scope.declare(name, { type: 'array', value: [], tag: 'queue', elemType })
    })
}
