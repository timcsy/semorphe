/**
 * **渲染的位置決定挑哪個形態。**
 *
 * ## 🪦 這個檔曾經在測 `getExpressionCounterpart`
 *
 * 那是 spec 097 之前的做法：先渲染成中性形態，**再事後把型別換掉**。
 * 而 spec 097 交付了形態軸（`form: {axis:'role'}`）之後，兩套機制並存了一個月
 * ——**而只有舊的那套真的在跑**：13 顆元件宣告了軸，13 顆全部落回中性形態，
 * 因為唯一的呼叫端傳的是空脈絡 `selectForm(formSet, node, {})`。
 *
 * 2026-09-14 把位置餵下去、舊機制退場。這個檔跟著換成**測新的那一條**
 * ——刪掉舊測試而不補新的，等於用「測試綠了」換掉「這件事還有人在驗」。
 *
 * ## ⚠️ 而其中一條是回歸測試
 *
 * 有 `renderStrategy` 的元件（`cpp:var_declare`）在策略成功時就 `return` 了，
 * **跳過形態選擇**——它一直靠舊機制活著。那一條錯是在「把舊機制換成 throw
 * 跑全套」的時候才現形的，推論沒有找到它。
 *
 * > **一個「我推論它已經不可達」的結論，要用一次 throw 來驗
 * > ——而那一次 throw 找到了推論漏掉的那條路。**
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { PatternRenderer } from '../../../src/core/projection/pattern-renderer'
import type { BlockSpec, SemanticNode } from '../../../src/core/types'

function makeSpec(blockType: string, componentId: string, opts: {
  hasOutput?: boolean
  form?: { axis: string; value: string }
  strategy?: string
} = {}): BlockSpec {
  const blockDef: Record<string, unknown> = { type: blockType }
  if (opts.hasOutput) blockDef.output = 'Expression'
  else { blockDef.previousStatement = null; blockDef.nextStatement = null }
  return {
    id: blockType,
    language: 'cpp',
    category: 'test',
    level: 1,
    version: '1.0.0',
    componentMapping: { componentId, properties: [], slots: {} },
    ...(opts.form ? { form: opts.form } : {}),
    blockDef,
    codeTemplate: { pattern: '', imports: [], order: 0 },
    astPattern: { nodeType: '_none', constraints: [] },
    renderMapping: {
      fields: {},
      inputs: {},
      statementInputs: {},
      ...(opts.strategy ? { strategy: opts.strategy } : {}),
    },
  } as BlockSpec
}

const node = (componentId: string): SemanticNode =>
  ({ componentId, properties: {}, slots: {} }) as never as SemanticNode

describe('渲染位置挑形態', () => {
  let renderer: PatternRenderer

  beforeEach(() => {
    renderer = new PatternRenderer()
    renderer.loadBlockSpecs([
      makeSpec('cpp_increment', 'cpp:increment'),
      makeSpec('cpp_increment_expression', 'cpp:increment', {
        hasOutput: true, form: { axis: 'role', value: 'expression' },
      }),
      makeSpec('cpp_print', 'cpp:print'),   // 只有一個形態
    ])
  })

  it('🔴 運算式位置 → 挑運算式形態', () => {
    expect(renderer.render(node('cpp:increment'), undefined, 'expression')?.type)
      .toBe('cpp_increment_expression')
  })

  it('🔴 語句位置 → 挑中性形態', () => {
    expect(renderer.render(node('cpp:increment'), undefined, 'statement')?.type)
      .toBe('cpp_increment')
  })

  /**
   * ⚠️ **不給位置是合法狀態，不是錯誤**——辨識與存檔往返之後脈絡不一定還在。
   * 落回中性形態，而且不出聲。
   */
  it('⚠️ 不給位置 → 中性形態，而且不警告', () => {
    expect(renderer.render(node('cpp:increment'))?.type).toBe('cpp_increment')
  })

  it('★ 只有一個形態的元件，給不給位置都一樣', () => {
    for (const p of [undefined, 'statement', 'expression'] as const) {
      expect(renderer.render(node('cpp:print'), undefined, p)?.type).toBe('cpp_print')
    }
  })

  /**
   * 🔴 **回歸**：有 `renderStrategy` 的元件也要拿得到軸。
   *
   * 舊的 `render()` 在策略成功時就 `return` 了，形態選擇在那之後
   * ——於是這一族元件永遠拿不到軸，而它們靠已退場的 `expressionCounterpart` 活著。
   */
  it('🔴 回歸：有 renderStrategy 的元件，形態軸仍然說了算', () => {
    const r = new PatternRenderer()
    r.loadBlockSpecs([
      makeSpec('cpp_var_declare', 'cpp:var_declare', { strategy: 'test:strat' }),
      makeSpec('cpp_var_declare_expression', 'cpp:var_declare', {
        hasOutput: true, form: { axis: 'role', value: 'expression' },
      }),
    ])
    r.setRenderStrategyRegistry({
      get: () => (): unknown => ({
        type: 'cpp_var_declare', id: 'x', fields: {}, inputs: {}, extraState: {},
      }),
    } as never)
    const ctx = { renderExpression: () => null, renderStatementChain: () => null,
      renderBlock: () => null, nextBlockId: () => 'b1' } as never
    expect(r.render(node('cpp:var_declare'), ctx, 'expression')?.type,
      '🔴 策略那一條路又跳過形態選擇了').toBe('cpp_var_declare_expression')
    expect(r.render(node('cpp:var_declare'), ctx, 'statement')?.type,
      '🔴 中性位置不該被換掉——策略造的內容要保留').toBe('cpp_var_declare')
  })
})
