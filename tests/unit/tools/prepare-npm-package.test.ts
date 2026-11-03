/**
 * 發 npm 之前把套件改成可發布的樣子（tools/prepare-npm-package.mjs）——版本號的格式、`private` 拿掉、只發 dist。
 */
import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
// @ts-expect-error 工具是 .mjs，沒有型別宣告
import { npmVersionFor, publishable } from '../../../tools/prepare-npm-package.mjs'

describe('prepare-npm-package', () => {
  it('★ 版本號照 cella 的做法：0.1.<YYYYMMDDHHMM>（UTC）', () => {
    expect(npmVersionFor(new Date('2026-11-03T07:05:00Z'))).toBe('0.1.202611030705')
  })
  it('🔴 拿掉 private、只發 dist；其餘欄位原樣', () => {
    const out = publishable({ name: 'semorphe', private: true, version: '0.1.0', type: 'module' }, '0.1.202611030705')
    expect(out).toEqual({ name: 'semorphe', version: '0.1.202611030705', type: 'module', files: ['dist'] })
  })
  it('★ repo 裡的 package.json 仍是 private（發布只從 CI 那一步發生）', () => {
    const pkg = JSON.parse(execFileSync('git', ['show', 'HEAD:package.json'], { encoding: 'utf8' }))
    expect(pkg.private).toBe(true)
  })
})
