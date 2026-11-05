/**
 * **printf／scanf 照型別產**（spec 215）——型別由 Cella 給（`types().nodes`），推不出的那一行保留 cout／cin 並註明（使用者 2026-11-04 定 A）。
 *
 * 每一條都問兩件事：產出的寫法對不對（形式），以及 Cella 判切換前後的判決與輸出是否逐字相同（意思）。
 */
import { describe, it, expect, afterEach } from 'vitest'
import { runCella, cellaTypesOfTree } from '../helpers/cella-run'
import { generateCode, setExpressionTypes } from '../../src/core/projection/code-generator'
import { KEEP_COUT_NOTE, KEEP_CIN_NOTE, KEEP_STATE_NOTE, KEEP_UNSYNC_NOTE } from '../../src/languages/cpp/printf-types'
import competitive from '../../src/languages/cpp/styles/competitive.json'
import type { SemanticNode, StylePreset } from '../../src/core/types'

const PRINTF = competitive as unknown as StylePreset
const H = '#include <bits/stdc++.h>\nusing namespace std;\n'
const main = (body: string): string => `${H}int main() {\n${body}\n  return 0;\n}\n`

afterEach(() => setExpressionTypes(null))

/** 照型別換成 printf 風格（型別問 Cella）；`types: false` ＝ 型別還沒到 */
async function toPrintf(code: string, opts: { types?: boolean } = {}): Promise<{ tree: SemanticNode; out: string }> {
  const r = await runCella(code)
  setExpressionTypes(opts.types === false ? null : await cellaTypesOfTree(r.tree))
  return { tree: r.tree, out: generateCode(r.tree, 'cpp', PRINTF) }
}

/** 切換前後 Cella 的判決與輸出逐字相同 */
async function sameRun(before: string, after: string, stdin = ''): Promise<void> {
  const a = await runCella(before, { stdin }), b = await runCella(after, { stdin })
  expect(a.verdict, `切換前就不是 accept：${JSON.stringify(a.problems)}`).toBe('accept')
  expect({ verdict: b.verdict, out: b.out }, after).toEqual({ verdict: a.verdict, out: a.out })
}

describe('printf：照型別', () => {
  it.each([
    ['char → %c', "  char c = 'A';\n  cout << c << endl;", 'printf("%c\\n", c);'],
    ['double → %g（cout 的預設格式；%f 會印 1.500000）', '  double d = 1.5;\n  cout << d << endl;', 'printf("%g\\n", d);'],
    ['long long → %lld', '  long long x = 10000000000LL;\n  cout << x << endl;', 'printf("%lld\\n", x);'],
    ['string → %s ＋ .c_str()', '  string s = "hi";\n  cout << s << endl;', 'printf("%s\\n", s.c_str());'],
    ['bool → %d', '  bool b = true;\n  cout << b << endl;', 'printf("%d\\n", b);'],
    ['換行在原位', '  int a = 1, b = 2;\n  cout << a << endl << b << endl;', 'printf("%d\\n%d\\n", a, b);'],
    ['字面值裡的 % 寫成 %%', '  int p = 50;\n  cout << p << "%" << endl;', 'printf("%d%%\\n", p);'],
  ])('🔴 %s', async (_n, body, expected) => {
    const code = main(body)
    const { out } = await toPrintf(code)
    expect(out).toContain(expected)
    await sameRun(code, out)
  })
})

describe('原本是 Cella 那側的缺口（0.1.202611042110 修好，釘子拔掉）', () => {
  it('🔴 v.size() → %lu（Cella 給呼叫結果的型別 unsigned long；原本被接收者的 this 蓋掉）', async () => {
    const code = main('  vector<int> v(3);\n  cout << v.size() << endl;')
    const { out } = await toPrintf(code)
    expect(out).toContain('printf("%lu\\n", v.size());')
    await sameRun(code, out)
  })
  it('🔴 scanf(" %c")：先跳過空白再讀一個字元（原本 %c 後面多寫一個 \\0 蓋掉讀到的字元）', async () => {
    const code = main('  char c;\n  cin >> c;\n  cout << c << endl;')
    const { out } = await toPrintf(code)
    expect(out).toContain('scanf(" %c", &c);')
    await sameRun(code, out, '  z\n')
  })
  it('🔴 字串下標 s[0] → %c（Cella 0.1.202611050117 起給去掉參照之後的 char；之前是 char *／std::string *）', async () => {
    const code = main('  string s = "ab";\n  cout << s[0] << endl;')
    const { out } = await toPrintf(code)
    expect(out).toContain('printf("%c\\n", s[0]);')
    await sameRun(code, out)
  })
  it('🔴 while (cin >> x) → while (scanf(…) == 1)：scanf 當運算式回傳讀到的個數', async () => {
    const code = main('  int x, sum = 0;\n  while (cin >> x) {\n    sum += x;\n  }\n  cout << sum << endl;')
    const { out } = await toPrintf(code)
    expect(out).toContain('while (scanf("%d", &x) == 1)')
    await sameRun(code, out, '1 2 3\n')
  })
})

describe('推不出的那一行：保留 cout 並註明（A）', () => {
  it('🔴 型別還沒到 → 保留 cout、行尾註明；程式照樣跑出一樣的東西', async () => {
    const code = main('  double d = 1.5;\n  cout << d << endl;')
    const { out } = await toPrintf(code, { types: false })
    expect(out).toContain(`cout << d << endl;`)
    expect(out).toContain(KEEP_COUT_NOTE)
    await sameRun(code, out)
  })

  it('🔴 型別到了之後重產：換成 printf，註明不殘留（讀回來的註明不收成使用者的註解）', async () => {
    const code = main('  double d = 1.5;\n  cout << d << endl;  // 使用者的註解')
    const first = await toPrintf(code, { types: false })
    expect(first.out).toContain(KEEP_COUT_NOTE)
    const again = await toPrintf(first.out)
    expect(again.out).toContain('printf("%g\\n", d);')
    expect(again.out, '產碼自己加的註明要拿掉').not.toContain(KEEP_COUT_NOTE)
    expect(again.out, '使用者的註解要留著').toContain('使用者的註解')
  })

  it('🔴 改過串流格式（fixed／setprecision）→ 含運算式的輸出都保留 cout；純文字照換', async () => {
    const code = main('  double d = 1.0 / 3;\n  cout << fixed << setprecision(2);\n  cout << "x" << endl;\n  cout << d << endl;')
    const { out } = await toPrintf(code)
    expect(out).toContain('printf("x\\n");')
    expect(out).toContain(`cout << d << endl;`)
    expect(out).toContain(KEEP_STATE_NOTE)
    await sameRun(code, out)
  })

  it('🔴 sync_with_stdio(false) 而有一行推不出 → 整支都保留 iostream（混用時輸出順序不保證）', async () => {
    const code = main('  ios::sync_with_stdio(false);\n  int a = 1;\n  cout << a << endl;\n  cout << "x" << endl;')
    const { out } = await toPrintf(code, { types: false })
    expect(out).not.toContain('printf(')
    expect(out).toContain(KEEP_UNSYNC_NOTE)
  })

  it('對照組：sync_with_stdio(false) 而每一行都推得出 → 全換', async () => {
    const code = main('  ios::sync_with_stdio(false);\n  int a = 1;\n  cout << a << endl;\n  cout << "x" << endl;')
    const { out } = await toPrintf(code)
    expect(out).toContain('printf("%d\\n", a);')
    expect(out).toContain('printf("x\\n");')
    expect(out).not.toContain('cout <<')
  })
})

describe('scanf：照型別', () => {
  it('🔴 int／double／long long 各自的格式（double 是 %lf）', async () => {
    const code = main('  int a; double d; long long n;\n  cin >> a >> d >> n;\n  cout << a << " " << d << " " << n << endl;')
    const { out } = await toPrintf(code)
    expect(out).toContain('scanf("%d%lf%lld", &a, &d, &n);')
    await sameRun(code, out, '3 2.5\n10000000000\n')
  })

  it('🔴 std::string 讀不進 → 保留 cin、註明', async () => {
    const code = main('  string s;\n  cin >> s;\n  cout << s << endl;')
    const { out } = await toPrintf(code)
    expect(out).toContain('cin >> s;')
    expect(out).toContain(KEEP_CIN_NOTE)
    await sameRun(code, out, 'hello\n')
  })

})

describe('學生語料量到的（spec 215）', () => {
  it('🔴 逗號運算式裡的 cout 保留時不加註明——註解會吃掉同一行後面的運算式（21_d518）', async () => {
    const code = main('  ios::sync_with_stdio(0), cin.tie(0);\n  int id = 0, n = 0;\n  string s;\n  cin >> s;\n  if (s == "a") cout << "New! ", n = ++id;\n  cout << n << endl;')
    const { out } = await toPrintf(code, { types: false })
    expect(out).toContain('cout << "New! ", n = ++id;')
    await sameRun(code, out, 'a\n')
  })
  it('🔴 scanf 的 &d[i].x 讀回成結構（原本整串當成一個名字，Cella 判不是左值）', async () => {
    const code = `${H}struct P { int x, y; };\nint main() {\n  P d[3];\n  int i = 0;\n  scanf("%d%d", &d[i].x, &d[i].y);\n  printf("%d\\n", d[i].x + d[i].y);\n  return 0;\n}\n`
    const r = await runCella(code, { stdin: '3 4\n' })
    expect(JSON.stringify(r.tree)).toContain('cpp:struct_at_member')
    expect({ verdict: r.verdict, out: r.out }).toEqual({ verdict: 'accept', out: '7\n' })
  })
})
