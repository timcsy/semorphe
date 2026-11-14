/**
 * 這顆元件寫成 Python（453）：不寫。`ios::sync_with_stdio(0)` 只改 C++ 的輸入輸出要不要跟 C 的 stdio 同步（速度），
 * 印出來的東西不變——Python 沒有對應的開關。StudyCpp 218 支裡 136 支有它。
 */
import type { ToPythonRegistrar } from '../../../languages/cpp/to-python/contract'

export function registerToPython(r: ToPythonRegistrar): void {
  r.stmt(() => [])
}
