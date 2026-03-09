import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

describe('BlockRegistrar', () => {
  it('app.ts should NOT contain Blockly.Blocks[ definitions (all moved to BlockRegistrar)', () => {
    const appPath = path.resolve(__dirname, '../../../src/ui/app.ts')
    const content = fs.readFileSync(appPath, 'utf-8')
    // Search for Blockly.Blocks[' pattern (block registration)
    const blockDefPattern = /Blockly\.Blocks\[/g
    const matches = content.match(blockDefPattern) ?? []
    expect(matches.length).toBe(0)
  })

  it('block-registrar.ts should contain mutator definitions (saveExtraState)', () => {
    const filePath = path.resolve(__dirname, '../../../src/ui/block-registrar.ts')
    const content = fs.readFileSync(filePath, 'utf-8')
    expect(content).toContain('saveExtraState')
    expect(content).toContain('loadExtraState')
  })

  it('block-registrar.ts should contain all major dynamic block types', () => {
    const filePath = path.resolve(__dirname, '../../../src/ui/block-registrar.ts')
    const content = fs.readFileSync(filePath, 'utf-8')
    const expectedTypes = [
      'u_print', 'u_input', 'u_var_declare', 'u_if',
      'u_func_def', 'u_func_call', 'c_printf', 'c_scanf',
      'u_string', 'u_endl', 'u_while_loop', 'u_count_loop',
      'c_raw_code', 'c_comment_doc',
    ]
    for (const t of expectedTypes) {
      expect(content).toContain(`'${t}'`)
    }
  })

  it('block-registrar.ts should contain workspace option helpers', () => {
    const filePath = path.resolve(__dirname, '../../../src/ui/block-registrar.ts')
    const content = fs.readFileSync(filePath, 'utf-8')
    expect(content).toContain('getWorkspaceVarOptions')
    expect(content).toContain('getScanfVarOptions')
    expect(content).toContain('getWorkspaceArrayOptions')
    expect(content).toContain('getWorkspaceFuncOptions')
  })
})
