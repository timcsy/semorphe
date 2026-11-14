/**
 * 這顆元件寫成 Python（453）：不寫。`cin.tie(0)` 只解開「讀之前先清 cout」的綁定（速度）；
 * 一支只讀標準輸入、寫標準輸出的程式，印出來的東西不變——Python 沒有對應的開關。
 */
import type { ToPythonRegistrar } from '../../../languages/cpp/to-python/contract'

export function registerToPython(r: ToPythonRegistrar): void {
  r.stmt(() => [])
}
