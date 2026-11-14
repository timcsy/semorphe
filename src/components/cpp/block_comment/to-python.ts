/**
 * 這顆元件寫成 Python（453）：`/* … *​/` → 每行一個 `#`。
 * Python 沒有區塊註解（三引號是字串，不是註解）——同 `languages/python/comment-syntax.ts` 的 `block`；
 * 不 trim：註解裡的對齊是內容。
 */
import type { ToPythonRegistrar } from '../../../languages/cpp/to-python/contract'

export function registerToPython(r: ToPythonRegistrar): void {
  r.stmt((n, py, depth) => String(n.properties.text ?? '').split('\n').map((l) => `${py.indent(depth)}# ${l}`.trimEnd()))
}
