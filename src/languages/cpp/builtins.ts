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
  // ⚠️ **`string::npos` 是 -1，不是 SIZE_MAX**——因為這個直譯器的
  // `find` 家族**刻意回 -1**（見 `cpp:string_find` 的檔頭：「使用者常寫
  // `!= -1` 來比，而 `!= -1` 與 `!= string::npos` 兩種寫法都對」）。
  //
  // 🔴 而在 2026-08-13 之前**這一格是空的**：`string::npos` 整個 lift 不出來，
  // 於是 `while ((pos = s.find(x, pos)) != string::npos)` 丟 UNKNOWN_CONCEPT。
  // 那句「兩種寫法都對」**只有一種是真的**——而沒有東西在檢查另一種。
  //
  // > **一句承諾了兩條路的註解，只走過其中一條。**
  'string::npos': { type: 'int', value: -1 },
  'npos': { type: 'int', value: -1 },
}

/** Set of all built-in constant names (for filtering from scope snapshots, lifter checks, etc.) */
export const CPP_BUILTIN_NAMES: Set<string> = new Set(Object.keys(CPP_BUILTIN_CONSTANTS))
