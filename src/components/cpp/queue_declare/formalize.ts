/** `cpp:queue_declare` 的 **formalize** 路（spec 194）——`queue<…> x;` → `tTemplate "queue" […]`（`type` 可以是好幾個範本引數，例如最小堆的 `int, vector<int>, greater<int>`）。契約見 `core/formalize-contract.ts`；形狀對照 Cella 用 clang 轉的課文樹（`packages/cpp/tools/lessons`，cella 0.1.202610312349 起有這些容器）。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'
import { splitTypeArgs } from '../../../providers/cella/formalize'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.decl('cpp:queue_declare', (n, f, global) => {
    const args = splitTypeArgs(String(n.properties?.type ?? 'int')).map((x) => f.type(x, n))
    if (!args.every(Boolean)) return []
    // 🔴 預設建構（`sDeclC … []`），不是「未初始化」（spec 194 量到：`sDecl` 而 `init: null` 會被判讀到不確定的值）
    return f.declCtor(n, f.k('tTemplate', { name: 'queue', args }), [], global)
  })
}
