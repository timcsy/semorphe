/**
 * 記憶體實作——**埠的契約長什麼樣，這裡逐條寫下來**。
 *
 * ⚠️ 它同時是**第二個實作的規格**：瀏覽器那一個（`src/ui/browser-store.ts`）
 * 要符合同一份契約，而它在 Node 裡跑不了（沒有 `localStorage`）
 * ——所以那一個由 e2e 驗，而**契約寫在這裡**。
 *
 * > **兩個實作如果沒有一份共用的契約，
 * > 「換一個實作」就從一個決定變成一次賭博。**
 */
import { describe, it, expect } from 'vitest'
import { MemoryKeyValueStore } from '../../../src/core/host/key-value-store'

describe('記憶體的存放實作', () => {
  it('存了就讀得回來', () => {
    const s = new MemoryKeyValueStore()
    expect(s.write('k', 'v')).toBe(true)
    expect(s.read('k')).toBe('v')
  })

  /**
   * 🔴 **「沒有那把鑰匙」與「存了一個空字串」是兩件事。**
   *
   * ⚠️ 少了這一條，一個把兩者都回 `''` 的實作照樣過
   * ——而呼叫端會把「從來沒存過」讀成「存了一份空的」。
   */
  it('沒存過回 null，而存了空字串回空字串', () => {
    const s = new MemoryKeyValueStore()
    expect(s.read('nope')).toBeNull()
    s.write('empty', '')
    expect(s.read('empty')).toBe('')
  })

  it('覆寫', () => {
    const s = new MemoryKeyValueStore()
    s.write('k', 'a')
    s.write('k', 'b')
    expect(s.read('k')).toBe('b')
  })

  it('刪掉之後回 null', () => {
    const s = new MemoryKeyValueStore()
    s.write('k', 'v')
    s.remove('k')
    expect(s.read('k')).toBeNull()
  })

  /** ⚠️ 刪一把不存在的鑰匙**不是錯誤**——清理路徑上最常見的呼叫。 */
  it('刪不存在的鑰匙不丟錯', () => {
    expect(() => new MemoryKeyValueStore().remove('nope')).not.toThrow()
  })

  /**
   * 🔴 **不跨實例**——那正是「記憶體」的意思，而測試靠它拿到互不干擾的起點。
   *
   * ⚠️ 一個用模組層級 Map 的實作會讓這一條紅，而它在單測裡看起來
   * 「更有效率」——直到兩個測試檔開始互相污染。
   */
  it('換一個實例就是空的', () => {
    new MemoryKeyValueStore().write('k', 'v')
    expect(new MemoryKeyValueStore().read('k')).toBeNull()
  })

  /** 兩把鑰匙互不干擾——存檔與進度共用同一個 store，這一條是它的前提。 */
  it('不同鑰匙互不干擾', () => {
    const s = new MemoryKeyValueStore()
    s.write('a', '1')
    s.write('b', '2')
    s.remove('a')
    expect(s.read('a')).toBeNull()
    expect(s.read('b')).toBe('2')
  })
})
