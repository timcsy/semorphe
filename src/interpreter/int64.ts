/**
 * **整數超過 2^53 的那一段**——`long long` 在 JavaScript 裡不是一個數字。
 *
 * ## 🔴 它從哪來（2026-09-19，語料）
 *
 * `AP325/2/2_8_loop.cpp`（模逆元／快速冪，競賽最常見的樣板之一）：
 *
 * ```cpp
 * while(nt){
 *     if(nt & 1) ans = ans*x%P;   // ← x,P ≈ 1e9 ⟹ 乘積 ≈ 1e18
 *     x = x*x%P;
 *     nt >>= 1;                   // ← JS 的 >> 是【32 位元】
 * }
 * ```
 *
 * **兩個獨立的失真疊在同一行上：**
 *
 * ```
 * ① 乘法超過 2^53（9.0e15）就失真     JS 的數字是 double；long long 精確到 9.2e18
 * ② 位元運算被截成 32 位元            JS 的 & | ^ << >> 一律先轉 int32
 * ```
 *
 * ⚠️ 而**症狀是「算出另一個數字」**，不是報錯——它落在語料的
 * 「內容真的不同」那一欄，而那一欄是唯一一欄**不會有人來問**的。
 *
 * ## 🔴 不變式：`bigint` 只在中途出現
 *
 * ```
 * 一個整數值：|v| ≤ 2^53 時是 number，超過時是 bigint
 * ```
 *
 * **不把整數全改成 `BigInt`**——那要動每一條算術路徑，而且會讓
 * 每一個下標、每一次比較、每一處 `Math.*` 都要先轉回來。
 *
 * 這個不變式讓 `bigint` 自我收斂：`ans*x%P`（P < 2^31）的乘積是 bigint，
 * 而 `% P` 之後立刻收回 number。**一支不取模的程式才會一路帶著 bigint**，
 * 而那正是它需要 64 位元的那一支。
 *
 * ## ⚠️ 它**不**負責的事
 *
 * - **不模擬溢位**：C++ 的 `long long` 溢位是未定義行為，而我們算得比它準
 *   ——那是**往安全的方向**錯（不會靜默給出一個看似合理的錯值）。
 * - **不碰浮點**：`double` 的乘法不得被升上去（`1e300 * 1e300` 在 C++ 是 `inf`，
 *   不是一個大整數）。判準是**運算元的型別**，不是它現在的大小。
 */

/** 這個直譯器裡「數字還精確」的上界。超過它就要換一種表示。 */
export const SAFE = Number.MAX_SAFE_INTEGER

/**
 * **收回來**——`bigint` 落在安全範圍裡就變回 `number`。
 *
 * 🔴 這一支是不變式的守門人：每一個產出整數的地方都要經過它，
 * 否則 `bigint` 會擴散到下標、比較、印出去的每一條路上。
 */
export function narrow(v: bigint): number | bigint {
  return v <= BigInt(SAFE) && v >= BigInt(-SAFE) ? Number(v) : v
}

/** 一個整數值（`number` 或 `bigint`）→ `bigint`。 */
export function big(v: number | bigint): bigint {
  return typeof v === 'bigint' ? v : BigInt(Math.trunc(v))
}

/**
 * 這個值需要用 `bigint` 算嗎——**它已經是 bigint，或它超過安全範圍**。
 *
 * ⚠️ 判準刻意**不看型別名**：一個 `int` 變數可能裝著一個從 `long long`
 * 傳過來的大數，而這個直譯器不分寬度（見 `literal_number` 的字尾註解）。
 */
export function needsBig(v: number | bigint): boolean {
  return typeof v === 'bigint' || !Number.isSafeInteger(v)
}

/**
 * **C++ 的整數除法是往零截斷**，而 `BigInt` 的 `/` 正好也是。
 * ⚠️ `Math.trunc(a / b)` 在大數上會先失真——所以不要用它「順便」處理 bigint。
 */
export function idiv(a: bigint, b: bigint): bigint {
  return a / b
}
