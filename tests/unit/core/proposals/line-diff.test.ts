import { describe, it, expect } from 'vitest'
import { lineDiff } from '../../../../src/core/proposals/line-diff'

const show = (b: string, a: string): string => lineDiff(b, a).map((l) => `${l.kind}${l.text}`).join('\n')

describe('lineDiff', () => {
  it('相同 → 全是未變的行', () => {
    expect(show('a\nb', 'a\nb')).toBe(' a\n b')
  })
  it('插入一行', () => {
    expect(show('a\nc', 'a\nb\nc')).toBe(' a\n+b\n c')
  })
  it('刪除一行', () => {
    expect(show('a\nb\nc', 'a\nc')).toBe(' a\n-b\n c')
  })
  it('改一行 → 先 - 後 +', () => {
    expect(show('a\nb\nc', 'a\nx\nc')).toBe(' a\n-b\n+x\n c')
  })
  it('結尾的換行不產生空行；空字串', () => {
    expect(show('a\n', 'a\nb\n')).toBe(' a\n+b')
    expect(lineDiff('', '')).toEqual([])
  })
  it('縮排變了算改過（比的是原文，不是去掉空白）', () => {
    expect(show('x\n  y', 'x\n    y')).toBe(' x\n-  y\n+    y')
  })
})
