/**
 * `cpp:define_func` 的 **formalize** 路（第 214 刀）——函式形巨集（`#define rep(i,n) for(int i=0;i<n;i++)`）
 * 在 lift 時已經展開在每一個使用處（`languages/cpp/lang/macro-expand.ts`：展開成 `loop_count` 等收得下 macroHeader 的元件），
 * 所以它本身不產生任何項目——與物件巨集同一個理由（cella 2026-11-01：巨集是前處理器的事，語意樹上不該出現）。
 * ⚠️ 展不開的用法不會變成空的：macro-expand 刻意沒有中途站，展不開就落到 raw_code，那顆照實標翻不出。
 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.item('cpp:define_func', () => [])
  // spec 200：而【運算式位置】的用法（`cout << SQR(3)`）不會被展開，它被 lift 成一般的函式呼叫——登記名字，讓呼叫端照實標翻不出
  r.definesMacro('cpp:define_func', (n) => ({ name: String(n.properties?.name ?? ''), value: String(n.properties?.value ?? ''), function: true }))
}
