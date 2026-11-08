/**
 * C++ → Python 的最小例（spec 219 T004）：每一類一支，斷言換出來的 Python **逐字**——
 * 護欄（`tests/integration/cpp-to-python-verdict.test.ts`）比的是判決，這裡釘的是寫法本身（不道地的寫法判決也會相同）。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../../../helpers/setup-lifter'
import { cellaTypesOfTree } from '../../../helpers/cella-run'
import { registerCppLanguage } from '../../../../src/languages/cpp/generators'
import { convertCppToPython } from '../../../../src/languages/cpp/cpp-to-python'
import type { SemanticNode } from '../../../../src/core/types'

let parser: Parser
beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  registerCppLanguage()
})

const H = '#include <iostream>\nusing namespace std;\n'
const main = (body: string): string => `${H}int main() {\n${body}    return 0;\n}\n`
async function py(src: string): Promise<string | null> {
  const tree = createTestLifter().lift(parser.parse(src)!.rootNode as never) as SemanticNode
  return convertCppToPython(tree, await cellaTypesOfTree(tree, { lang: 'cpp' })).code
}

describe('C++ → Python 的最小例', () => {
  it('印出：endl 結尾是預設換行；沒有 endl 是 end=""；好幾個值 sep=""', async () => {
    expect(await py(main('    cout << "hi" << endl;\n    cout << 1 << 2;\n'))).toBe('print("hi")\nprint(1, 2, sep="", end="")\n')
  }, 60_000)
  it('宣告與指定：沒有初值給 0、一行好幾個攤開；main 的 return 0 不寫、include／using 不寫', async () => {
    expect(await py(main('    int a, b = 3;\n    a = b + 1;\n    cout << a << endl;\n'))).toBe('a = 0\nb = 3\na = b + 1\nprint(a)\n')
  }, 60_000)
  it('整數除法 → int(a / b)，浮點照 /；浮點印 format(…, "g")', async () => {
    expect(await py(main('    int a = 7, b = 2;\n    double x = 7.0 / 2;\n    cout << a / b << " " << x << endl;\n')))
      .toBe('a = 7\nb = 2\nx = 7.0 / 2\nprint(int(a / b), " ", format(x, "g"), sep="")\n')
  }, 60_000)
  it('if／else if／else → if／elif／else；比較的 bool 印 int(…)', async () => {
    expect(await py(main('    int n = 5;\n    if (n > 3) {\n        cout << 1 << endl;\n    } else if (n > 1) {\n        cout << 2 << endl;\n    } else {\n        cout << (n == 0) << endl;\n    }\n')))
      .toBe('n = 5\nif n > 3:\n    print(1)\nelif n > 1:\n    print(2)\nelse:\n    print(int(n == 0))\n')
  }, 60_000)
  it('while 與計數 for（從 0 開始寫 range(n)；<= 寫 + 1）', async () => {
    expect(await py(main('    int s = 0;\n    for (int i = 0; i < 3; i++) {\n        s = s + i;\n    }\n    for (int j = 1; j <= 2; j++) {\n        s = s + j;\n    }\n    while (s > 0) {\n        s = s - 4;\n    }\n')))
      .toBe('s = 0\nfor i in range(3):\n    s = s + i\nfor j in range(1, 2 + 1):\n    s = s + j\nwhile s > 0:\n    s = s - 4\n')
  }, 60_000)
  it('函式定義與呼叫（參數照名字、回傳照寫）', async () => {
    expect(await py(`${H}int sq(int x) {\n    return x * x;\n}\nint main() {\n    cout << sq(3) << endl;\n    return 0;\n}\n`))
      .toBe('def sq(x):\n    return x * x\nprint(sq(3))\n')
  }, 60_000)
  it('讀整數：同 cin 的讀法，檔頭補 next_token()', async () => {
    expect(await py(main('    int a, b;\n    cin >> a >> b;\n    cout << a + b << endl;\n')))
      .toBe('_tokens = []\ndef next_token():\n    while len(_tokens) == 0:\n        _tokens.extend(input().split())\n    return _tokens.pop(0)\na = 0\nb = 0\na = int(next_token())\nb = int(next_token())\nprint(a + b)\n')
  }, 60_000)
  it('vector → list：push_back → append、size() → len()', async () => {
    expect(await py(main('    vector<int> v;\n    v.push_back(4);\n    cout << v.size() << " " << v[0] << endl;\n')))
      .toBe('v = []\nv.append(4)\nprint(len(v), " ", v[0], sep="")\n')
  }, 60_000)
})
