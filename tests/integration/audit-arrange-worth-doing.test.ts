/**
 * 第一百二十八條護欄：**「排回去」要有東西可排**
 *
 * ## 🔴 它從哪來（2026-09-21）
 *
 * 一班學生上完 C++ 入門前幾課，授課老師逐字：
 *
 * > 第一課的排一排沒有意義
 * > 排一排在第一課真的沒什麼意義，**因為只有一行**
 *
 * 查證屬實：`cpp-beginner/01-印出一句話` 的 `rebuild` 題，
 * 解答扣掉骨架（`#include`／`using`／`int main`／`return 0`）之後
 * **只剩一顆 `cout`**——一顆積木沒有「順序」可言。
 *
 * ⚠️ 而它不是唯一的：`cpp-beginner/05-程式從哪開始` 一模一樣。
 *
 * > **一個 Parsons 題如果只有一塊，它不是題目——它是一個【把積木放上去】的動作。**
 *
 * ## 判準
 *
 * `kind: 'arrange'` 的題目，它的參考解答扣掉骨架之後**至少要有兩顆**可排的東西。
 *
 * ⚠️ **門檻是教學決定，不是技術決定**。這裡取 **2**，理由是「一顆沒有順序」
 * ——那是能從定義推出來的下限。
 * 🔴 而「幾顆才**值得**排」（3？4？）**不在這條護欄的職權內**：
 * Parsons 題的研究多半用 6–10 行，而這套課程的前幾課本來就短。
 * 要調高門檻，要有人決定那幾課改成別的題型。
 *
 * ## ⚠️ 這條是硬性零，不是棘輪
 *
 * 「留一筆還成立嗎」→ 不成立：一個只有一塊的排序題，**每一個上到那一課的
 * 學生都會遇到**，而他遇到的是一個沒有意義的動作。
 * 「修法貴不貴」→ 把那一題拿掉，或給它更多內容。
 *
 * ## 本檔不檢測什麼
 *
 * - **不檢測「排得好不好玩」**——那要人看。
 * - **不檢測 `arrange` 以外的題型**——`follow`／`make` 一句也是正當的。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { REPO_ROOT, printReport } from '../helpers/guardrail'
import { allCppComponents } from '../../src/languages/cpp/all-declarations'
import { scaffoldNodeIds } from '../../src/core/scaffold-nodes'
import '../../src/languages/cpp/skeletons'
import type { SemanticNode } from '../../src/core/types'

/** 一顆積木沒有順序可言——這是能從定義推出來的下限，不是品味。 */
const MIN_PIECES = 2

/**
 * 🔴 **「哪些是骨架」問產品自己那一份**（`core/scaffold-nodes.ts`）。
 *
 * 第一版在這裡寫了一張清單
 *（`cpp:include`／`using_namespace`／`func_def`／`return`／`program`），
 * 而它**冤枉了第 18 課**：那一課要學生排的正是一個**函式定義**（`int square(int n)`），
 * 而清單把所有 `func_def` 都當骨架。
 *
 * 🟢 `scaffoldNodeIds` 問的是**元件宣告的性狀**（`traits.scaffold`／
 * `traits.scaffoldInMain`），而且它知道「`return` 只有在**進入點函式裡**
 * 才是骨架」——那正是這張手寫清單分不出來的。
 *
 * > **列一張自己的清單，只是把過期的時間往後挪。**
 */
const SKELETON = 'main'

let parser: Parser
let isStatement: (id: string) => boolean
beforeAll(async () => {
  await Parser.init({ locateFile: (f: string) => `${process.cwd()}/public/${f}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  registerCppLanguage()
  // 🟢 **角色是元件自己宣告的**——不要在這裡另立一張表（兩份遲早會分岔）。
  const roles = new Map(
    (allCppComponents() as { componentId: string; role?: string }[]).map((c) => [c.componentId, c.role]),
  )
  isStatement = (id) => roles.get(id) === 'statement'
})

interface Row { lesson: string; taskId: string; pieces: number; solution: string }

function lessonFiles(): string[] {
  const root = path.join(REPO_ROOT, 'lessons')
  const out: string[] = []
  if (!fs.existsSync(root)) return out
  for (const track of fs.readdirSync(root, { withFileTypes: true })) {
    if (!track.isDirectory()) continue
    for (const lesson of fs.readdirSync(path.join(root, track.name), { withFileTypes: true })) {
      if (!lesson.isDirectory()) continue
      const f = path.join(root, track.name, lesson.name, 'lesson.json')
      if (fs.existsSync(f)) out.push(f)
    }
  }
  return out.sort()
}

/**
 * 學生真的要拖的有幾塊——**所有的語句積木，含巢狀**。
 *
 * 🔴 **兩次都數錯，而兩次都是注入測試抓到的**：
 *
 * ```
 * 第一版  遞迴數所有節點      一句 cout 數成 3（literal_string 與 endl 也算）→ 永遠不會回報「太少」
 * 第二版  只數函式體的直接子  for 迴圈數成 1（裡面那幾句不算）→ 冤枉了三課
 * ```
 *
 * 🟢 **第三版問產品自己那一份**：`component.json` 的 `role`
 *（142 顆 statement／108 顆 expression）。學生排的是**語句**，
 * 而運算式是填在語句裡的格子，不是排的對象。
 *
 * > **「有幾塊可以排」這個數字，要從【積木自己宣告的角色】算，
 * > 不是從樹的形狀猜。**
 */
function piecesOf(source: string, isStatement: (id: string) => boolean): number {
  const tree = createTestLifter().lift(parser.parse(source)!.rootNode as never) as SemanticNode | null
  if (tree == null) return -1
  const scaffold = scaffoldNodeIds(tree, SKELETON)
  let n = 0
  const walk = (node: SemanticNode): void => {
    for (const kids of Object.values(node.slots ?? {})) {
      for (const k of kids ?? []) {
        if (!scaffold.has(k.id) && isStatement(k.componentId)) n++
        walk(k)
      }
    }
  }
  walk(tree)
  return n
}

function scan(): { all: Row[]; tooFew: Row[]; missing: Row[] } {
  const all: Row[] = []
  const missing: Row[] = []
  for (const file of lessonFiles()) {
    const d = JSON.parse(fs.readFileSync(file, 'utf8')) as { tasks?: { id: string; kind?: string }[] }
    const dir = path.dirname(file)
    const lesson = path.relative(path.join(REPO_ROOT, 'lessons'), dir)
    for (const t of d.tasks ?? []) {
      if (t.kind !== 'arrange') continue
      const cpp = path.join(dir, 'solutions', `${t.id}.cpp`)
      if (!fs.existsSync(cpp)) {
        // Python 那幾軌用別的解析器——這條護欄今天只看 C++（見檔頭「不檢測什麼」）
        const py = path.join(dir, 'solutions', `${t.id}.py`)
        if (!fs.existsSync(py)) missing.push({ lesson, taskId: t.id, pieces: -1, solution: '(沒有 solution)' })
        continue
      }
      all.push({ lesson, taskId: t.id, pieces: piecesOf(fs.readFileSync(cpp, 'utf8'), isStatement), solution: cpp })
    }
  }
  return { all, tooFew: all.filter((r) => r.pieces >= 0 && r.pieces < MIN_PIECES), missing }
}

describe('第一百二十八條護欄：「排回去」要有東西可排', () => {
  it('★ 健康檢查：真的掃到 arrange 題了', () => {
    // 不可省。`kind` 的值打錯的話 `all` 是空的，而下面那條硬性零會空過。
    const { all } = scan()
    expect(all.length, '一個 C++ 的 arrange 題都沒掃到 → 掃描壞了').toBeGreaterThan(10)
  })

  it('★ 健康檢查：數得出「有幾塊」——而不是每一題都回 0', () => {
    const { all } = scan()
    expect(Math.max(...all.map((r) => r.pieces)), '每一題都數到 0 → 那個數法壞了').toBeGreaterThan(4)
  })

  it('🔴 硬性零：每一個「排回去」至少要有兩塊可排', () => {
    const { all, tooFew, missing } = scan()
    printReport('「排回去」有幾塊可排', [
      `C++ 的 arrange 題   ${all.length}`,
      `🔴 少於 ${MIN_PIECES} 塊       ${tooFew.length}  ← 硬性零`,
      `⚠️ 沒有 solution     ${missing.length}`,
      ...tooFew.map((r) => `  ${r.lesson} [${r.taskId}]：只有 ${r.pieces} 塊`),
      '',
      '⚠️ 門檻是**教學決定**：2 是「一顆沒有順序」推出來的下限，',
      '   而「幾顆才值得排」要有人決定那幾課改成別的題型。',
    ])
    expect(
      tooFew.map((r) => `${r.lesson}[${r.taskId}]=${r.pieces}`),
      '一個只有一塊的排序題，不是題目——是一個把積木放上去的動作',
    ).toEqual([])
  })

  it('★ 注入：一支只有一句的程式必須被數成 1', () => {
    const one = '#include <iostream>\nusing namespace std;\nint main() {\n    cout << "hi" << endl;\n    return 0;\n}\n'
    expect(piecesOf(one, isStatement), '數法錯了 → 上面那條硬性零是空過的').toBe(1)
  })

  it('★ 注入：巢狀也要算——for 迴圈裡的那一句不是隱形的', () => {
    // 🔴 第二版只數函式體的直接子節點，於是 `for(...){ cout }` 數成 1
    //    ——冤枉了 11／16／18 三課。學生要排的是【兩塊】：迴圈本身與它肚子裡那一句。
    const nested = '#include <iostream>\nusing namespace std;\nint main() {\n    for (int i = 0; i < 3; i++) {\n        cout << i << endl;\n    }\n    return 0;\n}\n'
    expect(piecesOf(nested, isStatement), '巢狀的語句也要算').toBe(2)
  })

  it('★ 注入：三句的程式要數成 3', () => {
    const three = '#include <iostream>\nusing namespace std;\nint main() {\n    int a = 1;\n    a += 2;\n    cout << a << endl;\n    return 0;\n}\n'
    expect(piecesOf(three, isStatement)).toBe(3)
  })
})
