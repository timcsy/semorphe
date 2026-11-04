/**
 * @vitest-environment happy-dom
 *
 * **積木側的判決文案不顯示 reason 原文**（spec 216；使用者定：學生看到的文字不得直接是 reason——它是開發者的紀錄）。
 * 走通用那一句的種類，積木上說的是**種類的名稱**。
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { resetMessages, setMessages } from '../../../src/i18n/messages'
import zhTW from '../../../src/i18n/zh-TW/blocks.json'
import { BlocklyPanel } from '../../../src/ui/panels/blockly-panel'

const say = (d: unknown): string => (BlocklyPanel.prototype.diagnosticMessage as (x: unknown) => string).call({}, d)

describe('積木側：通用那一句用種類的名稱', () => {
  beforeEach(() => { resetMessages(); setMessages(zhTW as Record<string, string>) })
  it('🔴 ubNull：說「對空指標取值」，不出現 Cella 的英文 reason', () => {
    const m = say({ nodeId: 'n', severity: 'error', source: 'cella', rule: 'CELLA_OTHER', params: { kind: 'ubNull', reason: 'null pointer dereference', clause: 'C++17 [expr.unary.op]p1' } })
    expect(m).toBe('判斷功能說這裡有狀況：對空指標取值')
    expect(m).not.toContain('null pointer')
  })
  it('沒有名稱的種類：說一句誠實的話，不吐代號也不吐原文', () => {
    const m = say({ nodeId: 'n', severity: 'error', source: 'cella', rule: 'CELLA_OTHER', params: { kind: 'ubSomethingNew', reason: 'raw text' } })
    expect(m).toBe('判斷功能說這裡有狀況：一個還沒有中文說明的狀況')
  })
})
