/** 切片、三元、`__name__` 三件的自證測。 */
import { describe, it, expect } from 'vitest'
import { liftPython, componentIdsOf, generatePython as gen, runPython } from '../../../../tests/helpers/python-lift'

const ids = async (c: string): Promise<string[]> => componentIdsOf(await liftPython(c))
const rt = async (c: string): Promise<string> => gen(await liftPython(c)).trim()

describe('python:container_substr', () => {
  it('lift：四種寫法都認得，而取一格沒有被搶走', async () => {
    for (const c of ['a = xs[1:3]', 'a = xs[:2]', 'a = xs[-2:]', 'a = s[2:4]']) {
      expect(await ids(c + '\n'), c).toContain('python:container_substr')
    }
    const one = await ids('a = xs[0]\n')
    expect(one, '取一格要走同族那顆').toContain('python:container_at')
    expect(one).not.toContain('python:container_substr')
  })

  it('🔴 lift：帶步長的整顆降級——收一半會產出少了步長的切片', async () => {
    expect(await ids('a = xs[::2]\n')).not.toContain('python:container_substr')
  })

  it('🔴 來回：沒有的那一端不得被補上', async () => {
    expect(await rt('a = xs[:2]\n'), '補一個 0 就是改了使用者的碼').toBe('a = xs[:2]')
    expect(await rt('a = xs[-2:]\n')).toBe('a = xs[-2:]')
    expect(await rt('a = xs[1:3]\n')).toBe('a = xs[1:3]')
  })

  it('執行：串列與文字都切得動', async () => {
    expect(await runPython('xs = [1,2,3,4,5]\nprint(xs[1:3])\n')).toContain('[2, 3]')
    expect(await runPython('xs = [1,2,3,4,5]\nprint(xs[-2:])\n')).toContain('[4, 5]')
    expect(await runPython('print("abcdef"[2:4])\n')).toContain('cd')
  })

  it('🔴 執行：切片不會超界（與取一格【不同】）', async () => {
    const out = await runPython('xs = [1,2]\nprint(xs[1:99])\n')
    expect(out, '切片超界在 Python 不丟錯，回到尾巴為止').toContain('[2]')
  })
})

describe('python:ternary', () => {
  it('🔴 lift：索引 0 是「真的時候的值」不是條件', async () => {
    const t = await liftPython('a = "成年" if age >= 18 else "未成年"\n')
    expect(componentIdsOf(t)).toContain('python:ternary')
    const find = (n: any): any => n?.componentId === 'python:ternary' ? n
      : Object.values(n?.children ?? {}).flat().map(find).find(Boolean)
    const node = find(t)
    expect(node.children.condition[0].componentId, '條件被對映成那個字串了').toBe('python:compare')
  })

  it('來回：Python 的順序（值在前）', async () => {
    expect(await rt('a = "x" if c else "y"\n')).toBe('a = "x" if c else "y"')
  })

  it('執行：兩邊各選得到', async () => {
    expect(await runPython('a = 20\nprint("成年" if a >= 18 else "未成年")\n')).toContain('成年')
    expect(await runPython('a = 5\nprint("成年" if a >= 18 else "未成年")\n')).toContain('未成年')
  })

  it('🔴 執行：只算被選中的那一邊', async () => {
    // 兩邊都算的話，空串列時 `xs[0]` 會爆掉——而那正是這個寫法最常見的用途
    expect(await runPython('xs = []\nprint(xs[0] if xs else "空的")\n')).toContain('空的')
  })
})

describe('__name__', () => {
  it('🔴 主程式慣例跑得動——那是 AI 生的 Python 幾乎必有的一行', async () => {
    const out = await runPython('def main():\n    print("跑起來了")\n\nif __name__ == "__main__":\n    main()\n')
    expect(out).toContain('跑起來了')
  })
})
