/**
 * Fuzz Test Regression: C++ Arrays & Pointers
 * Generated from Phase 4 fuzz testing (2026-03-12)
 *
 * Tests lift -> generate -> roundtrip stability for programs
 * exercising arrays, pointers, references, and dynamic allocation.
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import type { Lifter } from '../../src/core/lift/lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { generateCode } from '../../src/core/projection/code-generator'
import { setupTestRenderer } from '../helpers/setup-renderer'
import { createTestLifter } from '../helpers/setup-lifter'
import { expectCellaOut } from '../helpers/cella-run'
import type { StylePreset } from '../../src/core/types'

const style: StylePreset = {
  id: 'apcs',
  name: { 'zh-TW': 'APCS', en: 'APCS' },
  io_style: 'cout',
  naming_convention: 'camelCase',
  indent_size: 4,
  brace_style: 'K&R',
  namespace_style: 'using',
  header_style: 'individual',
}

let tsParser: Parser
let lifter: Lifter

beforeAll(async () => {
  await Parser.init({
    locateFile: (scriptName: string) => `${process.cwd()}/public/${scriptName}`,
  })
  tsParser = new Parser()
  const lang = await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`)
  tsParser.setLanguage(lang)
  lifter = createTestLifter()
  registerCppLanguage()
  setupTestRenderer()
})

/**
 * spec 203（重構 6c-2e）：執行的判準從 JS 直譯器換成 Cella（產品同一條 lift → formalize → 判決），accept 且輸出逐字相同才通過。
 * 期望值是本機 `g++ -std=c++17` 編譯執行的輸出（2026-11-02 實測）。原本的斷言是 `toContain` 幾個數字——
 * 換成逐字比對：`toContain('0')` 對任何含 0 的輸出都綠（例如 `100`），那是假綠的形狀。
 */
const runExpect = (code: string, expected: string): Promise<unknown> => expectCellaOut(code, expected)

function roundTrip(code: string): string {
  const tree = tsParser.parse(code)
  const sem = lifter.lift(tree.rootNode as any)
  expect(sem).not.toBeNull()
  return generateCode(sem!, 'cpp', style)
}

// ─── Fuzz 1: Array initialization with values ───
describe('fuzz: array initialization with values', () => {
  const code = `#include <iostream>
using namespace std;
int main() {
    int a[5] = {10, 20, 30, 40, 50};
    int sum = 0;
    for (int i = 0; i < 5; i++) {
        sum = sum + a[i];
    }
    cout << sum << endl;
    return 0;
}`

  // BUG: initializer list values are lost during lift

  it('roundtrip is stable', () => {
    const gen1 = roundTrip(code)
    const gen2 = roundTrip(gen1)
    expect(gen1).toBe(gen2)
  })
})

// ─── Fuzz 2: Array boundary access (no OOB) ───
describe('fuzz: array boundary access patterns', () => {
  const code = `#include <iostream>
using namespace std;
int main() {
    int arr[10];
    for (int i = 0; i < 10; i++) {
        arr[i] = i * i;
    }
    cout << arr[0] << endl;
    cout << arr[4] << endl;
    cout << arr[9] << endl;
    return 0;
}`

  it('executes correctly', async () => {
    await runExpect(code, '0\n16\n81\n')
  })

  it('roundtrip is stable', () => {
    const gen1 = roundTrip(code)
    const gen2 = roundTrip(gen1)
    expect(gen1).toBe(gen2)
  })
})

// ─── Fuzz 3: Pointer arithmetic with array base ───
describe('fuzz: pointer arithmetic with array base', () => {
  const code = `#include <iostream>
using namespace std;
int main() {
    int arr[5] = {2, 4, 6, 8, 10};
    int* p = arr;
    cout << *p << endl;
    p = p + 2;
    cout << *p << endl;
    p = p + 2;
    cout << *p << endl;
    return 0;
}`

  // BUG: initializer list values lost, pointer arithmetic itself is correct

  it('roundtrip is stable', () => {
    const gen1 = roundTrip(code)
    const gen2 = roundTrip(gen1)
    expect(gen1).toBe(gen2)
  })
})

// ─── Fuzz 4: Pass array to function by pointer ───
describe('fuzz: pass array to function by pointer', () => {
  const code = `#include <iostream>
using namespace std;
void fillArray(int* arr, int n) {
    for (int i = 0; i < n; i++) {
        arr[i] = (i + 1) * 3;
    }
}
int main() {
    int data[4];
    fillArray(data, 4);
    for (int i = 0; i < 4; i++) {
        cout << data[i] << " ";
    }
    cout << endl;
    return 0;
}`

  it('executes correctly', async () => {
    await runExpect(code, '3 6 9 12 \n')
  })

  it('roundtrip is stable', () => {
    const gen1 = roundTrip(code)
    const gen2 = roundTrip(gen1)
    expect(gen1).toBe(gen2)
  })
})

// ─── Fuzz 5: Multiple pointers to same data ───
describe('fuzz: multiple pointers to same data', () => {
  const code = `#include <iostream>
using namespace std;
int main() {
    int x = 42;
    int* p1 = &x;
    int* p2 = &x;
    *p1 = *p1 + 8;
    cout << *p2 << endl;
    *p2 = *p2 * 2;
    cout << *p1 << endl;
    cout << x << endl;
    return 0;
}`

  it('executes correctly', async () => {
    await runExpect(code, '50\n100\n100\n')
  })

  it('roundtrip is stable', () => {
    const gen1 = roundTrip(code)
    const gen2 = roundTrip(gen1)
    expect(gen1).toBe(gen2)
  })
})

// ─── Fuzz 6: new/delete patterns ───
describe('fuzz: new/delete with computation', () => {
  const code = `#include <iostream>
using namespace std;
int main() {
    int* a = new int;
    int* b = new int;
    *a = 15;
    *b = 25;
    int sum = *a + *b;
    cout << sum << endl;
    *a = sum;
    cout << *a << endl;
    delete a;
    delete b;
    return 0;
}`

  // spec 203：原本是 it.todo（JS 直譯器沒有 new／delete 的語義）——Cella 有，g++ 印 40 40
  it('executes correctly', async () => {
    await runExpect(code, '40\n40\n')
  })

  it('roundtrip is stable', () => {
    const gen1 = roundTrip(code)
    const gen2 = roundTrip(gen1)
    expect(gen1).toBe(gen2)
  })
})

// ─── Fuzz 7: malloc/free patterns ───
describe('fuzz: malloc/free patterns', () => {
  const code = `#include <iostream>
#include <cstdlib>
using namespace std;
int main() {
    int* arr = (int*)malloc(3 * sizeof(int));
    arr[0] = 100;
    arr[1] = 200;
    arr[2] = 300;
    int total = arr[0] + arr[1] + arr[2];
    cout << total << endl;
    free(arr);
    return 0;
}`

  // spec 203：原本是 it.todo（JS 直譯器沒有 malloc／free 的語義）——Cella 有，g++ 印 600
  it('executes correctly', async () => {
    await runExpect(code, '600\n')
  })

  it('roundtrip is stable', () => {
    const gen1 = roundTrip(code)
    const gen2 = roundTrip(gen1)
    expect(gen1).toBe(gen2)
  })
})

// ─── Fuzz 8: Address-of and dereference chains ───
describe('fuzz: address-of and dereference chains', () => {
  const code = `#include <iostream>
using namespace std;
int main() {
    int x = 99;
    int* p = &x;
    cout << *&x << endl;
    cout << *p << endl;
    cout << **&p << endl;
    return 0;
}`

  it('executes correctly', async () => {
    await runExpect(code, '99\n99\n99\n')
  })

  it('roundtrip is stable', () => {
    const gen1 = roundTrip(code)
    const gen2 = roundTrip(gen1)
    expect(gen1).toBe(gen2)
  })
})

// ─── Fuzz 9: Array of pointers ───
describe('fuzz: array of pointers', () => {
  const code = `#include <iostream>
using namespace std;
int main() {
    int a = 1;
    int b = 2;
    int c = 3;
    int* ptrs[3];
    ptrs[0] = &a;
    ptrs[1] = &b;
    ptrs[2] = &c;
    int sum = 0;
    for (int i = 0; i < 3; i++) {
        sum = sum + *ptrs[i];
    }
    cout << sum << endl;
    return 0;
}`

    // 這個 `BUG:` 註解在 084 修好了——**兩個的根因是同一種**：
  // 語法樹的 `pointer_declarator` 包了一層，而辨識器沒有下鑽。
  it('★ 來回轉換保住指標陣列的名字與大小', () => {
    expect(roundTrip(code)).toContain('int* ptrs[3]')
  })

  it('★ 執行結果正確——期望值由 g++ 實際編譯執行決定，不心算', async () => {
    await runExpect(code, '6\n')
  })
})

// ─── Fuzz 10: Function returning pointer (to global) ───
describe('fuzz: function returning pointer to global', () => {
  const code = `#include <iostream>
using namespace std;
int globalVal = 777;
int* getGlobalPtr() {
    return &globalVal;
}
int main() {
    int* p = getGlobalPtr();
    cout << *p << endl;
    *p = 888;
    cout << globalVal << endl;
    return 0;
}`

    // 這個 `BUG:` 註解在 084 修好了——**兩個的根因是同一種**：
  // 語法樹的 `pointer_declarator` 包了一層，而辨識器沒有下鑽。
  it('★ 來回轉換保住回傳指標的型別', () => {
    expect(roundTrip(code)).toContain('int* getGlobalPtr(')
  })

  it('★ 執行結果正確——期望值由 g++ 實際編譯執行決定，不心算', async () => {
    await runExpect(code, '777\n888\n')
  })
})

// ─── Known issues summary ───
describe('曾經的已知問題：陣列與指標', () => {
  // 這個區塊原本只有一支 `it.todo`，阻斷者寫著「陣列初始化列表在辨識時遺失」。
  // **082 證明那個阻斷者早就不存在**（050 修好了，而沒有人回頭看）。
  //
  // 留一個空的 describe 是殼——它看起來覆蓋了一個情形。改成真的回歸測試，
  // 完整程式在 `tests/integration/array-initializer-programs.test.ts`。
  it('★ 陣列初始化列表：來回轉換與執行都正確', async () => {
    const code = 'int main(){ int a[4] = {3, 1, 4, 1}; int s = 0; for (int i=0;i<4;i++){ s = s + a[i]; } cout << s; return 0; }'
    expect(roundTrip(`#include <iostream>
using namespace std;
${code}`)).toMatch(/\{[^}]*,[^}]*\}/)
    // 初始值沒有進到陣列裡的話不是 9（讀到不定值會被判 reject）
    await runExpect(`#include <iostream>
using namespace std;
${code}`, '9')
  })
})
