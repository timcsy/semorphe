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
import { staleShapeIn, SHAPE_CHANGES_V12, SHAPE_CHANGES_V13, SHAPE_CHANGES_V14, SHAPE_CHANGES_V15 } from '../../../src/migrations/block-shape-changes'
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

  it('★ 錨點：升級鏈接得上（否則上面每一條都在測一個沒被接上的步驟）', () => {
    // ⚠️ **不釘死版號**——每加一筆形狀改動就開一個新版，
    //    釘死的話這一條會在**下一次正確的改動**變紅（build-guardrail 簽名三）。
    expect(CURRENT_VERSION).toBeGreaterThanOrEqual(13)
    for (let v = 1; v < CURRENT_VERSION; v++) {
      expect(UPGRADES[v], `🔴 升級鏈缺了 ${v} → ${v + 1} 這一格`).toBeTypeOf('function')
    }
  })

  /**
   * `v12 → v13`：C++ 的複合指定。⚠️ **不能加進 v12**——已經升到 v12 的存檔
   * 不會再跑一次 v12，所以同一個版號裡加第二筆是無效的。
   */
  it('★ v13：C++ 的舊形狀（含 altLayout 的 INDEX 佈局）也認得出來', () => {
    const twoLayouts = [
      { type: 'cpp_var_assign_compound', fields: { NAME: 'x', OP: '+=' } },
      { type: 'cpp_var_assign_compound', fields: { NAME: 'a', OP: '+=' },
        inputs: { INDEX: { block: { type: 'cpp_var_ref', fields: { NAME: 'i' } } } } },
      { type: 'cpp_var_assign_compound_expression', fields: { NAME: 'x', OP: '+=' } },
    ]
    for (const b of twoLayouts) {
      expect(staleShapeIn({ blocks: { blocks: [b] } }, SHAPE_CHANGES_V13),
        `🔴 認不出來 → ${b.type} 的左值會安靜地消失`).not.toBeNull()
    }
    const raw = { version: 12, code: 'a[i] += 2;\n', blocklyState: { blocks: { blocks: twoLayouts } } }
    const up = UPGRADES[12](raw)
    expect(up.version).toBe(13)
    expect(Object.keys(up.blocklyState as object)).toEqual([])
  })

  it('★ v14：普通指派的舊形狀也認得出來', () => {
    const st = { blocks: { blocks: [{ type: 'cpp_var_assign', fields: { NAME: 'x' } }] } }
    expect(staleShapeIn(st, SHAPE_CHANGES_V14)).not.toBeNull()
    const up = UPGRADES[13]({ version: 13, code: 'o.x = 1;\n', blocklyState: st })
    expect(up.version).toBe(14)
    expect(Object.keys(up.blocklyState as object)).toEqual([])
  })

  /**
   * 🔴 **一顆積木的骨架不只有欄位**：`cin >>` 換建構子時**沒有任何欄位改變**
   * （`compose` 模式的格子連一個欄位都沒有），變的是 `extraState` 的記憶方式
   * （`{args:[…]}` → `{itemCount}`）。
   *
   * > **一個只看得見欄位的失效判定，看不見「同一顆積木換了記憶方式」。**
   */
  it('★ v15：只有 `extraState` 變了（一個欄位都沒動）也要認得出來', () => {
    const composeOnly = { blocks: { blocks: [{
      type: 'cpp_input',
      // ⚠️ **沒有 fields**——舊的 compose 模式就是這樣存的
      extraState: { args: [{ mode: 'compose' }, { mode: 'compose' }] },
      inputs: { ARG_0: { block: { type: 'cpp_var_ref', fields: { NAME: 'x' } } } },
    }] } }
    expect(staleShapeIn(composeOnly, SHAPE_CHANGES_V15),
      '🔴 只看欄位 → 舊快取載進去會少掉格子，而沒有任何東西出聲').not.toBeNull()

    const selectMode = { blocks: { blocks: [{
      type: 'cpp_input', fields: { SEL_0: 'x' }, extraState: { args: [{ mode: 'select', text: 'x' }] },
    }] } }
    expect(staleShapeIn(selectMode, SHAPE_CHANGES_V15)).not.toBeNull()

    // ★ 反向：已經是新形狀的（`{itemCount}`）不得被亂丟
    const fresh = { blocks: { blocks: [{ type: 'cpp_input', extraState: { itemCount: 2 } }] } }
    expect(staleShapeIn(fresh, SHAPE_CHANGES_V15),
      '🔴 誤判 → 每一個使用者的排版都會無故重算').toBeNull()

    const up = UPGRADES[14]({ version: 14, code: 'cin >> x;\n', blocklyState: selectMode })
    expect(up.version).toBe(15)
    expect(Object.keys(up.blocklyState as object)).toEqual([])
  })

  it('🔴 v12 的表不得認 v13 的積木（版號各管各的）', () => {
    const cpp = { blocks: { blocks: [{ type: 'cpp_var_assign_compound', fields: { NAME: 'x' } }] } }
    expect(staleShapeIn(cpp, SHAPE_CHANGES_V12),
      '🔴 兩張表混在一起 → 已經升過 v12 的存檔會被重複丟快取').toBeNull()
  })
})
