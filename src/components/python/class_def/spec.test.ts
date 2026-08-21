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

  it('🔴 lift：有繼承的整顆走誠實降級——少了它產出的類別會安靜地不再繼承', async () => {
    expect(await ids('class Dog(Animal):\n    def bark(self):\n        pass\n')).not.toContain('python:class_def')
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
