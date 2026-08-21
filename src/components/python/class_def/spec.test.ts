/** `python:class_def` 的自證測。 */
import { describe, it, expect } from 'vitest'
import { liftPython, componentIdsOf, generatePython as gen, runPython } from '../../../../tests/helpers/python-lift'

const ids = async (c: string): Promise<string[]> => componentIdsOf(await liftPython(c))
const rt = async (c: string): Promise<string> => gen(await liftPython(c)).trim()

const DOG = `class Dog:
    def __init__(self, name):
        self.name = name

    def bark(self):
        print(self.name)`

describe('python:class_def', () => {
  it('lift：只有方法的類別收得了', async () => {
    const got = await ids(DOG + '\n')
    expect(got, '正向錨點').toContain('python:class_def')
    expect(got).not.toContain('unresolved')
  })

  /**
   * ⚠️ **這條原本釘的是「有繼承就整顆降級」，而邊界在 2026-08-22 移動了**
   * ——單一繼承收得下。今天降級的是**多重繼承**（積木上只有一格）
   * 與**不是裸名字的父類別**（`class D(Base[int])`）。
   */
  it('🔴 lift：多重繼承與非裸名字的父類別仍然誠實降級', async () => {
    expect(await ids('class D(A, B):\n    def m(self):\n        pass\n')).not.toContain('python:class_def')
  })

  it('🔴 lift：類別層級的屬性也整顆降級——還沒有地方放', async () => {
    expect(await ids('class C:\n    count = 0\n')).not.toContain('python:class_def')
  })

  it('來回：一字不差', async () => {
    expect(await rt(DOG + '\n')).toBe(DOG.replace(/\n\n/g, '\n'))
  })

  it('執行：建構、存欄位、呼叫方法', async () => {
    const out = await runPython(DOG + '\n\nd = Dog("小黑")\nd.bark()\n')
    expect(out, `跑不出名字：${JSON.stringify(out)}`).toContain('小黑')
  })

  it('執行：兩個實例各有各的欄位', async () => {
    const out = await runPython(DOG + '\n\na = Dog("甲")\nb = Dog("乙")\na.bark()\nb.bark()\n')
    expect(out).toContain('甲')
    expect(out).toContain('乙')
  })
})

/**
 * 🔴 **繼承**（2026-08-22）。之前有 `superclasses` 就整顆降級。
 */
describe('繼承', () => {
  it('🔴 子類別拿得到父類別的方法，而自己的覆蓋掉父的', async () => {
    const out = await runPython(
      'class Animal:\n    def __init__(self, name):\n        self.name = name\n\n    def speak(self):\n        return "..."\n\nclass Dog(Animal):\n    def speak(self):\n        return self.name + " 汪汪"\n\nd = Dog("小黑")\nprint(d.speak())\nprint(d.name)\n',
    )
    expect(out, '建構式是繼承來的').toContain('小黑')
    expect(out, '自己的 speak 要蓋掉父的').toContain('小黑 汪汪')
  })

  it('🔴 沒被覆蓋的方法用父的', async () => {
    const out = await runPython(
      'class A:\n    def hi(self):\n        return "A 的"\n\nclass B(A):\n    def other(self):\n        return 1\n\nprint(B().hi())\n',
    )
    expect(out).toContain('A 的')
  })

  it('★ 來回：沒有父類別時不得產出一對空括號', async () => {
    const code = 'class C:\n    def m(self):\n        pass\n'
    expect(gen(await liftPython(code)).trimEnd()).toBe(code.trimEnd())
    const inherit = 'class D(C):\n    def m(self):\n        pass\n'
    expect(gen(await liftPython(inherit)).trimEnd()).toBe(inherit.trimEnd())
  })

  it('🔴 多重繼承走誠實降級——積木上只有一格', async () => {
    expect(componentIdsOf(await liftPython('class D(A, B):\n    def m(self):\n        pass\n')))
      .not.toContain('python:class_def')
  })
})
