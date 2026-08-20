/**
 * Python 的 lift 入口——**與 `setup-lifter.ts` 分開，而那是刻意的**。
 *
 * `setup-lifter.ts` 寫死 `registerCppLifters` ＋ `src/languages/cpp/lift-patterns.json`，
 * 有 113 個測試檔在用它。把它改成多語言是一次獨立的重構
 * （spec 167 的 Out of Scope），而 Python 的量測現在就要。
 */
import { Lifter } from '../../src/core/lift/lifter'
import { PatternLifter } from '../../src/core/lift/pattern-lifter'
import { BlockSpecRegistry } from '../../src/core/block-spec-registry'
import { TransformRegistry, registerCoreTransforms, LiftStrategyRegistry } from '../../src/core/registry'
import { componentLiftPatterns } from '../../src/core/component/lift-patterns'
import { componentComponents, componentBlocks } from '../../src/core/component/registry'
import { loadAllLanguagePacks } from '../../src/core/load-language-packs'
import { allLanguagePacks } from '../../src/core/language-packs'
import { registerCppLifters } from '../../src/languages/cpp/lifters'
import { RenderStrategyRegistry } from '../../src/core/registry'
import { componentGenerateRegistrars } from '../../src/core/component/paths'
import { registerLanguage, generateCode } from '../../src/core/projection/code-generator'
import googleStyle from '../../src/languages/cpp/styles/google.json'
import type { LiftPattern, SemanticNode, NodeGenerator, StylePreset } from '../../src/core/types'

/**
 * 基準語料——**這一段是驗收的錨點，改它等於改驗收**。
 *
 * 涵蓋：指派、變數引用、算術、if/else、比較、while、for-in-range、函式定義、return、print。
 * 每一樣在 tree-sitter-cpp 裡都有一個**同名的節點型別**。
 */
export const PYTHON_BASELINE = `x = 5
y = x + 3
if y > 6:
    print("big", y)
else:
    print("small")
while x > 0:
    x = x - 1
for i in range(3):
    print(i)
def add(a, b):
    return a + b
`

/**
 * 建一個**設定成 Python 文法**的 Lifter。
 *
 * 🔴 **不要用 `createTestLifter`**——那個助手明說了 `tree-sitter-cpp`，
 * Python 的 pattern 會被正確地濾掉。
 *
 * ⚠️ 而在 spec 167 之前，4 支 Python 測試就是用它過的
 * ——**靠的是「當時完全沒有過濾」**。
 *
 * > **一支用錯設定卻通過的測試，證明的是那個設定沒有生效。**
 */
export function createPythonLifter(): Lifter {
  loadAllLanguagePacks()
  const pack = allLanguagePacks().find((p) => p.id === 'python')
  if (!pack) throw new Error('沒有 python 語言套件——這支測試在驗一個不存在的東西')
  const lifter = new Lifter()
  const tr = new TransformRegistry()
  registerCoreTransforms(tr)
  const ls = new LiftStrategyRegistry()
  const bs = new BlockSpecRegistry()
  bs.loadFromSplit(componentComponents() as never, componentBlocks() as never)
  const pl = new PatternLifter()
  pl.setTransformRegistry(tr)
  pl.setLiftStrategyRegistry(ls)
  pl.setGrammar(pack.grammar)
  const skipByGrammar = new Map<string, ReadonlySet<string>>()
  for (const lp of allLanguagePacks()) skipByGrammar.set(lp.grammar, new Set(lp.liftSkipNodeTypes ?? []))
  pl.loadBlockSpecs(bs.getAll(), skipByGrammar)
  pl.loadLiftPatterns([
    ...allLanguagePacks().flatMap((lp) => lp.liftPatterns ?? []),
    ...componentLiftPatterns(),
  ] as LiftPattern[])
  lifter.setPatternLifter(pl)
  lifter.setGrammar(pack.grammar)

  // 🔴 **產品會註冊 C++ 的手寫 lifter，所以量測也必須註冊。**
  //
  // ⚠️ 第一版沒有這一行，於是這個助手**比產品乾淨**——護欄全綠，
  // 而瀏覽器裡 `for i in range(3)` 仍然變成 `cpp_loop_for`。
  //
  // > **一個比產品乾淨的量測環境，量到的是一個不存在的系統。**
  registerCppLifters(lifter, {
    transformRegistry: tr,
    liftStrategyRegistry: ls,
    renderStrategyRegistry: new RenderStrategyRegistry(),
  })
  return lifter
}

/** 解析 ＋ lift 一段 Python。 */
export async function liftPython(code: string): Promise<SemanticNode | null> {
  loadAllLanguagePacks()
  const pack = allLanguagePacks().find((p) => p.id === 'python')!
  const parser = pack.createParser()
  await parser.init('public')
  const tree = await parser.parse(code)
  return createPythonLifter().lift(tree.rootNode as never)
}

export function componentIdsOf(n: SemanticNode | null, out: string[] = []): string[] {
  if (!n) return out
  out.push(n.componentId)
  for (const kids of Object.values(n.children ?? {})) for (const k of kids ?? []) componentIdsOf(k, out)
  return out
}


/**
 * 產生 Python 程式碼——**走膠囊的登錄表，不手接一堆 `registerGenerate`**。
 *
 * ⚠️ 既有的三支 Python 自證測是**逐個 import 產生器**的
 * （`registerGenerate as registerPrint` / `registerProgram` …）。
 * 那在只有三顆元件時可行，而**每加一顆就要有人記得去改那份清單**
 * ——那正是這個專案在治的「手寫清單」病。
 *
 * > **一份「加東西時要記得改」的清單，就是一個等著被忘記的地方。**
 *
 * 🟢 `componentGenerateRegistrars()` 由 `import.meta.glob` 直讀，**加一顆零編輯**。
 */
let pythonGeneratorsReady = false

export function generatePython(tree: SemanticNode | null): string {
  if (!pythonGeneratorsReady) {
    const g = new Map<string, NodeGenerator>()
    // ⚠️ **`style` 一定要傳**——共用產生器裡有一批 helper 是捕獲 `style` 的閉包，
    // 剪出去的膠囊拿不到那個閉包，只能自己從 `style` 算。
    // 少傳的症狀不是「排版怪」，是 `cpp/class_def` 當場 `Cannot read 'brace_style'`。
    const style = googleStyle as unknown as StylePreset
    for (const reg of componentGenerateRegistrars())
      (reg as (m: typeof g, s: StylePreset) => void)(g, style)
    // ⚠️ `registerLanguage` 收的是**工廠**（`(style) => Map`），不是 Map。
    // 傳 Map 進去不會紅，而 `generateCode` 會 `factory is not a function`。
    registerLanguage('python', () => g)
    pythonGeneratorsReady = true
  }
  return generateCode(tree as SemanticNode, 'python', googleStyle as unknown as StylePreset).trim()
}
