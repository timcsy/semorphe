/**
 * 🔴 一份偏好寫回去的範圍，不得大於它描述的東西。
 *
 * 使用者 2026-09-01：「**C++ 一開始要預設 C++ 吧**」——一份 C++ 的暫存檔，
 * 而狀態列寫著「Arduino（不指定板子）」。
 */
import { describe, it, expect } from 'vitest'
import { DocPrefStore, DOC_PREF_KEYS, type DocPrefs, type PrefStore } from '../../../src/vscode/sync/doc-prefs'

function memory(): PrefStore & { dump(): Record<string, DocPrefs | undefined> } {
  const m = new Map<string, DocPrefs | undefined>()
  return {
    get: (k) => m.get(k),
    set: (k, v) => { if (v === undefined) m.delete(k); else m.set(k, v) },
    keys: () => [...m.keys()],
    dump: () => Object.fromEntries(m),
  }
}

describe('這份文件上，使用者選了什麼', () => {
  it('沒選過就是空的——⚠️ 不是「預設 Arduino」', () => {
    expect(new DocPrefStore(memory()).get('file:///a.cpp')).toEqual({})
  })

  it('🔴 一份文件的選擇，不得影響另一份', () => {
    const s = new DocPrefStore(memory())
    s.merge('file:///sketch.ino', { targetId: 'arduino' })
    expect(s.get('file:///sketch.ino').targetId).toBe('arduino')
    expect(s.get('file:///main.cpp').targetId).toBeUndefined()
  })

  it('🔴 一次只選一顆——其餘幾格不得被清掉', () => {
    const s = new DocPrefStore(memory())
    s.merge('u', { targetId: 'arduino', skeletonId: 'arduino' })
    s.merge('u', { scaffoldMode: 'ghost' })
    expect(s.get('u')).toEqual({ targetId: 'arduino', skeletonId: 'arduino', scaffoldMode: 'ghost' })
  })

  it('存檔那一刻身分會變，偏好要跟著搬——而舊的要清掉', () => {
    const raw = memory()
    const s = new DocPrefStore(raw)
    s.merge('untitled:Untitled-1', { skeletonId: 'arduino' })
    expect(s.migrate('untitled:Untitled-1', 'file:///a.ino')).toBe(true)
    expect(s.get('file:///a.ino').skeletonId).toBe('arduino')
    expect(s.get('untitled:Untitled-1')).toEqual({})
    // 🔴 舊 key 留著就是一個【不會被發現的洩漏】——沒有人會去掃 workspaceState。
    expect(Object.keys(raw.dump())).toEqual(['semorphe.docPrefs:file:///a.ino'])
    expect(s.size).toBe(1)
  })

  it('沒有舊狀態不是錯誤', () => {
    expect(new DocPrefStore(memory()).migrate('a', 'b')).toBe(false)
  })
})

describe('🔴 哪些鍵屬於「這份文件」', () => {
  it('目標／骨架／鷹架／風格／課程 —— 描述這份文件', () => {
    expect(Object.keys(DOC_PREF_KEYS).sort())
      .toEqual(['scaffold', 'skeleton', 'style', 'target', 'topic'])
  })

  it('⚠️ 積木外觀與語系【不在】裡面——它們描述的是這個人，不是這份文件', () => {
    expect(DOC_PREF_KEYS.blockStyle).toBeUndefined()
    expect(DOC_PREF_KEYS.locale).toBeUndefined()
  })
})
