/**
 * 補了 formalize 之後的四份基線（tools/bump-formalize-baselines.ts）——預測的數字要與當天手動調的一致。
 * 錨點是 2026-11-02 第 226 刀（spec 201）手動調過的那一次：6 顆、79→73、1892→1898、1478→1484、六顆 files 各 +1。
 */
import { describe, it, expect } from 'vitest'
import { plan } from '../../../tools/bump-formalize-baselines'

const SIX = ['cpp:delay_microseconds', 'cpp:micros', 'cpp:pin_attach', 'cpp:pwm_attach', 'cpp:pwm_write', 'cpp:touch_read']
const before = (): Record<string, Record<string, any>> => ({  // eslint-disable-line @typescript-eslint/no-explicit-any
  'formalize-coverage': { _meta: { guard: 'formalize-coverage' }, 'C++ 元件數': 252, '還沒對應': 79, note: '舊的' },
  'judge-coverage': { _meta: { note: '舊的' }, scanned: { components: 351, cells: 1892 }, naked: 0, unmeasuredPaths: 1, byPath: {} },
  layering: { _meta: { note: '舊的' }, '掃描檔數': 1478, '跨層相依': 5, '組裝點豁免': 1 },
  locality: { _meta: {}, note: '舊的', limits: Object.fromEntries([...SIX.map((id) => [id, { files: id === 'cpp:pin_attach' ? 4 : 3, dirs: 1 }]), ['cpp:if', { files: 5, dirs: 1 }]]) },
})

describe('補了 formalize 之後的四份基線', () => {
  it('★ 第 226 刀那一次：預測與當天手動調的一致', () => {
    const b = before()
    const next = plan(SIX, '第 226 刀，spec 201', (n) => b[n])
    expect(next['formalize-coverage']['還沒對應']).toBe(73)
    expect(next['judge-coverage'].scanned.cells).toBe(1898)
    expect(next.layering['掃描檔數']).toBe(1484)
    expect(next.locality.limits['cpp:pin_attach'].files).toBe(5)
    expect(next.locality.limits['cpp:micros'].files).toBe(4)
    expect(next.locality.limits['cpp:if'].files, '沒有新增的不得被動到').toBe(5)
  })

  it('note 加在最前面、說得出是哪一刀，舊的 note 留著', () => {
    const b = before()
    const next = plan(SIX, '第 226 刀，spec 201', (n) => b[n])
    expect(next['formalize-coverage'].note).toMatch(/^📉 .*第 226 刀，spec 201.*79 → 73[\s\S]*舊的$/)
    expect(next.layering._meta.note).toMatch(/1478 → 1484[\s\S]*舊的$/)
  })

  it('上限表裡沒有的元件 → 丟錯（新元件要先有自己的上限，不是這支工具替它編一個）', () => {
    const b = before()
    expect(() => plan(['cpp:no_such'], 'x', (n) => b[n])).toThrow(/上限表裡沒有/)
  })
})
