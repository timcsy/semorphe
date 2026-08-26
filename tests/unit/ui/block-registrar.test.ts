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
      'cpp_var_declare', 'cpp_func_def', 'cpp_loop_count',
    ]
    // 🪦 **`cpp_input`（2026-08-26）· `cpp_print_formatted`／`cpp_input_formatted`
    //    （2026-08-26）退場**——三顆都改用 `builder: "variadic"`。
    //    ⚠️ 而這一刀**不是「一模一樣了」，是判哪一邊對**：
    //    宣告那份把參數擠進一個文字欄位，而 `children: ['args']` 說它們是子節點。
    //    每一格因此從「變數下拉／接點二選一」變成單純的接點
    //    ——理由與 `cin >>` 同一條（左值接點化之後那個模式失去了理由）。
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
    // 🪦 **`cpp_raw_code` 於 2026-08-26 退場——而它是最後一顆**。
    //    它卡了三輪，理由寫在 `retire-imperative-block` §3：比對說「一模一樣」
    //    而它不能刪，因為 `loadExtraState` 會依 `unresolved`／`nodeType` 換 tooltip
    //    ——**而比對只比「剛建好的樣子」**。
    //    這次能刪是因為那兩件事**分別搬走了**：`extraState` 的保存交給
    //    `preserveForeignExtraState` 新增的「純轉手」那一支（宣告式積木沒有
    //    save／load 鉤子時 Blockly **不會替你留著** extraState，實測是 `{}`），
    //    視覺交給面板的 `applyExtraStateVisuals`（它本來就對每一顆積木在做）。
    //    ⚠️ 而「一顆都不剩」**不等於清乾淨了**：檔案裡還有 10 顆命令式定義，
    //    其中 7 顆的宣告是空殼，見 `tests/baselines/block-def-parity.json`
    //    的 `hollowDeclaration`。
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
