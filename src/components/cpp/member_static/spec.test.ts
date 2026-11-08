/**
 * `cpp:member_static` 的自證測（361）：類別外的靜態成員定義（`int C::n = 3;`）——初值併進類別的 mbStatic，定義本身不另外送
 * （cella 2026-11-08 的送法，同 cpp_to_tree.py）。經類別名取靜態成員（`C::n` 當值）Cella 還解析不了 ⟹ 照實翻不出，不送成一個會被判 undeclared 的名字。
 */
import { describe, it, expect } from 'vitest'
import { expectCellaOut, runCella } from '../../../../tests/helpers/cella-run'

const H = '#include <iostream>\nusing namespace std;\n'

describe('膠囊自證：類別的靜態成員', () => {
  it('★ 類別外的定義給初值、沒寫初值的照標準是 0；成員函式裡的裸名字指到它', async () => {
    await expectCellaOut(H + 'class C {\npublic:\n    static int n;\n    static int z;\n    C() { n++; }\n    int get() { return n * 10 + z; }\n};\nint C::n = 3;\nint C::z;\nint main() {\n    C x, y;\n    cout << y.get() << endl;\n}\n', '50\n')
  }, 120_000)
  it('★ 指標型別的靜態成員（`static L* current;` ＋ `L* L::current = nullptr;`）', async () => {
    await expectCellaOut(H + 'class L {\npublic:\n    static L* current;\n    int v;\n    L(int x) : v(x) { current = this; }\n    int peek() { return current->v; }\n};\nL* L::current = nullptr;\nint main() {\n    L a(7);\n    cout << a.peek() << endl;\n}\n', '7\n')
  }, 120_000)
  it('🔴 經類別名取靜態成員（`C::n` 當值）：照實翻不出——不是錯的 reject（360 之後倒退過：送 eName 被判 undeclared）', async () => {
    const r = await runCella(H + 'class C {\npublic:\n    static int n;\n};\nint C::n = 3;\nint main() {\n    cout << C::n << endl;\n}\n')
    expect(r.verdict).toBe('untranslated')
    expect(r.untranslated.map((u) => u.reason).join(' ')).toContain('經類別名取靜態成員')
  }, 60_000)
})
