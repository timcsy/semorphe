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
   * 邊界移動時要**改成釘新的邊界，不是刪掉它**：今天走誠實降級的是
   * **解構的目標**（`for k, v in d.items()`），而語義樹裡沒有地方放兩個名字。
   */
  it('🔴 lift：解構的目標整顆走誠實降級——收一半會弄丟一個名字', async () => {
    const destructuring = 'a = [k for k, v in d.items()]\n'
    expect(await ids(destructuring)).not.toContain('python:array_make_for')
    expect(await ids(destructuring), '而它必須看得見').toContain('unresolved')
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
