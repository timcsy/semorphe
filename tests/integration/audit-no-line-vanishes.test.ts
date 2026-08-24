/**
 * 第五十五條護欄：**抬升→產生之後，原文的任何一行都不准【消失】。**
 *
 * ## 這條規範從哪來
 *
 * 2026-08-24 修 `for … else:`／`while … else:` 時發現：那兩顆元件**沒有地方放
 * `else`**，而抬升那一路只是**沒去讀它**——於是整段 `else` 消失。產出的碼合法、
 * 5500 支測試全綠、而使用者的檔案少了一段。
 *
 * 蒸餾出來的判準（`experience.md`）是：
 *
 * > **一顆元件遇到自己放不下的子句時，要整顆誠實降級（原文逐字留著），
 * > 不可以收一半。**
 *
 * 而那條教訓自己寫著最後一句：「**而沒有東西在檢查其餘的元件有沒有照做**」。
 * 這一支就是那個東西。
 *
 * ## 量什麼——一個可數的量
 *
 * ```
 * 原文的每一行（去空白、非空）  ⊆  產出的每一行
 * ```
 *
 * **行可以搬家、可以重排縮排、可以被註解重排**（2026-08-24 起註解會從行末
 * 搬到自己一行）——而它**不可以不見**。
 *
 * 三種結局，只有中間那個是缺陷：
 *
 * | 結局 | 判定 |
 * |---|---|
 * | 完整收下（樹裡有那個結構） | 🟢 行都在 |
 * | **誠實降級**（`raw_code`／`unresolved`，原文逐字留著） | 🟢 行都在 |
 * | **收一半**（合法、少一段） | 🔴 **這一條在抓的東西** |
 *
 * 🔴 **它與第三十一條（形態的殘差）不同**：那一條問「有多少碼掉進 raw_code」，
 * 也就是**模型還沒長到哪裡**；這一條問「有沒有碼**兩邊都沒進去**」。
 * 降級在那一條是分子，在這一條是**合格**。
 *
 * ## 自我否證聲明 ⚠️ 先於量測寫下
 *
 * > **如果注入一個「故意把某個子句丟掉」的抬升策略，而這支測試仍然是綠的，
 * > 代表這條護欄壞了，不是世界很乾淨。**
 *
 * 判斷依據是下面兩支 `★ 注入`——它們餵的是**合成的輸入**（一段程式碼 ＋ 一個
 * 被包過的產生器），不是任何真實元件的狀態。
 * ⚠️ 而入口條件錨在**掃了幾段**（語料段數 ＋ 探針數）——那個量**不會因為
 * 缺陷被修好而變小**，所以它不會在成功的那天爛掉。
 *
 * ## 本護欄【不】檢測什麼
 *
 * - ❌ **不檢測語義正確**：行都在不代表產出的程式跑起來一樣
 *   （那是第三十一／五十條的事）。
 * - ❌ **不檢測順序**：行可以搬家（註解就會）。順序錯了它是綠的。
 * - ❌ **不檢測「多出來的行」**：只管消失，不管冗贅。
 * - ⚠️ **只認得【整行】**：一行裡少了一個關鍵字（`async def f()` → `def f()`）
 *   會被抓到（那一行整行不同），而 `f(a, b)` → `f(a)` **抓不到**。
 *   那一類要靠第五十條的來回比對。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { PYTHON_CORPUS } from '../assets/python-corpus'
import { liftPython, generatePython, createPythonLifter } from '../helpers/python-lift'
import { setDegradationLanguage } from '../../src/core/degradation-blocks'
import { PythonParser } from '../../src/languages/python/parser'
import { createTestLifter } from '../helpers/setup-lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { generateCode } from '../../src/core/projection/code-generator'
import { printReport, assertCorpus, assertRatchet } from '../helpers/guardrail'
import type { Lifter } from '../../src/core/lift/lifter'
import type { StylePreset, SemanticNode } from '../../src/core/types'
import apcs from '../../src/languages/cpp/styles/apcs.json'

/**
 * **子句形狀的探針**——語料裡沒有的形狀，護欄就保護不到。
 *
 * 🔴 這正是 `for … else:` 活那麼久的原因：**語料裡一段都沒有**。
 * 所以這一份清單只收「**帶子句／帶修飾詞**」的形狀——它們就是「收一半」的入口。
 */
const PY_PROBES: readonly (readonly [string, string])[] = [
  ['for…else', 'for i in xs:\n    pass\nelse:\n    print(1)\n'],
  ['while…else', 'while a:\n    a = 0\nelse:\n    print(1)\n'],
  ['try…finally（無 except）', 'try:\n    x = 1\nfinally:\n    x = 2\n'],
  ['try…except…else…finally', 'try:\n    x = 1\nexcept ValueError:\n    x = 2\nelse:\n    x = 3\nfinally:\n    x = 4\n'],
  ['async def', 'async def f():\n    return 1\n'],
  ['await', 'async def f():\n    await g()\n'],
  ['def 帶裝飾器', '@staticmethod\ndef f(x):\n    return x\n'],
  ['多重繼承', 'class D(A, B):\n    pass\n'],
  ['巢狀類別', 'class A:\n    class B:\n        pass\n'],
  ['with 多個項目', 'with open("a") as f, open("b") as g:\n    pass\n'],
  ['match…case', 'match x:\n    case 1:\n        print(1)\n    case _:\n        print(2)\n'],
  ['for…else 巢在 def 裡', 'def f(xs):\n    for i in xs:\n        pass\n    else:\n        return 0\n'],
  ['try 巢在 for 裡帶 finally', 'for i in xs:\n    try:\n        pass\n    finally:\n        print(i)\n'],
  ['nonlocal', 'def outer():\n    x = 1\n    def inner():\n        nonlocal x\n        x = 2\n    inner()\n'],
  ['星號參數', 'def f(*args, **kw):\n    return len(args)\n'],
  ['yield', 'def gen():\n    yield 1\n'],
  ['條件式 import', 'if a:\n    import os\nelse:\n    import sys\n'],
  ['帶 else 的三元 ＋ 推導式', 'ys = [x if x > 0 else -x for x in xs]\nprint(ys)\n'],
]

/**
 * C++ 那一半的探針。
 *
 * ⚠️ **一條護欄只跑一個語言的語料，它就只保護那一個語言**——第五十一條付過
 * 這個學費（`cpp_class_def` 沒有上下接點活了很久，因為那一支只跑 Python 語料）。
 */
const CPP_PROBES: readonly (readonly [string, string])[] = [
  ['do…while', 'int main() {\n    int i = 0;\n    do {\n        i++;\n    } while (i < 3);\n    return 0;\n}\n'],
  ['switch 帶 default', 'int main() {\n    int x = 1;\n    switch (x) {\n    case 1:\n        break;\n    default:\n        break;\n    }\n    return 0;\n}\n'],
  ['try…catch(...)', 'int main() {\n    try {\n        throw 1;\n    } catch (...) {\n        return 1;\n    }\n    return 0;\n}\n'],
  ['for 三段俱全 ＋ continue', 'int main() {\n    for (int i = 0; i < 3; i++) {\n        if (i == 1) continue;\n    }\n    return 0;\n}\n'],
  ['if…else if…else', 'int main() {\n    int x = 0;\n    if (x > 0) {\n        x = 1;\n    } else if (x < 0) {\n        x = 2;\n    } else {\n        x = 3;\n    }\n    return 0;\n}\n'],
  ['while 帶 break', 'int main() {\n    while (true) {\n        break;\n    }\n    return 0;\n}\n'],
  ['struct 帶方法', 'struct P {\n    int x;\n    int get() {\n        return x;\n    }\n};\n'],
  ['巢狀迴圈', 'int main() {\n    for (int i = 0; i < 2; i++) {\n        for (int j = 0; j < 2; j++) {\n            int k = i + j;\n        }\n    }\n    return 0;\n}\n'],
]

/**
 * 把一行拆成「程式碼」與「註解」兩半。
 *
 * ⚠️ **只在引號外面找註解符號**——`print("a#b")`／`cout << "http://x"`
 * 會被天真的 `indexOf('#')` 剖成兩半，而那會讓這條護欄**假報**。
 */
function split(line: string): { code: string; note: string | null } {
  let q: string | null = null
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (q) { if (c === '\\') i++; else if (c === q) q = null; continue }
    if (c === '"' || c === "'") { q = c; continue }
    const two = line.slice(i, i + 2)
    if (c === '#' || two === '//') {
      return { code: line.slice(0, i).trim(), note: line.slice(i + (c === '#' ? 1 : 2)).trim() }
    }
  }
  return { code: line.trim(), note: null }
}

/**
 * 🔴 **量的單位是語彙單元，不是行**——這一版是第一次跑之後改的，而理由值得留著：
 *
 * | 第一版（比行） | 假報成什麼 |
 * |---|---|
 * | `b**2` → `b ** 2` | 「這一行消失了」——**那是排版** |
 * | `if (c) continue;` → 補上大括號拆成三行 | 「消失了」——**那也是排版** |
 *
 * > **一個會因為換行與空白就說「東西不見了」的判準，報的是 diff，不是缺陷。**
 * > （與第三十九條「鍵不要用行號」同一個病。）
 *
 * 語彙單元比對無視排版而抓得到真正的消失：`else` 那一支被丟掉時，
 * `else`／`print`／`1` 都不見了。
 */
const tokens = (code: string): string[] =>
  code.match(/[A-Za-z_]\w*|\d+\.?\d*|"[^"]*"|'[^']*'|[^\s\w]/g) ?? []

/** 原文有而產出**少掉**的東西——語彙單元按【次數】比，註解按內容比。 */
function vanished(src: string, out: string): string[] {
  const count = (s: string): { tok: Map<string, number>; note: Set<string> } => {
    const tok = new Map<string, number>(); const note = new Set<string>()
    for (const raw of s.split('\n')) {
      const p = split(raw)
      for (const t of tokens(p.code)) tok.set(t, (tok.get(t) ?? 0) + 1)
      if (p.note) note.add(p.note)
    }
    return { tok, note }
  }
  const a = count(src), b = count(out)
  const gone: string[] = []
  for (const [t, n] of a.tok) {
    const m = b.tok.get(t) ?? 0
    // ⚠️ **少掉才算**——多出來不算（產生器補大括號、補 `pass` 都是合法的）
    if (m < n) gone.push(`${t} ×${n - m}`)
  }
  // ⚠️ 註解**只比內容不比位置**：搬家是正規化（2026-08-24 起），消失才是缺陷
  for (const c of a.note) if (!b.note.has(c)) gone.push(`（註解）${c}`)
  return gone
}

let tp: Parser
let cppLifter: Lifter
const style = apcs as unknown as StylePreset

beforeAll(async () => {
  const pyParser = new PythonParser()
  await pyParser.init(`${process.cwd()}/public`)
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  createPythonLifter()
  setDegradationLanguage('python')
  tp = new Parser()
  tp.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  cppLifter = createTestLifter()
  registerCppLanguage()
})

const cppRt = (src: string): string =>
  generateCode(cppLifter.lift(tp.parse(src)!.rootNode as never) as SemanticNode as never, 'cpp', style)

describe('第五十五條護欄：抬升→產生之後，有沒有哪一行安靜消失', () => {
  it('★ 注入①：一個「把子句丟掉」的產生器【必須】被抓到', () => {
    // 合成輸入：一段有 else 的碼 ＋ 一個把 else 那兩行吃掉的假產生器。
    // ⚠️ 這裡一個真實元件身分都不出現——**注入的輸入是合成的**。
    const src = 'for i in xs:\n    pass\nelse:\n    print(1)\n'
    const fake = src.split('\n').slice(0, 2).join('\n')
    expect(vanished(src, fake).sort(), '丟了一整支子句而護欄沒說話 → 判定壞了')
      .toEqual(['( ×1', ') ×1', '1 ×1', ': ×1', 'else ×1', 'print ×1'])
  })

  it('★ 注入②：一段【只是搬家／重排】的產出不可以被誤報', () => {
    // 註解從行末搬到自己一行（2026-08-24 起的正規化）——行都在，不准報。
    const src = 'x = 1  # 起始值\nif a:  # 為什麼\n    y = 2\n'
    const moved = '# 起始值\nx = 1\nif a:\n    # 為什麼\n    y = 2\n'
    expect(vanished(src, moved), '一個「什麼都報」的掃描器也會過注入①——這一支擋的是它')
      .toEqual([])
    // ⚠️ 而**逐字保留的降級**也必須是綠的：它是「還沒支援」，不是「弄丟了」
    expect(vanished(src, src), '降級把原文原樣留著 → 合格').toEqual([])
  })

  it('★ 入口條件：語料與探針真的餵進來了', () => {
    // ⚠️ 錨在**掃了幾段**上——這個量不會因為缺陷被修好而變小。
    expect(PYTHON_CORPUS.length, '語料是空的 → 下面的零是假的').toBeGreaterThan(50)
    expect(PY_PROBES.length + CPP_PROBES.length, '探針是空的 → 只剩語料，而語料沒有這些形狀')
      .toBeGreaterThan(20)
  })

  it('硬性零：沒有一行會安靜消失', async () => {
    const misses: string[] = []
    let scanned = 0

    for (const [name, code] of [...PYTHON_CORPUS, ...PY_PROBES]) {
      scanned++
      const tree = await liftPython(code)
      if (!tree) { misses.push(`${name}：lift 回 null`); continue }
      const gone = vanished(code, generatePython(tree))
      if (gone.length > 0) misses.push(`py ${name}\n        少了 ${JSON.stringify(gone.slice(0, 3))}`)
    }
    for (const [name, code] of CPP_PROBES) {
      scanned++
      const gone = vanished(code, cppRt(code))
      if (gone.length > 0) misses.push(`cpp ${name}\n        少了 ${JSON.stringify(gone.slice(0, 3))}`)
    }

    printReport('抬升→產生之後有沒有哪一行消失', [
      `掃描   ${scanned} 段（語料 ${PYTHON_CORPUS.length} ＋ 探針 ${PY_PROBES.length + CPP_PROBES.length}）`,
      `消失   ${misses.length} 段  ← 硬性零`,
      ...misses.map((m) => `  ✘ ${m}`),
      '',
      '⚠️ 三種結局只有中間那個是缺陷：完整收下 🟢／誠實降級 🟢／**收一半** 🔴',
      '   降級在第三十一條是分子，在這裡是合格——兩條問的是不同的問題。',
    ])

    assertCorpus([
      ['語料段數', PYTHON_CORPUS.length],
      ['探針數', PY_PROBES.length + CPP_PROBES.length],
    ], 'no-line-vanishes')
    assertRatchet([['消失', misses.length]], 'no-line-vanishes', { detail: misses })
    expect(misses, '一行安靜消失＝使用者的檔案少了一段，而產出的碼合法').toEqual([])
  }, 120_000)
})
