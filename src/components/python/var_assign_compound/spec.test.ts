/**
 * `python:var_assign_compound` 的自證測。
 *
 * 🔴 重點在**運算規則**：Python 的 `/=` 是真除法、`%=` 跟著除數的正負號、
 * 多一個 `//=`——共用的那支複合指派執行器（C++ 在用的）三條都不對。
 */
import { describe, it, expect } from 'vitest'
import { liftPython, componentIdsOf, generatePython, runPython } from '../../../../tests/helpers/python-lift'
import type { SemanticNode } from '../../../core/types'

const ids = async (c: string): Promise<string[]> => componentIdsOf(await liftPython(c))
const rt = async (c: string): Promise<string> => generatePython(await liftPython(c)).trim()
const lift = liftPython

/** 找出那顆節點——⚠️ 找不到時回 null，讓斷言指名，不要在這裡 throw。 */
function findCompound(n: SemanticNode): SemanticNode | null {
  if (n.componentId === 'python:var_assign_compound') return n
  for (const kids of Object.values(n.children ?? {})) {
    for (const k of kids as SemanticNode[]) {
      const hit = findCompound(k)
      if (hit) return hit
    }
  }
  return null
}

describe('python:var_assign_compound', () => {
  it('lift：認得出來，而且不降級', async () => {
    const got = await ids('total += i\n')
    expect(got, '正向錨點——沒有它，下面的負向會空過').toContain('python:var_assign_compound')
    expect(got).not.toContain('unresolved')
  })

  /**
   * 🔴 **邊界推了一格**（2026-08-21）：第一版用 `constraints` 把左邊限定成
   * 單純的變數名，理由是「認一半不如誠實降級」——而**類別做出來之後
   * `self.n += k` 是最常見的一行**，那個限制就從誠實變成擋路。
   *
   * > **一個「還沒支援」的限制，會在別的東西做出來的那天變成擋路的。**
   */
  it('🔴 左邊可以是取成員（`self.n += k`）', async () => {
    const got = await ids('self.n += 1\n')
    expect(got, '正向錨點').toContain('python:var_assign_compound')
    expect(got).not.toContain('unresolved')
  })

  it('🔴 左邊也可以是索引（`nums[0] += 5`）', async () => {
    expect(await ids('nums[0] += 1\n')).toContain('python:var_assign_compound')
    expect(await rt('nums[0] += 1\n')).toBe('nums[0] += 1')
    expect(await runPython('nums = [1, 2]\nnums[0] += 5\nprint(nums)\n')).toContain('[6, 2]')
  })

  it('🔴 而索引取不到時要出聲，不得靜默', async () => {
    const out = await runPython('nums = [1]\nnums[9] += 1\nprint(nums)\n')
    expect(out).toMatch(/例外|錯誤|Error/)
  })

  it('執行：物件的欄位也累加得起來', async () => {
    const out = await runPython('class C:\n    def __init__(self):\n        self.n = 0\n\n    def add(self, k):\n        self.n += k\n\nc = C()\nc.add(3)\nc.add(4)\nprint(c.n)\n')
    expect(out).toContain('7')
  })

  it('來回：六個運算子都一字不差', async () => {
    for (const op of ['+=', '-=', '*=', '/=', '//=', '%=']) {
      expect(await rt(`total ${op} 3\n`)).toBe(`total ${op} 3`)
    }
  })

  it('執行：累加迴圈算得出正確的和', async () => {
    expect(await runPython('total = 0\nfor i in range(1, 5):\n    total += i\nprint(total)\n')).toContain('10')
  })

  it('🔴 執行：Python 的除法規則（三條 C++ 都不同）', async () => {
    expect(await runPython('x = 7\nx /= 2\nprint(x)\n'), '`/=` 是真除法').toContain('3.5')
    expect(await runPython('x = 7\nx //= 2\nprint(x)\n'), '`//=` 捨去小數').toContain('3')
    expect(await runPython('x = -7\nx %= 3\nprint(x)\n'), '餘數跟著除數的正負號').toContain('2')
  })

  /**
   * 🎯 **左值換成接點之後才成立的那些**（2026-08-25，路線圖「左值是接點，不是字串」）。
   *
   * 在此之前左邊是一個字串，而執行器用 regex 手拆它：
   *
   * ```
   * /^([A-Za-z_]\w*)\[(.+)\]$/     ← 認 nums[0]
   * name.lastIndexOf('.')          ← 認 self.n
   * ```
   *
   * 🔴 **下面每一條在那一版都是壞的，而且是靜默的**：
   *
   * ```
   * nums[i+1] += 1    idx[2] = "i+1"      不是數字、也不是變數名 → NaN → 丟越界
   * grid[1][0] += 1   idx[2] = "1][0"     同上
   * a.b.c += 1        recvName = "a.b"    scope 裡沒有這個名字 → 丟型別錯
   * ```
   *
   * ⚠️ 而它的註解自己承認過：「索引是一個字面或一個變數名
   * ——**複雜的運算式還沒收**」。**寫下來的邊界不會自己變成一條測試。**
   */
  it('🎯 左值是任意運算式——索引可以是算式', async () => {
    expect(await rt('nums[i + 1] += 1\n')).toBe('nums[i + 1] += 1')
    expect(await runPython('nums = [1,2,3]\ni = 0\nnums[i+1] += 10\nprint(nums)\n'))
      .toContain('[1, 12, 3]')
  })

  it('🎯 左值可以是兩層下標（`grid[1][0]`）', async () => {
    expect(await rt('grid[1][0] += 1\n')).toBe('grid[1][0] += 1')
    expect(await runPython('grid = [[1,2],[3,4]]\ngrid[1][0] += 5\nprint(grid)\n'))
      .toContain('[[1, 2], [8, 4]]')
  })

  it('🎯 左值可以串好幾個「的」（`a.b.c`）', async () => {
    expect(await rt('a.b.c += 1\n')).toBe('a.b.c += 1')
  })

  it('🎯 字典的一格（`d["k"]`）', async () => {
    expect(await rt('d["k"] += 1\n')).toBe('d["k"] += 1')
    expect(await runPython('d = {"k": 1}\nd["k"] += 4\nprint(d["k"])\n')).toContain('5')
  })

  it('🎯 負索引照 Python 的規則從尾巴算', async () => {
    expect(await runPython('nums = [1,2,3]\nnums[-1] += 7\nprint(nums)\n')).toContain('[1, 2, 10]')
  })

  it('🔴 左邊不再是一個字串屬性——那一格已經沒有了', async () => {
    const tree = await lift('nums[0] += 1\n')
    const node = findCompound(tree)
    expect(node, '正向錨點——沒有它，下面的負向會空過').toBeTruthy()
    expect(node!.properties.name, '🔴 字串屬性長回來了').toBeUndefined()
    expect((node!.children.target ?? []).length, '🔴 左邊不是接點').toBe(1)
  })
})
