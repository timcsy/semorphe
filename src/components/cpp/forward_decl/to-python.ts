/**
 * 這顆元件寫成 Python（459）：函式的前置宣告 → 不寫。Python 在呼叫的那一刻才找名字，不需要先宣告；
 * 而攤平的 main 若在定義之前，由 program 那顆把 main 移到最後（不然頂層會在 def 之前就呼叫）
 */
import type { ToPythonRegistrar } from '../../../languages/cpp/to-python/contract'

export function registerToPython(r: ToPythonRegistrar): void {
  r.stmt(() => [])
}
