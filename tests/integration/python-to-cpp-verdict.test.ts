/**
 * **Python → C++：兩邊交給 Cella 判，判決、輸出、assumes 相同**（spec 225）。
 *
 * ⚠️ Phase 1：型別表是**手寫的**（`tests/helpers/fake-observed-types.ts`）——Cella 的 `python.observedTypes` 發布之後換成真的，
 *    並加上 python-beginner 課文逐支的護欄（tasks T007）。這裡先釘住「換出來的 C++ 是合法的、意思相同」。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { generateCode } from '../../src/core/projection/code-generator'
import apcs from '../../src/languages/cpp/styles/apcs.json'
import type { SemanticNode, StylePreset } from '../../src/core/types'
import { liftPython } from '../helpers/python-lift'
import { runCella, cellaObservedOfTree } from '../helpers/cella-run'
import { fakeObserved } from '../helpers/fake-observed-types'
import fs from 'node:fs'
import path from 'node:path'
import { convertPythonToCpp } from '../../src/languages/python/python-to-cpp'

let parser: Parser
beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  registerCppLanguage()
})

const CASES: [string, string, Record<string, string>, string][] = [
  ['印出、end、sep', 'n = 3\nprint("hi", n)\nprint(n, end="")\nprint(1, 2, sep=",")\n', { n: 'int' }, ''],
  ['讀一行轉整數、if／else 裡第一次指定、印 bool', 'x = int(input())\nif x > 0:\n    y = x * 2\nelse:\n    y = 0\nprint(y, x > 1)\n', { x: 'int', y: 'int' }, '5\n'],
  ['負數的 // 與 %（向下取整）', 'a = -7\nb = 2\nprint(a // b, a % b)\nc = a // -3\nprint(c)\n', { a: 'int', b: 'int', c: 'int' }, ''],
  ['計數 for（含倒數）、while、break、清單', 'xs = []\nfor i in range(3):\n    xs.append(i * 2)\nfor j in range(5, 0, -1):\n    xs[0] = j\nk = 0\nwhile k < len(xs):\n    k += 1\n    break\nprint(xs[0], sum(xs), max(xs), k, i, j)\n', { xs: 'list[int]', i: 'int', j: 'int', k: 'int' }, ''],
  // Python：本體改迴圈變數不影響下一圈（C++ 的 for 會）
  ['計數 for 的本體改迴圈變數', 't = 0\nfor i in range(3):\n    i = i * 10\n    t += i\nprint(t)\n', { t: 'int', i: 'int' }, ''],
  ['函式', 'def add(a, b):\n    return a + b\nprint(add(1, 2))\n', { a: 'int', b: 'int', 'add()': 'int' }, ''],
  ['相加的結果取長度：接收者的括號不能掉（372 同類）', 's = "ab"\nt = "cd"\nprint(len(s + t))\n', { s: 'str', t: 'str' }, ''],
  ['字串相加', 's = input()\nt = s + "!"\nprint(t)\n', { s: 'str', t: 'str' }, 'hey\n'],
]

describe('Python → C++：換出來的 C++ 與原本的 Python 判得一樣（手寫型別表）', () => {
  for (const [name, src, vars, stdin] of CASES) {
    it(name, async () => {
      const t = (await liftPython(src))!
      const r = convertPythonToCpp(t, fakeObserved(t, vars), { input: stdin })
      expect(r.code, JSON.stringify(r.reasons)).not.toBeNull()
      const a = await runCella(src, { lang: 'python', stdin })
      const b = await runCella(r.code!, { lang: 'cpp', stdin })
      const show = `\n--- C++ ---\n${r.code}--- Python: ${a.verdict} ${JSON.stringify(a.out)} / C++: ${b.verdict} ${JSON.stringify(b.out)} ${JSON.stringify(b.problems?.map((p) => p.reason ?? p.kind))}`
      expect(a.verdict, `Python 那一側本身就不是 accept${show}`).toBe('accept')
      expect(b.verdict, show).toBe(a.verdict)
      expect(b.out, show).toBe(a.out)
      expect(b.assumes ?? [], show).toEqual(a.assumes ?? [])
      // SC-003／SC-005：換出來的 C++ 走一趟 C++ 的 lift 與產碼回來一字不差（第一行的說明不掉、不重複）
      const back = generateCode(createTestLifter().lift(parser.parse(r.code!)!.rootNode as never) as SemanticNode, 'cpp', apcs as unknown as StylePreset)
      //    空行不算（產生器不印空行，程式碼面板由 preserveBlankLines 照原文保留）
      const noBlank = (c: string) => c.split('\n').filter((l) => l.trim() !== '').join('\n')
      expect(noBlank(back), `走一趟 C++ 的樹回來不一樣`).toBe(noBlank(r.code!))
    }, 120_000)
  }
})

// ── 真的型別表（Cella 的 python.observedTypes）：python-beginner 課文的每一支解答 ──
const files = (fs.readdirSync('lessons/python-beginner', { recursive: true }) as string[]).map(String)
  .filter((f) => f.endsWith('.py') && f.includes('/solutions/')).sort().map((f) => `lessons/python-beginner/${f}`)

/** 這支解答對應的題目的輸入（檔名是題目 id；`rebuild` 用 follow 之後的那一題） */
function stdinOf(f: string): string {
  const lesson = JSON.parse(fs.readFileSync(path.join(path.dirname(path.dirname(f)), 'lesson.json'), 'utf8')) as { tasks: { id: string; check?: { stdin?: string[] } }[] }
  const id = path.basename(f, '.py').split('~')[0]
  const task = lesson.tasks.find((t) => t.id === id)
  return (task?.check?.stdin ?? []).map((l) => `${l}\n`).join('')
}

// ── 381：字串方法、印 list、切片、整數的 **（型別用 Cella 觀察到的）──
describe('Python → C++：換成補在開頭的小函式，判決相同', () => {
  for (const [name, src, stdin] of [
    ['split（空白）', 'words = input().split()\nprint(len(words))\nprint(words[1])\n', 'a  bb\tc\n'],
    ['split（分隔字面量，空段要留著）', 's = "a,,b"\nparts = s.split(",")\nprint(len(parts))\nprint(parts[2])\n', ''],
    ['upper／lower', 's = "Hello, World"\nprint(s.upper())\nprint(s.lower())\n', ''],
    ['replace（全部換掉）', 's = "aXbXc"\nprint(s.replace("X", "--"))\n', ''],
    ['切片：字串', 's = "abcdef"\nprint(s[1:3])\n', ''],
    ['印 list[int]／list[str]', 'xs = []\nxs.append(int(input()))\nxs.append(2)\nprint(xs)\nts = input().split()\nprint(ts)\n', '1\na b\n'],
    ['切片：list', 'xs = []\nxs.append(int(input()))\nxs.append(2)\nxs.append(3)\nprint(xs[1:3])\n', '1\n'],
    ['整數的 **', 'n = 3\nprint(n ** 2)\nprint(2 ** 0)\n', ''],
    // 406：指數是只被指定過一次非負字面量的變數
    ['整數的 **：指數是只指定過一次的常數', 'a = 7\nb = 2\nprint(a ** b)\n', ''],
    // 404：Python 印 repr——整數值補 .0、最短來回位數、指數在 [-4, 16) 之外改科學記號
    // 405：字典 → map。讀經過 map_at（缺鍵丟例外）、寫用 []、get 帶預設值、sorted(字典) 走訪照鍵排序
    ['字典：數次數、照鍵排序印出', 'words = input().split()\nseen = {}\nfor w in words:\n    seen[w] = seen.get(w, 0) + 1\nfor w in sorted(seen):\n    print(w, seen[w])\n', 'b a b c\n'],
    ['字典：整數鍵、d[k] op= v、len、get 缺鍵', 'd = {}\nd[3] = "x"\nd[1] = "y"\nd[3] += "z"\nc = {}\nc["a"] = 1\nc["a"] *= 5\nc["a"] //= 2\nfor k in sorted(d):\n    print(k, d[k], len(d), c.get("b", 7), c["a"])\n', ''],
    // 407：串列生成式 → 在那一句前面先建 vector（list、range、if 條件；同一顆被寫兩次只建一次）
    ['串列生成式：印出、當 sum 的引數、當 for 的走訪對象', 'words = ["a", "bb", "ccc"]\nprint([len(w) for w in words])\nxs = [i * i for i in range(5) if i % 2 == 0]\nprint(xs, sum([x + 1 for x in xs]))\nfor y in [x * 2 for x in xs]:\n    print(y)\nx = "s"\nprint(x)\n', ''],
    ['印浮點數（repr 的規則）', 'a = 2.0\nprint(a, a / 3, a + 0.1, a * 10000000000.0 * 10000000000.0, a / 100000, -a * 10000000)\nprint(str(a / 4) + "!")\n', ''],
  ] as const) {
    it(name, async () => {
      const t = (await liftPython(src))!
      const r = convertPythonToCpp(t, await cellaObservedOfTree(t, stdin), { input: stdin })
      expect(r.code, JSON.stringify(r.reasons)).not.toBeNull()
      const a = await runCella(src, { lang: 'python', stdin })
      const b = await runCella(r.code!, { lang: 'cpp', stdin })
      const show = `\n--- C++ ---\n${r.code}--- Python: ${a.verdict} ${JSON.stringify(a.out)} / C++: ${b.verdict} ${JSON.stringify(b.out)} ${JSON.stringify(b.problems?.map((p) => p.reason ?? p.kind))}`
      expect(a.verdict, show).toBe('accept')
      expect(b.verdict, show).toBe('accept')
      expect(b.out, show).toBe(a.out)
      expect(b.assumes ?? [], show).toEqual(a.assumes ?? [])
      // 換出來的 C++ 走一趟 C++ 的 lift 與產碼回來一字不差（407：`for (long long x : xs)` 曾經回來變成 auto）
      const back = generateCode(createTestLifter().lift(parser.parse(r.code!)!.rootNode as never) as SemanticNode, 'cpp', apcs as unknown as StylePreset)
      const noBlank = (c: string) => c.split('\n').filter((l) => l.trim() !== '').join('\n')
      expect(noBlank(back), '走一趟 C++ 的樹回來不一樣').toBe(noBlank(r.code!))
    }, 120_000)
  }
  for (const [name, src, stdin] of [
    ['split 的分隔是變數', 'd = input()\nprint(len("a b".split(d)))\n', ' \n'],
    ['replace 要換掉的是變數', 'd = input()\nprint("a b".replace(d, "x"))\n', ' \n'],
    ['負的切片', 's = "abc"\nprint(s[-2:3])\n', ''],
    ['負的指數（Python 是浮點）', 'n = 2\nprint(n ** -1)\n', ''],
    ['生成式在 if 的條件裡', 'xs = [1, 2]\nif len([x for x in xs]) > 1:\n    print("y")\n', ''],
    ['生成式所在的那一句有別的副作用（先算會改變先後）', 'xs = []\ndef f():\n    xs.append(1)\n    return 0\nprint(f(), [x for x in xs])\n', ''],
    ['兩層的生成式', 'print([a + b for a in [1, 2] for b in [3]])\n', ''],
    ['直接走訪字典（Python 照放入的順序，map 照鍵排序）', 'c = {}\nc["b"] = 1\nc["a"] = 2\nfor k in c:\n    print(k)\n', ''],
    ['走訪 sorted(字典) 時本體改了那個字典', 'c = {}\nc["a"] = 1\nfor k in sorted(c):\n    c["z"] = 2\nprint(len(c))\n', ''],
    ['有內容的字典字面量（重複的鍵兩邊取的不同）', 'c = {"a": 1, "a": 2}\nprint(c["a"])\n', ''],
    ['** 的指數是被改過的變數', 'b = 2\nb += 1\nprint(3 ** b)\n', ''],
    ['** 的指數是讀進來的', 'b = int(input())\nprint(3 ** b)\n', '2\n'],
    ['** 的指數在函式裡被 global 改掉', 'b = 2\ndef f():\n    global b\n    b = 5\nf()\nprint(3 ** b)\n', ''],
  ] as const) {
    it(`🔴 保留：${name}`, async () => {
      const t = (await liftPython(src))!
      const r = convertPythonToCpp(t, await cellaObservedOfTree(t, stdin), { input: stdin })
      expect(r.code, r.code ?? '').toBeNull()
      expect(r.reasons.length).toBeGreaterThan(0)
    }, 120_000)
  }
})

describe('Python → C++：python-beginner 課文的解答（Cella 觀察到的型別）', () => {
  const tally = { converted: [] as string[], kept: new Map<string, string[]>() }
  it('入口：讀到了課文的 Python 解答', () => expect(files.length).toBeGreaterThanOrEqual(30))
  for (const f of files) {
    it(f.replace('lessons/python-beginner/', ''), async () => {
      const src = fs.readFileSync(f, 'utf8')
      const stdin = stdinOf(f)
      const t = (await liftPython(src))!
      const r = convertPythonToCpp(t, await cellaObservedOfTree(t, stdin), { input: stdin })
      if (r.code === null) {
        expect(r.reasons.length).toBeGreaterThan(0)
        for (const x of r.reasons) { expect(x.detail.length).toBeGreaterThan(0); tally.kept.set(x.kind, [...(tally.kept.get(x.kind) ?? []), f]) }
        return
      }
      tally.converted.push(f)
      const same = async (): Promise<void> => {
        const a = await runCella(src, { lang: 'python', stdin })
        const b = await runCella(r.code!, { lang: 'cpp', stdin })
        const show = `\n--- C++ ---\n${r.code}--- Python: ${a.verdict} ${JSON.stringify(a.out)} / C++: ${b.verdict} ${JSON.stringify(b.out)} ${JSON.stringify(b.problems?.map((p) => p.reason ?? p.kind))}${JSON.stringify(b.untranslated)}`
        expect(b.verdict, show).toBe(a.verdict)
        expect(b.out, show).toBe(a.out)
        expect(b.assumes ?? [], `${show}\nassumes：Python ${JSON.stringify(a.assumes ?? [])} / C++ ${JSON.stringify(b.assumes ?? [])}`).toEqual(a.assumes ?? [])
      }
      // 🟠 Cella 的誤判（2026-11-09 回報）：`v = {…}` 被當成建構引數（clang 正常）——我們送的形狀是對的（eAssign ＋ eBraced）
      await same()
      expect(r.code.split('\n')[0], 'FR-009：第一行要說型別是照這組輸入推的').toMatch(/^\/\/ 變數的型別是照這/)
    }, 120_000)
  }
  it('★ 報表：兩份加起來等於解答總數', () => {
    const kept = new Set([...tally.kept.values()].flat()).size
    process.stdout.write(`Python → C++：換過去 ${tally.converted.length} 支／保留 ${kept} 支｜原因分佈 ${[...tally.kept].map(([k, v]) => `${k}:${new Set(v).size}`).join(' ')}\n`)
    expect(tally.converted.length + kept).toBe(files.length)
  })
})

