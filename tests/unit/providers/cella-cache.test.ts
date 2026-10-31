/** 判決模組的快取鍵（spec 182 T014）——套件版本或判決模組原始碼變了，鍵就要變。 */
import { describe, it, expect } from 'vitest'
import { checkerKey, checkerVersions, loadCompiled } from '../../../src/providers/cella/cache'

describe('Cella 判決模組的快取', () => {
  it('🔴 入口條件：鍵裡有六個套件的版本（glob 落空 → 升版後拿到舊模組，而且不出聲）', () => {
    const v = checkerVersions()
    expect(v.map((x) => x.split('@')[0]).sort()).toEqual(['arduino', 'c', 'cella-lang', 'cfamily', 'cpp', 'machine'])
    expect(v.every((x) => /@\d/.test(x))).toBe(true)
  })

  it('★ 鍵是穩定的 SHA-256（同一份套件、同一份原始碼 → 同一個鍵）', async () => {
    const a = await checkerKey()
    expect(a).toMatch(/^[0-9a-f]{64}$/)
    expect(await checkerKey()).toBe(a)
  })

  it('🔴 沒有 IndexedDB（隱私模式、Node）→ 當成沒有快取，不丟例外', async () => {
    expect(await loadCompiled('whatever')).toBeNull()
  })
})
