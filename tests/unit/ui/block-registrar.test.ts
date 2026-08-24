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
       'cpp_input', 'cpp_var_declare',
      'cpp_func_def', 'cpp_print_formatted', 'cpp_input_formatted', 'cpp_loop_count',
      'cpp_raw_code',
    ]
    // 🪦 **`cpp_func_call`（含運算式形態）於 2026-08-24 退場**——改用
    //    `builder: "variadic"` ＋ 活下拉 ＋ 具名的 `LABEL` 列。
    // 🪦 **`cpp_if` 於 2026-08-24 退場**（比對護欄確認一模一樣，換成 `branchList` 宣告）。
    //    ⚠️ 從這張清單拿掉一個名字**必須附理由**——否則「它不見了」與
    //    「它被誰不小心刪掉了」在這支測試裡長得一模一樣。
    // ⚠️ 🪦 `cpp_print`（162）、`cpp_array_at`／`cpp_continue`／`cpp_endl`／
    //    `cpp_literal_string`（163）、cpp_break／cpp_return／cpp_var_ref（164）、
    //    cpp_loop_while 等七顆（165）從這份清單移除——它不再是命令式的，
    //    改由 `ui/variadic-block.ts` 依膠囊的 `builder: "variadic"` 建。
    //    **一顆退場就要從這裡拿掉**，否則這條會在退場那天說「積木不見了」。
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
