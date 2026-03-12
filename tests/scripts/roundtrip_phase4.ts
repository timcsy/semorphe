/**
 * Phase 4 Roundtrip Runner: Arrays & Pointers
 * Lifts C++ code → semantic tree → generates C++ code → verifies stability
 */
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { generateCode } from '../../src/core/projection/code-generator'
import type { StylePreset, SemanticNode } from '../../src/core/types'
import { writeFileSync, mkdirSync } from 'fs'

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

const testPrograms: Record<string, string> = {
  t01_array_declare_access: `#include <iostream>
using namespace std;
int main() {
    int arr[5];
    arr[0] = 10;
    arr[1] = 20;
    arr[2] = 30;
    cout << arr[0] + arr[1] + arr[2] << endl;
    return 0;
}`,
  t02_array_for_loop: `#include <iostream>
using namespace std;
int main() {
    int arr[5];
    for (int i = 0; i < 5; i++) {
        arr[i] = i * i;
    }
    for (int i = 0; i < 5; i++) {
        cout << arr[i] << " ";
    }
    cout << endl;
    return 0;
}`,
  t03_pointer_declare_deref: `#include <iostream>
using namespace std;
int main() {
    int x = 42;
    int* p = &x;
    cout << *p << endl;
    *p = 100;
    cout << x << endl;
    return 0;
}`,
  t04_address_of: `#include <iostream>
using namespace std;
void addTen(int* p) {
    *p = *p + 10;
}
int main() {
    int x = 5;
    addTen(&x);
    cout << x << endl;
    return 0;
}`,
  t05_reference: `#include <iostream>
using namespace std;
void swap(int& a, int& b) {
    int temp = a;
    a = b;
    b = temp;
}
int main() {
    int x = 3;
    int y = 7;
    swap(x, y);
    cout << x << " " << y << endl;
    return 0;
}`,
  t06_2d_array: `#include <iostream>
using namespace std;
int main() {
    int arr[2][3];
    arr[0][0] = 1;
    arr[0][1] = 2;
    arr[0][2] = 3;
    arr[1][0] = 4;
    arr[1][1] = 5;
    arr[1][2] = 6;
    int sum = 0;
    for (int i = 0; i < 2; i++) {
        for (int j = 0; j < 3; j++) {
            sum = sum + arr[i][j];
        }
    }
    cout << sum << endl;
    return 0;
}`,
  t07_new_delete: `#include <iostream>
using namespace std;
int main() {
    int* p = new int;
    *p = 42;
    cout << *p << endl;
    delete p;
    return 0;
}`,
  t08_pointer_arithmetic: `#include <iostream>
using namespace std;
int main() {
    int x = 10;
    int* ptr = &x;
    *ptr = *ptr + 5;
    cout << x << endl;
    return 0;
}`,
  t09_array_sum_function: `#include <iostream>
using namespace std;
int sumArray(int arr[], int n) {
    int s = 0;
    for (int i = 0; i < n; i++) {
        s = s + arr[i];
    }
    return s;
}
int main() {
    int a[4];
    a[0] = 1;
    a[1] = 2;
    a[2] = 3;
    a[3] = 4;
    cout << sumArray(a, 4) << endl;
    return 0;
}`,
  t10_reference_variable: `#include <iostream>
using namespace std;
int main() {
    int x = 10;
    int& ref = x;
    ref = 20;
    cout << x << endl;
    return 0;
}`,
}

function countNodes(node: SemanticNode): { total: number; raw: number } {
  let total = 1
  let raw = 0
  if (node.concept === 'cpp_raw_code' || node.concept === 'cpp_raw_expression' || node.concept === 'unresolved') {
    raw++
  }
  for (const children of Object.values(node.children || {})) {
    for (const child of children) {
      const c = countNodes(child)
      total += c.total
      raw += c.raw
    }
  }
  return { total, raw }
}

async function main() {
  await Parser.init({
    locateFile: (scriptName: string) => `${process.cwd()}/public/${scriptName}`,
  })
  const parser = new Parser()
  const lang = await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`)
  parser.setLanguage(lang)

  const lifter = createTestLifter()
  registerCppLanguage()

  mkdirSync('/tmp/semorphe-roundtrip', { recursive: true })

  const results: { id: string; status: string; detail: string }[] = []

  for (const [id, code] of Object.entries(testPrograms)) {
    try {
      const tree = parser.parse(code)
      const sem = lifter.lift(tree.rootNode as any)
      if (!sem) {
        results.push({ id, status: 'LIFT_FAIL', detail: 'Lifter returned null' })
        continue
      }

      const { total, raw } = countNodes(sem)
      const generated = generateCode(sem, 'cpp', style)

      writeFileSync(`/tmp/semorphe-roundtrip/${id}_original.cpp`, code)
      writeFileSync(`/tmp/semorphe-roundtrip/${id}_generated.cpp`, generated)

      // Second roundtrip: lift generated code again
      const tree2 = parser.parse(generated)
      const sem2 = lifter.lift(tree2.rootNode as any)
      if (!sem2) {
        results.push({ id, status: 'ROUNDTRIP_DRIFT', detail: 'Second lift returned null' })
        continue
      }
      const generated2 = generateCode(sem2, 'cpp', style)
      writeFileSync(`/tmp/semorphe-roundtrip/${id}_generated2.cpp`, generated2)

      const drift = generated !== generated2

      if (raw > 0) {
        results.push({ id, status: 'DEGRADED', detail: `${raw}/${total} raw/unresolved nodes` })
      } else if (drift) {
        results.push({ id, status: 'ROUNDTRIP_DRIFT', detail: `Code differs after 2nd roundtrip` })
      } else {
        results.push({ id, status: 'PASS', detail: `${total} nodes, clean tree, stable` })
      }
    } catch (e: any) {
      results.push({ id, status: 'ERROR', detail: e.message?.substring(0, 100) })
    }
  }

  console.log('\n## Round-Trip Test Results (C++ Arrays & Pointers)\n')
  console.log('| # | Program | Result | Detail |')
  console.log('|---|---------|--------|--------|')
  for (let i = 0; i < results.length; i++) {
    const r = results[i]
    const sym = r.status === 'PASS' ? '✅' : r.status === 'DEGRADED' ? '🟡' : '❌'
    console.log(`| ${i + 1} | ${r.id} | ${sym} ${r.status} | ${r.detail} |`)
  }

  const passCount = results.filter(r => r.status === 'PASS').length
  console.log(`\nSummary: ${passCount}/${results.length} PASS`)
  writeFileSync('/tmp/semorphe-roundtrip/phase4_results.json', JSON.stringify(results, null, 2))
}

main().catch(console.error)
