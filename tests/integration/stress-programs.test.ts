/**
 * Stress Tests — Common Programming Problems & Edge Cases
 *
 * Tests the full pipeline objectively: code → lift → render → generate → interpret
 * Covers typical student programs, competitive programming patterns, and edge cases.
 * Written WITHOUT knowledge of internal implementation details.
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import type { Lifter } from '../../src/core/lift/lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { generateCode } from '../../src/core/projection/code-generator'
import { renderToBlocklyState } from '../../src/core/projection/block-renderer'
import { setupTestRenderer } from '../helpers/setup-renderer'
import { SemanticInterpreter } from '../../src/interpreter/interpreter'
import { createNode } from '../../src/core/semantic-tree'
import type { SemanticNode, StylePreset } from '../../src/core/types'

// ─── Test Infrastructure ───

const coutStyle: StylePreset = {
  id: 'apcs', name: { 'zh-TW': 'APCS', en: 'APCS' },
  io_style: 'cout', naming_convention: 'camelCase', indent_size: 4,
  brace_style: 'K&R', namespace_style: 'using', header_style: 'individual',
}

const printfStyle: StylePreset = {
  id: 'competitive', name: { 'zh-TW': '競賽', en: 'Competitive' },
  io_style: 'printf', naming_convention: 'snake_case', indent_size: 4,
  brace_style: 'K&R', namespace_style: 'using', header_style: 'bits',
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

function lift(code: string) {
  const tree = tsParser.parse(code)
  return lifter.lift(tree.rootNode as any)
}

function roundTrip(code: string, style: StylePreset = coutStyle): string {
  const sem = lift(code)
  expect(sem).not.toBeNull()
  return generateCode(sem!, 'cpp', style)
}

function blocks(code: string) {
  const sem = lift(code)
  expect(sem).not.toBeNull()
  return renderToBlocklyState(sem!)
}

function makeProgram(body: SemanticNode[]): SemanticNode {
  return createNode('program', {}, { body })
}

async function run(body: SemanticNode[], stdin: string[] = []) {
  const interp = new SemanticInterpreter({ maxSteps: 500000 })
  await interp.execute(makeProgram(body), stdin)
  return interp
}

async function runCode(code: string, stdin: string[] = [], style: StylePreset = coutStyle) {
  const sem = lift(code)
  expect(sem).not.toBeNull()
  const interp = new SemanticInterpreter({ maxSteps: 500000 })
  await interp.execute(sem!, stdin)
  return interp
}

// ─── 1. Common Beginner Programs ───

describe('Beginner Programs', () => {
  it('A+B Problem: read two integers, print sum', async () => {
    const interp = await runCode(`
      #include <iostream>
      using namespace std;
      int main() {
        int a, b;
        cin >> a >> b;
        cout << a + b << endl;
        return 0;
      }
    `, ['3', '7'])
    expect(interp.getOutput().join('')).toBe('10\n')
  })

  it('A+B with printf/scanf style', async () => {
    const interp = await runCode(`
      #include <cstdio>
      using namespace std;
      int main() {
        int a, b;
        scanf("%d", &a);
        scanf("%d", &b);
        printf("%d\\n", a + b);
        return 0;
      }
    `, ['3', '7'])
    expect(interp.getOutput().join('')).toBe('10\n')
  })

  it('swap two variables', async () => {
    const interp = await runCode(`
      #include <iostream>
      using namespace std;
      int main() {
        int a, b, temp;
        cin >> a >> b;
        temp = a;
        a = b;
        b = temp;
        cout << a << " " << b << endl;
        return 0;
      }
    `, ['5', '3'])
    // After swap: a=3, b=5
    expect(interp.getOutput().join('')).toContain('3')
    expect(interp.getOutput().join('')).toContain('5')
  })

  it('absolute value using if-else', async () => {
    const interp = await runCode(`
      #include <iostream>
      using namespace std;
      int main() {
        int x;
        cin >> x;
        if (x < 0) {
          x = -x;
        }
        cout << x << endl;
        return 0;
      }
    `, ['-42'])
    expect(interp.getOutput().join('')).toContain('42')
  })

  it('max of three numbers', async () => {
    const interp = await runCode(`
      #include <iostream>
      using namespace std;
      int main() {
        int a, b, c;
        cin >> a >> b >> c;
        int mx = a;
        if (b > mx) { mx = b; }
        if (c > mx) { mx = c; }
        cout << mx << endl;
        return 0;
      }
    `, ['7', '15', '3'])
    expect(interp.getOutput().join('')).toContain('15')
  })
})

// ─── 2. Loop-Heavy Programs ───

describe('Loop Programs', () => {
  it('sum 1 to N', async () => {
    const interp = await runCode(`
      #include <iostream>
      using namespace std;
      int main() {
        int n;
        cin >> n;
        int sum = 0;
        for (int i = 1; i <= n; i++) {
          sum += i;
        }
        cout << sum << endl;
        return 0;
      }
    `, ['100'])
    expect(interp.getOutput().join('')).toContain('5050')
  })

  it('multiplication table (nested loops)', async () => {
    const interp = await runCode(`
      #include <cstdio>
      using namespace std;
      int main() {
        for (int i = 1; i <= 3; i++) {
          for (int j = 1; j <= 3; j++) {
            printf("%d ", i * j);
          }
          printf("\\n");
        }
        return 0;
      }
    `)
    const output = interp.getOutput().join('')
    expect(output).toContain('1 2 3')
    expect(output).toContain('2 4 6')
    expect(output).toContain('3 6 9')
  })

  it('count digits of a number', async () => {
    const interp = await runCode(`
      #include <iostream>
      using namespace std;
      int main() {
        int n;
        cin >> n;
        int count = 0;
        while (n > 0) {
          count++;
          n = n / 10;
        }
        cout << count << endl;
        return 0;
      }
    `, ['12345'])
    expect(interp.getOutput().join('')).toContain('5')
  })

  it('reverse a number', async () => {
    const interp = await runCode(`
      #include <iostream>
      using namespace std;
      int main() {
        int n;
        cin >> n;
        int rev = 0;
        while (n > 0) {
          rev = rev * 10 + n % 10;
          n = n / 10;
        }
        cout << rev << endl;
        return 0;
      }
    `, ['1234'])
    expect(interp.getOutput().join('')).toContain('4321')
  })

  it('while loop with break (find first divisor)', async () => {
    const interp = await runCode(`
      #include <iostream>
      using namespace std;
      int main() {
        int n;
        cin >> n;
        int d = 2;
        while (d <= n) {
          if (n % d == 0) {
            break;
          }
          d++;
        }
        cout << d << endl;
        return 0;
      }
    `, ['15'])
    expect(interp.getOutput().join('')).toContain('3')
  })

  it('for loop with continue', async () => {
    const interp = await runCode(`
      #include <iostream>
      using namespace std;
      int main() {
        int sum = 0;
        for (int i = 1; i <= 10; i++) {
          if (i % 2 == 0) {
            continue;
          }
          sum += i;
        }
        cout << sum << endl;
        return 0;
      }
    `)
    // 1+3+5+7+9 = 25
    expect(interp.getOutput().join('')).toContain('25')
  })
})

// ─── 3. Array Programs ───

describe('Array Programs', () => {
  it('find max in array', async () => {
    const interp = await runCode(`
      #include <iostream>
      using namespace std;
      int main() {
        int n;
        cin >> n;
        int arr[100];
        for (int i = 0; i < n; i++) {
          cin >> arr[i];
        }
        int mx = arr[0];
        for (int i = 1; i < n; i++) {
          if (arr[i] > mx) {
            mx = arr[i];
          }
        }
        cout << mx << endl;
        return 0;
      }
    `, ['5', '3', '7', '1', '9', '4'])
    expect(interp.getOutput().join('')).toContain('9')
  })

  it('reverse array and print', async () => {
    const interp = await runCode(`
      #include <iostream>
      using namespace std;
      int main() {
        int n;
        cin >> n;
        int arr[100];
        for (int i = 0; i < n; i++) {
          cin >> arr[i];
        }
        for (int i = n - 1; i >= 0; i--) {
          cout << arr[i] << " ";
        }
        cout << endl;
        return 0;
      }
    `, ['4', '10', '20', '30', '40'])
    const output = interp.getOutput().join('')
    expect(output).toContain('40')
    expect(output).toContain('30')
    expect(output).toContain('20')
    expect(output).toContain('10')
  })

  it('bubble sort', async () => {
    const interp = await runCode(`
      #include <iostream>
      using namespace std;
      int main() {
        int n;
        cin >> n;
        int arr[100];
        for (int i = 0; i < n; i++) {
          cin >> arr[i];
        }
        for (int i = 0; i < n - 1; i++) {
          for (int j = 0; j < n - i - 1; j++) {
            if (arr[j] > arr[j + 1]) {
              int temp = arr[j];
              arr[j] = arr[j + 1];
              arr[j + 1] = temp;
            }
          }
        }
        for (int i = 0; i < n; i++) {
          cout << arr[i] << " ";
        }
        cout << endl;
        return 0;
      }
    `, ['5', '5', '3', '8', '1', '2'])
    const output = interp.getOutput().join('')
    expect(output).toContain('1 2 3 5 8')
  })
})

// ─── 4. Function Programs ───

describe('Function Programs', () => {
  it('GCD function', async () => {
    const interp = await runCode(`
      #include <iostream>
      using namespace std;
      int gcd(int a, int b) {
        while (b != 0) {
          int t = b;
          b = a % b;
          a = t;
        }
        return a;
      }
      int main() {
        int a, b;
        cin >> a >> b;
        cout << gcd(a, b) << endl;
        return 0;
      }
    `, ['48', '18'])
    expect(interp.getOutput().join('')).toContain('6')
  })

  it('recursive fibonacci', async () => {
    const interp = await runCode(`
      #include <iostream>
      using namespace std;
      int fib(int n) {
        if (n <= 1) {
          return n;
        }
        return fib(n - 1) + fib(n - 2);
      }
      int main() {
        cout << fib(10) << endl;
        return 0;
      }
    `)
    expect(interp.getOutput().join('')).toContain('55')
  })

  it('power function', async () => {
    const interp = await runCode(`
      #include <iostream>
      using namespace std;
      int power(int base, int exp) {
        int result = 1;
        for (int i = 0; i < exp; i++) {
          result *= base;
        }
        return result;
      }
      int main() {
        cout << power(2, 10) << endl;
        return 0;
      }
    `)
    expect(interp.getOutput().join('')).toContain('1024')
  })

  it('multiple function calls in expression', async () => {
    const interp = await runCode(`
      #include <iostream>
      using namespace std;
      int square(int x) {
        return x * x;
      }
      int main() {
        cout << square(3) + square(4) << endl;
        return 0;
      }
    `)
    // 9 + 16 = 25
    expect(interp.getOutput().join('')).toContain('25')
  })
})

// ─── 5. printf/scanf Format String Edge Cases ───

describe('printf/scanf Format Edge Cases', () => {
  it('printf with multiple format specifiers', async () => {
    const interp = await runCode(`
      #include <cstdio>
      using namespace std;
      int main() {
        int a = 3;
        int b = 5;
        printf("a=%d, b=%d, sum=%d\\n", a, b, a + b);
        return 0;
      }
    `)
    expect(interp.getOutput().join('')).toBe('a=3, b=5, sum=8\n')
  })

  it('printf with float precision', async () => {
    const interp = await runCode(`
      #include <cstdio>
      using namespace std;
      int main() {
        double pi = 3.14159265;
        printf("%.2f\\n", pi);
        printf("%.5f\\n", pi);
        return 0;
      }
    `, [])
    const output = interp.getOutput().join('')
    expect(output).toContain('3.14')
    expect(output).toContain('3.14159')
  })

  it('scanf with multiple variables on one call', async () => {
    const interp = await runCode(`
      #include <cstdio>
      using namespace std;
      int main() {
        int x, y, z;
        scanf("%d %d %d", &x, &y, &z);
        printf("%d\\n", x + y + z);
        return 0;
      }
    `, ['10', '20', '30'])
    expect(interp.getOutput().join('')).toBe('60\n')
  })

  it('mixed int and double scanf', async () => {
    const interp = await runCode(`
      #include <cstdio>
      using namespace std;
      int main() {
        int n;
        double x;
        scanf("%d", &n);
        scanf("%lf", &x);
        printf("%d %.1f\\n", n, x);
        return 0;
      }
    `, ['42', '3.5'])
    expect(interp.getOutput().join('')).toBe('42 3.5\n')
  })

  it('printf with no arguments (just string)', async () => {
    const interp = await runCode(`
      #include <cstdio>
      using namespace std;
      int main() {
        printf("Hello World\\n");
        return 0;
      }
    `)
    expect(interp.getOutput().join('')).toBe('Hello World\n')
  })
})

// ─── 6. Round-trip Preservation Tests (Code → Blocks → Code) ───

describe('Round-trip: printf style preserved', () => {
  it('printf format string preserved through round-trip', () => {
    const code = roundTrip(`
      #include <cstdio>
      using namespace std;
      int main() {
        int x = 5;
        printf("x=%d\\n", x);
        return 0;
      }
    `, printfStyle)
    expect(code).toContain('printf("x=%d\\n", x)')
  })

  it('scanf format string preserved through round-trip', () => {
    const code = roundTrip(`
      #include <cstdio>
      using namespace std;
      int main() {
        int a;
        scanf("%d", &a);
        return 0;
      }
    `, printfStyle)
    expect(code).toContain('scanf("%d", &a)')
  })

  it('complex printf with expressions preserved', () => {
    const code = roundTrip(`
      #include <cstdio>
      using namespace std;
      int main() {
        double pi = 3.14;
        printf("pi=%.2f\\n", pi);
        return 0;
      }
    `, printfStyle)
    expect(code).toContain('printf("pi=%.2f\\n", pi)')
  })

  it('cout with multiple values preserved', () => {
    const code = roundTrip(`
      #include <iostream>
      using namespace std;
      int main() {
        int x = 10;
        cout << "x=" << x << endl;
        return 0;
      }
    `, coutStyle)
    expect(code).toContain('cout')
    expect(code).toContain('"x="')
    expect(code).toContain('endl')
  })

  it('cin with multiple variables preserved', () => {
    const code = roundTrip(`
      #include <iostream>
      using namespace std;
      int main() {
        int a, b;
        cin >> a >> b;
        return 0;
      }
    `, coutStyle)
    expect(code).toContain('cin >> a >> b')
  })
})

// ─── 7. Block Structure Integrity ───

describe('Block Structure', () => {
  it('nested if-else produces correct block hierarchy', () => {
    const state = blocks(`
      if (x > 0) {
        if (x > 10) {
          y = 2;
        } else {
          y = 1;
        }
      } else {
        y = 0;
      }
    `)
    const outerIf = state.blocks.blocks[0]
    expect(outerIf.type).toBe('u_if')
    expect(outerIf.inputs.THEN).toBeDefined()
    expect(outerIf.inputs.ELSE).toBeDefined()
    // Inner if should be nested in THEN
    const innerIf = outerIf.inputs.THEN.block
    expect(innerIf.type).toBe('u_if')
  })

  it('for loop with body renders correctly', () => {
    const state = blocks(`
      for (int i = 0; i < 10; i++) {
        x = x + 1;
        y = y - 1;
      }
    `)
    const forBlock = state.blocks.blocks[0]
    // Should have a body with chained statements
    expect(forBlock.inputs.BODY).toBeDefined()
  })

  it('printf blocks use compose mode for expressions', () => {
    const state = blocks(`
      printf("result=%d\\n", a + b);
    `)
    const printfBlock = state.blocks.blocks[0]
    expect(printfBlock.type).toBe('c_printf')
    expect(printfBlock.fields.FORMAT).toBe('result=%d\\n')
    // The a+b expression should be in compose mode
    expect(printfBlock.extraState.args).toHaveLength(1)
    expect(printfBlock.extraState.args[0].mode).toBe('compose')
    expect(printfBlock.inputs.ARG_0).toBeDefined()
  })

  it('scanf blocks use select mode for variables', () => {
    const state = blocks(`
      scanf("%d %d", &x, &y);
    `)
    const scanfBlock = state.blocks.blocks[0]
    expect(scanfBlock.type).toBe('c_scanf')
    expect(scanfBlock.fields.FORMAT).toBe('%d %d')
    expect(scanfBlock.extraState.args).toHaveLength(2)
    expect(scanfBlock.extraState.args[0].mode).toBe('select')
    expect(scanfBlock.extraState.args[1].mode).toBe('select')
  })
})

// ─── 8. Competitive Programming Classics ───

describe('Competitive Programming', () => {
  it('check if number is prime', async () => {
    const interp = await runCode(`
      #include <iostream>
      using namespace std;
      int main() {
        int n;
        cin >> n;
        int isPrime = 1;
        if (n < 2) { isPrime = 0; }
        int i = 2;
        while (i * i <= n) {
          if (n % i == 0) {
            isPrime = 0;
            break;
          }
          i++;
        }
        if (isPrime == 1) {
          cout << "YES" << endl;
        } else {
          cout << "NO" << endl;
        }
        return 0;
      }
    `, ['17'])
    expect(interp.getOutput().join('')).toContain('YES')
  })

  it('check if number is NOT prime', async () => {
    const interp = await runCode(`
      #include <iostream>
      using namespace std;
      int main() {
        int n;
        cin >> n;
        int isPrime = 1;
        if (n < 2) { isPrime = 0; }
        int i = 2;
        while (i * i <= n) {
          if (n % i == 0) {
            isPrime = 0;
            break;
          }
          i++;
        }
        if (isPrime == 1) {
          cout << "YES" << endl;
        } else {
          cout << "NO" << endl;
        }
        return 0;
      }
    `, ['12'])
    expect(interp.getOutput().join('')).toContain('NO')
  })

  it('print all primes', async () => {
    const interp = await runCode(`
      #include <iostream>
      using namespace std;
      int main() {
        int n;
        cin >> n;
        for (int i = 2; i <= n; i++) {
          int ok = 1;
          int j = 2;
          while (j * j <= i) {
            if (i % j == 0) {
              ok = 0;
              break;
            }
            j++;
          }
          if (ok == 1) {
            cout << i << " ";
          }
        }
        cout << endl;
        return 0;
      }
    `, ['20'])
    const output = interp.getOutput().join('')
    expect(output).toContain('2')
    expect(output).toContain('3')
    expect(output).toContain('5')
    expect(output).toContain('7')
    expect(output).toContain('11')
    expect(output).toContain('13')
    expect(output).toContain('17')
    expect(output).toContain('19')
  })

  it('binary search in sorted array', async () => {
    const interp = await runCode(`
      #include <iostream>
      using namespace std;
      int main() {
        int n, target;
        cin >> n;
        int arr[100];
        for (int i = 0; i < n; i++) {
          cin >> arr[i];
        }
        cin >> target;
        int lo = 0;
        int hi = n - 1;
        int ans = -1;
        while (lo <= hi) {
          int mid = (lo + hi) / 2;
          if (arr[mid] == target) {
            ans = mid;
            break;
          } else if (arr[mid] < target) {
            lo = mid + 1;
          } else {
            hi = mid - 1;
          }
        }
        cout << ans << endl;
        return 0;
      }
    `, ['7', '1', '3', '5', '7', '9', '11', '13', '7'])
    // 7 is at index 3
    expect(interp.getOutput().join('')).toContain('3')
  })

  it('selection sort', async () => {
    const interp = await runCode(`
      #include <cstdio>
      using namespace std;
      int main() {
        int n;
        scanf("%d", &n);
        int arr[100];
        for (int i = 0; i < n; i++) {
          scanf("%d", &arr[i]);
        }
        for (int i = 0; i < n - 1; i++) {
          int minIdx = i;
          for (int j = i + 1; j < n; j++) {
            if (arr[j] < arr[minIdx]) {
              minIdx = j;
            }
          }
          if (minIdx != i) {
            int temp = arr[i];
            arr[i] = arr[minIdx];
            arr[minIdx] = temp;
          }
        }
        for (int i = 0; i < n; i++) {
          printf("%d ", arr[i]);
        }
        printf("\\n");
        return 0;
      }
    `, ['6', '64', '25', '12', '22', '11', '1'])
    expect(interp.getOutput().join('')).toContain('1 11 12 22 25 64')
  })
})

// ─── 9. Edge Cases & Boundary Conditions ───

describe('Edge Cases', () => {
  it('zero iterations in for loop', async () => {
    const interp = await runCode(`
      #include <iostream>
      using namespace std;
      int main() {
        int sum = 0;
        for (int i = 0; i < 0; i++) {
          sum += i;
        }
        cout << sum << endl;
        return 0;
      }
    `)
    expect(interp.getOutput().join('')).toContain('0')
  })

  it('single-element array operations', async () => {
    const interp = await runCode(`
      #include <iostream>
      using namespace std;
      int main() {
        int arr[1];
        arr[0] = 42;
        cout << arr[0] << endl;
        return 0;
      }
    `)
    expect(interp.getOutput().join('')).toContain('42')
  })

  it('deeply nested if-else (4 levels)', async () => {
    const interp = await runCode(`
      #include <iostream>
      using namespace std;
      int main() {
        int x;
        cin >> x;
        if (x > 0) {
          if (x > 10) {
            if (x > 100) {
              if (x > 1000) {
                cout << "huge" << endl;
              } else {
                cout << "big" << endl;
              }
            } else {
              cout << "medium" << endl;
            }
          } else {
            cout << "small" << endl;
          }
        } else {
          cout << "negative" << endl;
        }
        return 0;
      }
    `, ['500'])
    expect(interp.getOutput().join('')).toContain('big')
  })

  it('compound assignment operators', async () => {
    const interp = await runCode(`
      #include <iostream>
      using namespace std;
      int main() {
        int x = 10;
        x += 5;
        x -= 3;
        x *= 2;
        x /= 4;
        x %= 3;
        cout << x << endl;
        return 0;
      }
    `)
    // 10 +5=15, -3=12, *2=24, /4=6, %3=0
    expect(interp.getOutput().join('')).toContain('0')
  })

  it('increment and decrement', async () => {
    const interp = await runCode(`
      #include <iostream>
      using namespace std;
      int main() {
        int x = 5;
        x++;
        x++;
        x--;
        cout << x << endl;
        return 0;
      }
    `)
    expect(interp.getOutput().join('')).toContain('6')
  })

  it('boolean-like integer comparisons', async () => {
    const interp = await runCode(`
      #include <iostream>
      using namespace std;
      int main() {
        int a = 5;
        int b = 10;
        if (a != b && a < b) {
          cout << "correct" << endl;
        }
        if (!(a > b)) {
          cout << "also correct" << endl;
        }
        return 0;
      }
    `)
    const output = interp.getOutput().join('')
    expect(output).toContain('correct')
    expect(output).toContain('also correct')
  })

  it('integer overflow-like large computation', async () => {
    const interp = await runCode(`
      #include <iostream>
      using namespace std;
      int main() {
        int x = 100000;
        int y = x * x;
        cout << y << endl;
        return 0;
      }
    `)
    // 100000 * 100000 = 10000000000 (JS handles this)
    expect(interp.getOutput().join('')).toContain('10000000000')
  })

  it('negative modulo', async () => {
    const interp = await runCode(`
      #include <iostream>
      using namespace std;
      int main() {
        int x = -7;
        int y = 3;
        cout << x % y << endl;
        return 0;
      }
    `)
    // In C/JS, -7 % 3 = -1
    expect(interp.getOutput().join('')).toContain('-1')
  })
})

// ─── 10. Cross-Style Round-trip ───

describe('Cross-style Code Generation', () => {
  it('cout code generates correctly in printf style', () => {
    const code = roundTrip(`
      #include <iostream>
      using namespace std;
      int main() {
        int x = 5;
        cout << x << endl;
        return 0;
      }
    `, printfStyle)
    // print concept should generate printf in printf style
    expect(code).toContain('printf')
    expect(code).not.toContain('cout')
  })

  it('printf code generates correctly in cout style', () => {
    const code = roundTrip(`
      #include <cstdio>
      using namespace std;
      int main() {
        int x = 5;
        printf("%d\\n", x);
        return 0;
      }
    `, coutStyle)
    // cpp_printf concept has its own generator, preserves printf
    // (lossless lift means it stays as cpp_printf)
    expect(code).toContain('printf')
  })

  it('scanf code preserves format in competitive style', () => {
    const code = roundTrip(`
      #include <cstdio>
      using namespace std;
      int main() {
        int a, b;
        scanf("%d %d", &a, &b);
        printf("%d\\n", a + b);
        return 0;
      }
    `, printfStyle)
    expect(code).toContain('scanf("%d %d"')
    expect(code).toContain('printf("%d\\n"')
  })
})
