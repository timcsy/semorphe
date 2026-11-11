/**
 * 模糊測試的**永久回歸**——高中資訊課學生的 Python 解題程式（2026-11-11，第 410 刀）。
 *
 * 八段程式由一個**看不到這個 repo 的**出題代理寫出來，`expected` 是真的 `python3` 跑出來的輸出。
 *
 * ## 這一輪抓到什麼
 *
 * | 症狀 | 處置 |
 * |---|---|
 * | `for i, (w, c) in enumerate(d)` 產回去是 `for i in enumerate(d)`，Cella 對合法程式報 NameError | 巢狀目標整句誠實降級 |
 * | `f'{s!r:<6}'` 產回去是 `f"{s:<6}"`，印出來少了引號 | 410 先整句降級；412 起轉換是插值那一格的屬性；418 起 `{x=}`（名字與屬性鏈）也是 |
 * | `a = b = 0` 產回去是 `a = `（壞掉的程式），送 Cella 是不合法的 JSON | 連鎖指定誠實降級（樣式新增 `notNodeType`） |
 * | `x[0], x[1] = 1, 2` 只留下名字目標 | 非名字的序列目標誠實降級 |
 *
 * 還開著的：推導式的多變數目標（`[(a, b) for a, b in zip(…)]`）整段照實保留——下一刀；`math.isqrt` Cella 判 unknown（已回報）。
 */
import { describe, it, expect } from 'vitest'
import { liftPython, generatePython, componentIdsOf, runPython } from '../helpers/python-lift'
import { knownCellaGap } from '../helpers/cella-run'

const P: Record<string, { code: string; expected: string }> = {
  "fuzz_1": {
    "code": "def main():\n    text = 'the cat and the hat and the bat sat on the mat'\n    counts = {}\n    for w in text.split():\n        counts[w] = counts.get(w, 0) + 1\n    ranked = sorted(counts.items(), key=lambda x: (-x[1], x[0]))\n    for i, (word, c) in enumerate(ranked, 1):\n        print(f'{i:>2}. {word:<5}|{c:>3}')\n    longest = max(counts, key=len)\n    print('longest:', longest)\n    total = sum(c for c in counts.values() if c > 1)\n    print('repeated total:', total)\n    singles = [w for w, c in ranked if c == 1]\n    print('singles:', singles[-2:], len(singles))\n\nmain()\n",
    "expected": " 1. the  |  4\n 2. and  |  2\n 3. bat  |  1\n 4. cat  |  1\n 5. hat  |  1\n 6. mat  |  1\n 7. on   |  1\n 8. sat  |  1\nlongest: the\nrepeated total: 6\nsingles: ['on', 'sat'] 6\n"
  },
  "fuzz_2": {
    "code": "def count_paths(grid):\n    rows, cols = len(grid), len(grid[0])\n    dp = [[0] * cols for _ in range(rows)]\n    for r in range(rows):\n        for c in range(cols):\n            if grid[r][c] == 1:\n                dp[r][c] = 0\n                continue\n            if r == 0 and c == 0:\n                dp[r][c] = 1\n                continue\n            up = dp[r - 1][c] if r > 0 else 0\n            left = dp[r][c - 1] if c > 0 else 0\n            dp[r][c] = up + left\n    return dp\n\ngrid = [\n    [0, 0, 0, 0],\n    [0, 1, 0, 0],\n    [0, 0, 0, 1],\n    [1, 0, 0, 0],\n]\ntable = count_paths(grid)\nfor row in table:\n    print(' '.join(f'{v:3d}' for v in row))\nprint('paths:', table[-1][-1])\nprint('last col:', [row[-1] for row in table])\n",
    "expected": "  1   1   1   1\n  1   0   1   2\n  1   1   2   0\n  0   1   3   3\npaths: 3\nlast col: [1, 2, 0, 3]\n"
  },
  "fuzz_3": {
    "code": "memo = {}\ncalls = 0\n\ndef fib(n):\n    global calls\n    calls += 1\n    if n in memo:\n        return memo[n]\n    if n < 2:\n        result = n\n    else:\n        result = fib(n - 1) + fib(n - 2)\n    memo[n] = result\n    return result\n\ndef fib_iter(n):\n    a, b = 0, 1\n    for _ in range(n):\n        a, b = b, a + b\n    return a\n\nfor n in [10, 20, 30]:\n    calls = 0\n    v = fib(n)\n    print(f'fib({n:2}) = {v:>8} calls={calls}')\nprint(all(fib(k) == fib_iter(k) for k in range(31)))\nprint(sum(fib_iter(k) for k in range(10) if fib_iter(k) % 2 == 0))\n",
    "expected": "fib(10) =       55 calls=19\nfib(20) =     6765 calls=21\nfib(30) =   832040 calls=21\nTrue\n44\n"
  },
  "fuzz_4": {
    "code": "count = 0\n\ndef permute(items, prefix, out):\n    global count\n    if not items:\n        count += 1\n        out.append(prefix[:])\n        return\n    for i in range(len(items)):\n        prefix.append(items[i])\n        permute(items[:i] + items[i + 1:], prefix, out)\n        prefix.pop()\n\ndef main():\n    result = []\n    permute(['a', 'b', 'c'], [], result)\n    for idx, p in enumerate(result):\n        print(idx, ''.join(p))\n    print('count =', count)\n    target = 'cab'\n    for idx, p in enumerate(result):\n        if ''.join(p) == target:\n            print('found', target, 'at', idx)\n            break\n    else:\n        print('not found')\n    nums = []\n    permute([1, 2, 3, 4], [], nums)\n    odd_first = [p for p in nums if p[0] % 2 == 1 and p[-1] > 2]\n    print(len(nums), len(odd_first), count)\n\nmain()\n",
    "expected": "0 abc\n1 acb\n2 bac\n3 bca\n4 cab\n5 cba\ncount = 6\nfound cab at 4\n24 6 30\n"
  },
  "fuzz_5": {
    "code": "def shift_char(ch, k):\n    if 'a' <= ch <= 'z':\n        return chr((ord(ch) - ord('a') + k) % 26 + ord('a'))\n    if 'A' <= ch <= 'Z':\n        return chr((ord(ch) - ord('A') + k) % 26 + ord('A'))\n    return ch\n\ndef caesar(text, k):\n    return ''.join(shift_char(c, k) for c in text)\n\nmsg = 'Hello, World! xyz'\nfor k in [3, -3, 29, -55]:\n    enc = caesar(msg, k)\n    dec = caesar(enc, -k)\n    print(f'{k:>4} | {enc:<20}| {dec == msg}')\nprint(-7 // 2, -7 % 2, 7 // -2, 7 % -2)\nprint(divmod(-17, 5), divmod(17, -5))\nprint([shift_char(c, -1) for c in 'aA!'])\n",
    "expected": "   3 | Khoor, Zruog! abc   | True\n  -3 | Ebiil, Tloia! uvw   | True\n  29 | Khoor, Zruog! abc   | True\n -55 | Ebiil, Tloia! uvw   | True\n-4 1 -4 -1\n(-4, 3) (-4, -3)\n['z', 'Z', '!']\n"
  },
  "fuzz_6": {
    "code": "def rle_encode(s):\n    if not s:\n        return []\n    runs = []\n    cur, n = s[0], 1\n    for ch in s[1:]:\n        if ch == cur:\n            n += 1\n        else:\n            runs.append((cur, n))\n            cur, n = ch, 1\n    runs.append((cur, n))\n    return runs\n\ndef rle_decode(runs):\n    return ''.join(ch * n for ch, n in runs)\n\ndef main():\n    for s in ['aaabccddddde', 'abc', '', 'zzzzzzzzzzzz']:\n        runs = rle_encode(s)\n        packed = ''.join(f'{n}{ch}' if n > 1 else ch for ch, n in runs)\n        ok = rle_decode(runs) == s\n        print(f'{s!r:<16}-> {packed:<10} {ok}')\n    runs = rle_encode('aaabccddddde')\n    best = max(runs, key=lambda r: r[1])\n    print('longest run:', best)\n    print(runs[-1], runs[::-2])\n\nmain()\n",
    "expected": "'aaabccddddde'  -> 3ab2c5de   True\n'abc'           -> abc        True\n''              ->            True\n'zzzzzzzzzzzz'  -> 12z        True\nlongest run: ('d', 5)\n('e', 1) [('e', 1), ('c', 2), ('a', 3)]\n"
  },
  "fuzz_7": {
    "code": "def sieve(n):\n    is_prime = [True] * (n + 1)\n    is_prime[0] = is_prime[1] = False\n    i = 2\n    while i * i <= n:\n        if is_prime[i]:\n            is_prime[i * i::i] = [False] * len(range(i * i, n + 1, i))\n        i += 1\n    return [k for k, p in enumerate(is_prime) if p]\n\nprimes = sieve(60)\nprint(primes)\nprint(primes[-3:], primes[::-4], primes[1:8:3])\ntwins = [(a, b) for a, b in zip(primes, primes[1:]) if b - a == 2]\nprint('twins:', twins)\ngaps = [b - a for a, b in zip(primes, primes[1:])]\nprint('max gap:', max(gaps), 'at', primes[gaps.index(max(gaps))])\ntotal = 0\nfor p in primes:\n    if p > 40:\n        break\n    if p % 4 != 1:\n        continue\n    total += p\nprint('sum of 4k+1 primes <= 40:', total)\n",
    "expected": "[2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59]\n[47, 53, 59] [59, 41, 23, 11, 2] [3, 11, 19]\ntwins: [(3, 5), (5, 7), (11, 13), (17, 19), (29, 31), (41, 43)]\nmax gap: 6 at 23\nsum of 4k+1 primes <= 40: 101\n"
  },
  "fuzz_8": {
    "code": "import math\n\ndef transpose(m):\n    return [[m[r][c] for r in range(len(m))] for c in range(len(m[0]))]\n\ndef multiply(a, b):\n    rows, inner, cols = len(a), len(b), len(b[0])\n    result = [[0] * cols for _ in range(rows)]\n    for i in range(rows):\n        for j in range(cols):\n            for k in range(inner):\n                result[i][j] += a[i][k] * b[k][j]\n    return result\n\ndef show(name, m):\n    print(name)\n    for row in m:\n        print('  ' + ' '.join(f'{x:>4}' for x in row))\n\na = [[1, 2, 3], [4, 5, 6]]\nb = transpose(a)\nshow('A', a)\nshow('A^T', b)\nc = multiply(a, b)\nshow('A*A^T', c)\ntrace = sum(c[i][i] for i in range(len(c)))\nprint('trace:', trace, 'sqrt:', math.isqrt(trace))\nnorm = math.sqrt(sum(x * x for row in a for x in row))\nprint(f'norm = {norm:.3f}')\nprint(c[-1][::-1], list(zip(*a)))\n",
    "expected": "A\n     1    2    3\n     4    5    6\nA^T\n     1    4\n     2    5\n     3    6\nA*A^T\n    14   32\n    32   77\ntrace: 91 sqrt: 9\nnorm = 9.539\n[77, 32] [(1, 4), (2, 5), (3, 6)]\n"
  }
}

/** 轉一圈再轉一圈要是不動點；照實保留的構造要原樣出現（不得被安靜改掉） */
async function roundTrip(id: string, mustKeep: string[] = []): Promise<string[]> {
  const t = await liftPython(P[id].code)
  const ids = componentIdsOf(t)
  expect(ids, '正向錨點：樹裡有程式').toContain('python:program')
  const gen = generatePython(t)
  expect(generatePython(await liftPython(gen)), '第二趟漂了').toBe(gen)
  for (const k of mustKeep) expect(gen, `照實保留的那一段被改掉了：${k}`).toContain(k)
  return ids
}

describe('模糊測試：學生的 Python 解題程式（410）', () => {
  // for 的巢狀解包 `for i, (word, c) in …`——以前悄悄丟掉 `(word, c)`，Cella 對合法程式報 NameError；推導式 `for w, c in ranked` 的多目標另一刀（411）
  it('fuzz_1：Counts word frequencies in a sentence and prints a ranked table sorted by descending count then alphabetically.', async () => {
    const ids = await roundTrip('fuzz_1', ["for i, (word, c) in enumerate(ranked, 1):"])
    expect(ids, '翻不出的那一段照實保留').toContain('unresolved')
    expect(await runPython(P.fuzz_1.code), '判不出就說判不出，不得跑出別的結果').toMatch(/翻不出/)
  })
  it('fuzz_2：Counts monotone right/down paths through a grid with obstacles using a DP table.', async () => {
    const ids = await roundTrip('fuzz_2')
    expect(ids.filter((i) => /raw|unresolved/.test(i)), '整段都認得').toEqual([])
    expect(await runPython(P.fuzz_2.code)).toBe('completed|' + P.fuzz_2.expected)
  })
  it('fuzz_3：Computes Fibonacci numbers with a memoized recursive function that counts calls via a global, and checks it against an iterative version.', async () => {
    const ids = await roundTrip('fuzz_3')
    expect(ids.filter((i) => /raw|unresolved/.test(i)), '整段都認得').toEqual([])
    expect(await runPython(P.fuzz_3.code)).toBe('completed|' + P.fuzz_3.expected)
  })
  // 🟢 第 417 刀起 for … else 認得了（之前照實保留成 unresolved）
  it('fuzz_4：Generates all permutations recursively with backtracking, searches for one with an early break, and filters permutations of numbers.', async () => {
    const ids = await roundTrip('fuzz_4')
    expect(ids, '正向錨點：for 迴圈認得').toContain('python:loop_for')
    expect(ids.filter((i) => /raw|unresolved/.test(i)), '整段都認得').toEqual([])
    expect(await runPython(P.fuzz_4.code)).toBe('completed|' + P.fuzz_4.expected)
  })
  it('fuzz_5：Encrypts and decrypts with several shifts, then shows floor-division semantics.', async () => {
    const ids = await roundTrip('fuzz_5')
    expect(ids.filter((i) => /raw|unresolved/.test(i)), '整段都認得').toEqual([])
    expect(await runPython(P.fuzz_5.code)).toBe('completed|' + P.fuzz_5.expected)
  })
  // f-string 的 `!r`——以前悄悄丟掉、印出來的引號不見；410 起整句降級，412 收下（插值那一格多一個轉換）；推導式 `for ch, n in runs` 由 411 收下
  it('fuzz_6：Run-length encodes strings and verifies decoding.', async () => {
    const ids = await roundTrip('fuzz_6', ["{s!r:<16}"])
    expect(ids.filter((i) => /raw|unresolved/.test(i)), '整段都認得').toEqual([])
    expect(await runPython(P.fuzz_6.code)).toBe('completed|' + P.fuzz_6.expected)
  })
  // 連鎖指定 `is_prime[0] = is_prime[1] = False`——以前產回去是 `is_prime[0] = `（壞掉的程式）；410 照實降級，413 有了自己的元件
  it('fuzz_7：Sieve up to 60, twin primes, largest gap, filtered sum.', async () => {
    const ids = await roundTrip('fuzz_7', ["is_prime[0] = is_prime[1] = False"])
    expect(ids, '連鎖指定有自己的元件').toContain('python:assign_chain')
    expect(ids.filter((i) => /raw|unresolved/.test(i)), '整段都認得').toEqual([])
    // 切片指定 `is_prime[i * i::i] = …`：Cella 的指定目標把下標當一般運算式降（lowering.cella 的 sAssign → eSubscript），
    // 切片落到「a slice outside a subscript」——我們送的是忠實的 eSubscript(eSlice)，已回報 cella（2026-11-11）
    await knownCellaGap(/slice outside a subscript/, async () => {
      const r = await runPython(P.fuzz_7.code)
      if (r !== 'completed|' + P.fuzz_7.expected) throw new Error(r)
    })
  })
  it('fuzz_8：Transposes and multiplies a matrix, prints trace, isqrt and norm.（math.isqrt Cella 判 unknown，已回報）', async () => {
    const ids = await roundTrip('fuzz_8')
    expect(ids.filter((i) => /raw|unresolved/.test(i)), '整段都認得').toEqual([])
    await knownCellaGap(/math\.isqrt/, async () => {
      const r = await runPython(P.fuzz_8.code)
      if (r !== 'completed|' + P.fuzz_8.expected) throw new Error(r)
    })
  })
})
