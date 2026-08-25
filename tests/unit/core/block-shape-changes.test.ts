/**
 * `v11 → v12` 的升級步驟：**左值換成接點時，快取要被丟掉而不是被手修**。
 *
 * 🔴 為什麼這一支存在：`python_var_assign_compound` 的 `NAME` 欄位不見了，
 * 而那一格裝的是 `nums[0]`／`self.n`／`a.b.c`。Blockly 反序列化時會**安靜地
 * 略過**一個不存在的欄位——症狀是左值消失、程式碼從積木重產之後變成 `x += 1`，
 * **而沒有任何東西會出聲**。
 *
 * 判準（`migrate-storage` 第 3／4／5 步）：冪等 · 只改確定的位置 · 表空時不亂丟。
 */
import { describe, it, expect } from 'vitest'
import { staleShapeIn, SHAPE_CHANGES_V12 } from '../../../src/migrations/block-shape-changes'
import { UPGRADES, CURRENT_VERSION } from '../../../src/core/storage-version'

const oldState = {
  blocks: { blocks: [{
    type: 'python_var_assign_compound',
    fields: { NAME: 'nums[0]', OP: '+=' },
    inputs: { VALUE: { block: { type: 'python_literal_number', fields: { NUM: '1' } } } },
  }] },
}
const newState = {
  blocks: { blocks: [{
    type: 'python_var_assign_compound',
    fields: { OP: '+=' },
    inputs: {
      TARGET: { block: { type: 'python_var_ref', fields: { NAME: 'x' } } },
      VALUE: { block: { type: 'python_literal_number', fields: { NUM: '1' } } },
    },
  }] },
}

describe('v11 → v12：形狀變了的快取', () => {
  it('★ 正向：帶著退場欄位的舊快取要被認出來', () => {
    const hit = staleShapeIn(oldState, SHAPE_CHANGES_V12)
    expect(hit, '🔴 認不出來 → 舊存檔的左值會安靜地消失').not.toBeNull()
    expect(hit!.blockType).toBe('python_var_assign_compound')
  })

  it('★ 反向：已經是新形狀的快取不得被亂丟', () => {
    expect(staleShapeIn(newState, SHAPE_CHANGES_V12),
      '🔴 誤判 → 每一個使用者的排版都會無故重算').toBeNull()
  })

  it('🔴 合取：型別對得上而【沒有】那個退場欄位，不算', () => {
    // `TARGET` 接點裡的 `python_var_ref` 身上也有一個叫 `NAME` 的欄位
    // ——只比對欄位名的話它會命中，而它完全正確。
    expect(staleShapeIn(newState, SHAPE_CHANGES_V12)).toBeNull()
  })

  it('🔴 巢狀也要找得到（接點裡／next 串下去）', () => {
    const nested = { blocks: { blocks: [{
      type: 'python_func_def',
      inputs: { BODY: { block: {
        type: 'python_print',
        next: { block: oldState.blocks.blocks[0] },
      } } },
    }] } }
    expect(staleShapeIn(nested, SHAPE_CHANGES_V12)).not.toBeNull()
  })

  it('🔴 表是空的時候不得把任何東西判成過期', () => {
    expect(staleShapeIn(oldState, []), '🔴 一個還沒開始的遷移會把所有舊檔的快取丟光').toBeNull()
  })

  it('★ 升級步驟：舊快取被丟掉，而 code 原封不動', () => {
    const raw = { version: 11, code: 'nums[0] += 1\n', codeHash: 'abc', blocklyState: oldState }
    const up = UPGRADES[11](raw)
    expect(up.version).toBe(12)
    expect(up.code, '🔴 真相被動到了').toBe('nums[0] += 1\n')
    expect(Object.keys(up.blocklyState as object), '🔴 快取沒被丟掉').toEqual([])
  })

  it('★ 升級步驟：沒有過期形狀時，快取原樣保留', () => {
    const raw = { version: 11, code: 'x += 1\n', blocklyState: newState }
    const up = UPGRADES[11](raw)
    expect(up.version).toBe(12)
    expect(up.blocklyState, '🔴 無辜的快取被丟了').toEqual(newState)
  })

  it('🔴 冪等：跑第二次是 no-op（匯出那條路曾經讓轉換被跑兩次）', () => {
    const raw = { version: 11, code: 'nums[0] += 1\n', blocklyState: oldState }
    const once = UPGRADES[11](raw)
    const twice = UPGRADES[11]({ ...once, version: 11 })
    expect(twice.blocklyState).toEqual(once.blocklyState)
    expect(twice.code).toBe(once.code)
  })

  it('★ 錨點：這一版真的是 12（否則上面每一條都在測一個沒被接上的步驟）', () => {
    expect(CURRENT_VERSION).toBe(12)
    expect(UPGRADES[11]).toBeTypeOf('function')
  })
})
