/**
 * Beginner patterns, common mistakes, style mixing, and edge cases.
 *
 * Tests that exercise:
 * - do-while loops
 * - switch-case
 * - ternary operator
 * - char literals / char arithmetic
 * - beginner off-by-one, uninitialized vars, integer division pitfalls
 * - style mixing (cout + printf in same program)
 * - array edge cases
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import type { Lifter } from '../../src/core/lift/lifter'
import { SemanticInterpreter } from '../../src/interpreter/interpreter'
import { createTestLifter } from '../helpers/setup-lifter'

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
})

async function runCode(code: string, stdin: string[] = []) {
  const tree = tsParser.parse(code)
  const sem = lifter.lift(tree.rootNode)
  expect(sem).not.toBeNull()
  const interp = new SemanticInterpreter({ maxSteps: 2000000 })
  await interp.execute(sem!, stdin)
  return interp
}

// ============================================================
// do-while loops
// ============================================================
describe('do-while loops', () => {
  it('basic do-while: menu-driven input', async () => {
    // Keep reading until user inputs 0
    const interp = await runCode(`
      #include <iostream>
      using namespace std;
      int main() {
        int sum = 0;
        int x;
        do {
          cin >> x;
          sum += x;
        } while (x != 0);
        cout << sum << endl;
        return 0;
      }
    `, ['3', '5', '7', '0'])
    expect(interp.getOutput().join('')).toContain('15')
  })

  it('do-while: input validation (retry until valid)', async () => {
    const interp = await runCode(`
      #include <iostream>
      using namespace std;
      int main() {
        int n;
        do {
          cin >> n;
        } while (n < 1 || n > 100);
        cout << n << endl;
        return 0;
      }
    `, ['-5', '200', '0', '42'])
    expect(interp.getOutput().join('')).toContain('42')
  })

  it('do-while: digit extraction (reverse order)', async () => {
    const interp = await runCode(`
      #include <iostream>
      using namespace std;
      int main() {
        int n;
        cin >> n;
        do {
          cout << n % 10;
          n = n / 10;
        } while (n > 0);
        cout << endl;
        return 0;
      }
    `, ['12345'])
    expect(interp.getOutput().join('')).toContain('54321')
  })

  it('do-while: executes body at least once even if condition is false', async () => {
    const interp = await runCode(`
      #include <iostream>
      using namespace std;
      int main() {
        int count = 0;
        do {
          count++;
        } while (count > 100);
        cout << count << endl;
        return 0;
      }
    `)
    expect(interp.getOutput().join('')).toContain('1')
  })
})

// ============================================================
// switch-case
// ============================================================
describe('switch-case', () => {
  it('basic switch: day of week', async () => {
    const interp = await runCode(`
      #include <iostream>
      using namespace std;
      int main() {
        int day;
        cin >> day;
        switch (day) {
          case 1: cout << "Mon"; break;
          case 2: cout << "Tue"; break;
          case 3: cout << "Wed"; break;
          case 4: cout << "Thu"; break;
          case 5: cout << "Fri"; break;
          default: cout << "Weekend"; break;
        }
        cout << endl;
        return 0;
      }
    `, ['3'])
    expect(interp.getOutput().join('')).toContain('Wed')
  })

  it('switch: fall-through behavior', async () => {
    // Without break, cases fall through
    const interp = await runCode(`
      #include <iostream>
      using namespace std;
      int main() {
        int x = 1;
        int count = 0;
        switch (x) {
          case 1: count++;
          case 2: count++;
          case 3: count++;
          default: count++;
        }
        cout << count << endl;
        return 0;
      }
    `)
    // Falls through all cases from 1: count becomes 4
    expect(interp.getOutput().join('')).toContain('4')
  })

  it('switch: calculator with operator', async () => {
    const interp = await runCode(`
      #include <iostream>
      using namespace std;
      int main() {
        int a, b, op;
        cin >> a >> b >> op;
        int result = 0;
        switch (op) {
          case 1: result = a + b; break;
          case 2: result = a - b; break;
          case 3: result = a * b; break;
          case 4: result = a / b; break;
        }
        cout << result << endl;
        return 0;
      }
    `, ['10', '3', '3'])
    expect(interp.getOutput().join('')).toContain('30')
  })

  it('switch: grade classification', async () => {
    const interp = await runCode(`
      #include <iostream>
      using namespace std;
      int main() {
        int score;
        cin >> score;
        int grade = score / 10;
        switch (grade) {
          case 10:
          case 9: cout << "A"; break;
          case 8: cout << "B"; break;
          case 7: cout << "C"; break;
          case 6: cout << "D"; break;
          default: cout << "F"; break;
        }
        cout << endl;
        return 0;
      }
    `, ['85'])
    expect(interp.getOutput().join('')).toContain('B')
  })

  it('switch: default case only', async () => {
    const interp = await runCode(`
      #include <iostream>
      using namespace std;
      int main() {
        int x = 99;
        switch (x) {
          case 1: cout << "one"; break;
          case 2: cout << "two"; break;
          default: cout << "other"; break;
        }
        cout << endl;
        return 0;
      }
    `)
    expect(interp.getOutput().join('')).toContain('other')
  })
})

// ============================================================
// ternary operator
// ============================================================
describe('ternary operator', () => {
  it('basic ternary: min of two numbers', async () => {
    const interp = await runCode(`
      #include <iostream>
      using namespace std;
      int main() {
        int a, b;
        cin >> a >> b;
        int m = (a < b) ? a : b;
        cout << m << endl;
        return 0;
      }
    `, ['7', '3'])
    expect(interp.getOutput().join('')).toContain('3')
  })

  it('ternary: absolute value', async () => {
    const interp = await runCode(`
      #include <iostream>
      using namespace std;
      int main() {
        int x;
        cin >> x;
        int abs_x = (x >= 0) ? x : -x;
        cout << abs_x << endl;
        return 0;
      }
    `, ['-42'])
    expect(interp.getOutput().join('')).toContain('42')
  })

  it('ternary in expression: clamp value', async () => {
    const interp = await runCode(`
      #include <iostream>
      using namespace std;
      int main() {
        int x;
        cin >> x;
        int lo = 0;
        int hi = 100;
        int clamped = (x < lo) ? lo : ((x > hi) ? hi : x);
        cout << clamped << endl;
        return 0;
      }
    `, ['150'])
    expect(interp.getOutput().join('')).toContain('100')
  })

  it('ternary in cout: even/odd', async () => {
    const interp = await runCode(`
      #include <iostream>
      using namespace std;
      int main() {
        int n;
        cin >> n;
        cout << ((n % 2 == 0) ? "even" : "odd") << endl;
        return 0;
      }
    `, ['7'])
    expect(interp.getOutput().join('')).toContain('odd')
  })
})

// ============================================================
// char literals and char arithmetic
// ============================================================
describe('char operations', () => {
  it('char literal comparison: is uppercase', async () => {
    const interp = await runCode(`
      #include <iostream>
      using namespace std;
      int main() {
        int ch;
        cin >> ch;
        if (ch >= 65 && ch <= 90) {
          cout << "upper" << endl;
        } else {
          cout << "not upper" << endl;
        }
        return 0;
      }
    `, ['72'])
    // 72 = 'H'
    expect(interp.getOutput().join('')).toContain('upper')
  })

  it('char arithmetic: Caesar cipher with int codes', async () => {
    // Simple shift cipher using integer character codes
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
        int shift = 3;
        for (int i = 0; i < n; i++) {
          int c = arr[i];
          if (c >= 65 && c <= 90) {
            c = (c - 65 + shift) % 26 + 65;
          }
          arr[i] = c;
        }
        for (int i = 0; i < n; i++) {
          cout << arr[i] << " ";
        }
        cout << endl;
        return 0;
      }
    `, ['3', '65', '66', '90'])
    // A(65)->D(68), B(66)->E(69), Z(90)->C(67)
    expect(interp.getOutput().join('')).toContain('68 69 67')
  })
})

// ============================================================
// Beginner common mistakes (should all produce correct output)
// ============================================================
describe('beginner patterns: correct usage', () => {
  it('off-by-one: fence post problem (n items, n-1 separators)', async () => {
    const interp = await runCode(`
      #include <iostream>
      using namespace std;
      int main() {
        int n;
        cin >> n;
        int arr[100];
        for (int i = 0; i < n; i++) cin >> arr[i];
        for (int i = 0; i < n; i++) {
          if (i > 0) cout << ",";
          cout << arr[i];
        }
        cout << endl;
        return 0;
      }
    `, ['4', '1', '2', '3', '4'])
    expect(interp.getOutput().join('')).toContain('1,2,3,4')
  })

  it('accumulator pattern: sum and average', async () => {
    const interp = await runCode(`
      #include <iostream>
      using namespace std;
      int main() {
        int n;
        cin >> n;
        int sum = 0;
        for (int i = 0; i < n; i++) {
          int x;
          cin >> x;
          sum += x;
        }
        cout << sum << " " << sum / n << endl;
        return 0;
      }
    `, ['4', '10', '20', '30', '40'])
    // sum=100, avg=100/4=25
    expect(interp.getOutput().join('')).toContain('100 25')
  })

  it('integer division truncation', async () => {
    const interp = await runCode(`
      #include <iostream>
      using namespace std;
      int main() {
        int a = 7;
        int b = 2;
        int q = a / b;
        int r = a % b;
        cout << q << " " << r << endl;
        return 0;
      }
    `)
    // 7/2 = 3 remainder 1
    expect(interp.getOutput().join('')).toContain('3 1')
  })

  it('nested if-else: multi-branch classification', async () => {
    const interp = await runCode(`
      #include <iostream>
      using namespace std;
      int main() {
        int x;
        cin >> x;
        if (x > 0) {
          if (x > 100)
            cout << "big positive";
          else
            cout << "small positive";
        } else if (x == 0) {
          cout << "zero";
        } else {
          cout << "negative";
        }
        cout << endl;
        return 0;
      }
    `, ['-5'])
    expect(interp.getOutput().join('')).toContain('negative')
  })

  it('swap two variables using temp', async () => {
    const interp = await runCode(`
      #include <iostream>
      using namespace std;
      int main() {
        int a, b;
        cin >> a >> b;
        int temp = a;
        a = b;
        b = temp;
        cout << a << " " << b << endl;
        return 0;
      }
    `, ['3', '7'])
    expect(interp.getOutput().join('')).toContain('7 3')
  })

  it('flag variable pattern: search with found flag', async () => {
    const interp = await runCode(`
      #include <iostream>
      using namespace std;
      int main() {
        int n, target;
        cin >> n >> target;
        int arr[100];
        for (int i = 0; i < n; i++) cin >> arr[i];
        int found = 0;
        int pos = -1;
        for (int i = 0; i < n; i++) {
          if (arr[i] == target) {
            found = 1;
            pos = i;
            break;
          }
        }
        if (found == 1) {
          cout << "found at " << pos << endl;
        } else {
          cout << "not found" << endl;
        }
        return 0;
      }
    `, ['5', '30', '10', '20', '30', '40', '50'])
    expect(interp.getOutput().join('')).toContain('found at 2')
  })

  it('nested loop: multiplication table', async () => {
    const interp = await runCode(`
      #include <iostream>
      using namespace std;
      int main() {
        int n;
        cin >> n;
        for (int i = 1; i <= n; i++) {
          for (int j = 1; j <= n; j++) {
            cout << i * j << " ";
          }
          cout << endl;
        }
        return 0;
      }
    `, ['3'])
    const output = interp.getOutput().join('')
    expect(output).toContain('1 2 3')
    expect(output).toContain('2 4 6')
    expect(output).toContain('3 6 9')
  })

  it('counting pattern: frequency array', async () => {
    const interp = await runCode(`
      #include <iostream>
      using namespace std;
      int main() {
        int n;
        cin >> n;
        int freq[10];
        for (int i = 0; i < 10; i++) freq[i] = 0;
        for (int i = 0; i < n; i++) {
          int x;
          cin >> x;
          freq[x]++;
        }
        for (int i = 0; i < 10; i++) {
          if (freq[i] > 0) {
            cout << i << ":" << freq[i] << " ";
          }
        }
        cout << endl;
        return 0;
      }
    `, ['8', '1', '3', '1', '2', '3', '3', '1', '5'])
    const output = interp.getOutput().join('')
    expect(output).toContain('1:3')
    expect(output).toContain('2:1')
    expect(output).toContain('3:3')
    expect(output).toContain('5:1')
  })

  it('max/min tracking in loop', async () => {
    const interp = await runCode(`
      #include <iostream>
      using namespace std;
      int main() {
        int n;
        cin >> n;
        int arr[100];
        for (int i = 0; i < n; i++) cin >> arr[i];
        int maxVal = arr[0];
        int minVal = arr[0];
        for (int i = 1; i < n; i++) {
          if (arr[i] > maxVal) maxVal = arr[i];
          if (arr[i] < minVal) minVal = arr[i];
        }
        cout << maxVal << " " << minVal << endl;
        return 0;
      }
    `, ['5', '3', '7', '1', '9', '4'])
    expect(interp.getOutput().join('')).toContain('9 1')
  })

  it('reverse array in-place', async () => {
    const interp = await runCode(`
      #include <iostream>
      using namespace std;
      int main() {
        int n;
        cin >> n;
        int arr[100];
        for (int i = 0; i < n; i++) cin >> arr[i];
        for (int i = 0; i < n / 2; i++) {
          int temp = arr[i];
          arr[i] = arr[n - 1 - i];
          arr[n - 1 - i] = temp;
        }
        for (int i = 0; i < n; i++) {
          cout << arr[i] << " ";
        }
        cout << endl;
        return 0;
      }
    `, ['5', '1', '2', '3', '4', '5'])
    expect(interp.getOutput().join('')).toContain('5 4 3 2 1')
  })
})

// ============================================================
// Style mixing: cout + printf in same program
// ============================================================
describe('style mixing: cout and printf', () => {
  it('printf for formatted output, cout for simple output', async () => {
    const interp = await runCode(`
      #include <iostream>
      #include <cstdio>
      using namespace std;
      int main() {
        int x = 42;
        cout << "value: ";
        printf("%d\\n", x);
        return 0;
      }
    `)
    const output = interp.getOutput().join('')
    expect(output).toContain('value: ')
    expect(output).toContain('42')
  })

  it('scanf for input, cout for output', async () => {
    const interp = await runCode(`
      #include <iostream>
      #include <cstdio>
      using namespace std;
      int main() {
        int a, b;
        scanf("%d %d", &a, &b);
        cout << a + b << endl;
        return 0;
      }
    `, ['10', '20'])
    expect(interp.getOutput().join('')).toContain('30')
  })

  it('cin for input, printf for output', async () => {
    const interp = await runCode(`
      #include <iostream>
      #include <cstdio>
      using namespace std;
      int main() {
        int n;
        cin >> n;
        printf("The answer is %d\\n", n * 2);
        return 0;
      }
    `, ['15'])
    expect(interp.getOutput().join('')).toContain('The answer is 30')
  })

  it('mixed I/O in loop', async () => {
    const interp = await runCode(`
      #include <iostream>
      #include <cstdio>
      using namespace std;
      int main() {
        int n;
        cin >> n;
        for (int i = 0; i < n; i++) {
          int x;
          scanf("%d", &x);
          cout << x * x << " ";
        }
        cout << endl;
        return 0;
      }
    `, ['3', '2', '3', '4'])
    expect(interp.getOutput().join('')).toContain('4 9 16')
  })
})

// ============================================================
// Array edge cases
// ============================================================
describe('array edge cases', () => {
  it('single element array', async () => {
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

  it('array filled with zeros, then sparse updates', async () => {
    const interp = await runCode(`
      #include <iostream>
      using namespace std;
      int main() {
        int arr[10];
        for (int i = 0; i < 10; i++) arr[i] = 0;
        arr[3] = 100;
        arr[7] = 200;
        int sum = 0;
        for (int i = 0; i < 10; i++) sum += arr[i];
        cout << sum << endl;
        return 0;
      }
    `)
    expect(interp.getOutput().join('')).toContain('300')
  })

  it('array as parameter (passed by array name)', async () => {
    const interp = await runCode(`
      #include <iostream>
      using namespace std;
      int sumArray(int arr[], int n) {
        int s = 0;
        for (int i = 0; i < n; i++) s += arr[i];
        return s;
      }
      int main() {
        int a[5];
        for (int i = 0; i < 5; i++) a[i] = i + 1;
        cout << sumArray(a, 5) << endl;
        return 0;
      }
    `)
    expect(interp.getOutput().join('')).toContain('15')
  })

  it('2D array simulation with row-major indexing', async () => {
    const interp = await runCode(`
      #include <iostream>
      using namespace std;
      int main() {
        int rows = 3;
        int cols = 4;
        int mat[12];
        int val = 1;
        for (int i = 0; i < rows; i++) {
          for (int j = 0; j < cols; j++) {
            mat[i * cols + j] = val;
            val++;
          }
        }
        // Print diagonal elements: (0,0), (1,1), (2,2)
        for (int i = 0; i < 3; i++) {
          cout << mat[i * cols + i] << " ";
        }
        cout << endl;
        return 0;
      }
    `)
    // mat = 1,2,3,4 / 5,6,7,8 / 9,10,11,12
    // diagonal: mat[0]=1, mat[5]=6, mat[10]=11
    expect(interp.getOutput().join('')).toContain('1 6 11')
  })

  it('array boundary: access last element correctly', async () => {
    const interp = await runCode(`
      #include <iostream>
      using namespace std;
      int main() {
        int n = 5;
        int arr[5];
        for (int i = 0; i < n; i++) arr[i] = (i + 1) * 10;
        cout << arr[0] << " " << arr[n - 1] << endl;
        return 0;
      }
    `)
    expect(interp.getOutput().join('')).toContain('10 50')
  })

  it('array with negative values', async () => {
    const interp = await runCode(`
      #include <iostream>
      using namespace std;
      int main() {
        int arr[5];
        arr[0] = -10;
        arr[1] = 5;
        arr[2] = -3;
        arr[3] = 8;
        arr[4] = -1;
        int negCount = 0;
        for (int i = 0; i < 5; i++) {
          if (arr[i] < 0) negCount++;
        }
        cout << negCount << endl;
        return 0;
      }
    `)
    expect(interp.getOutput().join('')).toContain('3')
  })

  it('copy array to another array', async () => {
    const interp = await runCode(`
      #include <iostream>
      using namespace std;
      int main() {
        int src[5];
        int dst[5];
        for (int i = 0; i < 5; i++) src[i] = i * i;
        for (int i = 0; i < 5; i++) dst[i] = src[i];
        // Modify src, dst should be unchanged
        src[0] = 999;
        for (int i = 0; i < 5; i++) cout << dst[i] << " ";
        cout << endl;
        return 0;
      }
    `)
    expect(interp.getOutput().join('')).toContain('0 1 4 9 16')
  })
})

// ============================================================
// Complex control flow combinations
// ============================================================
describe('complex control flow', () => {
  it('nested loops with break: find first pair summing to target', async () => {
    const interp = await runCode(`
      #include <iostream>
      using namespace std;
      int main() {
        int n, target;
        cin >> n >> target;
        int arr[100];
        for (int i = 0; i < n; i++) cin >> arr[i];
        int found = 0;
        for (int i = 0; i < n && found == 0; i++) {
          for (int j = i + 1; j < n; j++) {
            if (arr[i] + arr[j] == target) {
              cout << arr[i] << "+" << arr[j] << "=" << target << endl;
              found = 1;
              break;
            }
          }
        }
        if (found == 0) cout << "not found" << endl;
        return 0;
      }
    `, ['5', '9', '2', '7', '3', '6', '1'])
    expect(interp.getOutput().join('')).toContain('2+7=9')
  })

  it('while loop with multiple exit conditions', async () => {
    const interp = await runCode(`
      #include <iostream>
      using namespace std;
      int main() {
        int n;
        cin >> n;
        int i = 2;
        int isPrime = 1;
        while (i * i <= n) {
          if (n % i == 0) {
            isPrime = 0;
            break;
          }
          i++;
        }
        if (n < 2) isPrime = 0;
        if (isPrime == 1) cout << "prime" << endl;
        else cout << "not prime" << endl;
        return 0;
      }
    `, ['17'])
    expect(interp.getOutput().join('')).toContain('prime')
  })

  it('for loop with continue: skip multiples of 3', async () => {
    const interp = await runCode(`
      #include <iostream>
      using namespace std;
      int main() {
        int sum = 0;
        for (int i = 1; i <= 10; i++) {
          if (i % 3 == 0) continue;
          sum += i;
        }
        cout << sum << endl;
        return 0;
      }
    `)
    // 1+2+4+5+7+8+10 = 37
    expect(interp.getOutput().join('')).toContain('37')
  })

  it('deeply nested if-else: BMI classification', async () => {
    const interp = await runCode(`
      #include <iostream>
      using namespace std;
      int main() {
        int bmi;
        cin >> bmi;
        if (bmi < 18) {
          cout << "underweight";
        } else {
          if (bmi < 25) {
            cout << "normal";
          } else {
            if (bmi < 30) {
              cout << "overweight";
            } else {
              cout << "obese";
            }
          }
        }
        cout << endl;
        return 0;
      }
    `, ['27'])
    expect(interp.getOutput().join('')).toContain('overweight')
  })

  it('loop with early return from function', async () => {
    const interp = await runCode(`
      #include <iostream>
      using namespace std;
      int indexOf(int arr[], int n, int target) {
        for (int i = 0; i < n; i++) {
          if (arr[i] == target) return i;
        }
        return -1;
      }
      int main() {
        int arr[6];
        arr[0] = 10; arr[1] = 20; arr[2] = 30;
        arr[3] = 40; arr[4] = 50; arr[5] = 60;
        cout << indexOf(arr, 6, 30) << endl;
        cout << indexOf(arr, 6, 99) << endl;
        return 0;
      }
    `)
    const output = interp.getOutput().join('')
    expect(output).toContain('2')
    expect(output).toContain('-1')
  })
})

// ============================================================
// do-while + switch combined patterns
// ============================================================
describe('combined patterns', () => {
  it('do-while menu with switch dispatch', async () => {
    const interp = await runCode(`
      #include <iostream>
      using namespace std;
      int main() {
        int balance = 100;
        int choice;
        int amount;
        // Process 3 transactions: deposit 50, withdraw 30, check balance
        // choice: 1=deposit, 2=withdraw, 3=balance, 0=exit
        cin >> choice;
        while (choice != 0) {
          switch (choice) {
            case 1:
              cin >> amount;
              balance += amount;
              break;
            case 2:
              cin >> amount;
              balance -= amount;
              break;
            case 3:
              cout << balance << endl;
              break;
          }
          cin >> choice;
        }
        cout << "final:" << balance << endl;
        return 0;
      }
    `, ['1', '50', '2', '30', '3', '0'])
    const output = interp.getOutput().join('')
    expect(output).toContain('120')
    expect(output).toContain('final:120')
  })

  it('ternary inside loop: absolute difference array', async () => {
    const interp = await runCode(`
      #include <iostream>
      using namespace std;
      int main() {
        int n;
        cin >> n;
        int a[100];
        int b[100];
        for (int i = 0; i < n; i++) cin >> a[i];
        for (int i = 0; i < n; i++) cin >> b[i];
        int sum = 0;
        for (int i = 0; i < n; i++) {
          int diff = a[i] - b[i];
          int absDiff = (diff >= 0) ? diff : -diff;
          sum += absDiff;
        }
        cout << sum << endl;
        return 0;
      }
    `, ['4', '1', '5', '3', '8', '4', '2', '7', '1'])
    // |1-4|+|5-2|+|3-7|+|8-1| = 3+3+4+7 = 17
    expect(interp.getOutput().join('')).toContain('17')
  })

  it('do-while with nested for: repeated digit sum until single digit', async () => {
    const interp = await runCode(`
      #include <iostream>
      using namespace std;
      int main() {
        int n;
        cin >> n;
        do {
          int sum = 0;
          int temp = n;
          while (temp > 0) {
            sum += temp % 10;
            temp = temp / 10;
          }
          n = sum;
        } while (n >= 10);
        cout << n << endl;
        return 0;
      }
    `, ['9999'])
    // 9+9+9+9 = 36, 3+6 = 9
    expect(interp.getOutput().join('')).toContain('9')
  })

  it('switch in function: classify character type by ASCII', async () => {
    const interp = await runCode(`
      #include <iostream>
      using namespace std;
      int classify(int code) {
        int group = code / 10;
        switch (group) {
          case 3: return 1;
          case 4: return 2;
          case 5: return 2;
          case 6: return 3;
          case 7: return 3;
          case 8: return 3;
          case 9: return 4;
          default: return 0;
        }
      }
      int main() {
        cout << classify(35) << " ";
        cout << classify(55) << " ";
        cout << classify(75) << " ";
        cout << classify(95) << " ";
        cout << classify(15) << endl;
        return 0;
      }
    `)
    expect(interp.getOutput().join('')).toContain('1 2 3 4 0')
  })
})

// ============================================================
// Tricky patterns that beginners struggle with
// ============================================================
describe('tricky beginner patterns', () => {
  it('nested function calls: max of three', async () => {
    const interp = await runCode(`
      #include <iostream>
      using namespace std;
      int maxTwo(int a, int b) {
        if (a > b) return a;
        return b;
      }
      int maxThree(int a, int b, int c) {
        return maxTwo(maxTwo(a, b), c);
      }
      int main() {
        int a, b, c;
        cin >> a >> b >> c;
        cout << maxThree(a, b, c) << endl;
        return 0;
      }
    `, ['5', '12', '8'])
    expect(interp.getOutput().join('')).toContain('12')
  })

  it('multiple returns from function: sign function', async () => {
    const interp = await runCode(`
      #include <iostream>
      using namespace std;
      int sign(int x) {
        if (x > 0) return 1;
        if (x < 0) return -1;
        return 0;
      }
      int main() {
        cout << sign(42) << " " << sign(-7) << " " << sign(0) << endl;
        return 0;
      }
    `)
    expect(interp.getOutput().join('')).toContain('1 -1 0')
  })

  it('boolean logic: De Morgan and short-circuit', async () => {
    const interp = await runCode(`
      #include <iostream>
      using namespace std;
      int main() {
        int a = 1;
        int b = 0;
        // !(a && b) should be same as (!a || !b)
        int r1 = 0;
        int r2 = 0;
        if (!(a == 1 && b == 1)) r1 = 1;
        if (a != 1 || b != 1) r2 = 1;
        cout << r1 << " " << r2 << endl;
        return 0;
      }
    `)
    expect(interp.getOutput().join('')).toContain('1 1')
  })

  it('variable shadowing in nested scope', async () => {
    const interp = await runCode(`
      #include <iostream>
      using namespace std;
      int main() {
        int x = 10;
        for (int i = 0; i < 3; i++) {
          int x = i * 100;
          cout << x << " ";
        }
        cout << x << endl;
        return 0;
      }
    `)
    // Inner x shadows outer; outer x remains 10
    expect(interp.getOutput().join('')).toContain('0 100 200 10')
  })

  it('pass-by-value semantics: function does not modify caller variable', async () => {
    const interp = await runCode(`
      #include <iostream>
      using namespace std;
      void tryModify(int x) {
        x = 999;
      }
      int main() {
        int val = 42;
        tryModify(val);
        cout << val << endl;
        return 0;
      }
    `)
    expect(interp.getOutput().join('')).toContain('42')
  })

  it('recursive countdown with base case', async () => {
    const interp = await runCode(`
      #include <iostream>
      using namespace std;
      void countdown(int n) {
        if (n <= 0) {
          cout << "Go!" << endl;
          return;
        }
        cout << n << " ";
        countdown(n - 1);
      }
      int main() {
        countdown(5);
        return 0;
      }
    `)
    expect(interp.getOutput().join('')).toContain('5 4 3 2 1 Go!')
  })

  it('palindrome check', async () => {
    const interp = await runCode(`
      #include <iostream>
      using namespace std;
      int main() {
        int n;
        cin >> n;
        int arr[100];
        for (int i = 0; i < n; i++) cin >> arr[i];
        int isPalin = 1;
        for (int i = 0; i < n / 2; i++) {
          if (arr[i] != arr[n - 1 - i]) {
            isPalin = 0;
            break;
          }
        }
        if (isPalin == 1) cout << "yes" << endl;
        else cout << "no" << endl;
        return 0;
      }
    `, ['5', '1', '2', '3', '2', '1'])
    expect(interp.getOutput().join('')).toContain('yes')
  })

  it('selection with index tracking: second largest', async () => {
    const interp = await runCode(`
      #include <iostream>
      using namespace std;
      int main() {
        int n;
        cin >> n;
        int arr[100];
        for (int i = 0; i < n; i++) cin >> arr[i];
        int max1 = -1;
        int max2 = -1;
        for (int i = 0; i < n; i++) {
          if (arr[i] > max1) {
            max2 = max1;
            max1 = arr[i];
          } else if (arr[i] > max2) {
            max2 = arr[i];
          }
        }
        cout << max2 << endl;
        return 0;
      }
    `, ['5', '3', '9', '1', '7', '5'])
    expect(interp.getOutput().join('')).toContain('7')
  })
})

// ============================================================
// printf format edge cases
// ============================================================
describe('printf format edge cases', () => {
  it('printf with multiple format specifiers', async () => {
    const interp = await runCode(`
      #include <cstdio>
      int main() {
        int a = 10;
        int b = 20;
        printf("a=%d, b=%d, sum=%d\\n", a, b, a + b);
        return 0;
      }
    `)
    expect(interp.getOutput().join('')).toContain('a=10, b=20, sum=30')
  })

  it('printf with width specifier', async () => {
    const interp = await runCode(`
      #include <cstdio>
      int main() {
        for (int i = 1; i <= 3; i++) {
          printf("%d ", i * i);
        }
        printf("\\n");
        return 0;
      }
    `)
    expect(interp.getOutput().join('')).toContain('1 4 9')
  })

  it('scanf reading multiple values', async () => {
    const interp = await runCode(`
      #include <cstdio>
      int main() {
        int x, y, z;
        scanf("%d %d %d", &x, &y, &z);
        printf("%d\\n", x + y + z);
        return 0;
      }
    `, ['10', '20', '30'])
    expect(interp.getOutput().join('')).toContain('60')
  })
})
