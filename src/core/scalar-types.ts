/**
 * **「這個型別名在執行期是哪一種純量」的宣告登記處**
 *
 * ## 🔴 它從哪來（2026-09-19）
 *
 * ```cpp
 * int n = 1e9;         g++ 1000000000      我們 1000000000   🟢
 * long long n = 2e9;   g++ 2000000000      我們 2e+09        🔴
 * ```
 *
 * `coerceType(val, 'int')` 認得 `int`，而 `long long` 掉進 `default: return val`
 * ——於是那個變數**一直是一個 double**。症狀不只是印出來的樣子：
 * `for(ll jp=1e12; jp>0; jp>>=1)` 的 `>>=` 因此不走整數那一路，被截成 32 位元。
 *
 * > **一個型別名沒有被認出來，它的錯不會出現在宣告那一行
 * > ——它出現在下游每一個「整數與小數不同」的地方。**
 *
 * ## ⚠️ 為什麼不直接在 `coerceType` 裡多寫幾個 case
 *
 * `long long`／`size_t`／`int64_t` 是 **C++ 的拼法**，而 `coerceType` 住在核心。
 * 中立性護欄盯著「核心不得認得語言的東西」，而它 2026-09-18 指名過一次。
 *
 * 🟢 形狀抄 `comment-syntax.ts`／`skip-declarations.ts`／`non-components.ts`：
 * **核心宣告槽位，語言套件推資料進來。**
 *
 * ## ⚠️ 它不做的事
 *
 * - **不管寬度**：`int` 與 `long long` 在這個直譯器裡都是「整數」，
 *   而精度由 `interpreter/int64.ts` 的不變式保證（超過 2^53 換成 `bigint`）。
 *   ⚠️ 所以**不要**拿這張表去做溢位模擬——那需要的是寬度，不是種類。
 * - **不管使用者自己的別名**：`typedef`／`#define` 走 `interpreter/aliases.ts`，
 *   而兩者**可以疊**（`ll` → `long long` → `int`）。
 */

const aliases = new Map<string, string>()

/**
 * 登記一個拼法。
 *
 * @param spelling 原始碼裡寫的（`long long`、`size_t`…）
 * @param runtime  執行期的種類（`int`／`double`／`char`／`bool`／`string`）
 */
export function declareScalarTypeAlias(spelling: string, runtime: string): void {
  if (spelling === '' || runtime === '' || spelling === runtime) return
  aliases.set(spelling, runtime)
}

/**
 * 這個拼法在執行期是哪一種——**認不得就原樣回去**。
 *
 * ⚠️ 原樣回去是對的：結構名、樣板名、還沒登記的拼法都該保持原樣，
 * 由下游（`ctx.structs.has`、聚合形狀、樣板判定）各自認領。
 */
export function runtimeScalarType(spelling: string): string {
  return aliases.get(spelling.trim()) ?? spelling
}

/** 測試用——還原成「沒有語言套件」的狀態。 */
export function resetScalarTypeAliases(): void {
  aliases.clear()
}

/** 護欄用：登記了哪些。 */
export function allScalarTypeAliases(): ReadonlyMap<string, string> {
  return aliases
}
