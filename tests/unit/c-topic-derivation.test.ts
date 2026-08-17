/**
 * **C 課程清單是【推導】出來的，不是手抄的。**
 *
 * ## 這一支存在的理由
 *
 * `c-beginner.json` 是 `cpp-beginner.json` 扣掉「C 裡不存在的概念」。
 * 🔴 **而兩份 JSON 各自躺在磁碟上，沒有任何東西保證它們的關係還成立**
 * ——`cpp-beginner` 加一顆概念，`c-beginner` 不會自己長出來，
 * 而**沒有人會發現**（那是本專案的「雙重真相來源」老坑）。
 *
 * > **一份由另一份推導出來的資料，如果推導規則不在測試裡，它就只是一份複本。**
 *
 * ## 判準有兩段，⚠️ 而第二段不如第一段乾淨
 *
 * ```
 * ① 函式庫層（機械推導）   requires 到 C 沒有的標頭 ∧ 沒有 ioRole 等價邊
 * ② 語言層（具名清單）     class／virtual／template／try……——【不需要任何標頭】
 * ```
 *
 * ①  用的是**元件自己的宣告**：`requires` 對照 `header-aliases.ts` 的 19 筆對映表。
 *    ⚠️ 而 `ioRole` 那個合取項是必要的——沒有它，`cpp:print` 會因為
 *    `requires: ["<iostream>"]` 被排掉，**於是 C 印不出東西**。
 *    （`cpp:print` 與 `cpp:print_formatted` 宣告了同一個 `ioRole`
 *    ＝同一個等價類，見 `toolbox-builder.ts:119`。）
 *
 * ② 🔴 **是一份具名清單，而那正是我想避免的東西。** 理由：
 *    `class_def`／`method_virtual`／`try_catch` **不需要任何標頭**，
 *    所以 `requires` 這個宣告**看不到它們**。
 *
 *    ⚠️ **真正該做的機制已經設計好了而本輪不做**：
 *    `draft/2026-08-13-C和C++難分難捨.md`§三 的 `provides`／`requires` 能力求解
 *    ——目標宣告 `provides: ["cpp"]`，概念宣告 `requires: ["cpp"]`。
 *    **那是 target 的第三格，而規格明確把它排除在本輪之外。**
 *
 *    → 所以這份清單是**暫時的**，而它有**兩道交叉驗證**（下面兩支測試），
 *      讓它不能靜靜地爛掉。
 *
 * ## 這一支不檢測什麼
 *
 * - **不檢測「扣掉的那些真的是 C 裡沒有的」**——那需要一個 C 編譯器當裁判，
 *   而那是 `tests/probes/c-style-parity.test.ts` 的工作。
 * - **不檢測樹的形狀**——只比概念集合。⚠️ 形狀由 `★ 形狀一致` 那支守著。
 * - 🔴 **不檢測 `requires` 宣告本身完整不完整。** 2026-08-17 實測發現
 *   `container_*`（7 顆）、`string_at`、`istringstream_declare`
 *   **該有 `requires` 而沒有**——它們因此落進②那份清單，
 *   而**正確的修法是補上宣告**（本輪不做：改它會動到自動 include 的行為）。
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import cppBeginner from '../../src/languages/cpp/topics/cpp-beginner.json'
import cBeginner from '../../src/languages/cpp/topics/c-beginner.json'
import { toCHeader } from '../../src/languages/cpp/header-aliases'
import { allComponentDefs } from '../helpers/component-scan'
import type { LevelNode } from '../../src/core/types'

/**
 * ② 語言層的 C++ 專屬概念——**不需要標頭，所以 `requires` 看不到它們**。
 *
 * ⚠️ 這份清單是暫時的，等 `provides`／`requires` 能力求解做出來就該刪掉（見檔頭）。
 */
const CPP_ONLY_LANGUAGE = new Set([
  // 命名空間與引用
  'cpp:using_namespace', 'cpp:namespace_def', 'cpp:var_declare_ref',
  // C++11 起的宣告形式
  'cpp:loop_range', 'cpp:var_declare_constexpr', 'cpp:var_declare_auto', 'cpp:using_alias',
  // 類別與物件
  'cpp:class_def', 'cpp:new', 'cpp:delete', 'cpp:template_function',
  'cpp:method_call', 'cpp:constructor', 'cpp:destructor',
  'cpp:method_virtual', 'cpp:method_virtual_pure', 'cpp:method_override',
  'cpp:operator_overload', 'cpp:member_static', 'cpp:lambda',
  // 例外與轉型
  'cpp:try_catch', 'cpp:throw',
  'cpp:cast_static', 'cpp:cast_dynamic', 'cpp:cast_reinterpret', 'cpp:cast_const',
  // 🔴 以下這些【該由①抓到】，而它們漏宣告 `requires`——見檔頭最後一條
  'cpp:container_empty', 'cpp:container_push', 'cpp:container_pop', 'cpp:container_clear',
  'cpp:container_append', 'cpp:container_erase', 'cpp:container_count',
  'cpp:string_at', 'cpp:istringstream_declare',
])

/**
 * C 有沒有這個標頭。
 *
 * ⚠️ `toCHeader` **認不得的會原樣回傳**（不是回 `null`）——所以判準是
 * 「**名字有沒有被換掉**」，不是「回傳值是不是空的」。
 * 🔴 第一版寫成 `=== null`，於是**每一顆都被判成 C 有**、排除清單是空的。
 */
function cHasHeader(header: string): boolean {
  const bare = header.replace(/^<|>$/g, '')
  return toCHeader(header) !== bare
}

/** ① 函式庫層：requires 到 C 沒有的標頭 ∧ 沒有 ioRole 等價邊 */
function libraryLevelExclusions(): Set<string> {
  const out = new Set<string>()
  for (const def of allComponentDefs()) {
    const requires = (def.requires ?? []) as string[]
    if (requires.length === 0) continue
    const cppOnly = requires.filter((h) => !cHasHeader(h))
    if (cppOnly.length === 0) continue
    // 有等價邊（同 ioRole 的另一個成員）→ C 的風格家族裡有對應物 → 不排除
    const traits = (def as { traits?: Record<string, unknown> }).traits
    if (traits?.ioRole) continue
    out.add(def.conceptId)
  }
  return out
}

function conceptsOf(root: LevelNode): Set<string> {
  const out = new Set<string>()
  const walk = (n: LevelNode): void => {
    for (const c of n.concepts) out.add(c)
    for (const k of n.children) walk(k)
  }
  walk(root)
  return out
}

function shapeOf(root: LevelNode): string[] {
  const out: string[] = []
  const walk = (n: LevelNode, d: number): void => {
    out.push(`${'  '.repeat(d)}${n.id}/${n.level}`)
    for (const k of n.children) walk(k, d + 1)
  }
  walk(root, 0)
  return out
}

const CPP = conceptsOf((cppBeginner as { levelTree: LevelNode }).levelTree)
const C = conceptsOf((cBeginner as { levelTree: LevelNode }).levelTree)

describe('C 課程清單的推導', () => {
  it('★ 入口條件：兩份清單都真的載入了（合成量）', () => {
    // 🔴 錨在**載入幾顆**，不是**扣掉幾顆**——後者是這份推導要推大的東西
    expect(CPP.size, '🔴 cpp-beginner 沒載入 → 下面的比對全部不算數').toBeGreaterThan(150)
    expect(C.size, '🔴 c-beginner 沒載入').toBeGreaterThan(80)
  })

  it('★ c-beginner 的概念集合 == cpp-beginner 扣掉判準推出來的那些', () => {
    const excluded = new Set([...libraryLevelExclusions(), ...CPP_ONLY_LANGUAGE])
    const expected = [...CPP].filter((c) => !excluded.has(c)).sort()
    expect(
      [...C].sort(),
      '🔴 c-beginner 與判準推出來的不一致——多半是 cpp-beginner 改了而沒重推。\n' +
        '判準：① requires 到 C 沒有的標頭 ∧ 無 ioRole　② 本檔的 CPP_ONLY_LANGUAGE 清單',
    ).toEqual(expected)
  })

  /**
   * ⚠️ 判準是「**子集**」不是「相同」——因為**整個子樹都空的節點被剪掉了**。
   *
   * C 沒有 STL 容器（L3a）、沒有 OOP（L3b）、沒有例外（L3c）——
   * 那三個節點扣完之後一顆概念都不剩。**留著會在選單裡顯示成三個空分類**，
   * 而一個空的「L3b: OOP 進階」告訴學生的是「這裡有東西而你看不到」，
   * **那正好是相反的訊息**。
   *
   * 🔴 **而剪掉空子樹仍然是過濾（P4），不是另寫一棵樹**：
   * 留下來的每一個節點，`id`／`level`／巢狀關係都與 C++ 那份**逐字相同**。
   */
  it('★ 形狀是子集——節點與層級不得被改寫，只准整個空子樹被剪掉', () => {
    const cShape = shapeOf((cBeginner as { levelTree: LevelNode }).levelTree)
    const cppShape = new Set(shapeOf((cppBeginner as { levelTree: LevelNode }).levelTree))
    const foreign = cShape.filter((s) => !cppShape.has(s))
    expect(
      foreign,
      '🔴 C 課程清單有 C++ 那份沒有的節點——它是**過濾**（P4），不是另外寫一棵樹。',
    ).toEqual([])
    // ★ 入口條件：真的還剩下節點（合成量），否則上一行對空陣列恆為真
    expect(cShape.length, '🔴 C 的樹被剪成空的').toBeGreaterThan(4)
  })

  it('★ 交叉驗證①：具名清單裡不得有幽靈（指向不存在的概念）', () => {
    const known = new Set(allComponentDefs().map((d) => d.conceptId))
    const ghosts = [...CPP_ONLY_LANGUAGE].filter((c) => !known.has(c))
    expect(ghosts, '🔴 清單裡有不存在的概念——它可能被改名或刪掉了，而清單沒跟上').toEqual([])
  })

  /**
   * 🔴 **交叉驗證②：留下來的概念，產出裡不得出現 C++ 專屬語法。**
   *
   * 這一支是那份具名清單的**執行機構**：有人往 `cpp-beginner` 加一顆
   * C++ 專屬概念而忘了列進清單 → **這一支會紅**，清單不會靜靜地爛掉。
   *
   * ⚠️ 它掃的是 `generate.ts` 裡的**字串字面**（＝產出的東西），
   * 不是 TypeScript 程式碼本身——後者當然到處都是 `class`。
   */
  it('★ 交叉驗證②：留在 C 裡的概念，產出不得含 C++ 專屬語法', () => {
    const CPP_SYNTAX = /\b(class|virtual|override|template|typename|new|delete|catch|throw|namespace|nullptr|constexpr)\b|::|_cast</
    const offenders: string[] = []
    let scanned = 0
    for (const cid of C) {
      const file = path.join(process.cwd(), 'src/components', cid.replace(':', '/'), 'generate.ts')
      if (!fs.existsSync(file)) continue
      scanned++
      const literals = [...fs.readFileSync(file, 'utf8').matchAll(/[`'"]([^`'"]{0,200})[`'"]/g)]
        .map((m) => m[1]).join(' ')
      const hit = literals.match(CPP_SYNTAX)
      if (hit) offenders.push(`${cid} → ${hit[0]}`)
    }
    // ★ 入口條件：真的掃到了東西（合成量）
    expect(scanned, '🔴 一個 generate.ts 都沒掃到 → 路徑錯了，這一支不算數').toBeGreaterThan(50)
    expect(
      offenders,
      '🔴 這些概念留在 C 課程清單裡，而它們的產出含 C++ 專屬語法。\n' +
        '→ 把它們加進 CPP_ONLY_LANGUAGE，或者確認那是誤報並在此說明。',
    ).toEqual([])
  })
})
