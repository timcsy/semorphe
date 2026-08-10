/**
 * `<cmath>` 的辨識路——**空的，而且是顯式的空**（理由見 `generators.ts`）。
 *
 * ## 這裡原本有一個 40 行的 `tryCmathLift()`
 *
 * 它有三個分支、自己組 `createNode`，看起來完全像實作。而拆開之後只剩三列：
 *
 * ```
 * pow      → cpp:math_pow    引數槽 base, exponent
 * 18 個名字 → cpp:math_unary  引數槽 value      ＋ func 屬性
 *  5 個名字 → cpp:math_binary 引數槽 arg1, arg2 ＋ func 屬性
 * ```
 *
 * > **一個函式長得像實作，不代表它是實作。**
 * > 判準：把它的分支排成表，每一列還剩下什麼？只剩資料 → 它是分派表。
 *
 * 三列現在登錄在各自的膠囊裡（`core/component/call-concepts.ts`），
 * 判別邏輯（找 `call_expression`、依序取引數）留在 `lifters/io.ts`。
 */
import type { Lifter } from '../../../../core/lift/lifter'

export function registerLifters(_lifter: Lifter): void {}
