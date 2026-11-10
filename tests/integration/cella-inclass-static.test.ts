/**
 * 類別裡帶本體、回傳型別前有修飾字的成員函式（396）：lifter 的 plainShape 不收它們，於是走 cpp:func_def；
 * 在類別裡要翻成成員（static 是 mbStaticMethod，沒有 this；inline／constexpr 是一般成員函式），不能照頂層函式翻。
 */
import { describe, it, expect } from 'vitest'
import { expectCellaOut, runCella } from '../helpers/cella-run'

const H = '#include <iostream>\nusing namespace std;\n'
const inClass = (members: string, main: string, after = '') =>
  H + 'class A {\n' + members + '};\n' + after + 'int main() {\n' + main + '    return 0;\n}\n'

describe('類別裡帶本體的 static／inline／constexpr 成員函式', () => {
  it.each([
    ['經類別呼叫', inClass('public:\n    static int twice(int x) {\n        return x * 2;\n    }\n', '    cout << A::twice(4) << endl;\n'), '8\n'],
    ['經物件呼叫', inClass('public:\n    static int g() {\n        return 3;\n    }\n', '    A a;\n    cout << a.g() << endl;\n'), '3\n'],
    ['類別裡裸名字呼叫、遞迴、private', inClass('private:\n    static int g(int a, int b) {\n        return b == 0 ? a : g(b, a % b);\n    }\npublic:\n    int run() {\n        return g(12, 18);\n    }\n', '    A a;\n    cout << a.run() << endl;\n'), '6\n'],
    ['讀靜態資料成員', inClass('public:\n    static int n;\n    static int g() {\n        return n + 1;\n    }\n', '    cout << A::g() << endl;\n', 'int A::n = 4;\n'), '5\n'],
    ['回傳參考', inClass('public:\n    static int& c() {\n        static int v = 1;\n        return v;\n    }\n', '    A::c() = 5;\n    cout << A::c() << endl;\n'), '5\n'],
    ['回傳 const 指標（struct）', H + 'struct S {\n    static const char* name() {\n        return "s";\n    }\n};\nint main() {\n    cout << S::name() << endl;\n    return 0;\n}\n', 's\n'],
    ['inline 是一般成員，讀得到欄位', inClass('public:\n    int v = 2;\n    inline int g() {\n        return v;\n    }\n', '    A a;\n    cout << a.g() << endl;\n'), '2\n'],
    ['static constexpr', inClass('public:\n    static constexpr int g() {\n        return 3;\n    }\n', '    cout << A::g() << endl;\n'), '3\n'],
  ])('%s', async (_name, code, out) => {
    await expectCellaOut(code as string, out as string)
  })

  it.each([
    ['private 從外面呼叫', inClass('private:\n    static int g() {\n        return 1;\n    }\n', '    cout << A::g() << endl;\n'), /private member/],
    ['static 讀非靜態欄位：沒有 this', inClass('public:\n    int x;\n    static int g() {\n        return x;\n    }\n', '    cout << A::g() << endl;\n'), /this/],
    ['static 呼叫非靜態成員：沒有 this', inClass('public:\n    int h() {\n        return 1;\n    }\n    static int g() {\n        return h();\n    }\n', '    cout << A::g() << endl;\n'), /this/],
  ])('負向：%s 判 reject', async (_name, code, why) => {
    const r = await runCella(code as string)
    expect(r.verdict).toBe('reject')
    expect(r.problems.map((p) => p.reason).join('；')).toMatch(why as RegExp)
  })
})
