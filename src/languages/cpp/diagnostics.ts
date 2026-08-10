import type { DiagnosticRule } from '../../core/diagnostics'

/** C++ specific diagnostic rules for block validation. */
export const cppDiagnosticRules: DiagnosticRule[] = [
  {
    blockTypes: ['cpp_if', 'cpp_if_else'],
    check: 'hasInput',
    inputName: 'CONDITION',
    severity: 'warning',
    message: 'DIAG_MISSING_CONDITION',
  },
  {
    blockTypes: ['cpp_loop_while'],
    check: 'hasInput',
    inputName: 'CONDITION',
    severity: 'warning',
    message: 'DIAG_MISSING_CONDITION',
  },
  {
    blockTypes: ['cpp_print'],
    check: 'hasInput',
    inputName: 'EXPR0',
    severity: 'warning',
    message: 'DIAG_MISSING_VALUE',
  },
  {
    blockTypes: ['cpp_var_declare'],
    check: 'varDeclareNames',
    severity: 'warning',
    message: 'DIAG_MISSING_VALUE',
  },
]
