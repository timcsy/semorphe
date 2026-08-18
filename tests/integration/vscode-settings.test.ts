/**
 * 設定解析的自證測。
 *
 * ## 它為什麼要獨立成純函式
 *
 * 優先序（語言覆寫 > 專案 > 使用者 > 內建）是這一輪**唯一有分支的邏輯**，
 * 而 `vscode` 在測試環境不存在。
 *
 * > **一個只有開 IDE 才驗得了的分支，實務上等於沒有人驗。**
 *
 * ## ⚠️ 而語言覆寫那一條有一個「安靜地不生效」的前提
 *
 * 宿主端要宣告 `scope: "language-overridable"` ——**不宣告的話覆寫不會發生，
 * 而且不會報錯**。那一條在這裡測不到（它是宣告不是邏輯），
 * 🔴 **由 T052 與交棒的實測顧**。
 */
import { describe, it, expect } from 'vitest'
import { resolveConfig, DEFAULT_CONFIG } from '../../src/vscode/sync/settings'

describe('resolveConfig —— 語言覆寫 > 專案 > 使用者 > 內建', () => {
  it('正向錨點：什麼都沒設 → 拿到完整的預設（零個 undefined）', () => {
    const c = resolveConfig({})
    expect(c).toEqual(DEFAULT_CONFIG)
    for (const [k, v] of Object.entries(c)) {
      expect(v, `🔴 ${k} 不得是 undefined——下游會用自己的預設補，那就是第二份真相`)
        .not.toBeUndefined()
    }
  })

  it('只有使用者層級 → 使用者勝出', () => {
    expect(resolveConfig({ target: { user: 'u' } }).targetId).toBe('u')
  })

  it('專案層級蓋過使用者層級', () => {
    expect(resolveConfig({ target: { user: 'u', workspace: 'w' } }).targetId).toBe('w')
  })

  it('🔴 語言覆寫蓋過專案層級——`.ino` 是 Arduino、`.cpp` 是 C++', () => {
    const c = resolveConfig({ target: { user: 'u', workspace: 'w', language: 'arduino-uno' } })
    expect(c.targetId).toBe('arduino-uno')
  })

  it('各格互不干擾——只設 target 不會動到 locale', () => {
    const c = resolveConfig({ target: { workspace: 'w' } })
    expect(c.targetId).toBe('w')
    expect(c.locale).toBe(DEFAULT_CONFIG.locale)
  })

  it('🔴 空字串是「設過了」，不是「沒設」', () => {
    // ⚠️ 用真值判斷的話空字串會被當成沒設，而那是靜默降級。
    expect(resolveConfig({ topic: { workspace: '' } }).topicId).toBe('')
  })

  it('純函式：同輸入同輸出，且不改動輸入', () => {
    const raw = { target: { workspace: 'w' } }
    const a = resolveConfig(raw)
    const b = resolveConfig(raw)
    expect(b).toEqual(a)
    expect(raw).toEqual({ target: { workspace: 'w' } })
  })

  it('⚠️ 這個模組不得 import `vscode`——否則它在測試環境就死了', async () => {
    const fs = await import('node:fs')
    const src = fs.readFileSync('src/vscode/sync/settings.ts', 'utf8')
    expect(src).not.toMatch(/from ['"]vscode['"]/)
  })
})
