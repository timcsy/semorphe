/**
 * 原本沒有 formalize 的十二顆元件（399）：C 字串（atof、strncmp、strncpy、strstr）、iota、partial_sum、exit、
 * queue.back()、reinterpret_cast、dynamic_cast、標準例外的建構（runtime_error(…)）、文件註解。
 * 每一支先斷言 lift 出那顆身分，再斷言 Cella 的判決。
 */
import { describe, it, expect } from 'vitest'
import { expectCellaOut, runCella } from '../helpers/cella-run'
import { formalize } from '../../src/providers/cella/formalize'
import type { SemanticNode } from '../../src/core/types'

const H = '#include <iostream>\n#include <cstring>\n#include <cstdlib>\n#include <numeric>\n#include <queue>\n#include <stdexcept>\nusing namespace std;\n'
const main = (b: string, pre = '') => H + pre + 'int main() {\n' + b + '    return 0;\n}\n'
const all = (n: SemanticNode, o: SemanticNode[] = []): SemanticNode[] => { o.push(n); for (const k of Object.values(n.slots ?? {})) for (const c of k) all(c, o); return o }

const CASES: [string, string, string, string][] = [
  ['atof', 'cpp:cstring_as_double', main('    char s[] = "2.5";\n    cout << atof(s) * 2 << endl;\n'), '5\n'],
  ['strncmp', 'cpp:cstring_compare_bounded', main('    char a[] = "abcd";\n    char b[] = "abxy";\n    cout << (strncmp(a, b, 2) == 0) << endl;\n'), '1\n'],
  ['strncpy', 'cpp:cstring_copy_bounded', main('    char a[10] = "";\n    char b[] = "hello";\n    strncpy(a, b, 3);\n    a[3] = 0;\n    cout << a << endl;\n'), 'hel\n'],
  ['strstr', 'cpp:cstring_find', main('    char a[] = "hello";\n    char b[] = "ll";\n    cout << (strstr(a, b) != NULL) << endl;\n'), '1\n'],
  ['iota', 'cpp:range_fill_sequence', main('    int a[4];\n    iota(a, a + 4, 3);\n    cout << a[0] << a[3] << endl;\n'), '36\n'],
  ['partial_sum', 'cpp:range_sum_partial', main('    int a[3] = {1, 2, 3};\n    int b[3];\n    partial_sum(a, a + 3, b);\n    cout << b[2] << endl;\n'), '6\n'],
  ['runtime_error', 'cpp:exception_make', main('    try {\n        throw runtime_error("bad");\n    } catch (const exception& e) {\n        cout << e.what() << endl;\n    }\n'), 'bad\n'],
  ['dynamic_cast', 'cpp:cast_dynamic', main('    B* p = new D();\n    D* d = dynamic_cast<D*>(p);\n    cout << (d != NULL) << endl;\n    delete p;\n', 'class B {\npublic:\n    virtual ~B() {}\n};\nclass D : public B {\n};\n'), '1\n'],
  ['文件註解', 'cpp:doc_comment', main('    cout << sq(3) << endl;\n', '/**\n * @brief 平方\n * @return 平方值\n */\nint sq(int x) {\n    return x * x;\n}\n'), '9\n'],
]

describe('十二顆元件接上 Cella（399）', () => {
  it.each(CASES)('%s', async (_name, id, code, out) => {
    const r = await expectCellaOut(code, out)
    expect(all(r.tree).map((n) => n.componentId)).toContain(id)
  })

  it('reinterpret_cast：翻得出（判決由 Cella 定）', async () => {
    const r = await runCella(main('    int x = 65;\n    char* p = reinterpret_cast<char*>(&x);\n    cout << (p != NULL) << endl;\n'))
    expect(all(r.tree).map((n) => n.componentId)).toContain('cpp:cast_reinterpret')
    expect(r.verdict).not.toBe('untranslated')
    console.log('reinterpret:', r.verdict, r.problems.map((p) => p.reason).join('；'))
  })

  it('exit：印到 exit 為止（Cella 1931 起接上）', async () => {
    await expectCellaOut(main('    cout << "a" << endl;\n    exit(0);\n    cout << "b" << endl;\n'), 'a\n')
  })

  it('queue_back（只從積木來：q.back() 從程式碼 lift 成中性的容器方法）：翻成 eMCall back', () => {
    const q: SemanticNode = { id: 'q', componentId: 'cpp:var_ref', properties: { name: 'q' }, slots: {} } as SemanticNode
    const b: SemanticNode = { id: 'b', componentId: 'cpp:queue_back', properties: {}, slots: { obj: [q] } } as SemanticNode
    const fz = formalize({ id: 'p', componentId: 'cpp:program', properties: {}, slots: { body: [
      { id: 'm', componentId: 'cpp:func_def', properties: { return_type: 'int', name: 'main', params: [] }, slots: { body: [
        { id: 'd', componentId: 'cpp:var_declare', properties: { type: 'queue<int>', name: 'q' }, slots: {} } as SemanticNode,
        { id: 'x', componentId: 'cpp:print', properties: {}, slots: { values: [b] } } as SemanticNode,
      ] } } as SemanticNode,
    ] } } as SemanticNode)
    expect(fz.unknown).toEqual([])
    expect(JSON.stringify(fz.program)).toContain('"f":"back"')
  })

  it('標準例外當型別：catch (const exception& e) 與 catch (out_of_range& e) 有判決', async () => {
    await expectCellaOut(main('    try {\n        throw out_of_range("x");\n    } catch (out_of_range& e) {\n        cout << "o" << e.what() << endl;\n    }\n'), 'ox\n')
  })

  it('負向：strncpy 的長度給字串要 reject', async () => {
    const r = await runCella(main('    char a[10];\n    strncpy(a, "x", "y");\n'))
    expect(r.verdict).toBe('reject')
  })
})
