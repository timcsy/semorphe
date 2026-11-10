/**
 * 原本沒有 formalize 的字串／數學元件（398）：append、clear、empty、replace、lcm、stod 補上。
 * `__gcd` 刻意不補：它是 GCC 的擴充，Cella 判「未宣告」——送出去會把學生常寫、g++ 收的程式判成錯（P6），已問 cella。
 * 每一支先斷言 lift 出那顆身分（string_empty 例外：它只從積木來），再斷言 Cella 判 accept 而且輸出相同。
 */
import { describe, it, expect } from 'vitest'
import { expectCellaOut, runCella, knownCellaGap } from '../helpers/cella-run'
import { formalize } from '../../src/providers/cella/formalize'
import type { SemanticNode } from '../../src/core/types'

const H = '#include <iostream>\n#include <string>\n#include <numeric>\n#include <algorithm>\nusing namespace std;\n'
const main = (b: string) => H + 'int main() {\n' + b + '    return 0;\n}\n'
const all = (n: SemanticNode, o: SemanticNode[] = []): SemanticNode[] => { o.push(n); for (const k of Object.values(n.slots ?? {})) for (const c of k) all(c, o); return o }

const CASES: [string, string, string, string][] = [
  ['append', 'cpp:string_append', main('    string s = "ab";\n    s.append("cd");\n    cout << s << endl;\n'), 'abcd\n'],
  ['append 接變數', 'cpp:string_append', main('    string s = "a";\n    string t = "b";\n    s.append(t);\n    s.append(t);\n    cout << s << endl;\n'), 'abb\n'],
  ['clear', 'cpp:string_clear', main('    string s = "ab";\n    s.clear();\n    cout << s.size() << endl;\n'), '0\n'],
  ['replace', 'cpp:string_replace', main('    string s = "hello";\n    s.replace(1, 3, "EY");\n    cout << s << endl;\n'), 'hEYo\n'],
  ['lcm', 'cpp:math_lcm', main('    cout << lcm(4, 6) << endl;\n'), '12\n'],
]

describe('字串與數學元件接上 Cella（398）', () => {
  it.each(CASES)('%s', async (_name, id, code, out) => {
    const r = await expectCellaOut(code, out)
    const ids = all(r.tree).map((n) => n.componentId)
    expect(ids).toContain(id)
  })

  it('string_empty（只從積木來）：翻成 eMCall empty，沒有翻不出的', () => {
    const s: SemanticNode = { id: 's', componentId: 'cpp:var_ref', properties: { name: 's' }, slots: {} } as SemanticNode
    const e: SemanticNode = { id: 'e', componentId: 'cpp:string_empty', properties: {}, slots: { obj: [s] } } as SemanticNode
    const decl: SemanticNode = { id: 'd', componentId: 'cpp:var_declare', properties: { type: 'string', name: 's' }, slots: {} } as SemanticNode
    const fz = formalize({ id: 'p', componentId: 'cpp:program', properties: {}, slots: { body: [
      { id: 'm', componentId: 'cpp:func_def', properties: { return_type: 'int', name: 'main', params: [] }, slots: { body: [decl, { id: 'x', componentId: 'cpp:print', properties: {}, slots: { values: [e] } } as SemanticNode] } } as SemanticNode,
    ] } } as SemanticNode)
    expect(fz.unknown).toEqual([])
    expect(JSON.stringify(fz.program)).toContain('"f":"empty"')
  })

  it('stod：Cella 還沒有 std::stod（照送，判 unknown）', async () => {
    await knownCellaGap(/std::stod is not supported/, () => expectCellaOut(main('    double d = stod("2.5");\n    cout << d * 2 << endl;\n'), '5\n'))
  })

  it('__gcd 照實翻不出（不送：GCC 擴充，Cella 判未宣告）', async () => {
    const r = await runCella(main('    cout << __gcd(12, 18) << endl;\n'))
    expect(all(r.tree).map((n) => n.componentId)).toContain('cpp:math_gcd')
    expect(r.verdict).toBe('untranslated')
  })

  it('負向：replace 的長度給字串要 reject', async () => {
    const r = await runCella(main('    string s = "ab";\n    s.replace(0, "x", "y");\n    cout << s << endl;\n'))
    expect(r.verdict).toBe('reject')
  })
})
