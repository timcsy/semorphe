import { describe, it, expect } from 'vitest'
import { runDiagnostics } from '../../../src/core/diagnostics'
import type { DiagnosticBlock } from '../../../src/core/diagnostics'
import { cppDiagnosticRules } from '../../../src/languages/cpp/diagnostics'

/**
 * ⚠️ **`nodeId` 預設與 `id` 不同**（`n_b1` 而不是 `b1`）。
 *
 * 讓它們相同的話，這批測試在「錨點還是 blockId」的實作上**也會通過**
 * ——而那正是 2026-08-14 換掉的東西。**兩個 id 故意長得不一樣，
 * 斷言才分得出診斷指的是語義節點還是積木。**
 */
function makeBlock(overrides: Partial<DiagnosticBlock> & { id: string; type: string }): DiagnosticBlock {
  return {
    nodeId: `n_${overrides.id}`,
    getFieldValue: () => null,
    getInputTargetBlock: () => null,
    getInput: () => null,
    ...overrides,
  }
}

describe('runDiagnostics', () => {
  it('should return empty array for no blocks', () => {
    expect(runDiagnostics([], cppDiagnosticRules)).toEqual([])
  })

  it('should warn when cpp_if is missing condition', () => {
    const block = makeBlock({ id: 'b1', type: 'cpp_if' })
    const result = runDiagnostics([block], cppDiagnosticRules)
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({ nodeId: 'n_b1', severity: 'warning', rule: 'MISSING_CONDITION', params: { inputName: 'CONDITION' }, source: 'component' })
  })

  it('should not warn when cpp_if has condition', () => {
    const block = makeBlock({
      id: 'b1',
      type: 'cpp_if',
      getInputTargetBlock: (name: string) => name === 'CONDITION' ? makeBlock({ id: 'c1', type: 'cpp_compare' }) : null,
    })
    expect(runDiagnostics([block], cppDiagnosticRules)).toEqual([])
  })

  it('should warn when cpp_if_else is missing condition', () => {
    const block = makeBlock({ id: 'b2', type: 'cpp_if_else' })
    const result = runDiagnostics([block], cppDiagnosticRules)
    expect(result).toHaveLength(1)
    expect(result[0].rule).toBe('MISSING_CONDITION')
  })

  it('should warn when cpp_loop_while is missing condition', () => {
    const block = makeBlock({ id: 'b3', type: 'cpp_loop_while' })
    const result = runDiagnostics([block], cppDiagnosticRules)
    expect(result).toHaveLength(1)
    expect(result[0].rule).toBe('MISSING_CONDITION')
  })

  it('should warn when cpp_print is missing expression', () => {
    const block = makeBlock({ id: 'b4', type: 'cpp_print' })
    const result = runDiagnostics([block], cppDiagnosticRules)
    expect(result).toHaveLength(1)
    expect(result[0].rule).toBe('MISSING_VALUE')
  })

  it('should not warn when cpp_print has expression', () => {
    const block = makeBlock({
      id: 'b4',
      type: 'cpp_print',
      getInputTargetBlock: (name: string) => name === 'EXPR0' ? makeBlock({ id: 'e1', type: 'cpp_literal_string' }) : null,
    })
    expect(runDiagnostics([block], cppDiagnosticRules)).toEqual([])
  })

  it('should warn when cpp_var_declare has empty name', () => {
    const block = makeBlock({
      id: 'b5',
      type: 'cpp_var_declare',
      getFieldValue: (name: string) => name === 'NAME' ? '' : null,
    })
    const result = runDiagnostics([block], cppDiagnosticRules)
    expect(result).toHaveLength(1)
    expect(result[0].rule).toBe('MISSING_VAR_NAME')
  })

  it('should warn for indexed var_declare with empty name', () => {
    const block = makeBlock({
      id: 'b6',
      type: 'cpp_var_declare',
      getFieldValue: (name: string) => {
        if (name === 'NAME_0') return ''
        if (name === 'NAME_1') return 'y'
        return null
      },
    })
    const result = runDiagnostics([block], cppDiagnosticRules)
    expect(result).toHaveLength(1)
    expect(result[0].rule).toBe('MISSING_VAR_NAME')
  })

  /**
   * 🔴 **`int , , ;` 產出三則，而它們以前完全無法區分。**
   *
   * 2026-08-14 之前三則的 `nodeId` 與 `message` 一模一樣，於是積木側
   * `setWarningText` 後蓋前——**三個問題只看得到一個**。
   *
   * ⚠️ **則數不變（仍是三則）**，改變的是它們從此帶著各自的位置。
   */
  it('三個空名字產出三則，而每一則的 position 都不同', () => {
    const block = makeBlock({
      id: 'b9',
      type: 'cpp_var_declare',
      getFieldValue: (name: string) => (['NAME_0', 'NAME_1', 'NAME_2'].includes(name) ? '' : null),
    })
    const result = runDiagnostics([block], cppDiagnosticRules)
    expect(result, '則數變了 → 本輪不該改變診斷的觸發').toHaveLength(3)
    expect(result.map((d) => d.rule)).toEqual(['MISSING_VAR_NAME', 'MISSING_VAR_NAME', 'MISSING_VAR_NAME'])
    // ⚠️ 這一行就是修正本身：以前這三個值不存在，三則長得一模一樣。
    expect(
      result.map((d) => d.params.position),
      '三則的位置相同 → 它們仍然無法區分，畫面上還是只會顯示一個',
    ).toEqual([1, 2, 3])
  })

  it('should handle multiple blocks with mixed diagnostics', () => {
    const blocks = [
      makeBlock({ id: 'b1', type: 'cpp_if' }),
      makeBlock({
        id: 'b2',
        type: 'cpp_if',
        getInputTargetBlock: (name: string) => name === 'CONDITION' ? makeBlock({ id: 'c1', type: 'cpp_compare' }) : null,
      }),
      makeBlock({ id: 'b3', type: 'cpp_print' }),
    ]
    const result = runDiagnostics(blocks, cppDiagnosticRules)
    expect(result).toHaveLength(2)
    expect(result.map(d => d.nodeId)).toEqual(['n_b1', 'n_b3'])
  })
})

// spec 205（6c-3 T006）：板子的判決照 arduino-esp32 的真實行為——位元數超出 1～16 時 analogReadResolution 直接 return、不報錯；
// 「參數不合理要出聲」是教學提示，住在診斷層（warning），不是板子判決（原本是 JS 直譯器丟錯）
describe('數字插槽的範圍（numberInputRange）', () => {
  const num = (v: string) => makeBlock({ id: 'n1', type: 'cpp_literal_number', getFieldValue: (f: string) => (f === 'NUM' ? v : null) })
  const res = (target: DiagnosticBlock | null) => makeBlock({ id: 'r1', type: 'cpp_analog_resolution', getInputTargetBlock: (n: string) => (n === 'BITS' ? target : null) })
  const run = (b: DiagnosticBlock) => runDiagnostics([b], cppDiagnosticRules).filter((d) => d.rule === 'VALUE_OUT_OF_RANGE')

  it('★ 99 位元 → 一則 warning，帶著值與範圍', () => {
    const d = run(res(num('99')))
    expect(d).toHaveLength(1)
    expect(d[0]).toMatchObject({ nodeId: 'n_r1', severity: 'warning', params: { inputName: 'BITS', value: '99', min: 1, max: 16 } })
  })
  it('★ 正向錨點：12 位元不提示', () => {
    expect(run(res(num('12')))).toHaveLength(0)
  })
  it('邊界：0 與 17 提示、1 與 16 不提示', () => {
    expect(run(res(num('0')))).toHaveLength(1)
    expect(run(res(num('17')))).toHaveLength(1)
    expect(run(res(num('1')))).toHaveLength(0)
    expect(run(res(num('16')))).toHaveLength(0)
  })
  it('接的不是數字積木（變數、運算式）→ 不猜、不提示；空插槽也不提示（那是另一條規則的事）', () => {
    expect(run(res(makeBlock({ id: 'v1', type: 'cpp_var_ref' })))).toHaveLength(0)
    expect(run(res(null))).toHaveLength(0)
  })
})
