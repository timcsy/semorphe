import { declareCommentSyntax } from '../../../core/comment-syntax'
import { cppCommentSyntax } from '../core/comment-syntax'
import type { StylePreset } from '../../../core/types'
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { registerLanguage } from '../../../core/projection/code-generator'
import { registerStatementGenerators } from '../core/generators/statements'
import { registerDeclarationGenerators } from '../core/generators/declarations'
import { registerExpressionGenerators } from '../core/generators/expressions'
import { allStdModules } from '../std'
import { declareSkips, declareAnnotations } from '../../../core/skip-declarations'
import { declareExecutor, declareBuiltinConstants, declareAbstract, declareDowngradeTypePrefix } from '../../../core/language-executors'
import { CPP_BUILTIN_CONSTANTS } from '../builtins'
import { registerCoreExecutors } from '../core/executors'
import { coreConcepts } from '../core'
import type { PathName, SkipReason } from '../../../core/types'

function createCppGenerators(style: StylePreset): Map<string, NodeGenerator> {
  const g = new Map<string, NodeGenerator>()
  // Core generators (no #include needed)
  registerStatementGenerators(g, style)
  registerDeclarationGenerators(g)
  registerExpressionGenerators(g)
  // Std module generators (each header's generators)
  for (const mod of allStdModules) {
    mod.registerGenerators(g, style)
  }
  return g
}

export function registerCppLanguage(): void {
  registerLanguage('cpp', createCppGenerators)
  registerCppSkipDeclarations()
  registerCppExecutors()
  // 註解的**語法**（`//`、`/** *​/`、`/* *​/`，以及從原始碼剝掉它們的規則）
  // 原本寫死在核心層。概念身分留在核心，語法住在這裡。
  declareCommentSyntax(cppCommentSyntax)
}

/**
 * 把各模組的執行器推進直譯器。
 *
 * 與 `registerGenerators` / `registerLifters` 同一個形狀：模組提供註冊函式，
 * 載入時被呼叫。核心**不知道**有哪些模組，只知道有人推東西進來。
 */
export function registerCppExecutors(): void {
  if (executorsPushed) return
  executorsPushed = true
  const push = (concept: string, executor: unknown): void =>
    declareExecutor(concept, executor as never)
  declareBuiltinConstants(CPP_BUILTIN_CONSTANTS)
  registerCoreExecutors(push as never)
  for (const mod of allStdModules) mod.registerExecutors(push as never)
}

let executorsPushed = false

/**
 * 把「這個概念刻意不執行」的宣告推進核心。
 *
 * 在此之前這件事寫死在 `src/interpreter/interpreter.ts` 的一份清單裡——
 * 核心層認識 34 個 C++ 概念名。現在核心只認識「有沒有人宣告過」。
 *
 * 見 specs/053-declare-noop-execute/classification.md
 */
export function registerCppSkipDeclarations(): void {
  const all = [...coreConcepts, ...allStdModules.flatMap((m) => m.concepts)]
  for (const c of all) {
    const reasons = (c as { skipReasons?: Partial<Record<PathName, SkipReason>> }).skipReasons
    if (reasons && Object.keys(reasons).length > 0) declareSkips(c.conceptId, reasons)
    const parent = (c as { abstractConcept?: string | null }).abstractConcept
    if (parent) declareAbstract(c.conceptId, parent)
    const prefix = (c as { downgradeTypePrefix?: string }).downgradeTypePrefix
    if (prefix) declareDowngradeTypePrefix(c.conceptId, prefix)
    const ann = (c as { annotations?: Record<string, unknown> }).annotations
    if (ann && Object.keys(ann).length > 0) declareAnnotations(c.conceptId, ann)
  }
}
