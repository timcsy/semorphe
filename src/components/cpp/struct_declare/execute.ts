/** `cpp:struct_declare` 的 **execute** 路——從共用檔原封剪過來（批次第四批：閉包提升之後才搬得動的三顆）。 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { installMethodExecutors, splitMember } from '../../../languages/cpp/core/executors/structs'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('cpp:struct_declare', async (node, ctx) => {
      installMethodExecutors(ctx)
      const name = String(node.properties.name)
      // ⚠️ 這裡原本自己收一份欄位，**只認欄位**——於是
      // `struct Node { int v; Node(int x) : v(x) {} };` 的建構式被靜默丟掉，
      // `Node n(5); cout << n.v` 印出 `0`。而 C++ 的 struct 與 class
      // **除了預設存取權限之外沒有差別**，方法、建構式、運算子多載都合法。
      //
      // → 改走 `splitMember`（class 用的同一支）。**共用的是演算法，不是身分。**
      const { fields, methods, ctor, dtor, statics } = splitMember(node.children.members ?? [])
      ctx.structs.declare(name, fields, methods, ctor, { statics, dtor })
    })
}
