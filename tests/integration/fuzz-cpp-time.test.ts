/**
 * 2026-11-04（spec 212，6c-5）：判準從參照編譯器換成 Cella——原本 g++ 跑原始碼與產回的碼比輸出，現在 Cella 跑兩份比輸出
 * （兩份都必須判 accept、印出的東西逐字相同；不再因為「沒有參照編譯器」而跳過）。
 *
 * **資訊隔離盲測：時間與亂數**（第 395 刀，`cpp:time` 的 component-fuzz，難度 easy）。
 *
 * 出題的那一側看不到原始碼——它只知道「初學者用 `time(...)` 與 `srand`／`rand` 寫的程式，印出來的要與時間、亂數的值無關」。
 * 判準（每一支）：
 * 1. **輸出等價**：原始與 lift → generate 產回來的，Cella 跑出同樣的輸出（兩份都 accept）
 * 2. **元件身分**：原文有 `time(0)` 的，樹裡要有 `cpp:time`（只認 `time(0)`——`time(NULL)` 照舊是通用呼叫）
 * 3. **二次往返**：產回來的再 lift，元件序列相同
 * 4. 沒有 `raw_code`
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { generateCode } from '../../src/core/projection/code-generator'
import { runCella, describeCellaResult } from '../helpers/cella-run'
import apcs from '../../src/languages/cpp/styles/apcs.json'
import type { SemanticNode, StylePreset } from '../../src/core/types'

const S = apcs as unknown as StylePreset
let parser: Parser
beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  registerCppLanguage()
})

const lift = (c: string): SemanticNode => createTestLifter().lift(parser.parse(c)!.rootNode as never) as SemanticNode
const ids = (n: SemanticNode, out: string[] = []): string[] => {
  out.push(n.componentId)
  for (const ks of Object.values(n.slots ?? {})) for (const k of ks) ids(k, out)
  return out
}

/** 步數上限：fuzz_7 跑一百萬圈的加總，預設的一百萬步不夠（Cella 判 unknown／fuel）——放大到兩千萬，不是缺陷；代價是時間（見 it 的時限） */
const STEPS = 20_000_000

const PROGRAMS: { id: string; code: string }[] = [
  { id: "fuzz_1", code: "#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    srand(time(0));\n    int rolls = 0;\n    int bad = 0;\n    int sixes = 0;\n    while (rolls < 10) {\n        int d = rand() % 6 + 1;\n        if (d < 1 || d > 6) {\n            bad++;\n        }\n        if (d == 6) {\n            sixes++;\n        }\n        rolls++;\n    }\n    cout << \"Rolled \" << rolls << \" dice\" << endl;\n    cout << \"Out of range: \" << bad << endl;\n    if (sixes >= 0 && sixes <= rolls) {\n        cout << \"Six count is sane\" << endl;\n    }\n    return 0;\n}\n" },
  { id: "fuzz_2", code: "#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    long now = time(0);\n    if (now > 0) {\n        cout << \"Clock is running\" << endl;\n    } else {\n        cout << \"Clock is broken\" << endl;\n    }\n    long later = time(NULL);\n    long diff = later - now;\n    if (diff >= 0 && diff <= 1) {\n        cout << \"Elapsed within one second\" << endl;\n    } else {\n        cout << \"Too slow\" << endl;\n    }\n    return 0;\n}\n" },
  { id: "fuzz_3", code: "#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    srand(time(NULL));\n    int secret = rand() % 100 + 1;\n    int guess = 1;\n    int tries = 0;\n    bool found = false;\n    while (guess <= 100 && !found) {\n        tries++;\n        if (guess == secret) {\n            found = true;\n        } else {\n            guess++;\n        }\n    }\n    if (found) {\n        cout << \"Found the secret\" << endl;\n    }\n    if (tries >= 1 && tries <= 100) {\n        cout << \"Tries in range\" << endl;\n    }\n    if (tries == secret) {\n        cout << \"Tries equals secret\" << endl;\n    }\n    return 0;\n}\n" },
  { id: "fuzz_4", code: "#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    int t = time(0);\n    int days = t / 86400;\n    int hour = t / 3600 % 24;\n    if (days > 19000) {\n        cout << \"We are past 2022\" << endl;\n    } else {\n        cout << \"Clock looks old\" << endl;\n    }\n    if (hour >= 0 && hour < 24) {\n        cout << \"Hour is valid\" << endl;\n    }\n    int weeks = days / 7;\n    if (weeks * 7 <= days) {\n        cout << \"Weeks fit in days\" << endl;\n    }\n    return 0;\n}\n" },
  { id: "fuzz_5", code: "#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    srand(time(0));\n    int i = 0;\n    int negatives = 0;\n    int others = 0;\n    int outside = 0;\n    while (i < 20) {\n        int v = rand() % 11 - 5;\n        if (v < -5 || v > 5) {\n            outside++;\n        }\n        if (v < 0) {\n            negatives++;\n        } else {\n            others++;\n        }\n        i = i + 1;\n    }\n    cout << \"Total: \" << negatives + others << endl;\n    cout << \"Outside: \" << outside << endl;\n    return 0;\n}\n" },
  { id: "fuzz_6", code: "#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    srand((unsigned) time(NULL));\n    int heads = 0;\n    int tails = 0;\n    int flips = 0;\n    while (flips < 50) {\n        if (rand() % 2 == 0) {\n            heads += 1;\n        } else {\n            tails += 1;\n        }\n        flips++;\n    }\n    cout << \"Flips: \" << flips << endl;\n    if (heads + tails == flips) {\n        cout << \"Counts match\" << endl;\n    }\n    if (heads <= 50 && tails <= 50) {\n        cout << \"No overflow\" << endl;\n    }\n    return 0;\n}\n" },
  { id: "fuzz_7", code: "#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    long start = time(0);\n    long long sum = 0;\n    long long k = 0;\n    while (k < 1000000) {\n        sum += k;\n        k++;\n    }\n    long finish = time(NULL);\n    cout << \"Sum: \" << sum << endl;\n    if (finish >= start) {\n        cout << \"Timer ok\" << endl;\n    }\n    if ((finish - start) / 60 == 0) {\n        cout << \"Less than a minute\" << endl;\n    }\n    return 0;\n}\n" },
  { id: "fuzz_8", code: "#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    srand(time(0) % 1000);\n    int noise = rand() % 10;\n    srand(42);\n    int a1 = rand();\n    int a2 = rand();\n    srand(42);\n    int b1 = rand();\n    int b2 = rand();\n    if (a1 == b1 && a2 == b2) {\n        cout << \"Same sequence\" << endl;\n    } else {\n        cout << \"Different sequence\" << endl;\n    }\n    if (noise >= 0 && noise < 10) {\n        cout << \"Noise in range\" << endl;\n    }\n    return 0;\n}\n" },
  { id: "fuzz_9", code: "#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    srand(time(NULL));\n    int value = 0;\n    int attempts = 0;\n    while (value <= 50 && attempts < 1000) {\n        value = rand() % 100 + 1;\n        attempts++;\n    }\n    if (value > 50 && value <= 100) {\n        cout << \"Value in range 51-100\" << endl;\n    } else {\n        cout << \"Gave up\" << endl;\n    }\n    if (attempts >= 1) {\n        cout << \"Tried at least once\" << endl;\n    }\n    return 0;\n}\n" },
  { id: "fuzz_10", code: "#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    long a = time(0);\n    int sec = (int)(time(NULL) % 60);\n    long minute = a / 60 % 60;\n    long year = 1970 + a / 31557600;\n    if (sec >= 0 && sec <= 59) {\n        cout << \"Second ok\" << endl;\n    }\n    if (minute >= 0 && minute < 60) {\n        cout << \"Minute ok\" << endl;\n    }\n    if (year >= 2024) {\n        cout << \"Year is recent\" << endl;\n    } else {\n        cout << \"Year is old\" << endl;\n    }\n    if (time(0) - a <= 1) {\n        cout << \"Clock steady\" << endl;\n    }\n    return 0;\n}\n" },
]

describe('盲測：時間與亂數', () => {
  for (const p of PROGRAMS) {
    it(`★ ${p.id}`, async () => {
      const tree = lift(p.code)
      const before = ids(tree)
      expect(before, 'raw_code').not.toContain('cpp:raw_code')
      if (/\btime\(0\)/.test(p.code)) expect(before, '🔴 元件身分：time(0) 沒有被認成 cpp:time').toContain('cpp:time')
      const gen = generateCode(tree, 'cpp', S)
      expect(ids(lift(gen)), '🔴 二次往返：元件序列變了').toEqual(before)
      const want = await runCella(p.code, { steps: STEPS })
      expect(want.verdict, `原始程式在 Cella 判不是 accept——是題目壞了，或 Cella 的缺口：\n${describeCellaResult(want)}`).toBe('accept')
      const mine = await runCella(gen, { steps: STEPS })
      expect(mine.verdict, `🔴 產回來的程式在 Cella 判不是 accept：\n${describeCellaResult(mine)}`).toBe('accept')
      expect(mine.out, '🔴 產回來的程式輸出不同').toBe(want.out)
    }, 240_000) // ⚠️ fuzz_7 在 Cella 上兩份各約 25 秒（單獨跑量的；全套並行時更久），預設的 60 秒不夠
  }
})
