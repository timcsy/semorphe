/** `cpp:cstring_as_int`（`atoi`）的自證測——2026-11-08 補上 formalize（學生語料 tioj 10_ex2_2 因此從翻不出變成判得出）。 */
import { describe, it } from 'vitest'
import { expectCellaOut } from '../../../../tests/helpers/cella-run'

describe('cpp:cstring_as_int', () => {
  it('執行：字元陣列與字串字面都轉得成整數', async () => {
    await expectCellaOut('#include <bits/stdc++.h>\nusing namespace std;\nint main() {\n    char s[10] = "123";\n    cout << atoi(s) + 1 << " " << atoi("-42") << endl;\n    return 0;\n}\n', '124 -42\n')
  })
})
