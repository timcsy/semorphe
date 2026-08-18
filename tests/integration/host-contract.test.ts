/**
 * 宿主宣告的契約 —— **「缺席」與「遺漏」必須分得出來**。
 *
 * ## 它守的是什麼
 *
 * 專案明令（`component-generate` skill 步驟五）：
 *
 * > **宣告性概念不要寫 noop。顯式的空與遺漏的空要分得出來，
 * > 而一個 noop 函式兩者長得一樣。**
 *
 * 而 `CodeView` 把那條落實成兩件事：
 *
 * ```
 * 缺席   由【型別】表達——可選欄位不實作
 * 理由   由 absentReasons 表達
 * ```
 *
 * 🔴 **而這支測試把兩者釘在一起**：
 * **多一個是說謊**（宣稱缺席而其實有），**少一個是遺漏**（缺席而沒說）。
 *
 * ## ⚠️ 而它只驗得了「不牽扯編輯器套件」的那些實作
 *
 * 網頁版的實作會拉進編輯器套件，而那個套件在測試環境解析不了。
 * 🔴 **所以網頁版那一份改用【原始碼層級】的檢查**——⚠️ 而那比較弱，
 * **弱在哪裡寫在下面那支測試的註解裡**，不假裝它一樣強。
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import { VscodeCodeView } from '../../src/vscode/webview/vscode-code-view'
import { vscodeProfile } from '../../src/vscode/vscode-profile'
import { OPTIONAL_CODE_VIEW_CAPABILITIES } from '../../src/core/host/code-view'
import type { CodeView } from '../../src/core/host/code-view'

/** 這個實作**實際上**有哪些可選能力。 */
function presentOptionals(view: CodeView): string[] {
  return OPTIONAL_CODE_VIEW_CAPABILITIES
    .filter((c) => typeof (view as unknown as Record<string, unknown>)[c] === 'function')
}

describe('CodeView：缺席的與宣告的必須一模一樣', () => {
  const view = new VscodeCodeView(document.createElement('div'))

  it('正向錨點：可選能力的清單不是空的（否則下面全部空過）', () => {
    expect(OPTIONAL_CODE_VIEW_CAPABILITIES.length).toBeGreaterThan(0)
  })

  it('🔴 沒實作的可選方法 = `absentReasons` 的鍵', () => {
    const absentByType = OPTIONAL_CODE_VIEW_CAPABILITIES.filter((c) => !presentOptionals(view).includes(c))
    const declared = Object.keys(view.absentReasons).sort()
    expect(declared, '🔴 多一個是說謊、少一個是遺漏').toEqual([...absentByType].sort())
  })

  it('🔴 每一條缺席的理由都不是空字串——「因為沒有」不算理由', () => {
    for (const [k, v] of Object.entries(view.absentReasons)) {
      expect(typeof v === 'string' && v.trim().length >= 6, `🔴 ${k} 的理由太短`).toBe(true)
    }
  })

  it('⚠️ 網頁版那一份用原始碼檢查——比較弱，而弱在它讀的是文字不是行為', () => {
    // 🔴 為什麼不 import：那個檔會拉進編輯器套件，測試環境解析不了。
    //    ⚠️ 所以這一條**只證明「那四個方法名出現在檔案裡」**，
    //       不證明它們真的能用——**而那個差距是真的，不要當它不存在**。
    const src = fs.readFileSync('src/ui/panels/monaco-panel.ts', 'utf8')
    for (const c of OPTIONAL_CODE_VIEW_CAPABILITIES) {
      expect(src, `🔴 網頁版應該有 ${c}`).toMatch(new RegExp(`\\n  ${c}\\(`))
    }
    expect(src, '🔴 網頁版什麼都不缺，所以 absentReasons 必須是空的')
      .toMatch(/readonly absentReasons = \{\}/)
  })
})

describe('HostProfile：關掉的每一項都要有理由', () => {
  it('🔴 `features` 裡為 false 的 = `featureReasons` 的鍵', () => {
    const off = Object.entries(vscodeProfile.features)
      .filter(([, on]) => !on).map(([k]) => k).sort()
    expect(Object.keys(vscodeProfile.featureReasons).sort()).toEqual(off)
  })

  it('🔴 而理由不得敷衍', () => {
    for (const [k, v] of Object.entries(vscodeProfile.featureReasons)) {
      expect((v ?? '').trim().length >= 8, `🔴 ${k} 的理由太短`).toBe(true)
    }
  })
})

describe('🔴 宿主的 id 不得拿來做行為分支', () => {
  it('`src/` 裡沒有任何 `.id === \'…\'` 的分支', () => {
    // ⚠️ 一旦有人寫 `if (profile.id === 'vscode')`，這份宣告就**退化成一個標籤**
    //    ——而能力清單不再是真相，因為真相散回去了。
    const offenders: string[] = []
    const walk = (dir: string): void => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = `${dir}/${e.name}`
        if (e.isDirectory()) { walk(p); continue }
        if (!p.endsWith('.ts') || p.endsWith('.test.ts')) continue
        const text = fs.readFileSync(p, 'utf8')
        // 只抓「拿 id 比對字串」——⚠️ 而註解裡提到它不算（那是說明，不是分支）
        for (const line of text.split('\n')) {
          if (/^\s*(\*|\/\/)/.test(line)) continue
          if (/\bprofile\.id\s*===|\bhost\.id\s*===/.test(line)) offenders.push(`${p}: ${line.trim()}`)
        }
      }
    }
    walk('src')
    expect(offenders, '🔴 能力清單退化成標籤了').toEqual([])
  })
})
