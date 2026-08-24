/**
 * 同步三態的行為。
 *
 * ⚠️ 這一支釘的是**分岔那一態**——它是使用者追問「會不會想暫停同步？」
 * 之後才發現的洞：暫停 → 兩邊都改 → 解除，「誰最後編輯」是**任意的**。
 */
import { describe, it, expect } from 'vitest'
import { SyncCoordinator } from '../../../src/core/sync-coordinator'

const editable = (): string[] => ['blockly-panel', 'monaco-panel']

describe('同步的三態', () => {
  it('平常是 live，而來源是【導出的】——誰最後編輯', () => {
    const c = new SyncCoordinator(editable)
    c.noteEdit('monaco-panel')
    expect(c.snapshot()).toMatchObject({ phase: 'live', source: 'monaco-panel' })
    c.noteEdit('blockly-panel')
    expect(c.snapshot().source, '來源要跟著最後編輯的那一個走').toBe('blockly-panel')
  })

  it('暫停中【沒有來源】——而那不是一種來源', () => {
    const c = new SyncCoordinator(editable)
    c.noteEdit('monaco-panel')
    c.pause()
    expect(c.snapshot()).toMatchObject({ phase: 'paused', source: null })
  })

  it('🔴 暫停期間兩邊都改過 → 解除之後是【分岔】，而不是安靜地挑一個', () => {
    const c = new SyncCoordinator(editable)
    c.pause()
    c.noteEdit('monaco-panel')
    c.noteEdit('blockly-panel')
    c.resume()
    const s = c.snapshot()
    expect(s.phase, '安靜地挑一個等於替使用者做了一個他沒做的決定').toBe('diverged')
    expect(s.source).toBeNull()
    expect(s.candidates.sort()).toEqual(['blockly-panel', 'monaco-panel'])
  })

  it('暫停期間只改一邊 → 解除之後直接回 live，不必問', () => {
    const c = new SyncCoordinator(editable)
    c.pause()
    c.noteEdit('monaco-panel')
    c.resume()
    expect(c.snapshot()).toMatchObject({ phase: 'live', source: 'monaco-panel' })
  })

  it('使用者選定來源之後，分岔結束', () => {
    const c = new SyncCoordinator(editable)
    c.pause()
    c.noteEdit('monaco-panel')
    c.noteEdit('blockly-panel')
    c.resume()
    expect(c.snapshot().phase).toBe('diverged')
    c.resolve('monaco-panel')
    expect(c.snapshot()).toMatchObject({ phase: 'live', source: 'monaco-panel' })
  })

  it('★ 候選清單是【注入的】——核心不認識任何一個具體的面板', () => {
    const c = new SyncCoordinator(() => ['a', 'b', 'c'])
    expect(c.snapshot().candidates).toEqual(['a', 'b', 'c'])
  })

  it('★ 再暫停一次時，上一輪的帳要清掉（否則分岔會黏著）', () => {
    const c = new SyncCoordinator(editable)
    c.pause(); c.noteEdit('a'); c.noteEdit('b'); c.resume()
    expect(c.snapshot().phase).toBe('diverged')
    c.pause()
    expect(c.snapshot().phase, '新的一輪暫停不該帶著舊的分岔').toBe('paused')
    c.noteEdit('a'); c.resume()
    expect(c.snapshot().phase).toBe('live')
  })
})
