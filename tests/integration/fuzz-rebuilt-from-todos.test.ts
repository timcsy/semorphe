/**
 * **過期的 it.todo 重建回來**（444，2026-11-13）
 *
 * 2026-03～09 的幾輪盲測只留下 `it.todo` 的標題，原始程式沒有留下來；而其中好幾支的理由寫的是 JS 直譯器的錯誤
 * （`UNDEFINED_FUNC`），那個直譯器 11-04 已經刪掉。這裡照每支的標題**重建一段最小形狀**，量今天的狀態。
 *
 * ⚠️ 重建出來的量的是**我重建的形狀**，不是當初那支程式（`fuzz-cpp-hardware` 的提醒）——所以每支都標出它來自哪一個 todo，
 *    而原本的 todo 換成指向這裡的註解，不聲稱「當初那支程式通過了」。
 *
 * 兩組：
 * - **今天換得過去的**：lift 無降級、身分正確、產碼一字不差、再轉一圈穩定、Cella 兩邊判 accept 且輸出相同。
 * - **誠實降級的**：照原文保留（raw_code／unresolved）、來回一字不差、Cella 判翻不出——而不是一個看起來合理的錯結構。
 *   其中「多個 catch」與「mutable」重建時量到是**靜默丟失**（第二個 catch 連同 `throw;` 不見、`mutable` 被拿掉），本刀改成降級。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import type { Lifter } from '../../src/core/lift/lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { generateCode } from '../../src/core/projection/code-generator'
import { setupTestRenderer } from '../helpers/setup-renderer'
import type { SemanticNode } from '../../src/core/semantic-tree'
import type { StylePreset } from '../../src/core/types'
import { runCella } from '../helpers/cella-run'
import { liftPython, generatePython } from '../helpers/python-lift'

const S = { id: 'apcs', name: { 'zh-TW': 'APCS', en: 'APCS' }, io_style: 'cout', naming_convention: 'camelCase', indent_size: 4, brace_style: 'K&R', namespace_style: 'using', header_style: 'individual' } as StylePreset
let parser: Parser
let lifter: Lifter
beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  lifter = createTestLifter()
  registerCppLanguage()
  setupTestRenderer()
})
const lift = (code: string) => lifter.lift(parser.parse(code)!.rootNode as never) as SemanticNode
const ids = (n: SemanticNode | null | undefined, acc: string[] = []): string[] => {
  if (!n) return acc
  acc.push(n.componentId)
  for (const v of Object.values(n.slots ?? {})) for (const c of v as SemanticNode[]) ids(c, acc)
  return acc
}
const DEGRADED = /raw_code|unresolved/
const noBlank = (s: string) => s.split('\n').filter((l) => l.trim() !== '').join('\n')
const H = '#include <bits/stdc++.h>\nusing namespace std;\n'

describe('今天換得過去的', () => {
  for (const [name, from, want, out, board] of [
    ['fuzz-cpp-numeric fuzz_10：struct param + iota + accumulate', H + 'struct P {\n    int x;\n};\nint total(vector<P> ps) {\n    int s = 0;\n    for (P p : ps) {\n        s += p.x;\n    }\n    return s;\n}\nint main() {\n    vector<int> v(5);\n    iota(v.begin(), v.end(), 1);\n    vector<P> ps;\n    for (int x : v) {\n        ps.push_back({x});\n    }\n    cout << total(ps) << " " << accumulate(v.begin(), v.end(), 0) << endl;\n    return 0;\n}\n', ['cpp:struct_declare', 'cpp:func_def'], '15 15\n', undefined],
    ['fuzz-cpp-containers fuzz_8：queue func param', H + 'void drain(queue<int> q) {\n    while (!q.empty()) {\n        cout << q.front();\n        q.pop();\n    }\n}\nint main() {\n    queue<int> q;\n    q.push(1);\n    q.push(2);\n    drain(q);\n    cout << q.size() << endl;\n    return 0;\n}\n', ['cpp:queue_declare', 'cpp:func_def'], '122\n', undefined],
    ['fuzz-cpp-containers fuzz_10：map pair key', H + 'int main() {\n    map<pair<int, int>, int> m;\n    m[{1, 2}] = 3;\n    m[make_pair(0, 5)] = 4;\n    for (auto kv : m) {\n        cout << kv.first.first << kv.first.second << kv.second << endl;\n    }\n    return 0;\n}\n', ['cpp:map_declare'], '054\n123\n', undefined],
    ['fuzz-cpp-string fuzz_6：substr nested find', H + 'string word(string s) {\n    return s.substr(s.find(" ") + 1, s.find("!") - s.find(" ") - 1);\n}\nint main() {\n    cout << word("hi there!") << endl;\n    return 0;\n}\n', ['cpp:func_def'], 'there\n', undefined],
    ['fuzz-cpp-container-ends fuzz_9：deque<char> by value', H + 'void show(deque<char> d) {\n    d.push_front(\'x\');\n    for (char c : d) {\n        cout << c;\n    }\n    cout << endl;\n}\nint main() {\n    deque<char> d;\n    d.push_back(\'a\');\n    d.push_back(\'b\');\n    show(d);\n    cout << d.size() << d.front() << endl;\n    return 0;\n}\n', ['cpp:deque_declare'], 'xab\n2a\n', undefined],
    ['fuzz-cpp-container-ends fuzz_3：grid BFS nested', H + 'int main() {\n    vector<vector<int>> g(3, vector<int>(3, 0));\n    vector<vector<int>> dist(3, vector<int>(3, -1));\n    queue<pair<int, int>> q;\n    q.push({0, 0});\n    dist[0][0] = 0;\n    int dr[4] = {1, -1, 0, 0};\n    int dc[4] = {0, 0, 1, -1};\n    while (!q.empty()) {\n        pair<int, int> cur = q.front();\n        q.pop();\n        for (int k = 0; k < 4; k++) {\n            int r = cur.first + dr[k];\n            int c = cur.second + dc[k];\n            if (r >= 0 && r < 3 && c >= 0 && c < 3 && dist[r][c] == -1 && g[r][c] == 0) {\n                dist[r][c] = dist[cur.first][cur.second] + 1;\n                q.push({r, c});\n            }\n        }\n    }\n    cout << dist[2][2] << endl;\n    return 0;\n}\n', ['cpp:queue_declare'], '4\n', undefined],
    ['fuzz-cpp-hardware fuzz_4：arduino unsigned wrap', 'void setup() {\n    Serial.begin(9600);\n    unsigned long a = 0UL - 4294967290UL;\n    Serial.println(a);\n}\nvoid loop() {\n}\n', [], '6\r\n', 'uno'],
    ['fuzz-cpp-hardware fuzz_9：arduino char buf + String', 'void setup() {\n    Serial.begin(9600);\n    char buf[12];\n    long n = 1234;\n    int i = 0;\n    while (n > 0) {\n        buf[i] = \'0\' + n % 10;\n        n = n / 10;\n        i++;\n    }\n    buf[i] = \'\\0\';\n    String s = String(buf);\n    Serial.println(s);\n}\nvoid loop() {\n}\n', ['cpp:array_declare'], '4321\r\n', 'uno'],
    ['fuzz-cpp-hardware fuzz_11：arduino (byte)x', 'void setup() {\n    Serial.begin(9600);\n    int x = 300;\n    byte b = (byte)x;\n    Serial.println(b);\n}\nvoid loop() {\n}\n', [], '44\r\n', 'uno'],
    ['fuzz-cpp-hardware fuzz_19：arduino float precision', 'void setup() {\n    Serial.begin(9600);\n    float v = 3.14159;\n    Serial.println(v, 3);\n    Serial.println((int)(v * 100));\n}\nvoid loop() {\n}\n', [], '3.142\r\n314\r\n', 'uno'],
  ] as const) {
    it(name, async () => {
      const t = lift(from)
      const all = ids(t)
      expect(all.length, '樹是空的').toBeGreaterThan(3)
      for (const id of want) expect(all, `身分 ${id} 不在樹裡`).toContain(id)
      expect(all.filter((x) => DEGRADED.test(x)), '有降級').toEqual([])
      const g = generateCode(t, 'cpp', S)
      expect(noBlank(g), '產碼與原文不同').toBe(noBlank(from))
      expect(generateCode(lift(g), 'cpp', S), '再轉一圈不穩定').toBe(g)
      const r = await runCella(from, board ? { board } : {})
      expect(r.verdict).toBe('accept')
      expect(r.out).toBe(out)
    }, 120_000)
  }
  it('fuzz-python-mixed fuzz_10：字串相加與重複、內建函式', async () => {
    const src = 's = "ab" + "cd"\nt = s * 2\nprint(t, len(t), str(len(s)) + "!", abs(-3), max(1, 5), int("7"))\n'
    const t = await liftPython(src)
    const all = ids(t)
    expect(all).toContain('python:print')
    expect(all.filter((x) => DEGRADED.test(x))).toEqual([])
    expect(generatePython(t).trim()).toBe(src.trim())
    const r = await runCella(src, { lang: 'python' })
    expect(r.verdict).toBe('accept')
    expect(r.out).toBe('abcdabcd 8 4! 3 5 7\n')
  }, 120_000)
})

describe('誠實降級的（照原文保留，不給一個看起來合理的錯結構）', () => {
  for (const [name, src] of [
    ['fuzz-cpp-advanced fuzz_1（mutable）', H + 'int main() {\n    int c = 0;\n    auto f = [c]() mutable {\n        c++;\n        return c;\n    };\n    cout << f() << f() << c << endl;\n    return 0;\n}\n'],
    ['fuzz-cpp-advanced fuzz_2（樣板特化）', H + 'namespace m {\n    template <typename T>\n    T twice(T x) {\n        return x * 2;\n    }\n    template <>\n    string twice<string>(string x) {\n        return x + x;\n    }\n}\nint main() {\n    cout << m::twice(3) << m::twice<string>("ab") << endl;\n    return 0;\n}\n'],
    ['fuzz-cpp-advanced fuzz_7（多個 catch）', H + 'int main() {\n    try {\n        try {\n            throw runtime_error("a");\n        } catch (const logic_error& e) {\n            cout << "L";\n        } catch (const runtime_error& e) {\n            cout << "R";\n            throw;\n        }\n    } catch (const exception& e) {\n        cout << e.what() << endl;\n    }\n    return 0;\n}\n'],
    ['fuzz-cpp-advanced fuzz_8（可變參數樣板）', H + 'template <typename... T>\nint sum(T... xs) {\n    return (xs + ... + 0);\n}\nint main() {\n    cout << sum(1, 2, 3) << endl;\n    return 0;\n}\n'],
  ] as const) {
    it(name, async () => {
      const t = lift(src)
      expect(ids(t).some((x) => DEGRADED.test(x)), '應該照原文保留').toBe(true)
      const g = generateCode(t, 'cpp', S)
      expect(noBlank(g), '照原文保留的那一段走樣了').toBe(noBlank(src))
      const r = await runCella(src)
      expect(r.verdict, '翻不出的不能判成一個答案').not.toBe('accept')
    }, 120_000)
  }
})
