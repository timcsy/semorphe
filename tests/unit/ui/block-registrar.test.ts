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
      'cpp_print', 'cpp_input', 'cpp_var_declare', 'cpp_if',
      'cpp_func_def', 'cpp_func_call', 'cpp_print_formatted', 'cpp_input_formatted',
      'cpp_literal_string', 'cpp_endl', 'cpp_loop_while', 'cpp_loop_count',
      'cpp_raw_code', 'cpp_doc_comment',
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
