/**
 * 🔴 「說是四格其實根本不是」——版面清單要問宿主，不能問宣告。
 *
 * 2026-09-01 使用者在 VSCode 回報。那裡程式碼在 IDE 的編輯器裡、
 * 主控台是 IDE 的終端機（`vscode-profile.ts` 明說），面板裡只有流程與積木。
 */
import { describe, it, expect } from 'vitest'
import { hostLayoutOptions, reduceAreas, normalizeShape, layoutPreset } from '../../../src/core/host/layout-presets'
import type { UnderstandingLayer } from '../../../src/core/view-host'

const ALL = (): boolean => true
/** VSCode：只有關係（流程）與空間（積木）住在面板裡。 */
const VSCODE = (l: UnderstandingLayer): boolean => l === 'relation' || l === 'space'

describe('網頁版：四層都在', () => {
  it('四張版面全部留著，而且名字用宣告的', () => {
    const opts = hostLayoutOptions(ALL, 'space')
    expect(opts.map((o) => o.id)).toEqual(['focus', 'compare', 'three-column', 'grid'])
    expect(opts.every((o) => o.complete)).toBe(true)
  })

  it('十字仍然是四格', () => {
    const grid = hostLayoutOptions(ALL, 'space').find((o) => o.id === 'grid')!
    expect(grid.areas).toEqual([['element', 'relation'], ['state', 'space']])
  })
})

describe('🔴 VSCode：只有流程與積木', () => {
  const opts = hostLayoutOptions(VSCODE, 'space')

  it('🔴 十字在這裡是【兩格上下】，不是四格', () => {
    const grid = opts.find((o) => o.id === 'grid')
    expect(grid?.areas).toEqual([['relation'], ['space']])
    expect(grid?.complete).toBe(false)
  })

  it('🔴 三欄在這裡是【兩格並排】', () => {
    expect(opts.find((o) => o.id === 'three-column')?.areas)
      .toEqual([['relation', 'space'], ['relation', 'space']])
  })

  it('🔴 專注與對照在這裡都只剩積木一格——只留一張', () => {
    // 專注 → [['space']]；對照 → [['space'],['space']]（積木跨兩列）。
    // 🔴 2026-09-01 實測抓到的：**跨格不是兩格**，兩者畫面相同，
    //    而第一版用未正規化的簽章比對，於是選單裡出現兩個都寫著「積木」的選項。
    expect(opts.filter((o) => o.shape.flat().join() === 'space')).toHaveLength(1)
    expect(opts.map((o) => o.id)).not.toContain('compare')
  })

  it('🔴 三欄在這裡是【一列兩格】，不是兩列——名字才不會退回宣告的「三欄（程式碼…）」', () => {
    const three = opts.find((o) => o.id === 'three-column')!
    expect(three.areas).toHaveLength(2)          // 縮減後仍是跨兩列
    expect(three.shape).toEqual([['relation', 'space']])   // 而形狀是一列兩格
  })

  it('🔴 每個選項的形狀都不重複——兩個做同一件事的選項是雜訊', () => {
    const sigs = opts.map((o) => o.shape.map((r) => r.join(' ')).join('|'))
    expect(new Set(sigs).size).toBe(sigs.length)
  })

  it('🔴 一個選項都不會空掉——每張都至少有一格', () => {
    for (const o of opts) {
      expect(o.areas.length, `${o.id} 沒有列`).toBeGreaterThan(0)
      expect(o.areas[0].length, `${o.id} 沒有欄`).toBeGreaterThan(0)
    }
  })

  it('🔴 剩下的格子裡不得出現這個宿主沒有的層', () => {
    for (const o of opts) {
      for (const l of o.areas.flat()) expect(VSCODE(l), `${o.id} 留下了 ${l}`).toBe(true)
    }
  })
})

describe('reduceAreas', () => {
  it('整欄都沒有的欄要整條拿掉——不是留一條 0px', () => {
    // 🔴 留 0px 的後果見 `grid-divider-boundary.test.ts`：它會多出一條假的縫。
    const three = layoutPreset('three-column')!
    expect(reduceAreas(three, VSCODE, 'space')[0]).toHaveLength(2)
  })

  it('專注的 `*` 要先解析成焦點層再判斷', () => {
    const focus = layoutPreset('focus')!
    expect(reduceAreas(focus, VSCODE, 'relation')).toEqual([['relation']])
  })
})

describe('normalizeShape：跨格收成一格', () => {
  it('相鄰而相同的列合併', () => {
    expect(normalizeShape([['space'], ['space']])).toEqual([['space']])
  })
  it('相鄰而相同的欄合併', () => {
    expect(normalizeShape([['space', 'space']])).toEqual([['space']])
  })
  it('兩列各跨兩列 → 一列兩格', () => {
    expect(normalizeShape([['relation', 'space'], ['relation', 'space']]))
      .toEqual([['relation', 'space']])
  })
  it('⚠️ 真的是兩格的不得被合併', () => {
    expect(normalizeShape([['relation'], ['space']])).toEqual([['relation'], ['space']])
  })
  it('⚠️ 十字四格原封不動', () => {
    const grid = [['element', 'relation'], ['state', 'space']] as const
    expect(normalizeShape(grid)).toEqual(grid)
  })
  it('⚠️ 對照：積木跨兩列而左邊是兩格——不得整片收掉', () => {
    const compare = [['element', 'space'], ['state', 'space']] as const
    expect(normalizeShape(compare)).toEqual(compare)
  })
})
