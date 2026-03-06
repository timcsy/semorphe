export interface Diagnostic {
  blockId: string
  severity: 'warning' | 'error'
  message: string
}

export interface DiagnosticBlock {
  id: string
  type: string
  getFieldValue(name: string): string | null
  getInputTargetBlock(name: string): DiagnosticBlock | null
  getInput(name: string): unknown | null
}

export function runDiagnostics(blocks: DiagnosticBlock[]): Diagnostic[] {
  const diagnostics: Diagnostic[] = []

  for (const block of blocks) {
    switch (block.type) {
      case 'u_if':
      case 'u_if_else':
        if (!block.getInputTargetBlock('CONDITION')) {
          diagnostics.push({ blockId: block.id, severity: 'warning', message: 'DIAG_MISSING_CONDITION' })
        }
        break

      case 'u_var_declare': {
        let i = 0
        let hasAnyVar = false
        while (true) {
          const name = block.getFieldValue(`NAME_${i}`)
          if (name === null) break
          if (!name || name.trim() === '') {
            diagnostics.push({ blockId: block.id, severity: 'warning', message: 'DIAG_MISSING_VALUE' })
          }
          hasAnyVar = true
          i++
        }
        if (!hasAnyVar) {
          const name = block.getFieldValue('NAME')
          if (!name || name.trim() === '') {
            diagnostics.push({ blockId: block.id, severity: 'warning', message: 'DIAG_MISSING_VALUE' })
          }
        }
        break
      }

      case 'u_while_loop':
        if (!block.getInputTargetBlock('CONDITION')) {
          diagnostics.push({ blockId: block.id, severity: 'warning', message: 'DIAG_MISSING_CONDITION' })
        }
        break

      case 'u_print':
        if (!block.getInputTargetBlock('EXPR0')) {
          diagnostics.push({ blockId: block.id, severity: 'warning', message: 'DIAG_MISSING_VALUE' })
        }
        break
    }
  }

  return diagnostics
}
