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
}
const check = (paths: unknown, views: ViewTable = VIEWS): void => checkPaths(paths, '膠囊 cpp/x', views)

describe('paths 契約：每個視圖一對 render／lift', () => {
  it('★ 新形狀接受', () => {
    expect(() => check(ok)).not.toThrow()
  })

  it('★ 顯式的空（null ＋ 同層的 _why）接受', () => {
    expect(() => check({ ...ok, views: { ...ok.views, code: { render: './generate.ts', lift: null, _lift_why: '只由別顆產生' } } })).not.toThrow()
  })

  it('🔴 平鋪的舊鍵擋下（P8 不留轉接層）', () => {
    expect(() => check({ ...ok, generate: './generate.ts' })).toThrow(/cpp\/x.*generate/)
    expect(() => check({ render: './forms/blocks.json', extract: './forms/blocks.json', generate: './generate.ts', lift: './lift.ts' }))
      .toThrow(/views/)
  })

  it('🔴 雙向視圖少了 lift 鍵擋下——遺漏的空不得被當成單向', () => {
    expect(() => check({ ...ok, views: { ...ok.views, blocks: { render: './forms/blocks.json' } } })).toThrow(/cpp\/x.*blocks.*lift/)
  })

  it('🔴 null 而沒有同層的 _why 擋下', () => {
    expect(() => check({ ...ok, views: { ...ok.views, code: { render: null, lift: './lift.ts' } } })).toThrow(/cpp\/x.*code.*_render_why/)
  })

  it('🔴 未知的視圖名擋下——加一個視圖是在視圖表上加一筆', () => {
    expect(() => check({ ...ok, views: { ...ok.views, flow: { render: './flow.ts', lift: './flow.ts' } } })).toThrow(/cpp\/x.*flow/)
  })

  // spec 208（重構 6c-4）：execute 那一格隨 JS 直譯器退場——執行只走 Cella。殘留的宣告會讓人以為還要寫，所以出現就擋
  it('🔴 execute 那一格已退場：出現就擋（含顯式的空與它的 _why）', () => {
    expect(() => check({ ...ok, execute: './execute.ts' })).toThrow(/cpp\/x.*execute/)
    expect(() => check({ ...ok, execute: null, _execute_why: '沒有執行期行為' })).toThrow(/execute/)
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
    expect(cellPath({ views: { blocks: { render: './a', lift: './a' } } }, 'code.render')).toBeNull()
  })
})

// 🔴 第 402 刀（盲測 fuzz-cpp-student-mixed）：積木抽得回來、而程式碼產不出來的元件——
//    從程式碼 lift 進來的節點帶著 rawCode，產碼退回原文，所以「程式碼 → 程式碼」永遠是對的；
//    而從積木抽回來的節點沒有原文 ⟹ 學生一動積木，`toupper(c)` 變成 `⟨cpp:char_to_upper⟩`。
//    當時三顆（char_to_upper／char_to_lower／char_is_digit）都寫著「顯式的空，不是遺漏」——而它是遺漏。
describe('積木抽得回來的元件，程式碼那一路不得是空的', () => {
  it('★ 掃全部膠囊：blocks.lift 有 ⟹ code.render 有', async () => {
    const { readFileSync } = await import('node:fs')
    const { globSync } = await import('node:fs')
    const files = globSync('src/components/*/*/component.json')
    expect(files.length).toBeGreaterThan(100)
    const bad = files.filter((f) => {
      const p = JSON.parse(readFileSync(f, 'utf8')).paths ?? {}
      return cellPath(p, 'blocks.lift') && !cellPath(p, 'code.render')
    })
    expect(bad).toEqual([])
  })
})
