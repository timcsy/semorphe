/**
 * **編譯錯誤的細分**（cella 0.1.202611050546；spec 218）：文案照 `what` 挑最細的那一句，缺參數就退到粗一層——不露出 `{…}`。
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { resetMessages, setMessages } from '../../../src/i18n/messages'
import zhTW from '../../../src/i18n/zh-TW/blocks.json'
import { diagnosticText, diagnosticParams } from '../../../src/core/projection/diagnostic-projection'

const say = (rule: string, side: 'BLOCK' | 'CODE', params: Record<string, string>) => diagnosticText(rule, side, diagnosticParams(params))

describe('編譯錯誤照 what 細分', () => {
  beforeEach(() => { resetMessages(); setMessages(zhTW as Record<string, string>) })
  it('🔴 對常數指定：指名那一句', () => {
    expect(say('CELLA_NOT_ASSIGNABLE', 'BLOCK', { what: 'const', subject: 'MAX', kind: 'notAssignable' })).toBe('「MAX」是常數，不能改')
  })
  it('🔴 引數太少：程式碼側說出要幾個、給了幾個', () => {
    expect(say('CELLA_CALL_ARGUMENTS', 'CODE', { what: 'tooFew', name: 'f', expected: '2', got: '1', subject: 'f(1)', line: '5', kind: 'callArguments' }))
      .toBe('第 5 行：呼叫「f」的引數太少——要 2 個，給了 1 個')
  })
  it('缺了 expected／got：退到粗一層，不露出 {expected}', () => {
    const t = say('CELLA_CALL_ARGUMENTS', 'CODE', { what: 'tooFew', name: 'f', subject: 'f(1)', line: '5', kind: 'callArguments', clause: 'C++17 [expr.call]' })
    expect(t).not.toMatch(/\{\w+\}/)
  })
  it('🔴 運算元型別：說出兩邊的型別與運算子', () => {
    expect(say('CELLA_OPERAND_TYPES', 'BLOCK', { operator: '+', left: 'int', right: 'std::string', what: 'other', kind: 'operandTypes' })).toBe('int 和 std::string 不能用 + 運算')
  })
  it('🔴 重複宣告的變數：說出名字', () => {
    expect(say('CELLA_REDECLARED', 'BLOCK', { what: 'variable', name: 'x', kind: 'redeclared' })).toBe('「x」已經宣告過了')
  })
  it('沒有細分文案的 what（label）：退到這一類的那一句', () => {
    expect(say('CELLA_REDECLARED', 'BLOCK', { what: 'label', name: 'done', kind: 'redeclared' })).toBe('「done」重複定義了')
  })
})
