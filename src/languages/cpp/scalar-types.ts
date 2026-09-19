/**
 * **C++ 的純量拼法 → 執行期的種類**（2026-09-19）。
 *
 * ## 🔴 少了這張表的症狀不是「型別顯示錯了」
 *
 * ```cpp
 * int n = 1e9;         g++ 1000000000   我們 1000000000   🟢
 * long long n = 2e9;   g++ 2000000000   我們 2e+09        🔴
 * ```
 *
 * `coerceType` 認得 `int` 而 `long long` 掉進 `default: return val`
 * ——於是那個變數**一直是一個 double**。它印成 `2e+09`，
 * 而 `n >>= 1` 因此不走整數那一路，被截成 32 位元。
 *
 * > **一個型別名沒有被認出來，它的錯不會出現在宣告那一行
 * > ——它出現在下游每一個「整數與小數不同」的地方。**
 *
 * ## ⚠️ 為什麼在【模組頂層】而不是在 `initCppModule()` 裡
 *
 * 第一版放在 `module.ts` 的頂層，而**只有 app 會載入那個檔**——
 * 測試呼叫的是 `registerCppLanguage()`，於是這張表在測試裡是空的，
 * 而同一段程式在產品裡與在測試裡**行為不同**。
 *
 * 🔴 這個 repo 記過同一件事兩次：`generators/index.ts` 的降級積木名
 *（spec 168「搬到模組頂層」）、以及 `tests/helpers/toolbox.ts` 的
 * Python 分類宣告（「副作用匯入」）。
 *
 * > **一份「語言套件推進來」的資料，它的正確性綁在「誰載入了那個檔」上
 * > ——所以它要住在那個語言一定會被載入的地方。**
 *
 * ## ⚠️ 它不做的事
 *
 * **寬度不在這裡**——`int` 與 `long long` 都是「整數」，精度由
 * `interpreter/int64.ts` 的不變式保證（超過 2^53 換成 `bigint`）。
 * ⚠️ `unsigned` 的**環繞語義也不在這裡**：那需要寬度，而這張表沒有。
 *    今天 `unsigned` 就是整數，負數不會環繞——那是一個**已知的不同**，
 *    語料裡 0 支依賴它。
 */
import { declareScalarTypeAlias } from '../../core/scalar-types'

for (const t of [
  'long', 'long int', 'long long', 'long long int', 'short', 'short int',
  'signed', 'signed int', 'signed char', 'unsigned', 'unsigned int', 'unsigned char',
  'unsigned long', 'unsigned long int', 'unsigned long long', 'unsigned long long int',
  'unsigned short', 'size_t', 'ssize_t', 'ptrdiff_t',
  'int8_t', 'int16_t', 'int32_t', 'int64_t',
  'uint8_t', 'uint16_t', 'uint32_t', 'uint64_t',
]) declareScalarTypeAlias(t, 'int')
declareScalarTypeAlias('long double', 'double')
declareScalarTypeAlias('wchar_t', 'char')
declareScalarTypeAlias('char16_t', 'char')
declareScalarTypeAlias('char32_t', 'char')
