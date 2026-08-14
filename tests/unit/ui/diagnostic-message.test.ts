/**
 * **同一則診斷，兩個面板必須說不一樣的話。**（階段 6.6 驗收④）
 *
 * ## 為什麼這支測的是 `formatMessage` 而不是面板類別
 *
 * 兩個面板的 `diagnosticMessage()` 各是一行：查 `DIAG_<RULE>_BLOCK`
 * 或 `DIAG_<RULE>_CODE`。**差別完全住在文案裡**，而不在程式碼裡。
 *
 * ⚠️ 所以「兩邊不同」這件事**是文案的性質**——去 new 一個 BlocklyPanel
 * （要 DOM、要 Blockly workspace）只會多測到一堆與這個問題無關的東西，
 * 而真正該紅的情況（兩份文案寫成同一句）它照樣測得到。
 *
 * **端對端那一層由 `e2e/diagnostics.spec.ts` 蓋**——那裡問的是真的面板物件。
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { formatMessage, resetMessages, setMessages } from '../../../src/i18n/messages'
import { cppDiagnosticRules } from '../../../src/languages/cpp/diagnostics'
import zhTW from '../../../src/i18n/zh-TW/blocks.json'
import en from '../../../src/i18n/en/blocks.json'

const IDENTITIES = [...new Set(cppDiagnosticRules.map((r) => r.rule))].sort()

/** 一則診斷可能帶的參數。兩個面板各自決定用不用。 */
const SAMPLE_PARAMS = { inputName: 'CONDITION', position: 2 }

describe('診斷訊息：兩個面板各自組裝', () => {
  beforeEach(() => {
    resetMessages()
  })

  it('★ 入口條件：規則身分不是空的（錨在合成量）', () => {
    expect(IDENTITIES.length, '一個規則身分都沒有 → 這支測不到任何東西').toBeGreaterThan(0)
  })

  for (const locale of ['zh-TW', 'en'] as const) {
    it(`★ ${locale}：每一個規則身分，積木側與程式碼側都必須【不同】（全數，不抽驗）`, () => {
      setMessages((locale === 'zh-TW' ? zhTW : en) as Record<string, string>)
      const same: string[] = []
      for (const rule of IDENTITIES) {
        const block = formatMessage(`DIAG_${rule}_BLOCK`, SAMPLE_PARAMS)
        const code = formatMessage(`DIAG_${rule}_CODE`, SAMPLE_PARAMS)
        expect(block, `${rule} 的積木側文案不存在`).toBeTruthy()
        expect(code, `${rule} 的程式碼側文案不存在`).toBeTruthy()
        if (block === code) same.push(`${rule}：兩邊都是「${block}」`)
      }
      expect(
        same,
        '🔴 有規則的兩個面板說了同一句話——那等於這條規則沒有兌現驗收④：\n' +
          '積木側該給初學者看得懂的說法，程式碼側該像編譯器。',
      ).toEqual([])
    })
  }

  it('★ 參數真的被代進去了——不是把 `{position}` 原樣印出來', () => {
    setMessages(zhTW as Record<string, string>)
    const msg = formatMessage('DIAG_MISSING_VAR_NAME_BLOCK', { position: 3 })
    expect(msg).toContain('3')
    expect(msg, '佔位符沒被代換 → 使用者會看到 `{position}` 這串字').not.toContain('{position}')
  })

  it('★ 沒給到的參數**原樣留著**，不變成 undefined', () => {
    setMessages({ ZZ: '缺的是 {inputName}' })
    // ⚠️ 一個少了參數的文案該長得像「壞掉」，不該長得像「這裡本來就沒有」。
    // `undefined` 讀起來像後者。
    expect(formatMessage('ZZ', {})).toBe('缺的是 {inputName}')
  })

  it('🔴 查不到文案時回 `null`——**不得回傳規則代號**', () => {
    setMessages(zhTW as Record<string, string>)
    // 2026-08-14 之前 monaco-panel 的 `?? key` 就是把代號當訊息，
    // 而畫面上「確實有一則訊息」，所以沒有人回報。
    expect(formatMessage('DIAG_NO_SUCH_RULE_CODE')).toBeNull()
  })

  it('★ 通用退路存在，而它與任何規則的文案都不同', () => {
    setMessages(zhTW as Record<string, string>)
    const fallback = formatMessage('DIAG_UNKNOWN')
    expect(fallback).toBeTruthy()
    for (const rule of IDENTITIES) {
      expect(formatMessage(`DIAG_${rule}_BLOCK`, SAMPLE_PARAMS)).not.toBe(fallback)
      expect(formatMessage(`DIAG_${rule}_CODE`, SAMPLE_PARAMS)).not.toBe(fallback)
    }
  })
})
