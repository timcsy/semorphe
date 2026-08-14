import type { DiagnosticRule } from '../../core/diagnostics'

/**
 * C++ specific diagnostic rules for block validation.
 *
 * ## 規則**條目**與規則**身分**不是同一個數字
 *
 * ```
 * 條目 4   一條規則看一組積木型別（cpp_if 與 cpp_loop_while 各一條）
 * 身分 3   MISSING_CONDITION / MISSING_VALUE / MISSING_VAR_NAME
 * ```
 *
 * 文案要照**身分**列舉（第四十二條護欄在看這個），不是照條目
 * ——否則同一個身分會被算兩次，而「12 份」變成「16 份」。
 *
 * ## 🔴 `MISSING_VALUE` 曾經被兩個不同的問題共用
 *
 * `cpp_print` 沒接東西與 `cpp_var_declare` 沒填名字，2026-08-14 之前
 * 用的是同一個 `DIAG_MISSING_VALUE`。
 *
 * > **一個身分被兩個不同的問題共用，等於承諾了它們永遠要用同一句話。**
 *
 * 而積木側想說「第 2 個變數還沒有名字」時就撞牆了——那句話對 `cpp_print`
 * 毫無意義。所以拆成 `MISSING_VAR_NAME`。
 */
export const cppDiagnosticRules: DiagnosticRule[] = [
  {
    blockTypes: ['cpp_if', 'cpp_if_else'],
    check: 'hasInput',
    inputName: 'CONDITION',
    severity: 'warning',
    rule: 'MISSING_CONDITION',
  },
  {
    blockTypes: ['cpp_loop_while'],
    check: 'hasInput',
    inputName: 'CONDITION',
    severity: 'warning',
    rule: 'MISSING_CONDITION',
  },
  {
    blockTypes: ['cpp_print'],
    check: 'hasInput',
    inputName: 'EXPR0',
    severity: 'warning',
    rule: 'MISSING_VALUE',
  },
  {
    blockTypes: ['cpp_var_declare'],
    check: 'varDeclareNames',
    severity: 'warning',
    rule: 'MISSING_VAR_NAME',
  },
]
