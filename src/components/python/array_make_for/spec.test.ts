/** `python:array_make_for` 的自證測。 */
import { describe, it, expect } from 'vitest'
import { liftPython, componentIdsOf, generatePython as gen, runPython } from '../../../../tests/helpers/python-lift'

const ids = async (c: string): Promise<string[]> => componentIdsOf(await liftPython(c))
const rt = async (c: string): Promise<string> => gen(await liftPython(c)).trim()

describe('python:array_make_for', () => {
  it('lift：有無篩選都收得了', async () => {
    expect(await ids('a = [x * x for x in xs]\n'), '正向錨點').toContain('python:array_make_for')
    expect(await ids('a = [x for x in xs if x > 0]\n')).toContain('python:array_make_for')
    expect(await ids('a = [x for x in xs if x > 0]\n')).not.toContain('unresolved')
  })

  /**
   * ⚠️ **這條原本釘的是「巢狀整顆走誠實降級」，而那個邊界在 2026-08-22 移動了**
   * ——巢狀今天收得下（見下面的「巢狀」那一組）。
   *
   * 邊界移動時要**改成釘新的邊界，不是刪掉它**。第二次移動（第 411 刀）：
   * 解構的目標（`for k, v in d.items()`）今天收得下，名字放在 `targets`；
   * 今天走誠實降級的是**巢狀的解構**（`for i, (a, b) in …`）與**只有一個名字的解包**（`for x, in …`）。
   */
  it('🔴 下標目標整顆走誠實降級——收一半會弄丟目標（巢狀與單名解包從第 422 刀起走 pattern，見檔尾）', async () => {
    expect(await ids('a = [k for k, v in d.items()]\n'), '正向錨點：一般的解構收得下').toContain('python:array_make_for')
    for (const c of ['a = [1 for a[0], b in ps]\n']) {
      expect(await ids(c), c).not.toContain('python:array_make_for')
      expect(await ids(c), `${c} 而它必須看得見`).toContain('unresolved')
    }
  })

  it('🟢 多個名字（第 411 刀，盲測 8 支裡 3 支）：來回一字不差，名字都在 targets', async () => {
    for (const c of ['t = [(a, b) for a, b in zip(xs, ys) if b - a == 2]', 's = [w for w, c in r if c == 1]', 'z = "".join(ch * n for ch, n in runs)', 'u = {k for k, v in d.items()}']) {
      expect(await rt(c + '\n'), c).toBe(c)
    }
    const t = await liftPython('a = [k for k, v in d.items()]\n')
    const find = (n: any): any => n?.componentId === 'python:array_make_for' ? n
      : Object.values(n?.slots ?? {}).flat().map(find).find(Boolean)
    expect(find(t)?.slots.targets?.map((p: any) => p.properties.name)).toEqual(['k', 'v'])
  })

  it('🟢 執行：多個名字照 Python 的規則解開', async () => {
    expect(await runPython('ps = [(1, 3), (5, 7), (11, 12)]\nprint([b - a for a, b in ps])\nprint("".join(c * n for c, n in [("a", 2), ("b", 1)]))\n'))
      .toBe('completed|[2, 2, 1]\naab\n')
  })

  it('來回：一字不差', async () => {
    for (const c of ['a = [x * x for x in xs]', 'a = [x for x in xs if x > 0]']) {
      expect(await rt(c + '\n'), c).toBe(c)
    }
  })

  it('執行：算得出來，篩選也有作用', async () => {
    expect(await runPython('sq = [x * x for x in range(4)]\nprint(sq)\n')).toContain('[0, 1, 4, 9]')
    expect(await runPython('ev = [x for x in range(6) if x % 2 == 0]\nprint(ev)\n')).toContain('[0, 2, 4]')
  })

  it('🔴 執行：那個名字只在運算式裡活著，不得污染外面', async () => {
    const out = await runPython('x = 99\na = [x for x in range(3)]\nprint(x)\n')
    expect(out, `外面的 x 被生成式改掉了：${JSON.stringify(out)}`).toContain('99')
  })
})

/**
 * 🔴 **巢狀推導式**（2026-08-22）。攤平二維表是 AI 生的 Python 裡的慣用寫法，
 * 而它之前整顆降級——**那是對的選擇**（收一半會產出一個少了一層迴圈的
 * 合法運算式，而它算出來的東西完全不同）。
 *
 * 🟢 今天收得下，而且**層數不受限**：外面每一層是一顆同族的
 * 「一段走訪來源」積木，而它自己也有一個「再外面一層」的插槽。
 */
describe('巢狀', () => {
  it('🔴 兩層：攤平', async () => {
    const code = 'g = [[1, 2], [3, 4]]\nflat = [x for row in g for x in row]\nprint(flat)\n'
    expect(componentIdsOf(await liftPython(code))).toContain('python:loop_iter')
    expect(await runPython(code)).toContain('[1, 2, 3, 4]')
  })

  it('🔴 三層也成立——「再外面一層」是一個插槽不是一個上限', async () => {
    expect(await runPython('a = [[[1], [2]], [[3]]]\nprint([z for p in a for q in p for z in q])\n'))
      .toContain('[1, 2, 3]')
  })

  it('🔴 巢狀＋條件：條件在最裡面判', async () => {
    expect(await runPython('g = [[1, 2], [3, 4]]\nprint([x for row in g for x in row if x > 2])\n'))
      .toContain('[3, 4]')
  })

  it('🔴 round-trip：外層要先寫，而順序不得反過來', async () => {
    const code = 'flat = [x for row in g for x in row]\n'
    expect(gen(await liftPython(code)).trimEnd()).toBe(code.trimEnd())
  })

  it('★ 對照組：單層一個字都沒變', async () => {
    const code = 'ys = [x * 2 for x in xs if x > 0]\n'
    expect(gen(await liftPython(code)).trimEnd()).toBe(code.trimEnd())
    expect(componentIdsOf(await liftPython(code)), '單層不該長出一段外層').not.toContain('python:loop_iter')
  })
})

/**
 * 🔴 **產生器運算式**（2026-08-22）——`all(x > 0 for x in xs)`。
 *
 * 它與串列推導式是同一個形狀，只差一對中括號，而**那個差別要留住**：
 * 加上去就是改了使用者的碼。
 */
describe('產生器運算式', () => {
  it('🔴 執行：與加了中括號的算出同一個答案', async () => {
    const out = await runPython('xs = [2, 4, 6]\nprint(all(x % 2 == 0 for x in xs))\nprint(any(x > 5 for x in xs))\nprint(sum(x * 2 for x in xs))\n')
    expect(out).toContain('True\nTrue\n24')
  })

  it('🔴 來回：中括號【不得】被加上去，而原本有的也不得被拿掉', async () => {
    expect(gen(await liftPython('print(all(x > 0 for x in xs))\n')).trimEnd())
      .toBe('print(all(x > 0 for x in xs))')
    expect(gen(await liftPython('a = [x for x in xs]\n')).trimEnd()).toBe('a = [x for x in xs]')
  })

  it('🔴 一般的呼叫不得被這條路搶走（對照組）', async () => {
    expect(gen(await liftPython('print(a, b)\nf(1)\n')).trimEnd()).toBe('print(a, b)\nf(1)')
  })
})

describe('🔴 產生器運算式的括號（第 419 刀，盲測抓到）', () => {
  // 以前一律不帶自己的括號：只有「呼叫唯一的引數」那個位置合法，其他位置產回去都是不合法的 Python
  const roundTrip = async (code: string) => {
    const t = await liftPython(code)
    expect(componentIdsOf(t), '正向錨點：收成推導式這顆').toContain('python:array_make_for')
    return gen(t)
  }
  for (const c of [
    'print(sum(x for x in r))',
    'print(", ".join(str(x) for x in r))',
    'print(*(x for x in r))',
    'f(a, (x for x in r))',
    'g = (x for x in r)',
    'm = max((x for x in r), default=0)',
    't = sorted((x for x in r), reverse=True)',
    'print(any(x for x in r), all((y for y in r)))',
  ]) {
    it(`來回一字不差：${c}`, async () => {
      expect(await roundTrip(`r = [1]\n${c}`)).toBe(`r = [1]\n${c.replace('all((y for y in r))', 'all(y for y in r)')}`)
    })
  }
  it('執行：不是唯一引數的那幾個位置，產回去的程式照樣跑得出原本的結果', async () => {
    const code = 'r = [3, 1, 2]\nprint(*(x * 2 for x in r))\nprint(max((x for x in r if x > 5), default=0), sorted((x for x in r), reverse=True))\ng = (x + 1 for x in r)\nprint(list(g))\n'
    const back = gen(await liftPython(code))
    expect(await runPython(back)).toBe('completed|6 2 4\n0 [3, 2, 1]\n[4, 2, 3]\n')
  })
})

describe('🟢 推導式的目標是一個樣式（第 422 刀）', () => {
  const find = (n: any, id: string): any => n?.componentId === id ? n
    : Object.values(n?.slots ?? {}).flat().map((k) => find(k, id)).find(Boolean)
  const cases = [
    'r = [n for n, *_ in g]',
    'r = [a + b for (a, b) in ps]',
    'r = [x for i, (x, y) in enumerate(ps) if i > 0]',
    'r = sum(a * b for (a, b), c in zip(u, v))',
    'r = {x for x, in ps}',
    'r = {k: a for k, (a, b) in d.items()}',
    'r = [x for row in g for x, y in row]',
  ]

  it('★ lift：樣式進 pattern，裡面是元組／變數／展開，沒有降級', async () => {
    const t = await liftPython(cases[2] + '\n')
    const c = find(t, 'python:array_make_for')
    expect(c, '正向錨點：認得這個推導式').toBeTruthy()
    expect(c.slots.pattern?.[0]?.componentId).toBe('python:tuple_make')
    expect(c.slots.targets ?? []).toEqual([])
    expect(c.properties.obj, '轉 C++ 那一路讀的第一個名字').toBe('i')
    const all = componentIdsOf(await liftPython(cases.join('\n') + '\n'))
    expect(all).toContain('python:map_make_for')
    expect(all).toContain('python:splat')
    expect(all.filter((i) => /raw|unresolved/.test(i))).toEqual([])
  })

  for (const c of cases) {
    it(`★ 來回一字不差：${c}`, async () => {
      expect(await rt(c + '\n')).toBe(c)
    })
  }

  it('平的名字仍走 targets（形態不變）', async () => {
    const c = find(await liftPython('r = [a for a, b in ps]\n'), 'python:array_make_for')
    expect(c, '正向錨點').toBeTruthy()
    expect(c.slots.targets?.map((p: any) => p.properties.name)).toEqual(['a', 'b'])
    expect(c.slots.pattern ?? []).toEqual([])
  })

  it('🔴 下標與屬性目標、外層的樣式仍整顆降級，而且不改動原文', async () => {
    expect(await ids('r = [x for x in xs]\n'), '正向錨點').toContain('python:array_make_for')
    for (const c of ['r = [1 for a[0] in xs]\n', 'r = [1 for o.x in xs]\n', 'r = [x for (a, b) in g for x in a]\n']) {
      expect(await ids(c), c).not.toContain('python:array_make_for')
      expect(await rt(c), '降級也不得改動原文').toBe(c.trim())
    }
  })

  it('★ 執行：巢狀解包、展開、單元素解包、字典（Cella）', async () => {
    const src = [
      'g = [(1, 2, 3), (4, 5)]',
      'print([n for n, *_ in g])',
      'ps = [(1, 2), (3, 4), (5, 6)]',
      'print([x for i, (x, y) in enumerate(ps) if i > 0])',
      'print(sum(a * b for (a, b) in ps))',
      'print(sorted({x for x, in [(7,), (8,), (7,)]}))',
      'd = {"p": (1, 2), "q": (3, 4)}',
      'print({k: a + b for k, (a, b) in d.items()})',
    ].join('\n') + '\n'
    expect(await runPython(src)).toBe("completed|[1, 4]\n[3, 5]\n44\n[7, 8]\n{'p': 3, 'q': 7}\n")
  })
})
