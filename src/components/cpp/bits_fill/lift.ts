/**
 * `cpp:bits_fill` 的 **lift** 路——**三筆資料，一顆身分**。
 *
 * ## ⚠️ 為什麼是「依接收者型別」那一張表（第三張），不是容器方法表
 *
 * `count` 這個方法名**已經被同族那顆「數某個值出現幾次」佔著**（`c.count(x)`，
 * 數某個值出現幾次），而容器方法表以名字為鍵、**同名指向不同身分會 throw**。
 *
 * 🟢 而 `method-components.ts` 的第三張表正是為這件事存在，它的檔頭逐字：
 * 「`s.clear()` 是字串版、`v.clear()` 是容器版……這些差別只有**型別查得到時**才成立。」
 *
 * ⚠️ 型別查不到時**不猜**——留在通用版。那一句也是那個檔的原話。
 *
 * 🔴 **型別章是 `bits` 不是 `bitset`**：辨識期記下來的型別是**從身分推導**的
 *（`cpp:bits_declare` → `bits`），不是 C++ 的型別名。
 */
import { registerTypedMethodComponent } from '../../../core/component/method-components'

/** 三個名字、一顆身分——而**那個名字本身**就是它們的差別（進 `properties.method`）。 */
const NAMES = ['reset', 'set', 'flip'] as const

export function registerLift(): void {
  for (const m of NAMES) {
    registerTypedMethodComponent('bits', m, 'cpp:bits_fill', 'cpp/bits_fill')
  }
}

/**
 * 🪦 **`d1[i].reset()` 認不出來，而那是【刻意的】**（2026-09-19）。
 *
 * 依型別分派那一張表是**用接收者的原文去查名字**的（`io.ts`：
 * `ctx.data.getType(objText)`），而 `d1[i]` 不是一個名字：
 *
 * ```
 * bs.reset()      🟢 查得到 bs 的型別是 bits
 * d1[i].reset()   🔴 查不到「d1[i]」這個名字 ⟹ 掉進泛用的方法呼叫
 * ```
 *
 * 🔴 **第一版的修法是把三個名字也登錄到「以名字為鍵」那一張，而那是錯的**
 * ——那會讓**任何**接收者的 `.reset()` 都被搶走，包括型別查不到的。
 * 而 `method-components.ts` 逐字寫著：
 *
 * > **型別查不到時不猜——留在通用版。
 * > 猜一個錯的專屬身分比誠實降級更糟。**
 *
 * ⚠️ 抓到它的是既有的「零引數的方法不得憑空多出插槽」那條護欄
 * ——它拿 `obj.reset()` 當泛用方法呼叫的例子，而 `obj` 沒有宣告過。
 *
 * **何時該修**：宣告表記得住**陣列的元素型別**的那一天
 *（今天 `bitset<26> d1[3]` 只記下 `d1 → array`，元素型別在別處）。
 * 那是整族共同的限制，不是這一顆的。
 */
