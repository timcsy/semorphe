/**
 * 🔴 **每一條行動版的 CSS 規則都要問過「這個宿主有沒有行動版」。**
 *
 * ## 病歷（同一個形狀犯了兩次）
 *
 * ```
 * 2026-08-18  面板下方冒出手機的分頁列（積木／程式碼／主控台）
 *             ——`features.mobileLayout` 宣告了 false，而【沒有人讀它】
 * 2026-09-02  槽的下拉從畫面底部彈出來（使用者：「選單可以不要開在下面嗎？」）
 *             ——分頁列那一段修好了，而 QuickPick 那一段漏了
 * ```
 *
 * 共同的根：**寬度斷點自己決定了使用者拿的是手機**。而一塊 IDE 面板天生就窄
 * （實測 640px），於是桌面宿主上跑出整套行動版的行為。
 *
 * > **一個「這個宿主沒有行動版」的宣告，要是有一條 CSS 規則沒有問它，
 * > 那條規則就會在一塊窄面板上自己決定使用者拿的是手機。**
 *
 * ## ⚠️ 自我否證聲明
 *
 * > **如果掃到的行動版規則是 0 條，代表這支沒有讀到那個區塊
 * > ——這份報表不算數，不是「全部合規」。**
 *
 * ## 這支不檢測什麼
 *
 * - **不檢測那些規則對不對**（間距、字級）——那是設計判斷。
 * - **不檢測 JS 那一半**（`host-no-mobile-layout` 這個 class 有沒有被加上）
 *   ——那由 `app-shell` 自己的行為與預檢盯著。
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/** ⚠️ **先把註解拿掉**——註解裡有大括號與選擇器範例，會把掃描器帶歪。 */
const CSS = readFileSync(resolve(__dirname, '../..', 'src/ui/style.css'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')

/** 取出所有 `@media (max-width: …)` 區塊的內容。 */
export function mobileBlocks(css: string): string[] {
  const out: string[] = []
  const re = /@media[^{]*max-width[^{]*\{/g
  let m: RegExpExecArray | null
  while ((m = re.exec(css)) !== null) {
    let depth = 1
    let i = m.index + m[0].length
    const start = i
    while (i < css.length && depth > 0) {
      if (css[i] === '{') depth++
      else if (css[i] === '}') depth--
      i++
    }
    out.push(css.slice(start, i - 1))
  }
  return out
}

/** 區塊裡**最外層**的每一條選擇器。 */
export function selectorsIn(block: string): string[] {
  const heads: string[] = []
  let buf = ''
  let depth = 0
  for (const ch of block) {
    if (ch === '{') {
      if (depth === 0) heads.push(buf)
      buf = ''
      depth += 1
    } else if (ch === '}') {
      depth = Math.max(0, depth - 1)
      buf = ''
    } else if (depth === 0) {
      buf += ch
    }
  }
  return heads
    .flatMap((h) => h.split(','))
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith('@'))
}

describe('第一百條護欄：行動版的規則要問過宣告', () => {
  const blocks = mobileBlocks(CSS)
  const selectors = blocks.flatMap(selectorsIn)

  it('★ 入口條件：真的讀到那些區塊了', () => {
    // 錨在**掃到幾條**（合成量），見檔頭的自我否證聲明。
    expect(blocks.length, '一個 max-width 區塊都沒讀到 → 下面的 0 是假的').toBeGreaterThan(0)
    expect(selectors.length, '一條選擇器都沒讀到 → 同上').toBeGreaterThan(10)
  })

  it('🔴 硬性零：每一條都要掛 `body:not(.host-no-mobile-layout)`', () => {
    const bad = selectors.filter((s) => !s.includes('body:not(.host-no-mobile-layout)'))
    expect(bad, `這些行動版規則在【宣告沒有行動版】的宿主上也會生效：\n  ${bad.join('\n  ')}`)
      .toEqual([])
  })

  it('★ 注入：一條沒掛的規則要被抓到', () => {
    const fake = '@media (max-width: 768px) {\n  .quick-pick { width: 100%; }\n}'
    expect(selectorsIn(mobileBlocks(fake)[0])).toEqual(['.quick-pick'])
    expect(selectorsIn(mobileBlocks(fake)[0])
      .filter((s) => !s.includes('body:not(.host-no-mobile-layout)')), '注入的那一條沒被抓到')
      .toEqual(['.quick-pick'])
  })
})
