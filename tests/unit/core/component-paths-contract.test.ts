/**
 * `component.json` 的 `paths` 契約（spec 181：每個視圖一對 render／lift）。
 *
 * 判準：`specs/181-view-paths/data-model.md` 的五條驗證規則。
 * 🔴 「雙向還是單向」是**視圖**的性質（視圖表），不是看元件有沒有寫 `lift`——
 *    否則遺漏的 lift 會被當成單向而安靜放行（research R4）。
 */
import { describe, it, expect } from 'vitest'
import { checkPaths, cellPath, VIEWS, type ViewTable } from '../../../src/core/component/views'

const ok = {
  views: {
    blocks: { render: './forms/blocks.json', lift: './forms/blocks.json' },
    code: { render: './generate.ts', lift: './lift-pattern.json', liftStrategy: './lift-strategy.ts' },
  },
  formalize: './formalize.ts',
  execute: './execute.ts',
}
const check = (paths: unknown, views: ViewTable = VIEWS): void => checkPaths(paths, '膠囊 cpp/x', views)

describe('paths 契約：每個視圖一對 render／lift', () => {
  it('★ 新形狀接受', () => {
    expect(() => check(ok)).not.toThrow()
  })

  it('★ 顯式的空（null ＋ 同層的 _why）接受', () => {
    expect(() => check({ ...ok, views: { ...ok.views, code: { render: './generate.ts', lift: null, _lift_why: '只由別顆產生' } } })).not.toThrow()
    expect(() => check({ ...ok, execute: null, _execute_why: '沒有執行期行為' })).not.toThrow()
  })

  it('🔴 平鋪的舊鍵擋下（P8 不留轉接層）', () => {
    expect(() => check({ ...ok, generate: './generate.ts' })).toThrow(/cpp\/x.*generate/)
    expect(() => check({ render: './forms/blocks.json', extract: './forms/blocks.json', generate: './generate.ts', lift: './lift.ts', execute: './execute.ts' }))
      .toThrow(/views/)
  })

  it('🔴 雙向視圖少了 lift 鍵擋下——遺漏的空不得被當成單向', () => {
    expect(() => check({ ...ok, views: { ...ok.views, blocks: { render: './forms/blocks.json' } } })).toThrow(/cpp\/x.*blocks.*lift/)
  })

  it('🔴 null 而沒有同層的 _why 擋下', () => {
    expect(() => check({ ...ok, views: { ...ok.views, code: { render: null, lift: './lift.ts' } } })).toThrow(/cpp\/x.*code.*_render_why/)
    expect(() => check({ ...ok, execute: null })).toThrow(/_execute_why/)
  })

  it('🔴 未知的視圖名擋下——加一個視圖是在視圖表上加一筆', () => {
    expect(() => check({ ...ok, views: { ...ok.views, flow: { render: './flow.ts', lift: './flow.ts' } } })).toThrow(/cpp\/x.*flow/)
  })

  it('🔴 少了 execute 鍵擋下（階段 6 退場之前都要寫）', () => {
    const { execute: _e, ...rest } = ok
    expect(() => check(rest)).toThrow(/execute/)
  })

  // ── US2：加一個視圖不必發明新動詞 ──────────────────────────
  const withDiag: ViewTable = { ...VIEWS, diagnostics: 'render-only' }

  it('★ 單向視圖只寫 render：接受（只動視圖表與宣告）', () => {
    expect(() => check({ ...ok, views: { ...ok.views, diagnostics: { render: './diag.ts' } } }, withDiag)).not.toThrow()
  })

  it('🔴 單向視圖出現 lift 擋下', () => {
    expect(() => check({ ...ok, views: { ...ok.views, diagnostics: { render: './diag.ts', lift: './diag.ts' } } }, withDiag))
      .toThrow(/cpp\/x.*diagnostics.*lift/)
  })

  it('🔴 只有 lift 沒有 render 擋下', () => {
    expect(() => check({ ...ok, views: { ...ok.views, diagnostics: { lift: './diag.ts' } } }, withDiag)).toThrow(/cpp\/x.*diagnostics.*render/)
  })

  it('★ 格子查詢：同一套名字讀出每一路；null 與不存在都是「沒有」', () => {
    expect(cellPath(ok, 'blocks.render')).toBe('./forms/blocks.json')
    expect(cellPath(ok, 'code.liftStrategy')).toBe('./lift-strategy.ts')
    expect(cellPath(ok, 'formalize')).toBe('./formalize.ts')
    expect(cellPath(ok, 'execute')).toBe('./execute.ts')
    expect(cellPath({ ...ok, execute: null, _execute_why: 'x' }, 'execute')).toBeNull()
    expect(cellPath({ views: { blocks: { render: './a', lift: './a' } }, execute: null }, 'code.render')).toBeNull()
  })
})
