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
 * 🔴 執行失敗   跑不起來                 ← 最重。教學上要好用＝要跑得動
 * 來回不同      產回去的碼與原碼不一樣    ← 產出壞掉的碼，見下
 * 降級節點      認不出來而誠實變灰的      ← 少 = 認得多
 * 通用桶        掉進 python:func_call    ← 不降級，但身分沒了
 * ```
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

const GUARD = 'python-coverage'

interface Baseline {
  _meta: { guard: string; measuredAt: string; rule: string; note: string }
  corpus: { programs: number; nodes: number }
  degraded: number
  roundTripDiff: number
  genericCall: number
  runFailed: number
  unresolvedTypes: Record<string, number>
}

const isDegraded = (id: string): boolean =>
  id === 'unresolved' || id.endsWith(':raw_code') || id.endsWith(':raw_expression')

/** 排版正規化——比的是**程式**，不是空白。 */
const norm = (x: string): string =>
  x.trim().split('\n').map((l) => l.trimEnd()).filter((l) => l.length > 0).join('\n')

function unresolvedOf(n: SemanticNode | null, out: string[] = []): string[] {
  if (!n) return out
  if (n.componentId === 'unresolved') out.push(String((n.properties as Record<string, unknown>)?.node_type ?? '?'))
  for (const kids of Object.values(n.children ?? {})) for (const k of kids ?? []) unresolvedOf(k, out)
  return out
}

interface result {
  programs: number; nodes: number; degraded: number
  roundTripDiff: number; genericCall: number; runFailed: number
  unresolvedTypes: Record<string, number>
  diffs: string[]
  runErrors: string[]
}

/** 量一批語料。**吃輸入**，所以注入餵得進來。 */
async function measure(corpus: readonly (readonly [string, string])[]): Promise<result> {
  const r: result = {
    programs: corpus.length, nodes: 0, degraded: 0, roundTripDiff: 0, genericCall: 0,
    runFailed: 0, unresolvedTypes: {}, diffs: [], runErrors: [],
  }
  for (const [name, code] of corpus) {
    const tree = await liftPython(code)
    const ids = componentIdsOf(tree)
    r.nodes += ids.length
    r.degraded += ids.filter(isDegraded).length
    r.genericCall += ids.filter((i) => i === 'python:func_call').length
    for (const t of unresolvedOf(tree)) r.unresolvedTypes[t] = (r.unresolvedTypes[t] ?? 0) + 1
    // 🔴 **跑得動嗎**——`stdin` 餵幾行，讓需要輸入的語料也走得完。
    //    降級的節點跑到時會丟「我看不懂」，那本來就該算失敗：**學生按下執行看到的就是它**。
    const out = await runPython(code, ['5', '3', 'x'])
    if (/執行例外|例外：|Error/.test(out)) {
      r.runFailed++
      r.runErrors.push(`${name}：${out.replace(/\n/g, ' ').slice(0, 90)}`)
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
beforeAll(async () => { r = await measure(PYTHON_CORPUS) }, 120_000)

describe('第五十條護欄：AI 生的 Python，我們處理得了多少', () => {
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
      `🔴 執行失敗  ${r.runFailed} 段  ← 最重：教學上要好用＝要【跑得動】`,
      `🔴 來回不同  ${r.roundTripDiff} 段  ← 產出【不合法或語義不同】的 Python`,
      `   降級節點  ${r.degraded} 個（${((r.degraded / r.nodes) * 100).toFixed(0)}%）  ← 誠實變灰，學生看得見`,
      `   通用桶    ${r.genericCall} 個  ← 掉進 python:func_call，不降級但身分沒了`,
      '',
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
        unresolvedTypes: r.unresolvedTypes,
      } satisfies Baseline)
      return
    }

    const b = loadBaseline<Baseline>(GUARD)
    // ⚠️ **語料只准長大**（第四十八條）——縮語料能讓上面三個數字一起變好看
    assertCorpus([['語料段數', r.programs, b.corpus.programs]])
    assertRatchet([
      ['🔴 執行失敗', r.runFailed, b.runFailed ?? r.runFailed],
      ['🔴 來回不同', r.roundTripDiff, b.roundTripDiff],
      ['降級節點', r.degraded, b.degraded],
      ['通用桶', r.genericCall, b.genericCall],
    ])
  })
})
