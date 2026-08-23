/**
 * 模糊測試的**永久回歸**——Python 的內建方法那一批（2026-08-23）。
 *
 * ## 這十段程式不是我寫的
 *
 * 它們由一個**看不到這個 repo 的**出題代理寫出來（資訊隔離：它只知道
 * 「Python 老師出中級練習題」，不知道有哪些積木、哪裡有洞）。
 *
 * > **一個知道實作的人寫測試，會下意識繞開實作處理不了的寫法。**
 *
 * 而 `expected` 是**真的 `python3` 跑出來的輸出**，不是我判斷應該是什麼。
 *
 * ## 這一輪它抓到什麼（全部當場修掉）
 *
 * | 症狀 | 根因 |
 * |---|---|
 * | `"-7".zfill(5)` 給 `000-7` | 補零沒有把符號留在最前面 |
 * | `round(10.0, 2)` 印成 `10` | 給了位數還回整數型別 |
 * | `map(f, "ab", [1,2])` 每一格都 `None` | `map` 只讀第二個引數，不吃多串 |
 * | `filter(None, xs)` 說「這個東西叫不動」 | 沒有處理「判斷式是 None」這個慣用寫法 |
 * | `" ".join(f(x) for x in xs)` 說 `x` 沒宣告 | 裸的產生器被當成兩個引數 |
 * | `d.pop(k)` 炸在 `xs.splice is not a function` | `pop` 只當串列處理 |
 * | `repr` / `.setdefault` / `.add` 不存在 | 內建表的缺口 |
 * | `{1,2} & {2}` 整段降級 | 集合的四個運算沒有 |
 * | `def f(coins=(25,10,5,1))` 跑不動 | 預設值只認純量字面 |
 *
 * ⚠️ 而**每一個修法都要對得上真的 Python**——包括那個有名的陷阱：
 * `def collect(item, bucket=[])` 的串列**在每次呼叫之間共用**。
 */
import { describe, it, expect } from 'vitest'
import { liftPython, generatePython, componentIdsOf, runPython } from '../helpers/python-lift'

interface Case { id: string; why: string; tricky: string; code: string; expected: string }

const CASES: Case[] = [
  {
    id: "fuzz_1",
    why: "String search and padding methods (find/index/count/startswith/endswith/ljust/rjust/zfill) driven through a formatted report loop.",
    tricky: "find() returns -1 for a missing character and that -1 is summed and then zfill'd, while a membership test guards the index() call that would otherwise raise.",
    code: "def pad_label(label, width):\n    label = label.strip()\n    if len(label) > width:\n        label = label[:width - 1] + \"~\"\n    return label.ljust(width, \".\")\n\n\ndef tag_of(code):\n    if code.startswith(\"A\") and code.endswith(\"9\"):\n        return \"alpha\"\n    elif code.startswith(\"A\") or code.endswith(\"9\"):\n        return \"partial\"\n    return \"plain\"\n\n\ncodes = [\"  A19\", \"B29 \", \"A07\", \"  zz9\", \"AB\"]\ntotal = 0\nfor i, raw in enumerate(codes):\n    code = raw.strip()\n    pos = code.find(\"9\")\n    total += pos\n    print(\"{0:>2}|{1}|{2}|{3}\".format(i, pad_label(raw, 4), tag_of(code), str(pos).zfill(2)))\n\njoined = \"\".join(codes)\nprint(\"total\", total)\nprint(\"count9\", joined.count(\"9\"))\nprint(\"find\", joined.find(\"z\"), joined.find(\"q\"))\nif \"q\" in joined:\n    print(\"index\", joined.index(\"q\"))\nelse:\n    print(\"no q, z at\", joined.index(\"z\"))\nprint(\"rjust\", \"end\".rjust(8, \"-\"), \"zfill\", \"-7\".zfill(5))\n",
    expected: " 0|A19.|alpha|02\n 1|B29.|partial|02\n 2|A07.|partial|-1\n 3|zz9.|partial|02\n 4|AB..|partial|-1\ntotal 4\ncount9 3\nfind 14 -1\nno q, z at 14\nrjust -----end zfill -0007\n",
  },
  {
    id: "fuzz_2",
    why: "In-place list mutation versus new-list semantics across aliasing, slicing, sort/sorted, insert/remove/pop and negative indices.",
    tricky: "sort() returns None while sorted() returns a list, an aliased name mutates with the original, and insert(-1, x) lands before the last element rather than at the end.",
    code: "def add_score(scores, value):\n    scores.append(value)\n    return scores\n\n\ndef normalized(scores):\n    out = scores[:]\n    out.sort()\n    return out\n\n\nbase = [40, 10, 30]\nalias = base\ncopy = list(base)\nreturned = add_score(base, 20)\nprint(\"base\", base)\nprint(\"alias\", alias)\nprint(\"copy\", copy)\nprint(\"same object\", returned is base, copy is base)\n\nprint(\"normalized\", normalized(base))\nprint(\"base after normalized\", base)\n\nprint(\"sorted() returns\", sorted(base))\nprint(\"sort() returns\", base.sort())\nprint(\"base now\", base)\n\nbase.insert(1, 15)\nbase.remove(30)\nprint(\"after insert/remove\", base)\n\nlast = base.pop()\nfirst = base.pop(0)\nprint(\"popped\", last, first, base)\n\nbase.insert(-1, 99)\nprint(\"insert at -1\", base)\nprint(\"negatives\", base[-1], base[-2:], base[:-1])\n",
    expected: "base [40, 10, 30, 20]\nalias [40, 10, 30, 20]\ncopy [40, 10, 30]\nsame object True False\nnormalized [10, 20, 30, 40]\nbase after normalized [40, 10, 30, 20]\nsorted() returns [10, 20, 30, 40]\nsort() returns None\nbase now [10, 20, 30, 40]\nafter insert/remove [10, 15, 20, 40]\npopped 40 10 [15, 20]\ninsert at -1 [15, 99, 20]\nnegatives 20 [99, 20] [15, 99]\n",
  },
  {
    id: "fuzz_3",
    why: "map/filter/all/any combined with isinstance dispatch over a deliberately mixed-type list.",
    tricky: "isinstance(True, int) is True so bools take the int branch and inflate the int count, map over two iterables stops at the shorter one, and filter(None, ...) drops 0 and False but keeps 'drop'.",
    code: "def weight(item):\n    if isinstance(item, bool):\n        return 100\n    if isinstance(item, int):\n        return item * 2\n    if isinstance(item, str):\n        return len(item)\n    return -1\n\n\ndef keep(item):\n    return not isinstance(item, str) or item.startswith(\"k\")\n\n\nraw = [3, True, \"keep\", \"drop\", 0, False, \"kx\", 7.5]\n\nweights = list(map(weight, raw))\nprint(\"weights\", weights)\n\nkept = list(filter(keep, raw))\nprint(\"kept\", kept)\n\nprint(\"all ints?\", all(isinstance(x, int) for x in raw))\nprint(\"any float?\", any(isinstance(x, float) for x in raw))\nprint(\"bools counted as int:\", sum(1 for x in raw if isinstance(x, int)))\n\npairs = list(map(lambda a, b: \"{}={}\".format(a, b), \"abcd\", [1, 2, 3]))\nprint(\"zipped map\", pairs)\n\ntruthy = list(filter(None, raw))\nprint(\"filter None\", truthy)\n\ntotal = 0\nfor idx, w in enumerate(weights):\n    if w < 0:\n        continue\n    total += w\n    if total > 120:\n        print(\"stopped at index\", idx)\n        break\nprint(\"total\", total)\n",
    expected: "weights [6, 100, 4, 4, 0, 100, 2, -1]\nkept [3, True, 'keep', 0, False, 'kx', 7.5]\nall ints? False\nany float? True\nbools counted as int: 4\nzipped map ['a=1', 'b=2', 'c=3']\nfilter None [3, True, 'keep', 'drop', 'kx', 7.5]\nstopped at index 5\ntotal 214\n",
  },
  {
    id: "fuzz_4",
    why: "Sort stability and multi-key ordering with sorted(), list.sort(key=..., reverse=True), index() and count() on tuple records.",
    tricky: "Equal keys keep their prior order even under reverse=True, so the two-pass sort (name first, then score) yields a different result than a single sort would.",
    code: "def score_of(record):\n    return record[1]\n\n\ndef show(title, rows):\n    print(title)\n    for name, score in rows:\n        print(\"  \" + name.ljust(6, \" \") + str(score).rjust(3))\n\n\nrecords = [(\"bob\", 3), (\"amy\", 1), (\"cat\", 3), (\"dan\", 1), (\"eve\", 2), (\"amy\", 3)]\n\nshow(\"by score\", sorted(records, key=score_of))\nshow(\"reverse\", sorted(records, key=score_of, reverse=True))\nshow(\"by name then default\", sorted(sorted(records), key=score_of))\n\nwork = records[:]\nwork.sort(key=lambda r: len(r[0]))\nshow(\"by name length (stable)\", work)\n\nwork.sort(key=score_of, reverse=True)\nshow(\"then by score desc\", work)\n\nnames = [r[0] for r in records]\nprint(\"first amy at\", names.index(\"amy\"), \"amy count\", names.count(\"amy\"))\nprint(\"unique sorted\", sorted(set(names)))\nprint(\"set size vs list size\", len(set(names)), len(names))\n",
    expected: "by score\n  amy     1\n  dan     1\n  eve     2\n  bob     3\n  cat     3\n  amy     3\nreverse\n  bob     3\n  cat     3\n  amy     3\n  eve     2\n  amy     1\n  dan     1\nby name then default\n  amy     1\n  dan     1\n  eve     2\n  amy     3\n  bob     3\n  cat     3\nby name length (stable)\n  bob     3\n  amy     1\n  cat     3\n  dan     1\n  eve     2\n  amy     3\nthen by score desc\n  bob     3\n  cat     3\n  amy     3\n  eve     2\n  amy     1\n  dan     1\nfirst amy at 1 amy count 2\nunique sorted ['amy', 'bob', 'cat', 'dan', 'eve']\nset size vs list size 5 6\n",
  },
  {
    id: "fuzz_5",
    why: "Short-circuit evaluation of and/or traced through functions that record every call they make.",
    tricky: "The trace list reveals exactly which operands were evaluated, and and/or return the operand value (0, 2, 3) rather than a bool.",
    code: "trace = []\n\n\ndef check(name, value):\n    trace.append(name)\n    return value\n\n\ndef classify(n):\n    if check(\"neg\", n < 0) or check(\"big\", n > 100):\n        return \"out\"\n    if check(\"even\", n % 2 == 0) and check(\"small\", n < 10):\n        return \"even-small\"\n    return \"plain\"\n\n\nfor n in [-5, 200, 4, 12, 7]:\n    trace = []\n    label = classify(n)\n    print(\"{0:>4} -> {1:<10} trace={2}\".format(n, label, \",\".join(trace)))\n\ncalls = []\n\n\ndef note(tag):\n    calls.append(tag)\n    return len(tag)\n\n\na = note(\"x\") and note(\"yy\")\nb = note(\"\") and note(\"zzz\")\nc = note(\"\") or note(\"www\")\nprint(\"a b c\", a, b, c)\nprint(\"calls\", calls, \"count of empty\", calls.count(\"\"))\n\nflag = True\nflag = flag and not calls.count(\"q\")\nprint(\"flag\", flag, isinstance(flag, bool))\n",
    expected: "  -5 -> out        trace=neg\n 200 -> out        trace=neg,big\n   4 -> even-small trace=neg,big,even,small\n  12 -> plain      trace=neg,big,even,small\n   7 -> plain      trace=neg,big,even\na b c 2 0 3\ncalls ['x', 'yy', '', '', 'www'] count of empty 2\nflag True True\n",
  },
  {
    id: "fuzz_6",
    why: "Off-by-one boundaries, reverse building with a while loop, and negative/overshooting slice behaviour on strings.",
    tricky: "range(len(s) + 1) walks one index past the end and relies on break, the empty string makes w[-1:] fall through to an `or` default, and out-of-range slices return '' instead of raising.",
    code: "def trim_tail(word, n):\n    if n >= len(word):\n        return \"\"\n    return word[:len(word) - n]\n\n\ndef mirror(word):\n    result = \"\"\n    i = len(word) - 1\n    while i >= 0:\n        result += word[i]\n        i -= 1\n    return result\n\n\nwords = [\"level\", \"python\", \"ab\", \"\", \"noon\"]\nfor w in words:\n    print(\"[{0}] rev=[{1}] tail2=[{2}] last={3}\".format(\n        w, mirror(w), trim_tail(w, 2), w[-1:] or \"<none>\"))\n\nsentence = \"the quick brown fox\"\nfor i in range(len(sentence) + 1):\n    if i >= len(sentence):\n        print(\"index\", i, \"is past the end\")\n        break\n    if sentence[i] != \" \":\n        continue\n    print(\"space at\", i, \"word before =\", sentence[:i].split(\" \")[-1])\n\nprint(\"slice overshoot\", sentence[10:100])\nprint(\"empty slice\", repr(sentence[100:110]))\nprint(\"negative step\", sentence[::-1][:9])\nprint(\"last three\", sentence[-3:], \"all but last three\", sentence[:-3])\n",
    expected: "[level] rev=[level] tail2=[lev] last=l\n[python] rev=[nohtyp] tail2=[pyth] last=n\n[ab] rev=[ba] tail2=[] last=b\n[] rev=[] tail2=[] last=<none>\n[noon] rev=[noon] tail2=[no] last=n\nspace at 3 word before = the\nspace at 9 word before = quick\nspace at 15 word before = brown\nindex 19 is past the end\nslice overshoot brown fox\nempty slice ''\nnegative step xof nworb\nlast three fox all but last three the quick brown \n",
  },
  {
    id: "fuzz_7",
    why: "divmod-based coin change with default, keyword and mutable default arguments plus a while loop with break.",
    tricky: "The shared mutable default list in collect() persists between calls, keyword arguments are passed out of declaration order, and divmod on a negative number floors toward negative infinity.",
    code: "def make_change(amount, coins=(25, 10, 5, 1), log=None):\n    if log is None:\n        log = []\n    used = []\n    for coin in coins:\n        count, amount = divmod(amount, coin)\n        used.append(count)\n        log.append(\"{0}x{1}\".format(count, coin))\n    return used, log\n\n\ndef collect(item, bucket=[]):\n    bucket.append(item)\n    return bucket\n\n\nfor amount in [0, 7, 99, 141]:\n    used, log = make_change(amount)\n    print(str(amount).rjust(4), used, \" \".join(log))\n\nused, shared = make_change(30, log=[\"start\"])\nprint(\"with log\", used, shared)\nprint(\"keyword order\", make_change(coins=(50, 1), amount=53)[0])\n\nprint(\"collect a\", collect(\"a\"))\nprint(\"collect b\", collect(\"b\"))\nprint(\"collect c fresh\", collect(\"c\", []))\nprint(\"collect d\", collect(\"d\"))\n\nq, r = divmod(-7, 3)\nprint(\"divmod negative\", q, r, -7 // 3, -7 % 3)\n\ntotal = 0\nstep = 1\nwhile step <= 5:\n    total += step * step\n    step += 1\n    if total > 30:\n        break\nprint(\"total\", total, \"step\", step)\n",
    expected: "   0 [0, 0, 0, 0] 0x25 0x10 0x5 0x1\n   7 [0, 0, 1, 2] 0x25 0x10 1x5 2x1\n  99 [3, 2, 0, 4] 3x25 2x10 0x5 4x1\n 141 [5, 1, 1, 1] 5x25 1x10 1x5 1x1\nwith log [1, 0, 1, 0] ['start', '1x25', '0x10', '1x5', '0x1']\nkeyword order [1, 3]\ncollect a ['a']\ncollect b ['a', 'b']\ncollect c fresh ['c']\ncollect d ['a', 'b', 'd']\ndivmod negative -3 2 -3 2\ntotal 55 step 6\n",
  },
  {
    id: "fuzz_8",
    why: "Dictionary accumulation with get/setdefault/pop/items, case-folded keys, and sorting by a computed key.",
    tricky: "Case folding merges 'Apple' and 'apple' in the tally but not in the first-letter grouping, and pop() with a default survives the second removal of the same key.",
    code: "def tally(words):\n    counts = {}\n    for w in words:\n        key = w.lower()\n        counts[key] = counts.get(key, 0) + 1\n    return counts\n\n\ndef group_by_first(words):\n    groups = {}\n    for w in words:\n        groups.setdefault(w[0], []).append(w)\n    return groups\n\n\ntext = \"Apple banana apple Cherry banana apple date\"\nwords = text.split()\n\ncounts = tally(words)\nfor key in sorted(counts):\n    print(key.ljust(8, \"_\"), str(counts[key]).zfill(2))\n\ngroups = group_by_first(words)\nfor letter, members in sorted(groups.items()):\n    print(letter, len(members), members)\n\nprint(\"get missing\", counts.get(\"fig\"), counts.get(\"fig\", 0))\nremoved = counts.pop(\"date\")\nprint(\"popped date\", removed, \"left\", len(counts))\nprint(\"pop missing\", counts.pop(\"date\", -1))\n\ninverted = {}\nfor word, n in counts.items():\n    inverted.setdefault(n, []).append(word)\nprint(\"inverted\", sorted(inverted.items()))\n\nprint(\"keys sorted by count then name\",\n      sorted(counts, key=lambda k: (-counts[k], k)))\nprint(\"in check\", \"apple\" in counts, \"Apple\" in counts)\n",
    expected: "apple___ 03\nbanana__ 02\ncherry__ 01\ndate____ 01\nA 1 ['Apple']\nC 1 ['Cherry']\na 2 ['apple', 'apple']\nb 2 ['banana', 'banana']\nd 1 ['date']\nget missing None 0\npopped date 1 left 3\npop missing -1\ninverted [(1, ['cherry']), (2, ['banana']), (3, ['apple'])]\nkeys sorted by count then name ['apple', 'banana', 'cherry']\nin check True False\n",
  },
  {
    id: "fuzz_9",
    why: "Nested function calls with a local variable shadowing a module-level name, plus a closure used as a helper.",
    tricky: "The local `total` inside fee() and summarize() never touches the module-level `total`, which still prints as 0 after the accumulation.",
    code: "total = 0\n\n\ndef fee(amount):\n    total = amount * 0.1\n    return round(total, 2)\n\n\ndef net(amount):\n    return round(amount - fee(amount), 2)\n\n\ndef summarize(items):\n    total = 0\n    lines = []\n    for name, amount in items:\n        value = net(amount)\n        total += value\n        lines.append(\"{0:<8}{1:>8.2f}{2:>8.2f}\".format(name, amount, value))\n    return lines, round(total, 2)\n\n\ndef bucket(amount):\n    def label(v):\n        if v < 50:\n            return \"low\"\n        return \"high\"\n    return label(amount) + \"/\" + str(len(str(int(amount))))\n\n\nitems = [(\"rent\", 800), (\"food\", 45.5), (\"bus\", 12), (\"gym\", 49.99)]\nlines, grand = summarize(items)\nfor line in lines:\n    print(line)\nprint(\"grand\", grand, \"module total still\", total)\n\nfor name, amount in items:\n    print(name.rjust(6, \".\"), bucket(amount))\n\namount = 100\nprint(\"shadow check\", fee(amount), amount)\nprint(\"nested call\", net(fee(200)))\n",
    expected: "rent      800.00  720.00\nfood       45.50   40.95\nbus        12.00   10.80\ngym        49.99   44.99\ngrand 816.74 module total still 0\n..rent high/3\n..food low/2\n...bus low/2\n...gym low/2\nshadow check 10.0 100\nnested call 18.0\n",
  },
  {
    id: "fuzz_10",
    why: "Nested-loop grid transposition with all/any generator predicates, set algebra and first-seen deduplication.",
    tricky: "An all-zero row passes the all() bound but fails the any() half, and all([])/any([]) on empty input give True/False respectively.",
    code: "def row_ok(row, limit):\n    return all(cell <= limit for cell in row) and any(cell > 0 for cell in row)\n\n\ndef transpose(grid):\n    out = []\n    for c in range(len(grid[0])):\n        column = []\n        for r in range(len(grid)):\n            column.append(grid[r][c])\n        out.append(column)\n    return out\n\n\ngrid = [[1, 5, 3], [0, 0, 0], [9, 2, 4], [2, 2, 2]]\n\nfor i, row in enumerate(grid):\n    mark = \"ok\" if row_ok(row, 5) else \"no\"\n    print(\"row{0} {1} {2}\".format(i, mark, \" \".join(str(c).rjust(2) for c in row)))\n\nfor j, col in enumerate(transpose(grid)):\n    print(\"col\" + str(j), col, \"max\", max(col), \"sum\", sum(col))\n\nflat = [c for row in grid for c in row]\nuniq = set(flat)\nprint(\"flat len\", len(flat), \"uniq len\", len(uniq))\nprint(\"sorted uniq\", sorted(uniq))\nprint(\"evens\", sorted(x for x in uniq if x % 2 == 0))\nprint(\"intersection\", sorted(uniq & {0, 2, 4, 6, 8}))\nprint(\"difference\", sorted(uniq - set(range(5))))\n\nseen = set()\norder = []\nfor value in flat:\n    if value in seen:\n        continue\n    seen.add(value)\n    order.append(value)\nprint(\"first-seen order\", order)\nprint(\"all positive?\", all(x > 0 for x in flat), \"any > 8?\", any(x > 8 for x in flat))\nprint(\"empty all()\", all([]), \"empty any()\", any([]))\n",
    expected: "row0 ok  1  5  3\nrow1 no  0  0  0\nrow2 no  9  2  4\nrow3 ok  2  2  2\ncol0 [1, 0, 9, 2] max 9 sum 12\ncol1 [5, 0, 2, 2] max 5 sum 9\ncol2 [3, 0, 4, 2] max 4 sum 9\nflat len 12 uniq len 7\nsorted uniq [0, 1, 2, 3, 4, 5, 9]\nevens [0, 2, 4]\nintersection [0, 2, 4]\ndifference [5, 9]\nfirst-seen order [1, 5, 3, 0, 9, 2, 4]\nall positive? False any > 8? True\nempty all() True empty any() False\n",
  },
]

describe('模糊測試回歸：Python 內建方法（隔離出題者 ＋ 真 python3 對答案）', () => {
  it('★ 錨點：十段都真的載進來了', () => {
    expect(CASES.length).toBe(10)
    for (const c of CASES) {
      expect(c.code.length, c.id).toBeGreaterThan(100)
      expect(c.expected.length, c.id).toBeGreaterThan(10)
    }
  })

  for (const c of CASES) {
    it(`${c.id}：不降級 ＋ 來回一致 ＋ 答案與真 python3 相同`, async () => {
      const tree = await liftPython(c.code)
      const ids = componentIdsOf(tree)
      expect(ids.length, '一段都沒抬升起來——負向斷言會空過').toBeGreaterThan(5)
      expect(ids, `${c.id} 有降級節點（${c.why}）`).not.toContain('raw_code')
      expect(ids, `${c.id} 有降級節點`).not.toContain('unresolved')

      // 來回：產回去再抬一次，身分集合要一樣（P1 可逆性）
      const again = componentIdsOf(await liftPython(generatePython(tree)))
      expect([...new Set(again)].sort(), `${c.id} 來回之後身分變了`).toEqual([...new Set(ids)].sort())

      const out = await runPython(c.code)
      expect(out.startsWith('completed|'), `${c.id} 跑不動：${out}`).toBe(true)
      expect(out.slice('completed|'.length).trimEnd(), `${c.id}：${c.tricky}`)
        .toBe(c.expected.trimEnd())
    }, 60_000)
  }
})
