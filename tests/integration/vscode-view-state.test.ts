/**
 * per-uri 視圖狀態的自證測。
 *
 * ## 🔴 最重要的一支是「身分搬遷」
 *
 * 一個還沒存檔的暫存分頁存成檔案時，身分從 `untitled:Untitled-1`
 * 變成 `file:///…` ——**同一份文件，兩個 key**。
 *
 * ⚠️ 而那**正是使用者的主場景**（2026-08-17 逐字：
 * 「甚至 AI 給的 Code 他們貼上來也是可以順利雙向轉換」）
 * ——貼進來的第一站就是一個沒有路徑的暫存分頁。
 *
 * > **一個場景如果只在「正常情況」被測，
 * > 它就會在「最常見的情況」壞掉。**
 */
import { describe, it, expect } from 'vitest'
import {
  ViewStateStore,
  EMPTY_VIEW_STATE,
  type KeyValueStore,
  type ViewState,
} from '../../src/vscode/sync/view-state'

/** 記憶體版的儲存體——⚠️ 語義要與宿主的 `workspaceState` 相同：設 `undefined` ＝ 刪除。 */
function fakeStore(): KeyValueStore {
  const m = new Map<string, ViewState>()
  return {
    get: (k) => m.get(k),
    set: (k, v) => { if (v === undefined) m.delete(k); else m.set(k, v) },
    keys: () => [...m.keys()],
  }
}

const sample: ViewState = { scrollX: 10, scrollY: 20, scale: 1.5, blockPositions: { b1: { x: 3, y: 4 } } }

describe('ViewStateStore —— 切分頁再切回來，畫布還在原位', () => {
  it('正向錨點：存了再取，得回同一份', () => {
    const s = new ViewStateStore(fakeStore())
    s.set('file:///a.cpp', sample)
    expect(s.get('file:///a.cpp')).toEqual(sample)
  })

  it('沒存過 → undefined（呼叫端用 EMPTY_VIEW_STATE 補）', () => {
    const s = new ViewStateStore(fakeStore())
    expect(s.get('file:///never.cpp')).toBeUndefined()
    expect(EMPTY_VIEW_STATE.scale).toBe(1)
  })

  it('不同 uri 互不干擾', () => {
    const s = new ViewStateStore(fakeStore())
    s.set('file:///a.cpp', sample)
    s.set('file:///b.cpp', { ...sample, scale: 2 })
    expect(s.get('file:///a.cpp')!.scale).toBe(1.5)
    expect(s.get('file:///b.cpp')!.scale).toBe(2)
  })

  it('🔴 身分搬遷：untitled 存檔之後，狀態跟著搬到新 key', () => {
    const s = new ViewStateStore(fakeStore())
    s.set('untitled:Untitled-1', sample)
    expect(s.migrate('untitled:Untitled-1', 'file:///saved.ino')).toBe(true)
    expect(s.get('file:///saved.ino')).toEqual(sample)
  })

  it('🔴 搬遷之後舊 key 要清掉——留著就是一個不會被發現的洩漏', () => {
    const s = new ViewStateStore(fakeStore())
    s.set('untitled:Untitled-1', sample)
    s.migrate('untitled:Untitled-1', 'file:///saved.ino')
    expect(s.get('untitled:Untitled-1')).toBeUndefined()
    expect(s.size).toBe(1)
  })

  it('沒有舊狀態時搬遷回傳 false——⚠️ 那不是錯誤，是「本來就沒有」', () => {
    const s = new ViewStateStore(fakeStore())
    expect(s.migrate('untitled:Untitled-9', 'file:///x.ino')).toBe(false)
    expect(s.size).toBe(0)
  })

  it('搬遷不會蓋掉不相干的 key', () => {
    const s = new ViewStateStore(fakeStore())
    s.set('untitled:Untitled-1', sample)
    s.set('file:///other.cpp', { ...sample, scale: 3 })
    s.migrate('untitled:Untitled-1', 'file:///saved.ino')
    expect(s.get('file:///other.cpp')!.scale).toBe(3)
    expect(s.size).toBe(2)
  })

  it('⚠️ 這個模組不得 import `vscode`', async () => {
    const fs = await import('node:fs')
    const src = fs.readFileSync('src/vscode/sync/view-state.ts', 'utf8')
    expect(src).not.toMatch(/from ['"]vscode['"]/)
  })
})
