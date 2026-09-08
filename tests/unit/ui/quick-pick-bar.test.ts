/**
 * @vitest-environment happy-dom
 *
 * **拆輪子的橫條是一面鏡子，不是一句評語**——而那是可以量的。
 */
import { describe, it, expect } from 'vitest'
import { showQuickPick } from '../../../src/ui/toolbar/quick-pick'

function open(bar?: { left: number; right: number; title: string }): HTMLElement {
  document.body.innerHTML = ''
  showQuickPick({
    title: 'ㄒ',
    items: [{ value: 'a', label: '第 1 課', ...(bar ? { previewBar: bar } : {}) }],
  }, () => {})
  return document.querySelector('.quick-pick-item') as HTMLElement
}

describe('橫條', () => {
  it('畫得出來，寬度跟著比例走', () => {
    const row = open({ left: 0.25, right: 0.75, title: '積木 2 · 程式碼 6' })
    const bar = row.querySelector('.quick-pick-bar') as HTMLElement
    expect(bar).not.toBeNull()
    expect((bar.querySelector('.quick-pick-bar-left') as HTMLElement).style.width).toBe('25%')
    expect((bar.querySelector('.quick-pick-bar-right') as HTMLElement).style.width).toBe('75%')
  })

  /**
   * 🔴 **鏡子不說話**：橫條裡不得有任何文字節點。
   * 這一條是這整條線的判準——「說到人就砍掉」在畫面上的形狀。
   */
  it('🔴 硬性零：橫條裡沒有任何一個字', () => {
    const row = open({ left: 0.5, right: 0.5, title: '積木 3 · 程式碼 3' })
    const bar = row.querySelector('.quick-pick-bar') as HTMLElement
    expect(bar.textContent).toBe('')
    // 而清單那一列的文字只有標籤——橫條沒有把字混進去
    expect(row.textContent).toBe('第 1 課')
  })

  /**
   * 🔴 `title` 只准是數字——沒有「還」「才」「只」「已經」「你」。
   * ⚠️ 這裡驗的是 app 餵進來的那句話的**形狀**（合成輸入），
   *    而 app 那一側的格式是 `積木 N · 程式碼 M`。
   */
  it('🔴 title 不得有評價性的字', () => {
    const title = '積木 2 · 程式碼 6'
    for (const w of ['還', '才', '只', '已經', '你', '太', '不夠']) {
      expect(title.includes(w), `🔴 「${title}」帶了「${w}」——那是評語，不是鏡子`).toBe(false)
    }
    const row = open({ left: 0.25, right: 0.75, title })
    expect((row.querySelector('.quick-pick-bar') as HTMLElement).getAttribute('aria-label')).toBe(title)
  })

  it('沒有 previewBar 的項目不畫', () => {
    expect(open().querySelector('.quick-pick-bar')).toBeNull()
  })

  it('★ 兩邊都是 0 → 兩塊都是 0 寬（不是 50/50）', () => {
    const row = open({ left: 0, right: 0, title: '積木 0 · 程式碼 0' })
    expect((row.querySelector('.quick-pick-bar-left') as HTMLElement).style.width).toBe('0%')
    expect((row.querySelector('.quick-pick-bar-right') as HTMLElement).style.width).toBe('0%')
  })
})
