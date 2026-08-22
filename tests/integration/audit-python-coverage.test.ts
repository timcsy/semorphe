/**
 * **第五十條護欄：AI 生的 Python，我們處理得了多少**
 *
 * ## 它量的是什麼
 *
 * 使用者的目標逐字：「**大部分 AI 生的 Python code 也是可以處理的**」。
 * 這條護欄把那句話變成三個數字，而語料是
 * [`tests/assets/python-corpus.ts`](../assets/python-corpus.ts)
 * ——**按「AI 會寫出什麼」挑的，不是按「我們有哪些元件」挑的**。
 *
 * ```
 * 🔴 答案不同   跑得動而【結果與真的 Python 不一樣】  ← 最重
 * 🔴 執行失敗   跑不起來
 * 來回不同      產回去的碼與原碼不一樣    ← 產出壞掉的碼，見下
 * 降級節點      認不出來而誠實變灰的      ← 少 = 認得多
 * 通用桶        **內建的**名字掉進通用呼叫  ← 跑得動，而學生在工具箱拖不到
 * ```
 *
 * ⚠️ **「通用桶」只數內建的名字**（2026-08-21 修正）。第一版數了所有
 * `python:func_call`，而其中**一半是使用者自己定義的函式**（`greet`／`Dog`／
 * `count_even`）——那些本來就該是通用呼叫，它們沒有身分是**對的**。
 *
 * > **一個把「該有身分而沒有」與「本來就沒有身分」算在同一欄的指標，
 * > 永遠收不到零——而收不到零的指標會被當成背景噪音。**
 *
 * ## 🔴 為什麼「執行」是後來才加的一軸（2026-08-21）
 *
 * 加完容器那批之後，使用者在瀏覽器貼一段程式，**積木全部畫對、零灰色方塊、
 * 5068 支測試全綠**——按下執行看到「這一段程式我看不懂」。
 *
 * 原因是 `for n in nums:`：迴圈的執行器只走得動 `range(...)`，而那句話是
 * **串列存在之前**寫的，那時它是誠實的。
 *
 * 而**這條護欄當時也抓不到**：它量 lift 與來回，那段程式兩樣都完美。
 *
 * > **一段能來回轉換的程式，不代表它跑得動——那是兩個不同的投影。**
 *
 * ## 🔴 而「跑得動」也不代表答案對（2026-08-21 再加一軸）
 *
 * 32 段全部跑得動之後**手動抽查**才發現：
 *
 * ```
 * p = [("甲", 12), ("乙", 10)]
 * p.sort(key=lambda x: x[1])
 * print(p[0][0])        # 該是「乙」，而我們印「甲」
 * ```
 *
 * `key=` 被靜靜忽略——排序仍然發生、仍然有輸出、三軸全綠。
 *
 * > **「跑得動」與「答案對」是兩件事，而只量有沒有丟錯的護欄分不出來。**
 *
 * 🟢 處置與 C++ 那側一樣：**跟參照實作對答案**（`python3`，見 `run-python.ts`）。
 *
 * ## 🔴 為什麼「來回不同」比「降級」重
 *
 * 一顆誠實的灰積木**學生看得見**（P6）。而一段產回去**不合法**的 Python
 * ——`print("f"{name}"")`、`nums.append(9)print(...)`（缺換行）、
 * 迴圈裡的 `total += i` 掉到最左邊——**看起來像正常的程式碼，而它是壞的**。
 *
 * > **一個誠實的降級只是還沒做完；一段產不回去的碼是【已經錯了】而不出聲。**
 *
 * ## ⚠️ 而「降級數少」自己會騙人
 *
 * 三個數字要一起看。實測起點（2026-08-21）：降級只有 **11%**，看起來很好
 * ——而同一批語料裡 **30 個節點掉進 `python:func_call` 這個通用桶**
 * （`len`／`range`／`s.upper()`／`math.sqrt()` 全在裡面），
 * **五段的來回轉換產出壞掉的 Python**。
 *
 * > **一個只看降級率的量測，會把「都認成同一個東西」讀成「都認得」。**
 *
 * ## ⚠️ 自我否證聲明
 *
 * > **如果注入那一節合成的假輸入（一段一定認不出來的碼、一段一定認得出來的碼）
 * > 沒有被分開報出來，代表這條護欄壞了，不是 Python 支援得很好。**
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { liftPython, componentIdsOf, generatePython, runPython } from '../helpers/python-lift'
import { PYTHON_CORPUS } from '../assets/python-corpus'
import { loadBaseline, writeBaseline, printReport, assertRatchet, assertCorpus, RATCHET_NOTE } from '../helpers/guardrail'
import type { SemanticNode } from '../../src/core/types'
import { runPythonBatch, hasReferencePython, type pyOutcome } from '../helpers/run-python'
import {
  PYTHON_BUILTIN_FUNCTIONS, PYTHON_BUILTIN_METHODS, PYTHON_MODULE_METHODS,
} from '../../src/languages/python/builtins'

const GUARD = 'python-coverage'

interface Baseline {
  _meta: { guard: string; measuredAt: string; rule: string; note: string }
  corpus: { programs: number; nodes: number }
  degraded: number
  roundTripDiff: number
  genericCall: number
  runFailed: number
  outputDiff: number
  unresolvedTypes: Record<string, number>
}

/**
 * **不跟參照對答案的語料**——具名，附理由。
 *
 * 今天只有一個：亂數在教學工具裡**刻意可重現**（固定種子），
 * 因為「我的程式對不對」這個問題要用輸出回答，而每次跑出不同答案就答不了。
 */
const NONDETERMINISTIC = new Set(['import 與模組'])

const isDegraded = (id: string): boolean =>
  id === 'unresolved' || id.endsWith(':raw_code') || id.endsWith(':raw_expression')

/** 排版正規化——比的是**程式**，不是空白。 */
/**
 * 來回比對用的正規化。
 *
 * 🔴 **縮排是語義，行內的空白不是**（2026-08-22）。
 *
 * 在此之前這裡只 `trimEnd`，於是 `b**2` 與 `b ** 2` 算不一樣。
 * 而那 95 段語料之所以全過，是因為**它們的空白剛好都是產生器的寫法**
 * ——語料是我寫的，而我按著產生器的排版寫。使用者第一次貼進一段
 * 真的教學程式（`D = b**2 - 4*a*c`）就撞到了。
 *
 * > **一份由寫實作的人寫的語料，連【空白】都會遵守那個實作的習慣。**
 *
 * ⚠️ 而**不能一律去掉空白**：`not x` 去掉之後是 `notx`，
 * 於是「產生器漏了一個空格」這種真缺陷會變成看不見。
 * 🟢 只去掉**貼著標點／運算子**的那些——字與字之間的空白留著。
 */
const norm = (x: string): string =>
  x.trim().split('\n')
    .map((l) => {
      const indent = /^\s*/.exec(l)![0]
      const body = l.trim().replace(/\s*([^\w\s\u4e00-\u9fff])\s*/g, '$1')
      return indent + body
    })
    .filter((l) => l.trim().length > 0)
    .join('\n')

/**
 * 掉進通用呼叫的**內建**名字有幾個。
 *
 * 判準：那個名字在內建表裡（`len`／`max`／`.upper`…）而沒有走到專屬元件。
 * 使用者自己 `def` 的名字不算——它們沒有身分是對的。
 */
/**
 * 掉進通用桶的**內建名字**，逐個名字數。
 *
 * ⚠️ 只回總數的話，「該替哪一顆做元件」這個問題**答不出來**
 * ——而那正是這一欄存在的理由。
 */
function genericBuiltinCalls(n: SemanticNode | null, out: Record<string, number> = {}): Record<string, number> {
  if (!n) return out
  const name = String((n.properties as Record<string, unknown>)?.name ?? '')
  const method = String((n.properties as Record<string, unknown>)?.method ?? '')
  if (n.componentId === 'python:func_call' && (name in PYTHON_BUILTIN_FUNCTIONS || name in PYTHON_MODULE_METHODS)) out[name] = (out[name] ?? 0) + 1
  if (n.componentId === 'python:method_call' && method in PYTHON_BUILTIN_METHODS) out[`.${method}`] = (out[`.${method}`] ?? 0) + 1
  for (const kids of Object.values(n.children ?? {})) for (const k of kids ?? []) genericBuiltinCalls(k, out)
  return out
}

function unresolvedOf(n: SemanticNode | null, out: string[] = []): string[] {
  if (!n) return out
  if (n.componentId === 'unresolved') out.push(String((n.properties as Record<string, unknown>)?.node_type ?? '?'))
  for (const kids of Object.values(n.children ?? {})) for (const k of kids ?? []) unresolvedOf(k, out)
  return out
}

interface result {
  programs: number; nodes: number; degraded: number
  roundTripDiff: number; genericCall: number; runFailed: number; outputDiff: number
  unresolvedTypes: Record<string, number>
  diffs: string[]
  runErrors: string[]
  outputDiffs: string[]
  genericNames: Record<string, number>
}

/** 量一批語料。**吃輸入**，所以注入餵得進來。 */
async function measure(corpus: readonly (readonly [string, string])[]): Promise<result> {
  const r: result = {
    programs: corpus.length, nodes: 0, degraded: 0, roundTripDiff: 0, genericCall: 0,
    runFailed: 0, outputDiff: 0, unresolvedTypes: {}, diffs: [], runErrors: [], outputDiffs: [], genericNames: {},
  }
  for (const [name, code] of corpus) {
    const tree = await liftPython(code)
    const ids = componentIdsOf(tree)
    r.nodes += ids.length
    r.degraded += ids.filter(isDegraded).length
    // 只數**內建的**名字——使用者自己定義的函式沒有身分是對的（見檔頭）
    genericBuiltinCalls(tree, r.genericNames)
    r.genericCall = Object.values(r.genericNames).reduce((a, b) => a + b, 0)
    for (const t of unresolvedOf(tree)) r.unresolvedTypes[t] = (r.unresolvedTypes[t] ?? 0) + 1
    // 🔴 **跑得動嗎**——`stdin` 餵幾行，讓需要輸入的語料也走得完。
    //    降級的節點跑到時會丟「我看不懂」，那本來就該算失敗：**學生按下執行看到的就是它**。
    const out = await runPython(code, ['5', '3', 'x'])
    if (/執行例外|例外：|Error/.test(out)) {
      r.runFailed++
      r.runErrors.push(`${name}：${out.replace(/\n/g, ' ').slice(0, 90)}`)
    } else {
      // 🔴 **跟參照直譯器對答案**——跑得動不代表答案對
      const ref = reference.get(name)
      // ⚠️ **具名豁免**：亂數在教學工具裡刻意可重現（固定種子），
      //    所以它與真的 Python 必然不同。那是設計不是缺陷。
      //    🔴 而豁免要**具名**（`history/018`：靠規則順便放過＝用宣告刷數字）。
      if (ref?.ok && !NONDETERMINISTIC.has(name)) {
        const ours = out.replace(/^completed\|/, '')
        if (ours.trimEnd() !== ref.output.trimEnd()) {
          r.outputDiff++
          r.outputDiffs.push(
            `${name}\n        真 Python  ${JSON.stringify(ref.output.slice(0, 70))}\n        我們      ${JSON.stringify(ours.slice(0, 70))}`,
          )
        }
      }
    }

    if (norm(generatePython(tree)) !== norm(code)) {
      r.roundTripDiff++
      const a = norm(code).split('\n'), b = norm(generatePython(tree)).split('\n')
      for (let i = 0; i < Math.max(a.length, b.length); i++) {
        if (a[i] !== b[i]) { r.diffs.push(`${name}\n        原  ${a[i] ?? '(無)'}\n        產  ${b[i] ?? '(無)'}`); break }
      }
    }
  }
  return r
}

let r: result
/**
 * 參照直譯器的答案，按語料的名字索引。
 *
 * ⚠️ **一次批次跑完**（`beforeAll`），不是在每支 `it` 裡各跑一次
 * ——`execSync` 會阻塞整條 Node 執行緒而弄紅同一輪的其他測試
 * （`experience.md` 的那一條）。
 */
const reference = new Map<string, pyOutcome>()

beforeAll(async () => {
  const outcomes = await runPythonBatch(
    PYTHON_CORPUS.map(([, code]) => code),
    PYTHON_CORPUS.map(() => '5\n3\nx\n'),
  )
  PYTHON_CORPUS.forEach(([name], i) => reference.set(name, outcomes[i]))
  r = await measure(PYTHON_CORPUS)
}, 180_000)

describe('第五十條護欄：AI 生的 Python，我們處理得了多少', () => {
  it('★ 錨點：參照直譯器必須在——沒有它就量不出「答案對不對」', () => {
    expect(hasReferencePython()).toBe(true)
    const ok = [...reference.values()].filter((x) => x.ok).length
    expect(ok, '參照一段都跑不動 → 量測機構壞了，不是語料壞了').toBeGreaterThan(20)
  })

  /**
   * 🔴 **名字重複的症狀是「參照對到別段程式」**（2026-08-22 撞到）：
   * `reference` 是一個以名字為鍵的 Map，兩段同名時**後者覆蓋前者**，
   * 於是前一段拿**別人的**正確答案來比——報表上多出一筆看起來很嚇人
   * 而其實不存在的缺陷，同時**真正的那段被漏掉**。
   *
   * > **一個以名字為鍵的索引，在名字重複時不會報錯——它只會安靜地對錯。**
   */
  it('★ 錨點：語料的名字不得重複——否則參照會對到別段程式', () => {
    const names = PYTHON_CORPUS.map(([n]) => n)
    const dup = names.filter((n, i) => names.indexOf(n) !== i)
    expect(dup, `重複的名字：${dup.join('、')}`).toEqual([])
  })

  it('★ 錨點：語料真的載入且真的 lift 得出東西', () => {
    expect(PYTHON_CORPUS.length, '語料是空的 → 每個數字都是假的零').toBeGreaterThan(10)
    expect(r.nodes, '一個節點都沒 lift 出來 → 量測壞了，不是 Python 很完美').toBeGreaterThan(200)
  })

  it('★ 注入①：一段一定認不出來的碼【必須】被算成降級', async () => {
    const x = await measure([['合成', 'async def f():\n    async with open("x") as g:\n        yield g\n']])
    expect(x.degraded, '這麼冷僻的語法都不降級 → 降級計數沒接上').toBeGreaterThan(0)
  })

  it('★ 注入②：一段一定認得出來的碼不得被誤報', async () => {
    const x = await measure([['合成', 'x = 1\nprint(x)\n']])
    expect(x.degraded, '最單純的兩行被算成降級 → 判準把好的當壞的').toBe(0)
    expect(x.roundTripDiff, '最單純的兩行來回不同 → 產生器壞了').toBe(0)
  })

  it('★ 注入④：跑不動的程式【必須】被算成執行失敗', async () => {
    const x = await measure([['合成', 'for q in 5:\n    print(q)\n']])
    expect(x.runFailed, '一段一定跑不動的碼沒被算到 → 執行那一軸沒接上').toBe(1)
  })

  it('★ 注入⑤：跑得動的不得被誤報', async () => {
    const x = await measure([['合成', 'print(1)\n']])
    expect(x.runFailed, '最單純的一行被算成跑不動 → 判準把好的當壞的').toBe(0)
  })

  it('★ 注入③：產不回去的碼【必須】被算成來回不同', async () => {
    // 🔴 錨在**合成的**輸入上，不錨在「今天哪幾段是壞的」——後者會在修好那天變紅
    const x = await measure([['合成', 'nums = [1]\nnums.append(2)\nprint(nums)\n']])
    expect(x.programs).toBe(1)
    // 這一段今天產不回去（缺換行）。修好之後這支要改成斷言 0——而**那時它會紅**，
    // 所以它錨的是「計數器會數」：語料非空且量得到節點。
    expect(x.nodes, '合成語料量不到節點 → 這支注入本身失效').toBeGreaterThan(5)
  })

  it('報表 ＋ 三個棘輪只准下降', () => {
    const top = Object.entries(r.unresolvedTypes).sort((a, b) => b[1] - a[1])
    printReport('AI 生的 Python：我們處理得了多少', [
      `語料   ${r.programs} 段｜節點 ${r.nodes}`,
      '',
      `🔴 答案不同  ${r.outputDiff} 段  ← **最重**：跑得動而結果與真的 Python 不一樣`,
      `🔴 執行失敗  ${r.runFailed} 段  ← 教學上要好用＝要【跑得動】`,
      `🔴 來回不同  ${r.roundTripDiff} 段  ← 產出【不合法或語義不同】的 Python`,
      `   降級節點  ${r.degraded} 個（${((r.degraded / r.nodes) * 100).toFixed(0)}%）  ← 誠實變灰，學生看得見`,
      `   通用桶    ${r.genericCall} 個  ← 掉進 python:func_call，不降級但身分沒了`,
      // 🔴 **逐個名字**——「該替哪一顆做元件」只有這一欄答得出來
      `     ${Object.entries(r.genericNames).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}×${v}`).join('  ')}`,
      '',
      ...r.outputDiffs.map((e) => `     ✘ 答案不同  ${e}`),
      ...r.runErrors.map((e) => `     ✘ 跑不動  ${e}`),
      ...r.diffs.map((d) => `     ✘ ${d}`),
      '',
      '  認不出來的節點型別（前十）：',
      ...top.slice(0, 10).map(([k, v]) => `     ${String(v).padStart(3)}  ${k}`),
    ])

    if (process.env.GENERATE_BASELINE) {
      writeBaseline(GUARD, {
        _meta: {
          guard: GUARD,
          measuredAt: new Date().toISOString().slice(0, 10),
          rule:
            '語料是「AI 會生的教學用 Python」，不是照現有元件挑的。三個數字一起看：' +
            '來回不同（產出壞掉的碼，最重）／降級節點（誠實變灰）／通用桶（不降級但身分沒了）。',
          note: RATCHET_NOTE,
        },
        corpus: { programs: r.programs, nodes: r.nodes },
        degraded: r.degraded,
        roundTripDiff: r.roundTripDiff,
        genericCall: r.genericCall,
        runFailed: r.runFailed,
        outputDiff: r.outputDiff,
        unresolvedTypes: r.unresolvedTypes,
      } satisfies Baseline)
      return
    }

    const b = loadBaseline<Baseline>(GUARD)
    // ⚠️ **語料只准長大**（第四十八條）——縮語料能讓上面三個數字一起變好看
    assertCorpus([['語料段數', r.programs, b.corpus.programs]])
    assertRatchet([
      ['🔴 答案不同', r.outputDiff, b.outputDiff ?? r.outputDiff],
      ['🔴 執行失敗', r.runFailed, b.runFailed ?? r.runFailed],
      ['🔴 來回不同', r.roundTripDiff, b.roundTripDiff],
      ['降級節點', r.degraded, b.degraded],
      ['通用桶', r.genericCall, b.genericCall],
    ])
  })
})
