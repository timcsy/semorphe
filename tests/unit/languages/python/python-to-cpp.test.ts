/**
 * Python → C++ 的最小例（spec 225 T002）：型別表用**手寫的**（形狀照與 cella 談定的 `{nodes, basis}`）——
 * 真的型別表等 Cella 發布 `python.observedTypes` 之後由課文護欄接上。這裡釘的是寫法本身與保留的判準。
 */
import { describe, it, expect } from 'vitest'
import { liftPython } from '../../../helpers/python-lift'
import { convertPythonToCpp, unifyTypes } from '../../../../src/languages/python/python-to-cpp'
import { fakeObserved } from '../../../helpers/fake-observed-types'

async function cpp(src: string, vars: Record<string, string>, opts?: Parameters<typeof fakeObserved>[2], input?: string) {
  const t = (await liftPython(src))!
  return convertPythonToCpp(t, fakeObserved(t, vars, opts), { input })
}
const NOTE_RUN = '// 變數的型別是照這次執行看到的；換一組輸入，型別可能不同\n'
const MAIN = (body: string, extra = '') => `${NOTE_RUN}#include <iostream>\n#include <string>\n${extra}using namespace std;\n\n`
const okCode = async (src: string, vars: Record<string, string>, input?: string) => {
  const r = await cpp(src, vars, undefined, input)
  if (r.code === null) throw new Error(JSON.stringify(r.reasons))
  return r.code
}

describe('Python → C++ 的寫法', () => {
  it('印出：預設以空白分開、換行結尾；end／sep；字串字面量直接寫（+ 串接才包 string）', async () => {
    const code = await okCode('n = 3\nprint("hi", n)\nprint(n, end="")\nprint(1, 2, sep=",")\n', { n: 'int' })
    expect(code).toBe(`${MAIN('')}int main() {\n    long long n;\n    n = 3;\n    cout << "hi" << " " << n << "\\n";\n    cout << n;\n    cout << 1 << "," << 2 << "\\n";\n    return 0;\n}\n`)
  })
  it('宣告提到最前面：if 裡第一次指定、外面用到的照樣看得到；bool 印 True／False', async () => {
    const code = await okCode('x = int(input())\nif x > 0:\n    y = x * 2\nelse:\n    y = 0\nprint(y, x > 1)\n', { x: 'int', y: 'int' }, '5\n')
    expect(code).toContain('    long long x;\n    long long y;\n')
    expect(code).toContain('x = stoi(read_line());')
    expect(code).toContain('string read_line() {')
    expect(code).toContain('cout << y << " " << (x > 1 ? "True" : "False") << "\\n";')
  })
  it('// 與 % 補小函式（向下取整）；/ 是浮點除法', async () => {
    const code = await okCode('a = -7\nb = 2\nprint(a // b, a % b)\nc = a / b\n', { a: 'int', b: 'int', c: 'float' })
    expect(code).toContain('floor_div(a, b)')
    expect(code).toContain('floor_mod(a, b)')
    expect(code).toContain('c = (double)a / b;')
    expect(code).toContain('long long floor_div(long long a, long long b) {')
  })
  it('計數 for（含倒數）與 while、break；清單 → vector', async () => {
    const code = await okCode('xs = []\nfor i in range(3):\n    xs.append(i * 2)\nfor j in range(5, 0, -1):\n    xs[0] = j\nk = 0\nwhile k < len(xs):\n    k += 1\n    break\nprint(xs[0], sum(xs), max(xs))\n', { xs: 'list[int]', i: 'int', j: 'int', k: 'int' })
    expect(code).toContain('vector<long long> xs;')
    expect(code).toContain('long long i;')
    expect(code).toContain('long long j;')
    expect(code).toContain('for (i = 0; i < 3; i++) {')
    expect(code).toContain('for (j = 5; j > 0; j--) {')
    expect(code).toContain('xs.push_back(i * 2);')
    expect(code).toContain('while (k < (long long)xs.size()) {')
    expect(code).toContain('accumulate(xs.begin(), xs.end(), 0LL)')
    expect(code).toContain('*max_element(xs.begin(), xs.end())')
  })
  it('函式：參數與回傳的型別取觀察到的；寫在 main 之前', async () => {
    const code = await okCode('def add(a, b):\n    return a + b\nprint(add(1, 2))\n', { a: 'int', b: 'int', 'add()': 'int' })
    expect(code).toContain('long long add(long long a, long long b) {\n    return a + b;\n}')
    expect(code.indexOf('long long add(')).toBeLessThan(code.indexOf('int main()'))
  })
})

describe('Python → C++ 照實保留', () => {
  it('同一個變數觀察到兩種型別（int|str）→ 整支不換、指出那個變數', async () => {
    const r = await cpp('x = 1\nprint(x)\n', { x: 'int|str' })
    expect(r.code).toBeNull()
    expect(r.reasons.map((x) => x.kind)).toContain('type-uncertain')
    expect(r.reasons.map((x) => x.detail).join()).toContain('x')
  })
  it('空清單之後看不出元素型別（讀取全是 list[?]）→ 不換', async () => {
    const r = await cpp('xs = []\nprint(len(xs))\n', { xs: 'list[?]' })
    expect(r.code).toBeNull()
    expect(r.reasons.map((x) => x.kind)).toContain('type-uncertain')
  })
  it('有一段在這份輸入下沒跑到 → 不換', async () => {
    const r = await cpp('x = 1\nif x > 5:\n    print("big")\n', { x: 'int' }, { unreached: (n) => n.componentId === 'python:print' })
    expect(r.code).toBeNull()
    expect(r.reasons.map((x) => x.detail).join()).toContain('沒有跑到')
  })

  it('elif：換成 else if，多段主體攤開、else 接在最後', async () => {
    const r = await cpp('x = 1\nif x > 5:\n    print("a")\nelif x > 2:\n    print("b")\n    print("c")\nelif x > 0:\n    print("d")\nelse:\n    print("e")\n', { x: 'int' })
    expect(r.reasons).toEqual([])
    expect(r.code).toMatch(/\} else if \(x > 2\) \{\n\s+cout << "b" << "\\n";\n\s+cout << "c" << "\\n";\n\s+\} else if \(x > 0\) \{/)
    expect(r.code).toMatch(/\} else \{\n\s+cout << "e"/)
  })

  it('沒跑到的分支：只印字串字面量 ⟹ 換得過去；其餘照舊保留（型別不自己推）', async () => {
    const lit = await cpp('x = 1\nif x > 5:\n    print("big")\n', { x: 'int' }, { unreached: (n) => n.componentId === 'python:literal_string' })
    expect(lit.reasons).toEqual([])
    expect(lit.code).toContain('cout << "big"')
    const assign = await cpp('x = 1\ny = "s"\nif x > 5:\n    y = "t"\n', { x: 'int', y: 'str' }, { unreached: (n) => n.componentId === 'python:literal_string' && n.properties.value === 't' })
    expect(assign.code).toBeNull()
    expect(assign.reasons.map((x) => x.kind)).toContain('type-uncertain')
  })
  it('沒有型別表 → 不換（需要型別）', async () => {
    const t = (await liftPython('x = 1\nprint(x)\n'))!
    expect(convertPythonToCpp(t, null).reasons.map((x) => x.kind)).toContain('needs-types')
  })
  it('印浮點數 → 不換（Python 印 2.0、cout 印 2）', async () => {
    const r = await cpp('x = 2.0\nprint(x)\n', { x: 'float' })
    expect(r.reasons.map((x) => x.kind)).toEqual(['float-print'])
  })
  it('負的下標、子集以外的構造 → 不換', async () => {
    expect((await cpp('xs = [1, 2]\nprint(xs[-1])\n', { xs: 'list[int]' })).code).toBeNull()
    expect((await cpp('d = {}\nprint(len(d))\n', { d: 'dict[?, ?]' })).code).toBeNull()
  })
  it('unifyTypes：list[?] 在有 list[int] 時讓位；聯集與只有 ? 的不行', () => {
    expect(unifyTypes(['list[?]', 'list[int]'])).toBe('list[int]')
    expect(unifyTypes(['list[?]|list[int]'])).toBe('list[int]')
    expect(unifyTypes(['int', 'str'])).toBeUndefined()
    expect(unifyTypes(['list[?]'])).toBeUndefined()
    expect(unifyTypes(['list[int|str]'])).toBe('list[int|str]')
  })
  it('沒有輸入而程式讀輸入 → 不換、說需要一份輸入（FR-008）', async () => {
    const r = await cpp('x = int(input())\nprint(x)\n', { x: 'int' })
    expect(r.code).toBeNull()
    expect(r.reasons.map((x) => x.kind)).toEqual(['needs-input'])
  })
})

describe('型別是照這組輸入推的——寫在第一行（FR-009，使用者 11-09 定）', () => {
  it('讀輸入的程式：列出這組輸入', async () => {
    const code = await okCode('x = int(input())\ny = int(input())\nprint(x + y)\n', { x: 'int', y: 'int' }, '5\n3\n')
    expect(code.split('\n')[0]).toBe('// 變數的型別是照這組輸入跑一次看到的（輸入：5、3）；換一組輸入，型別可能不同')
  })
  it('輸入太長就截短', async () => {
    const code = await okCode('x = input()\nprint(x)\n', { x: 'str' }, `${'a'.repeat(60)}\n`)
    expect(code.split('\n')[0]).toMatch(/（輸入：a{20}…）/)
  })
  it('不讀輸入的程式：照這次執行看到的', async () => {
    const code = await okCode('n = 3\nprint(n)\n', { n: 'int' })
    expect(code.split('\n')[0]).toBe('// 變數的型別是照這次執行看到的；換一組輸入，型別可能不同')
  })
})

