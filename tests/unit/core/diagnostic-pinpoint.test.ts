/**
 * **指名**（spec 218 第一步）：判決指到的那一顆的程式碼與行號放進文案；拿不到就退回不指名的那一句。
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { resetMessages, setMessages } from '../../../src/i18n/messages'
import zhTW from '../../../src/i18n/zh-TW/blocks.json'
import { toDiagnostics } from '../../../src/core/verdict-diagnostics'
import { diagnosticText, diagnosticParams } from '../../../src/core/projection/diagnostic-projection'
import type { SemanticNode } from '../../../src/core/types'

const ref = { id: 'n2', componentId: 'x:ref', properties: { name: 'total' }, slots: {}, metadata: { sourceRange: { startLine: 7, startColumn: 2, endLine: 7, endColumn: 7 } } } as unknown as SemanticNode
const tree = { id: 'n1', componentId: 'x:program', properties: {}, slots: { body: [ref] } } as unknown as SemanticNode
const verdict = { verdict: 'reject', problems: [{ kind: 'ubUninit', category: 'error', at: 'n2', reason: 'uninitialized read', clause: 'C++17 [dcl.init]p12' }] }

describe('指名：程式碼與行號（spec 218）', () => {
  beforeEach(() => { resetMessages(); setMessages(zhTW as Record<string, string>) })
  const diag = (codeOf?: (n: SemanticNode) => string) =>
    toDiagnostics({ verdict: verdict as never, types: null, tree, readsInput: false, hasStdin: false, codeOf }).diagnostics[0]

  it('🔴 有程式碼與行號：兩側都說出名字，程式碼側帶行號', () => {
    const d = diag((n) => String(n.properties.name))
    expect(d.params).toMatchObject({ subject: 'total', line: '8' })
    expect(diagnosticText(d.rule, 'BLOCK', diagnosticParams(d.params))).toBe('「total」還沒有值就拿來用了')
    expect(diagnosticText(d.rule, 'CODE', diagnosticParams(d.params))).toBe('第 8 行：「total」還沒有值就拿來用了')
  })
  it('沒有 codeOf：退回不指名的那一句', () => {
    const d = diag()
    expect(d.params.subject).toBeUndefined()
    expect(diagnosticText(d.rule, 'BLOCK', diagnosticParams(d.params))).not.toContain('{')
  })
  it('有名字而沒有行號（從積木抽回的節點）：積木側照樣指名，程式碼側退回——不露出 {line}', () => {
    const noLine = { ...ref, metadata: {} } as SemanticNode
    const t2 = { ...tree, slots: { body: [noLine] } } as SemanticNode
    const d = toDiagnostics({ verdict: verdict as never, types: null, tree: t2, readsInput: false, hasStdin: false, codeOf: () => 'total' }).diagnostics[0]
    expect(diagnosticText(d.rule, 'BLOCK', diagnosticParams(d.params))).toBe('「total」還沒有值就拿來用了')
    expect(diagnosticText(d.rule, 'CODE', diagnosticParams(d.params))).not.toContain('{line}')
  })
})
