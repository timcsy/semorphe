/**
 * **C++ 語法形狀的補課**——第五十三條護欄那一維點名的九格（2026-08-23）。
 *
 * ## 為什麼有這一支
 *
 * 第五十三條（語料自己夠不夠）把**文法自己宣告的節點型別**當全集，
 * 而 C++ 那一維有九格是「該補進語料」——**沒有人看過它們**。
 * 而「沒人看過」與「看過並降級」在任何數字上長得一模一樣。
 *
 * ## 補課的第一輪就抓到三個缺陷
 *
 * | 形狀 | 症狀 |
 * |---|---|
 * | `int add(int a, int b = 0)` | 那一格參數**整個不見**，而主體照樣用 `b`——**產出的碼編不過** |
 * | 同上 | 就算產得回去，`add(1)` 算出的是型別的零值不是 10——**答案錯** |
 * | `#ifdef X … #endif` | 主體與 `#endif` **產不回去**——來回一趟少了幾行 |
 * | `"ab" "cd"` | 整段降級（Python 那側早就收了，而 C++ 這側缺同一個形狀） |
 *
 * 三個都修了；這一支把那些形狀**釘住**，並且把還沒支援的那幾個
 * **釘成「誠實降級」**——它們今天是可見的灰色，不是隱形的洞。
 *
 * ⚠️ **這個檔同時是語料**：第三十一條與第五十三條都掃 `tests/integration/*.test.ts`
 * 裡的反引號片段。所以下面每一段程式碼**要是完整、可編譯的 C++**。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { generateCode } from '../../src/core/projection/code-generator'
import { SemanticInterpreter } from '../../src/interpreter/interpreter'
import { runCpp, hasReferenceCompiler } from '../helpers/run-cpp'
import type { Lifter } from '../../src/core/lift/lifter'
import type { StylePreset, SemanticNode } from '../../src/core/types'
import apcs from '../../src/languages/cpp/styles/apcs.json'

let tp: Parser
let lifter: Lifter
const style = apcs as unknown as StylePreset

beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  tp = new Parser()
  tp.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  lifter = createTestLifter()
  registerCppLanguage()
})

const lift = (src: string): SemanticNode => lifter.lift(tp.parse(src)!.rootNode as never) as SemanticNode
const rt = (src: string): string => generateCode(lift(src) as never, 'cpp', style)
const idsOf = (n: SemanticNode, out: string[] = []): string[] => {
  out.push(n.componentId)
  for (const ks of Object.values(n.children ?? {})) for (const k of ks) idsOf(k, out)
  return out
}
async function run(src: string): Promise<string> {
  const interp = new SemanticInterpreter({ maxSteps: 200000 })
  await interp.execute(lift(src) as never)
  return interp.getOutput().join('')
}

// ─────────────────────────────────────────────────────────
// 收得下的四個形狀——**身分、來回、答案**三項都要
// ─────────────────────────────────────────────────────────

const DEFAULT_PARAM = `#include <iostream>
using namespace std;

int add(int a, int b = 10) {
    return a + b;
}

int main() {
    cout << add(1) << " " << add(1, 2) << endl;
    return 0;
}`

const CONCAT_STRING = `#include <iostream>
#include <string>
using namespace std;

int main() {
    string s = "ab" "cd";
    cout << s << " " << s.size() << endl;
    return 0;
}`

const LAMBDA_CAPTURE_INIT = `#include <iostream>
using namespace std;

int main() {
    int y = 5;
    auto f = [x = y]() { return x * 2; };
    cout << f() << endl;
    return 0;
}`

const PURE_VIRTUAL = `#include <iostream>
using namespace std;

struct Shape {
    virtual double area() = 0;
};

struct Square : public Shape {
    double side;
    double area() override { return side * side; }
};

int main() {
    Square s;
    s.side = 3;
    cout << s.area() << endl;
    return 0;
}`

describe('C++ 形狀補課：收得下的那幾個', () => {
  it('🔴 帶預設值的參數：那一格本來整個不見，而主體照樣用它', async () => {
    const ids = idsOf(lift(DEFAULT_PARAM))
    expect(ids, '一段都沒抬升起來——負向斷言會空過').toContain('cpp:func_def')
    expect(ids).not.toContain('raw_code')

    // 來回：簽名上的 `= 10` 要在
    expect(rt(DEFAULT_PARAM)).toContain('int add(int a, int b = 10)')

    // 🔴 **答案**：少給引數時要用宣告的預設值，不是型別的零值
    expect(await run(DEFAULT_PARAM)).toBe('11 3\n')
  })

  it('★ 與參照編譯器對答案（`g++` 說了算）', async () => {
    if (!hasReferenceCompiler()) return
    expect(runCpp(DEFAULT_PARAM)).toBe(await run(DEFAULT_PARAM))
  })

  it('相鄰的字串字面是【一個】字串，而寫法要留住', async () => {
    const ids = idsOf(lift(CONCAT_STRING))
    expect(ids).toContain('cpp:literal_string')
    expect(ids).not.toContain('unresolved')
    // ⚠️ 產回去仍然是兩段——**語義是一個，而寫法是使用者的**
    expect(rt(CONCAT_STRING)).toContain('"ab" "cd"')
    expect(await run(CONCAT_STRING)).toBe('abcd 4\n')
  })

  it('lambda 的擷取初始化（`[x = y]`）認得出來，也產得回去', () => {
    const ids = idsOf(lift(LAMBDA_CAPTURE_INIT))
    expect(ids).toContain('cpp:lambda')
    expect(ids).not.toContain('raw_code')
    expect(rt(LAMBDA_CAPTURE_INIT)).toContain('[x = y]')
  })

  it('純虛擬（`= 0`）——**元件早就有，而語料裡一段都沒有**', () => {
    const ids = idsOf(lift(PURE_VIRTUAL))
    expect(ids, '宣告了卻沒有人跑過的那一顆').toContain('cpp:method_virtual_pure')
    expect(rt(PURE_VIRTUAL)).toContain('virtual double area() = 0;')
  })
})

// ─────────────────────────────────────────────────────────
// 還沒收的三個形狀——**要是「看過並降級」，不是「沒人看過」**
// ─────────────────────────────────────────────────────────

const PREPROC_IF = `#include <iostream>
#define LEVEL 2
#if LEVEL > 1
const int mode = 1;
#elif LEVEL == 1
const int mode = 0;
#else
const int mode = -1;
#endif

int main() {
    std::cout << mode << std::endl;
    return 0;
}`

const PREPROC_ELIFDEF = `#include <iostream>
#define FAST 1
#ifdef FAST
const int mode = 1;
#elifdef SLOW
const int mode = 0;
#else
const int mode = -1;
#endif

int main() {
    std::cout << mode << std::endl;
    return 0;
}`

const UNION = `#include <iostream>

union Value {
    int i;
    float f;
};

int main() {
    Value v;
    v.i = 3;
    std::cout << v.i << std::endl;
    return 0;
}`

describe('C++ 形狀補課：還沒收的那幾個要【誠實降級】', () => {
  it('⚠️ `#if`／`#elif`／`#else`：認不出來 → 灰色方塊，而**原文一字不差地留著**', () => {
    const ids = idsOf(lift(PREPROC_IF))
    expect(ids, '整段真的抬升到東西了').toContain('cpp:define')   // ← 正向錨點
    expect(ids, '它就是要走降級——這一條釘的是「看過並降級」').toContain('unresolved')
    // 🔴 **降級不等於丟掉**：產回去的碼要能編
    const out = rt(PREPROC_IF)
    expect(out).toContain('#if LEVEL > 1')
    expect(out).toContain('#elif LEVEL == 1')
    expect(out).toContain('#endif')
  })

  it('⚠️ `#elifdef`（C++23 才有的那一個）：同樣走降級，而原文留著', () => {
    const ids = idsOf(lift(PREPROC_ELIFDEF))
    expect(ids, '整段真的抬升到東西了').toContain('cpp:define')   // ← 正向錨點
    expect(ids).toContain('unresolved')
    expect(rt(PREPROC_ELIFDEF)).toContain('#elifdef SLOW')
  })

  it('⚠️ `union`：認不出來 → 灰色方塊，而原文留著', () => {
    const ids = idsOf(lift(UNION))
    expect(ids, '整段真的抬升到東西了').toContain('cpp:func_def')  // ← 正向錨點
    expect(ids).toContain('raw_code')
    expect(rt(UNION)).toContain('union Value')
  })
})
