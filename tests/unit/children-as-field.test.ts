/**
 * `childrenAsField`：子節點列表 ↔ 一個文字欄位
 *
 * ## 這裡釘的是**這個方向最明顯的失敗模式**
 *
 * 用一個字串承載一串結構化的東西，分隔符就是風險。而拆錯的症狀特別壞：
 * **參數數量變多，而每一個都是垃圾**——不是「少一個」那種一眼看得出來的。
 *
 * 允許「明確不支援」，**不允許靜默拆錯**（spec FR-005、SC-003）。
 */
import { describe, it, expect } from 'vitest'
import { serializeChildren, parseToChildren, splitTopLevel } from '../../src/core/projection/children-as-field'
import { createNode } from '../../src/core/semantic-tree'

const spec = { field: 'PARAMS', childSlot: 'params', childConcept: 'param_decl', parts: ['type', 'name'] }
const p = (type: string, name: string) => createNode('param_decl', { type, name })

describe('splitTopLevel：深度感知的分割', () => {
  it('一般情形', () => {
    expect(splitTopLevel('int a, int b', ',')).toEqual(['int a', 'int b'])
  })

  it('★ 角括號裡的逗號不是分隔符', () => {
    // 天真的 split(',') 會拆成三段：'map<int' / 'int> m' / ' int k'
    expect(splitTopLevel('map<int,int> m, int k', ',')).toEqual(['map<int,int> m', 'int k'])
  })

  it('★ 巢狀角括號', () => {
    expect(splitTopLevel('pair<int, pair<int,int>> p, int k', ',')).toEqual(['pair<int, pair<int,int>> p', 'int k'])
  })

  it('★ 圓括號（函式指標）', () => {
    expect(splitTopLevel('void (*f)(int, int), int k', ',')).toEqual(['void (*f)(int, int)', 'int k'])
  })

  it('★ 方括號（陣列）', () => {
    expect(splitTopLevel('int a[10], int k', ',')).toEqual(['int a[10]', 'int k'])
  })

  it('空字串給空陣列，不是 [""]', () => {
    expect(splitTopLevel('', ',')).toEqual([])
    expect(splitTopLevel('   ', ',')).toEqual([])
  })

  it('括號不平衡時不得無限迴圈或漏字', () => {
    // 使用者打到一半就是這個樣子。不求拆對，只求**不吞字**。
    expect(splitTopLevel('map<int,int m, int k', ',').join('|')).toContain('int k')
  })
})

describe('serializeChildren：子節點 → 文字', () => {
  it('一般情形', () => {
    expect(serializeChildren([p('int', 'a'), p('int', 'b')], spec)).toBe('int a, int b')
  })

  it('★ 零個子節點回傳 null，不是空字串', () => {
    // `null` = 不寫欄位；`''` = 寫一個空欄位。兩者在來回比對上不同
    // （research R3）。
    expect(serializeChildren([], spec)).toBeNull()
  })

  it('型別含空白照原樣', () => {
    expect(serializeChildren([p('long long', 'n')], spec)).toBe('long long n')
  })

  it('型別含逗號照原樣', () => {
    expect(serializeChildren([p('map<int,int>', 'm')], spec)).toBe('map<int,int> m')
  })
})

describe('parseToChildren：文字 → 子節點', () => {
  it('一般情形', () => {
    const r = parseToChildren('int a, int b', spec)
    expect(r.map((n) => n.properties)).toEqual([{ type: 'int', name: 'a' }, { type: 'int', name: 'b' }])
    expect(r.every((n) => n.conceptId === 'param_decl')).toBe(true)
  })

  it('★ 最後一個空白分隔的詞是名字，其餘全是型別', () => {
    // `long long n` 不得變成 `{type: "long", name: "long"}`。
    expect(parseToChildren('long long n', spec)[0].properties).toEqual({ type: 'long long', name: 'n' })
    expect(parseToChildren('const std::string& s', spec)[0].properties).toEqual({ type: 'const std::string&', name: 's' })
  })

  it('★ 型別含逗號不得拆成兩個參數', () => {
    const r = parseToChildren('map<int,int> m, int k', spec)
    expect(r).toHaveLength(2)
    expect(r[0].properties).toEqual({ type: 'map<int,int>', name: 'm' })
  })

  it('★ 空字串給空陣列', () => {
    expect(parseToChildren('', spec)).toEqual([])
    expect(parseToChildren('  ', spec)).toEqual([])
  })

  it('★ 只有一個詞（只有型別沒有名字）：不得憑空補一個名字', () => {
    // `void f(int)` 這種。判不出來就**留原樣**，讓來回轉換抓到，不要猜。
    const r = parseToChildren('int', spec)
    expect(r).toHaveLength(1)
    expect(r[0].properties.name).toBe('')
    expect(r[0].properties.type).toBe('int')
  })

  it('多餘空白不影響', () => {
    expect(parseToChildren('  int   a ,  int b  ', spec).map((n) => n.properties)).toEqual([
      { type: 'int', name: 'a' },
      { type: 'int', name: 'b' },
    ])
  })
})

describe('★ 來回是不動點——這是唯一真正要緊的性質', () => {
  const 樣本 = [
    [p('int', 'a'), p('int', 'b')],
    [p('long long', 'n')],
    [p('map<int,int>', 'm'), p('int', 'k')],
    [p('const std::string&', 's')],
    [p('pair<int, pair<int,int>>', 'p')],
  ]
  for (const [i, kids] of 樣本.entries()) {
    it(`樣本 ${i + 1}：serialize → parse → 屬性完全相同`, () => {
      const text = serializeChildren(kids, spec)!
      expect(parseToChildren(text, spec).map((n) => n.properties)).toEqual(kids.map((n) => n.properties))
    })
  }

  it('零個也是不動點', () => {
    expect(parseToChildren(serializeChildren([], spec) ?? '', spec)).toEqual([])
  })
})
