/**
 * `cpp:define` 的 **execute** 路
 *
 * ## ⚠️ 這不是巨集展開——那條路是墓碑，而它仍然成立
 *
 * `history/014-墓碑目錄.md:23` 否決了「模擬 C preprocessor 來解決巨集」，
 * 理由逐字：「重新實現 C preprocessor 的正確性成本極高，而收益只在 S3-S5……
 * **S0-S2 的教學場景根本不需要（學生程式碼不會用框架巨集）**」。
 *
 * 那個判斷**對函式巨集仍然成立**（`#define SQR(x) ((x)*(x))` 要文字替換，
 * 語義層不該去模擬它）。而**它的理由推得太遠了一格**：
 *
 * > 學生**不用框架巨集**是真的。而學生**會用 `#define MAX 100` 定義常數**
 * > ——那是 C 風格教學裡最常見的一行。
 *
 * 實測：第三十二條護欄的 18 段缺口裡有 **2 段**倒在這裡
 * （`#define LIMIT 100` 之後用 `LIMIT` → `UNDECLARED_VAR`）。
 *
 * ## 所以做的是另一件事：**具名常數的宣告**
 *
 * `#define MAX_SIZE 100` 在語義上就是一個具名常數——C++ 自己的建議也是
 * 「用 `const` 取代 `#define`」。把它綁進 scope **不需要任何前處理器**，
 * 與墓碑「不模擬文字替換」不衝突。
 *
 * ## ⚠️ 值不是字面常數時：不猜，讓它繼續出聲
 *
 * `#define SQR(x) ((x)*(x))`、`#define MIN(a,b) …` 這些**刻意不處理**。
 * 那時 `SQR` 仍然是未宣告，`UNDECLARED_VAR` 照樣丟出來——
 * **一個沒被支援的東西要繼續報錯，不能因為「我們處理了一半」就變安靜。**
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import type { RuntimeValue } from '../../../interpreter/types'
import { defined } from '../../../languages/cpp/core/executors/preprocessor'

/**
 * 巨集的值是不是一個**字面常數**。不是就回 `null`——呼叫端據此決定不綁。
 *
 * ⚠️ 只認字面量，不認運算式（`#define AREA (W*H)`）。認了就等於在語義層
 * 做求值，而那條線一跨過去就是在重建前處理器。
 */
function literalValue(raw: string): RuntimeValue | null {
  const s = raw.trim()
  if (!s) return null
  if (/^[+-]?\d+$/.test(s)) return { type: 'int', value: Number(s) }
  if (/^[+-]?(\d+\.\d*|\.\d+)$/.test(s)) return { type: 'double', value: Number(s) }
  if (/^"([^"\\]|\\.)*"$/.test(s)) {
    try {
      return { type: 'string', value: JSON.parse(s) as string }
    } catch {
      return null
    }
  }
  if (/^true$|^false$/.test(s)) return { type: 'bool', value: s === 'true' }
  return null
}

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('cpp:define', async (node, ctx) => {
    const name = String(node.properties.name ?? '')
    if (!name) return
    // `#ifdef` / `#ifndef` 讀這個集合——與下面的常數綁定是兩件獨立的事
    defined.add(name)

    const value = literalValue(String(node.properties.value ?? ''))
    // ⚠️ 同名重複 `#define` 時 `declare` 會丟錯，而那是對的：
    // 兩個不同的值綁到同一個名字，靜默取其一會讓後面的算式莫名其妙。
    if (value) ctx.scope.declare(name, value)
  })
}
