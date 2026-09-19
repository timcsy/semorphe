/**
 * `cpp:bits_count` 的 **lift** 路——**兩種寫法，一顆身分**。
 *
 * ```
 * __builtin_popcount(x)   GCC／Clang 的內建，不是標準函式庫 ⟹ 沒有 `std::` 前綴
 * bs.count()              一排位元的方法（2026-09-19 加）
 * ```
 *
 * ⚠️ 方法那一形走**「依接收者型別」那張表**（第三張），不是容器方法表
 * ——因為 `count` 這個名字**已經被 `c.count(x)` 佔著**，而容器方法表
 * 以名字為鍵、同名指向不同身分會 throw。
 * 🔴 型別章是 `bits`（**從身分推導**：`cpp:bits_declare` → `bits`），不是 C++ 的 `bitset`。
 */
import { registerCallComponent } from '../../../core/component/call-components'
import { registerTypedMethodComponent } from '../../../core/component/method-components'

export function registerLift(): void {
  // ⚠️ **不用 `registerSingleArgFunction`**——它的槽名固定是 `value`（那是它的檔頭
  //    自己寫的「特例入口」），而這一顆的插槽叫 `obj`（見 `component.json` 的 `_slots_why`）。
  registerCallComponent('__builtin_popcount', {
    componentId: 'cpp:bits_count',
    argSlots: ['obj'],
    /**
     * 🔴 **兩條路徑要填【同一格】**——方法那一路填的是 `properties.method`
     *（`declaresMethodProp`），所以呼叫那一路也填它。
     * ⚠️ 不填的話那一格是空的，產出永遠是內建那一形
     * ——而 `bs.count()` 會變成 `__builtin_popcount(bs)`，**那連編都編不過**。
     */
    funcProp: 'method',
    source: 'cpp/bits_count',
  })
  registerTypedMethodComponent('bits', 'count', 'cpp:bits_count', 'cpp/bits_count')
}
