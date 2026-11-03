/**
 * `cpp:ifndef` 的 **formalize** 路——條件編譯是前處理器的事（cella 2026-11-01：巨集在前端展開，語意樹上不該出現），
 * 所以條件成立時 body 的敘述原地送出、成立時什麼都不送（`#ifndef N` 的 N 有沒有被 `#define` 過由 `macroDefined` 答）。
 * 學生最常見的是 `#ifdef LOCAL freopen(…) #endif`——本機除錯用，判斷時 LOCAL 沒定義，那一段不跑。
 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  const on = (n: { properties?: Record<string, unknown> }, f: { macroDefined(name: string): boolean }): boolean =>
    !f.macroDefined(String(n.properties?.condition ?? ''))
  r.stmt('cpp:ifndef', (n, f) => (on(n, f) ? (n.slots?.body ?? []).flatMap((c) => f.stmt(c)) : []))
  r.item('cpp:ifndef', (n, f) => (on(n, f) ? (n.slots?.body ?? []).flatMap((c) => f.item(c)) : []))
}
