/**
 * C++ built-in constants — single source of truth.
 * Used by lifters, interpreter, and executor.
 */
import type { RuntimeType } from '../../interpreter/types'

export interface BuiltinConstant {
  type: RuntimeType
  value: number
}

/** Complete map of C++ built-in constants with their runtime values. */
export const CPP_BUILTIN_CONSTANTS: Record<string, BuiltinConstant> = {
  'true': { type: 'int', value: 1 },
  'false': { type: 'int', value: 0 },
  'EOF': { type: 'int', value: -1 },
  'NULL': { type: 'int', value: 0 },
  'nullptr': { type: 'int', value: 0 },
  'INT_MAX': { type: 'int', value: 2147483647 },
  'INT_MIN': { type: 'int', value: -2147483648 },
  'LLONG_MAX': { type: 'int', value: Number.MAX_SAFE_INTEGER },
  'LLONG_MIN': { type: 'int', value: Number.MIN_SAFE_INTEGER },
  'SIZE_MAX': { type: 'int', value: Number.MAX_SAFE_INTEGER },
  /**
   * 🔴 **值要與我們自己的 `rand()` 對得起來**（2026-09-20）。
   *
   * `cpp:random_next` 回的是 `0 … 32767`，所以這裡就是 32767
   * ——`(double)rand()/RAND_MAX` 這個招牌寫法要落在 `[0,1]` 裡。
   *
   * ⚠️ **不抄參照編譯器的 2147483647**：那台機器的 `rand()` 值域也是那麼大，
   * 而我們的不是。抄一個數字而不抄產生它的那支函式，會讓一個
   * **兩邊各自都自洽**的常數變成一個**我們這邊不自洽**的常數。
   * C++ 標準只要求 `RAND_MAX >= 32767`，沒有定死它是多少。
   *
   * > **一個從別的系統抄來的常數，它的正確性住在【抄它的人有沒有一起抄那個系統】。**
   *
   * ⚠️ 而語料 `basic/6_count` 印的就是 `RAND_MAX` 與 `rand()`——那一支
   * **本來就不可比**（標準不規定序列）。這一格治的是它**跑不完**
   *（`UNDECLARED_VAR ｜ RAND_MAX` 整支停住），不是治它的輸出。
   */
  'RAND_MAX': { type: 'int', value: 32767 },
  // ⚠️ **`string::npos` 是 -1，不是 SIZE_MAX**——因為這個直譯器的
  // `find` 家族**刻意回 -1**（見 `cpp:string_find` 的檔頭：「使用者常寫
  // `!= -1` 來比，而 `!= -1` 與 `!= string::npos` 兩種寫法都對」）。
  //
  // 🔴 而在 2026-08-13 之前**這一格是空的**：`string::npos` 整個 lift 不出來，
  // 於是 `while ((pos = s.find(x, pos)) != string::npos)` 丟 UNKNOWN_COMPONENT。
  // 那句「兩種寫法都對」**只有一種是真的**——而沒有東西在檢查另一種。
  //
  // > **一句承諾了兩條路的註解，只走過其中一條。**
  'string::npos': { type: 'int', value: -1 },
  'npos': { type: 'int', value: -1 },
}

/** Set of all built-in constant names (for filtering from scope snapshots, lifter checks, etc.) */
export const CPP_BUILTIN_NAMES: Set<string> = new Set(Object.keys(CPP_BUILTIN_CONSTANTS))
