/**
 * `cpp:bits_count` 的 **lift** 路——**一筆資料：「這個名字屬於我」**
 *
 * ⚠️ `__builtin_popcount` 是 GCC／Clang 的內建，不是標準函式庫
 * ——所以它**沒有 `std::` 前綴的寫法**，只有一個名字。
 */
import { registerSingleArgFunction } from '../../../core/component/call-concepts'

export function registerLift(): void {
  registerSingleArgFunction('__builtin_popcount', 'cpp:bits_count', 'cpp/bits_count')
}
