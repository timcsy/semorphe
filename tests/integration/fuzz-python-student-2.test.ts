/**
 * 模糊測試的**永久回歸**——盲測第二批（2026-11-12，第 421–423 刀的來源）。
 *
 * 十段程式由一個**看不到這個 repo 的**出題代理寫出來，`expected` 是真的 `python3` 跑出來的輸出。
 * 第一批在 `fuzz-python-student.test.ts`。
 *
 * ## 這一輪量到什麼（423 時點）
 *
 * - 十支轉一圈再轉一圈**都是不動點**，沒有 SEMANTIC_DIFF／COMPILE_FAIL／ROUNDTRIP_DRIFT。
 * - 🟢 423 收下：fuzz_7 的 `nonlocal count`（`python:nonlocal`）；fuzz_3 的 `del b.rate`（`python:delete`）。
 * - 照實保留、下一刀處理的：`@staticmethod`／`@lru_cache`（裝飾器）、`def total(*args, scale=1, **kw)`、
 *   `match`、三段以上的比較鏈 `0 < x < 20 != 21`。
 * - Cella 那一側不支援的標準模組（Counter、deque、heapq、bisect、string）用 `knownCellaGap` 釘著——支援之後會轉紅，提醒轉成一般測試。
 *
 * ⚠️ 下面「照實保留」的清單是**精確的**：哪天少一筆（例如裝飾器有了元件），這裡會紅——那是要更新這份清單的訊號，不是壞掉。
 */
import { describe, it, expect } from 'vitest'
import { liftPython, generatePython, componentIdsOf, runPython } from '../helpers/python-lift'
import { knownCellaGap } from '../helpers/cella-run'
import type { SemanticNode } from '../../src/core/types'
const P: Record<string, { code: string; expected: string }> = {
  "fuzz_1": {
    "code": "from collections import Counter\n\ntext = \"\"\"the quick brown fox jumps over the lazy dog\nThe dog barks, the fox runs!\na quick-thinking dog?\"\"\"\n\ndef clean(word):\n    return word.strip(\".,!?\").lower()\n\nwords = [clean(w) for line in text.splitlines() for w in line.split()]\nwords = [w for w in words if w]\nfreq = {}\nfor w in words:\n    freq[w] = freq.get(w, 0) + 1\n\nranked = sorted(freq.items(), key=lambda kv: (-kv[1], kv[0]))\nfor rank, (word, cnt) in enumerate(ranked[:5], 1):\n    bar = \"#\" * cnt\n    print(f\"{rank:>2}. {word:<15}{cnt:3d} {bar}\")\n\nfirst, *middle, last = ranked\nprint(\"first:\", first, \"last:\", last, \"middle size:\", len(middle))\n\nlengths = {w: len(w) for w in freq}\nby_len = {}\nfor w, n in lengths.items():\n    by_len.setdefault(n, []).append(w)\nfor n in sorted(by_len, reverse=True)[:3]:\n    print(n, *sorted(by_len[n]), sep=\",\")\n\ninitials = {w[0] for w in words}\nprint(\"\".join(sorted(initials)))\nc = Counter(words)\nprint(c.most_common(2) == ranked[:2], \"the\" in freq, \"cat\" in freq)\nvowels = sum(w.count(v) for w in words for v in \"aeiou\")\nprint(\"vowels=%d, ratio=%.3f\" % (vowels, vowels / len(\"\".join(words))))\n",
    "expected": " 1. the              4 ####\n 2. dog              3 ###\n 3. fox              2 ##\n 4. a                1 #\n 5. barks            1 #\nfirst: ('the', 4) last: ('runs', 1) middle size: 10\n14,quick-thinking\n5,barks,brown,jumps,quick\n4,lazy,over,runs\nabdfjloqrt\nTrue True False\nvowels=23, ratio=0.311\n"
  },
  "fuzz_2": {
    "code": "matrix = [\n    [1, 2, 3, 4],\n    [5, 6, 7, 8],\n    [9, 10, 11, 12],\n]\n\ndef transpose(m):\n    return [list(row) for row in zip(*m)]\n\ndef rotate_cw(m):\n    return [list(row)[::-1] for row in zip(*m)]\n\ndef show(m, title=\"\"):\n    if title:\n        print(f\"-- {title} --\")\n    for row in m:\n        print(*(f\"{x:3}\" for x in row))\n\nshow(matrix, \"original\")\nshow(transpose(matrix), \"transpose\")\nshow(rotate_cw(matrix), \"rotate\")\n\nrow_sums = [sum(r) for r in matrix]\ncol_sums = [sum(c) for c in zip(*matrix)]\nprint(\"rows:\", row_sums, \"cols:\", col_sums)\n\ndiag = [matrix[i][i] for i in range(min(len(matrix), len(matrix[0])))]\nanti = [row[-1 - i] for i, row in enumerate(matrix)]\nprint(\"diag\", diag, \"anti\", anti)\n\nspiral = []\nm = [row[:] for row in matrix]\nwhile m:\n    spiral += m.pop(0)\n    if m and m[0]:\n        for row in m:\n            spiral.append(row.pop())\n    if m:\n        spiral += m.pop()[::-1]\n    if m and m[0]:\n        for row in reversed(m):\n            spiral.append(row.pop(0))\n    m = [r for r in m if r]\nprint(\"spiral:\", \" -> \".join(map(str, spiral)))\n\nflat = [x for row in matrix for x in row if x % 3 != 0]\nprint(flat[::2], flat[-3:], flat[1:-1:3])\nprint(all(a < b for a, b in zip(flat, flat[1:])), any(x > 11 for x in flat))\n",
    "expected": "-- original --\n  1   2   3   4\n  5   6   7   8\n  9  10  11  12\n-- transpose --\n  1   5   9\n  2   6  10\n  3   7  11\n  4   8  12\n-- rotate --\n  9   5   1\n 10   6   2\n 11   7   3\n 12   8   4\nrows: [10, 26, 42] cols: [15, 18, 21, 24]\ndiag [1, 6, 11] anti [4, 7, 10]\nspiral: 1 -> 2 -> 3 -> 4 -> 8 -> 12 -> 11 -> 10 -> 9 -> 5 -> 6 -> 7\n[1, 4, 7, 10] [8, 10, 11] [2, 7]\nTrue False\n"
  },
  "fuzz_3": {
    "code": "class Account:\n    bank_name = \"PyBank\"\n    count = 0\n    rate = 0.02\n\n    def __init__(self, owner, balance=0):\n        Account.count += 1\n        self.id = Account.count\n        self.owner = owner\n        self.balance = balance\n        self.history = []\n\n    def deposit(self, amount):\n        if amount <= 0:\n            raise ValueError(f\"bad deposit {amount}\")\n        self.balance += amount\n        self.history.append((\"D\", amount))\n        return self\n\n    def withdraw(self, amount):\n        if amount > self.balance:\n            raise ValueError(\"insufficient funds\")\n        self.balance -= amount\n        self.history.append((\"W\", amount))\n        return self\n\n    @staticmethod\n    def fmt(x):\n        return \"{:,.2f}\".format(x)\n\n    def __str__(self):\n        return f\"[{self.id}] {self.owner}: {Account.fmt(self.balance)}\"\n\n    def __repr__(self):\n        return \"Account(%r, %d)\" % (self.owner, self.balance)\n\na = Account(\"Amy\", 1000)\nb = Account(\"Ben\")\nb.rate = 0.05\na.deposit(500).withdraw(200).deposit(1234567)\nfor acct, amt in [(b, 50), (a, -5), (b, 100), (a, 10 ** 9)]:\n    try:\n        acct.withdraw(amt) if amt > 100 else acct.deposit(amt)\n    except ValueError as e:\n        print(\"error:\", e)\n    else:\n        print(\"ok\", acct.owner, amt)\n    finally:\n        pass\nprint(a, b, sep=\"\\n\")\nprint(repr(a), [b])\nprint(Account.rate, a.rate, b.rate, Account.count, Account.bank_name)\nfor kind, amt in a.history:\n    print(kind, amt, end=\"; \")\nprint()\ndel b.rate\nprint(b.rate, \"rate\" in vars(a), \"owner\" in vars(a))\n",
    "expected": "ok Ben 50\nerror: bad deposit -5\nok Ben 100\nerror: insufficient funds\n[1] Amy: 1,235,867.00\n[2] Ben: 150.00\nAccount('Amy', 1235867) [Account('Ben', 150)]\n0.02 0.02 0.05 2 PyBank\nD 500; W 200; D 1234567; \n0.02 False True\n"
  },
  "fuzz_4": {
    "code": "def describe(cmd):\n    match cmd.split():\n        case [\"go\", (\"north\" | \"south\" | \"east\" | \"west\") as d]:\n            return f\"moving {d}\"\n        case [\"go\", *other]:\n            return f\"unknown direction {' '.join(other) or '?'}\"\n        case [\"take\", item] if item.isdigit():\n            return f\"take {int(item) * 2} coins\"\n        case [\"take\", *items]:\n            return \"take \" + \", \".join(items)\n        case [\"quit\" | \"exit\"]:\n            return \"bye\"\n        case []:\n            return \"empty\"\n        case _:\n            return \"???\"\n\ncmds = [\"go north\", \"go up left\", \"go\", \"take 21\", \"take sword shield\",\n        \"quit\", \"\", \"dance now\", \"exit\"]\nfor i, c in enumerate(cmds, 1):\n    print(i, repr(c), \"=>\", describe(c))\n\ndef classify(value):\n    match value:\n        case 0 | 0.0:\n            return \"zero\"\n        case int(n) if n < 0:\n            return \"neg int\"\n        case int():\n            return \"pos int\"\n        case (x, y):\n            return f\"pair {x}+{y}={x + y}\"\n        case {\"name\": name, **rest}:\n            return f\"named {name} +{len(rest)}\"\n        case str() as s:\n            return s.upper()\n        case _:\n            return type(value).__name__\n\nfor v in [0, -3, 7, (2, 5), [1, 2], {\"name\": \"x\", \"a\": 1, \"b\": 2}, \"hi\", 2.5, (1, 2, 3)]:\n    print(classify(v))\n",
    "expected": "1 'go north' => moving north\n2 'go up left' => unknown direction up left\n3 'go' => unknown direction ?\n4 'take 21' => take 42 coins\n5 'take sword shield' => take sword, shield\n6 'quit' => bye\n7 '' => empty\n8 'dance now' => ???\n9 'exit' => bye\nzero\nneg int\npos int\npair 2+5=7\npair 1+2=3\nnamed x +2\nHI\nfloat\ntuple\n"
  },
  "fuzz_5": {
    "code": "nums = [7, -7, 13, -13, 0, 25, -1]\ndivs = [3, -3]\nfor a in nums:\n    row = []\n    for d in divs:\n        q, r = divmod(a, d)\n        assert q * d + r == a\n        row.append(f\"{a}//{d}={a // d},{a}%{d}={a % d}\")\n    print(\" | \".join(row))\n\nprint([round(x) for x in (0.5, 1.5, 2.5, 3.5, -0.5, -1.5)])\nprint(round(2.675, 2), round(1234.5678, -2), round(-2.5))\nprint(int(-7 / 2), -7 // 2, int(7.9), int(-7.9))\n\ndef to_base(n, b):\n    digits = \"0123456789ABCDEF\"\n    if n == 0:\n        return \"0\"\n    sign = \"-\" if n < 0 else \"\"\n    n = abs(n)\n    out = \"\"\n    while n:\n        n, r = divmod(n, b)\n        out = digits[r] + out\n    return sign + out\n\nfor n in (255, -255, 0, 1000):\n    print(n, to_base(n, 2), to_base(n, 16), to_base(n, 7), sep=\"\\t\")\n    assert n == 0 or int(to_base(n, 16), 16) == n\n\nh, rem = divmod(98765, 3600)\nm, s = divmod(rem, 60)\nprint(\"%02d:%02d:%02d\" % (h, m, s))\nprint(10 ** 20 // 3, 2 ** 64 % 1000, -2 ** 2, (-2) ** 2, 2 ** -1)\nx = 17\nprint(0 < x < 20 != 21, 1 < x > 30, x % 5 == 2 == 2)\nprint(abs(-7) % 3, pow(3, 200, 1000), pow(-3, 3))\n",
    "expected": "7//3=2,7%3=1 | 7//-3=-3,7%-3=-2\n-7//3=-3,-7%3=2 | -7//-3=2,-7%-3=-1\n13//3=4,13%3=1 | 13//-3=-5,13%-3=-2\n-13//3=-5,-13%3=2 | -13//-3=4,-13%-3=-1\n0//3=0,0%3=0 | 0//-3=0,0%-3=0\n25//3=8,25%3=1 | 25//-3=-9,25%-3=-2\n-1//3=-1,-1%3=2 | -1//-3=0,-1%-3=-1\n[0, 2, 2, 4, 0, -2]\n2.67 1200.0 -2\n-3 -4 7 -7\n255\t11111111\tFF\t513\n-255\t-11111111\t-FF\t-513\n0\t0\t0\t0\n1000\t1111101000\t3E8\t2626\n27:26:05\n33333333333333333333 616 -4 4 0.5\nTrue False True\n1 1 -27\n"
  },
  "fuzz_6": {
    "code": "import heapq\nfrom collections import defaultdict\n\nedges = [\n    (\"A\", \"B\", 4), (\"A\", \"C\", 2), (\"B\", \"C\", 5), (\"B\", \"D\", 10),\n    (\"C\", \"E\", 3), (\"E\", \"D\", 4), (\"D\", \"F\", 11), (\"E\", \"F\", 20),\n]\ngraph = defaultdict(list)\nfor u, v, w in edges:\n    graph[u].append((v, w))\n    graph[v].append((u, w))\n\nINF = float(\"inf\")\n\ndef dijkstra(src):\n    dist = {node: INF for node in graph}\n    prev = {}\n    dist[src] = 0\n    pq = [(0, src)]\n    while pq:\n        d, u = heapq.heappop(pq)\n        if d > dist[u]:\n            continue\n        for v, w in graph[u]:\n            if (nd := d + w) < dist[v]:\n                dist[v] = nd\n                prev[v] = u\n                heapq.heappush(pq, (nd, v))\n    return dist, prev\n\ndef path_to(prev, target):\n    path = [target]\n    while (p := prev.get(path[-1])) is not None:\n        path.append(p)\n    return path[::-1]\n\ndist, prev = dijkstra(\"A\")\nfor node, d in sorted(dist.items(), key=lambda kv: (kv[1], kv[0])):\n    print(f\"{node}: {d:>3} via {'->'.join(path_to(prev, node))}\")\n\nfar = max(dist, key=dist.get)\nprint(\"farthest:\", far, dist[far])\nreach = {n for n, d in dist.items() if d <= 9}\nprint(sorted(reach), len(reach) == len(graph))\ndegree = {n: len(adj) for n, adj in graph.items()}\nprint(*[f\"{n}={k}\" for n, k in sorted(degree.items())], sep=\" \")\ntotal = sum(w for *_, w in edges)\nprint(\"total weight\", total, \"avg %.2f\" % (total / len(edges)))\n",
    "expected": "A:   0 via A\nC:   2 via A->C\nB:   4 via A->B\nE:   5 via A->C->E\nD:   9 via A->C->E->D\nF:  20 via A->C->E->D->F\nfarthest: F 20\n['A', 'B', 'C', 'D', 'E'] False\nA=2 B=3 C=3 D=3 E=3 F=2\ntotal weight 59 avg 7.38\n"
  },
  "fuzz_7": {
    "code": "from functools import lru_cache\n\ncalls = 0\n\ndef make_counter(start=0, step=1):\n    count = start\n    def inc(times=1):\n        nonlocal count\n        count += step * times\n        return count\n    return inc\n\ndef fib_slow(n):\n    global calls\n    calls += 1\n    return n if n < 2 else fib_slow(n - 1) + fib_slow(n - 2)\n\n@lru_cache(maxsize=None)\ndef fib_fast(n):\n    return n if n < 2 else fib_fast(n - 1) + fib_fast(n - 2)\n\ndef hanoi(n, src=\"A\", dst=\"C\", via=\"B\", moves=None):\n    if moves is None:\n        moves = []\n    if n == 1:\n        moves.append((src, dst))\n    else:\n        hanoi(n - 1, src, via, dst, moves)\n        moves.append((src, dst))\n        hanoi(n - 1, via, dst, src, moves)\n    return moves\n\ndef total(*args, scale=1, **kw):\n    return scale * (sum(args) + sum(kw.values()))\n\nc1 = make_counter()\nc2 = make_counter(100, -5)\nprint(c1(), c1(), c1(3), c2(), c2(2))\nprint(fib_slow(15), calls)\nprint(fib_fast(90), fib_fast.cache_info().hits)\nmoves = hanoi(4)\nprint(len(moves), moves[:3], moves[-1])\nfor i, (s, d) in enumerate(moves[:4]):\n    print(f\"move {i}: {s}->{d}\", end=\"  \" if i < 3 else \"\\n\")\nprint(total(1, 2, 3), total(*range(5), scale=2), total(x=4, y=5, scale=-1))\nsquare = lambda x: x * x\ncompose = lambda f, g: lambda x: f(g(x))\nprint(compose(square, c1)(2), list(map(square, filter(lambda n: n % 2, range(8)))))\n",
    "expected": "1 2 5 95 85\n610 1973\n2880067194370816120 88\n15 [('A', 'B'), ('A', 'C'), ('B', 'C')] ('B', 'C')\nmove 0: A->B  move 1: A->C  move 2: B->C  move 3: A->B\n6 20 -9\n49 [1, 9, 25, 49]\n"
  },
  "fuzz_8": {
    "code": "import bisect\nimport itertools\n\nscores = [(\"Alice\", 88, 92), (\"Bob\", 75, 60), (\"Cara\", 95, 98),\n          (\"Dan\", 60, 59), (\"Eve\", 88, 90), (\"Finn\", 40, 72)]\ncutoffs = [60, 70, 80, 90]\ngrades = \"FDCBA\"\n\ndef grade(x):\n    return grades[bisect.bisect_right(cutoffs, x)]\n\nreport = []\nfor idx, (name, mid, final) in enumerate(scores):\n    avg = (mid + final) / 2\n    report.append((name, avg, grade(avg)))\n\nreport.sort(key=lambda t: (-t[1], t[0]))\nfor pos, (name, avg, g) in enumerate(report, start=1):\n    flag = \"*\" if avg >= 90 else (\"!\" if avg < 60 else \"\")\n    print(\"{:>2} {:<6}{:6.1f} {}{}\".format(pos, name, avg, g, flag))\n\nnames, mids, finals = zip(*scores)\nprint(names[::-1], max(mids), min(finals))\nimproved = [n for n, m, f in scores if f > m]\nprint(\"improved:\", \", \".join(improved) or \"nobody\")\n\nby_grade = {}\nfor name, _, g in report:\n    by_grade.setdefault(g, []).append(name)\nprint({g: by_grade[g] for g in grades if g in by_grade})\n\npairs = list(itertools.combinations(names[:4], 2))\nprint(len(pairs), pairs[0], pairs[-1])\nfor g, group in itertools.groupby(sorted(report, key=lambda t: t[2]), key=lambda t: t[2]):\n    print(g, [n for n, *_ in group])\n\nrunning = list(itertools.accumulate(mids))\nprint(running, list(itertools.accumulate(mids, max)))\npos = bisect.bisect_left(sorted(finals), 90)\nprint(pos, sorted(finals)[pos:])\ni = 0\nwhile i < len(report):\n    if report[i][2] == \"F\":\n        print(\"first fail at\", i)\n        break\n    i += 1\nelse:\n    print(\"no fails\")\n",
    "expected": " 1 Cara    96.5 A*\n 2 Alice   90.0 A*\n 3 Eve     89.0 B\n 4 Bob     67.5 D\n 5 Dan     59.5 F!\n 6 Finn    56.0 F!\n('Finn', 'Eve', 'Dan', 'Cara', 'Bob', 'Alice') 95 59\nimproved: Alice, Cara, Eve, Finn\n{'F': ['Dan', 'Finn'], 'D': ['Bob'], 'B': ['Eve'], 'A': ['Cara', 'Alice']}\n6 ('Alice', 'Bob') ('Cara', 'Dan')\nA ['Cara', 'Alice']\nB ['Eve']\nD ['Bob']\nF ['Dan', 'Finn']\n[88, 163, 258, 318, 406, 446] [88, 88, 95, 95, 95, 95]\n3 [90, 92, 98]\nfirst fail at 4\n"
  },
  "fuzz_9": {
    "code": "import string\n\ndef caesar(s, k):\n    out = []\n    for ch in s:\n        if ch.isupper():\n            out.append(chr((ord(ch) - 65 + k) % 26 + 65))\n        elif ch.islower():\n            out.append(chr((ord(ch) - 97 + k) % 26 + 97))\n        else:\n            out.append(ch)\n    return \"\".join(out)\n\ndef rle(s):\n    if not s:\n        return \"\"\n    res, prev, n = [], s[0], 1\n    for ch in s[1:]:\n        if ch == prev:\n            n += 1\n        else:\n            res.append(f\"{n}{prev}\" if n > 1 else prev)\n            prev, n = ch, 1\n    res.append(f\"{n}{prev}\" if n > 1 else prev)\n    return \"\".join(res)\n\ndef is_pal(s):\n    t = [c.lower() for c in s if c.isalnum()]\n    return t == t[::-1]\n\nmsg = \"Hello, World! xyz\"\nenc = caesar(msg, 3)\nprint(enc, \"|\", caesar(enc, -3), \"|\", caesar(msg, -29) == caesar(msg, -3))\nfor s in [\"aaabccddddde\", \"\", \"abc\", \"zzzzzzzzzzzz\"]:\n    print(repr(s), \"->\", repr(rle(s)))\ntests = [\"A man, a plan, a canal: Panama\", \"race a car\", \"\", \"No 'x' in Nixon\"]\nprint([is_pal(t) for t in tests])\ntable = str.maketrans(\"aeiou\", \"AEIOU\", string.punctuation)\nprint(\"it's a fine-day, isn't it?\".translate(table))\nline = \"  name=Tom ; age = 17;city=Taipei ;; \"\npairs = dict(p.split(\"=\") for p in map(str.strip, line.split(\";\")) if \"=\" in p)\ninfo = {k.strip(): v.strip() for k, v in pairs.items()}\nprint(info, info.get(\"zip\", \"N/A\"))\nwords = \"one two three four five\".split()\nprint(\"-\".join(w[::-1] for w in words), \" \".join(w.capitalize() for w in words))\nprint(\"abc\" * 3, \"-\" * 0 + \"|\", \"x\".center(7, \"*\"), \"42\".zfill(5), \"a,b,,c\".split(\",\"))\nprint(\"banana\".replace(\"an\", \"AN\", 1), \"banana\".count(\"ana\"), \"banana\".find(\"z\"), \"banana\".rfind(\"a\"))\n",
    "expected": "Khoor, Zruog! abc | Hello, World! xyz | True\n'aaabccddddde' -> '3ab2c5de'\n'' -> ''\n'abc' -> 'abc'\n'zzzzzzzzzzzz' -> '12z'\n[True, False, True, True]\nIts A fInEdAy Isnt It\n{'name': 'Tom', 'age': '17', 'city': 'Taipei'} N/A\neno-owt-eerht-ruof-evif One Two Three Four Five\nabcabcabc | ***x*** 00042 ['a', 'b', '', 'c']\nbANana 1 -1 5\n"
  },
  "fuzz_10": {
    "code": "from collections import deque\n\nGRID = [\n    \"S.#.....\",\n    \".##.###.\",\n    \"....#...\",\n    \"#.#.#.#.\",\n    \"..#...#E\",\n]\nROWS, COLS = len(GRID), len(GRID[0])\nDIRS = {\"U\": (-1, 0), \"D\": (1, 0), \"L\": (0, -1), \"R\": (0, 1)}\n\ndef find(ch):\n    for r, row in enumerate(GRID):\n        if (c := row.find(ch)) != -1:\n            return r, c\n    return None\n\ndef bfs(start, goal):\n    q = deque([start])\n    came = {start: None}\n    while q:\n        cur = q.popleft()\n        if cur == goal:\n            break\n        r, c = cur\n        for name, (dr, dc) in DIRS.items():\n            nr, nc = r + dr, c + dc\n            if 0 <= nr < ROWS and 0 <= nc < COLS and GRID[nr][nc] != \"#\" and (nr, nc) not in came:\n                came[(nr, nc)] = (cur, name)\n                q.append((nr, nc))\n    else:\n        return None\n    moves = []\n    node = goal\n    while came[node] is not None:\n        node, step = came[node]\n        moves.append(step)\n    return \"\".join(reversed(moves))\n\ndef main():\n    start, goal = find(\"S\"), find(\"E\")\n    print(\"start\", start, \"goal\", goal, \"missing\", find(\"Q\"))\n    path = bfs(start, goal)\n    print(\"path:\", path, \"len\", len(path) if path else -1)\n    canvas = [list(row) for row in GRID]\n    r, c = start\n    for step in path[:-1]:\n        dr, dc = DIRS[step]\n        r, c = r + dr, c + dc\n        canvas[r][c] = \"*\"\n    print(\"\\n\".join(\"\".join(row) for row in canvas))\n    counts = {d: path.count(d) for d in \"UDLR\"}\n    print(counts, sum(counts.values()) == len(path))\n    walls = sum(row.count(\"#\") for row in GRID)\n    print(f\"walls={walls} open={ROWS * COLS - walls}\")\n\nif __name__ == \"__main__\":\n    main()\n",
    "expected": "start (0, 0) goal (4, 7) missing None\npath: DDRRRUURRRRDDDD len 15\nS.#*****\n*##*###*\n****#..*\n#.#.#.#*\n..#...#E\n{'U': 2, 'D': 6, 'L': 0, 'R': 7} True\nwalls=13 open=27\n"
  }
}

/** 照實保留的節點：`unresolved` 記它的 AST 節點型別，`raw_expression` 記身分 */
function kept(n: SemanticNode | null, out: string[] = []): string[] {
  if (!n) return out
  if (n.componentId === 'unresolved') { out.push(String(n.properties?.node_type)); return out }
  if (/raw/.test(n.componentId)) { out.push(n.componentId.replace(/^python:/, '')); return out }
  for (const k of Object.values(n.slots ?? {})) for (const c of (k as SemanticNode[]) ?? []) kept(c, out)
  return out
}

async function roundTrip(id: string, keptTypes: string[], anchors: string[]): Promise<void> {
  const t = await liftPython(P[id].code)
  const ids = componentIdsOf(t)
  expect(ids, '正向錨點：樹裡有程式').toContain('python:program')
  for (const a of anchors) expect(ids, `正向錨點：${a}`).toContain(a)
  expect(kept(t).sort(), '照實保留的清單').toEqual([...keptTypes].sort())
  const gen = generatePython(t)
  expect(generatePython(await liftPython(gen)), '第二趟漂了').toBe(gen)
}

const want = (id: string) => 'completed|' + P[id].expected

describe('模糊測試：學生的 Python 程式，盲測第二批', () => {
  it('fuzz_1：', async () => {
    await roundTrip('fuzz_1', [], [])
    await knownCellaGap(/from collections import Counter/, async () => {
      const r = await runPython(P.fuzz_1.code)
      if (r !== want('fuzz_1')) throw new Error(r)
    })
  })
  it('fuzz_2：', async () => {
    await roundTrip('fuzz_2', [], [])
    expect(await runPython(P.fuzz_2.code)).toBe(want('fuzz_2'))
  })
  // class 因 @staticmethod 整段照實保留（下一刀：裝飾器）
  it('fuzz_3：', async () => {
    await roundTrip('fuzz_3', ["class_definition"], [])
  })
  // match 還沒有元件
  it('fuzz_4：', async () => {
    await roundTrip('fuzz_4', ["match_statement", "match_statement"], [])
  })
  // 三段以上的比較鏈還沒收（compare_chain 只收兩段）
  it('fuzz_5：', async () => {
    await roundTrip('fuzz_5', ["raw_expression"], [])
  })
  it('fuzz_6：', async () => {
    await roundTrip('fuzz_6', [], [])
    await knownCellaGap(/importing heapq/, async () => {
      const r = await runPython(P.fuzz_6.code)
      if (r !== want('fuzz_6')) throw new Error(r)
    })
  })
  // @lru_cache 與 *args／**kw 參數還沒收
  it('fuzz_7：', async () => {
    await roundTrip('fuzz_7', ["decorated_definition", "function_definition"], ["python:nonlocal"])
  })
  it('fuzz_8：', async () => {
    await roundTrip('fuzz_8', [], [])
    await knownCellaGap(/importing bisect/, async () => {
      const r = await runPython(P.fuzz_8.code)
      if (r !== want('fuzz_8')) throw new Error(r)
    })
  })
  it('fuzz_9：', async () => {
    await roundTrip('fuzz_9', [], [])
    await knownCellaGap(/importing string/, async () => {
      const r = await runPython(P.fuzz_9.code)
      if (r !== want('fuzz_9')) throw new Error(r)
    })
  })
  it('fuzz_10：', async () => {
    await roundTrip('fuzz_10', [], [])
    await knownCellaGap(/from collections import deque/, async () => {
      const r = await runPython(P.fuzz_10.code)
      if (r !== want('fuzz_10')) throw new Error(r)
    })
  })

  // 423 的兩顆，單獨釘一次：產回去的那一句一字不差，而且走得到 Cella
  it('fuzz_3 的 del b.rate 收成 python:delete', async () => {
    const t = await liftPython('class B:\n    pass\nb = B()\nb.rate = 1\ndel b.rate\nprint(hasattr(b, "x"))\n')
    expect(componentIdsOf(t)).toContain('python:delete')
    expect(generatePython(t)).toContain('del b.rate\n')
  })
  it('fuzz_7 的 nonlocal 收成 python:nonlocal，跑出來對', async () => {
    const code = P.fuzz_7.code.split('\n').slice(4, 12).join('\n') + '\nc = make_counter(10, 2)\nprint(c(), c(3))\n'
    const t = await liftPython(code)
    expect(componentIdsOf(t)).toContain('python:nonlocal')
    expect(generatePython(t)).toContain('nonlocal count\n')
    expect(await runPython(code)).toBe('completed|12 18\n')
  })
})
