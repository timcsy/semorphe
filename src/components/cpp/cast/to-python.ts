/**
 * 這顆元件寫成 Python（453）：C 風格轉型——判準在 `castToPython`（與 `static_cast` 共用）：
 * - 浮點 → 整數：`int(x)`（都向零截斷；超出範圍在 C++ 是未定義行為，Cella 先判出來）
 * - 整數 → 同寬或更寬的整數：照原樣（值不變）
 * - char → 整數：`ord(x)`（Python 的 char 是長度 1 的字串）
 * - 整數、double → double：`float(x)`（2^53 以內精確；long long 照實保留）
 * 其餘（窄化成 int 會繞回、轉成 float 會降精度、轉成 char／bool）照實保留——不猜。
 */
import type { ToPythonRegistrar } from '../../../languages/cpp/to-python/contract'
import { castToPython } from '../../../languages/cpp/to-python/contract'

export function registerToPython(r: ToPythonRegistrar): void {
  r.expr((n, py) => castToPython(n, py))
}
