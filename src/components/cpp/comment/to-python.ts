/** 這顆元件寫成 Python（453）：`// 文字` → `# 文字`（同 `languages/python/comment-syntax.ts` 的寫法；註解不影響執行）。 */
import type { ToPythonRegistrar } from '../../../languages/cpp/to-python/contract'

export function registerToPython(r: ToPythonRegistrar): void {
  r.stmt((n, py, depth) => [`${py.indent(depth)}# ${String(n.properties.text ?? '')}`.trimEnd()])
}
