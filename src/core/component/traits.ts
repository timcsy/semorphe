/**
 * **元件性狀的核心讀取器** —— 只讀膠囊自己的宣告
 *
 * ## 為什麼要與語言套件那一份分開
 *
 * `languages/cpp/core/node-traits.ts` 除了讀膠囊宣告，還疊了一張**過渡表**
 * （還沒膠囊化的元件的性狀暫放處）。那張表是 C++ 的，所以那個模組屬於語言套件。
 *
 * 而**核心層也有消費者**：`interpreter/executors/variables.ts` 要分辨
 * `A a(5)` 是建構還是求值，判斷條件是「初值是不是一個名字等於型別的呼叫」。
 *
 * 它原本寫死 `arg0.conceptId === 'cpp:func_call'`——一顆 C++ 元件的身分
 * 寫在核心裡。改成問語言套件那份性狀的話，**核心就 import 了語言套件**，
 * 而那是 P9 的字面違反（中立性護欄當場抓到）。
 *
 * > **把耦合從「身分」換成「性狀」是對的方向，而換的過程可能換出一條反向依賴。**
 *
 * 處置：核心讀核心讀得到的（膠囊的 `component.json`，`import.meta.glob` 直讀），
 * 語言套件在上面疊自己的過渡表。**已膠囊化的元件兩邊答案相同。**
 */
import { registeredComponents } from './registry'

/** 一顆已膠囊化元件宣告的性狀。沒宣告回 `undefined`——**不猜**。 */
export function componentTraits(conceptId: string): Record<string, unknown> | undefined {
  const c = registeredComponents().find((x) => x.conceptId === conceptId)
  return (c?.manifest as { traits?: Record<string, unknown> } | undefined)?.traits
}

/**
 * 這顆是**具名呼叫**嗎（`properties.name` 是被呼叫的名字）。
 *
 * ⚠️ 只認膠囊的宣告。還沒膠囊化的元件在這裡一律回 `false`——
 * 那是保守的方向：**寧可少認一個，不要認錯一個**。
 */
export function isNamedCall(conceptId: string): boolean {
  return componentTraits(conceptId)?.namedCall === true
}
