import type { StylePreset } from '../../../../core/types'
import type { NodeGenerator } from '../../../../core/projection/code-generator'
import { indent, indented, generateExpression, generateBody, trackOwnText } from '../../../../core/projection/code-generator'
import { isElseIfChainable } from '../../../../core/component/traits'

/**
 * 大括號要不要換行——**風格決定的排版原子**。
 *
 * ## ⚠️ 為什麼它是模組層級的匯出，而不是閉包
 *
 * 它原本是 `registerStatementGenerators` 內部**捕獲 `style` 的閉包**。
 * 那在單一檔案裡很順，而**它擋住了膠囊化**：任何從這個函式剪出去的元件
 * 都拿不到那個閉包，`statements.ts` 那 24 顆因此全部搬不動
 * （2026-08-11 實測，見 `knowledge/draft/2026-08-11-F批次化的實測地形.md`）。
 *
 * > **一個閉包 helper 會把它所在的整個函式變成不可分割的單位。**
 * > 而那個單位是「一個檔案」，不是「一顆元件」——與膠囊化的方向相反。
 *
 * 處置：把捕獲的東西變成**顯式參數**。行為一字未變，而元件搬得動了。
 *
 * @param style 風格預設——`brace_style === 'Allman'` 時大括號換行
 */
/**
 * 參數列格式化——**風格無關的排版原子**。
 *
 * ⚠️ 它原本是 `registerStatementGenerators` 內部的閉包。與 `openBrace` 同一個病：
 * **一個閉包 helper 會把它所在的整個函式變成不可分割的單位**，
 * 而那個單位是「一個檔案」不是「一顆元件」——擋住膠囊化。
 *
 * ⚠️ **同一個檔案裡的第二個**——`openBrace` 是第一個。
 */
export const formatParams = (paramChildren: { properties: Record<string, unknown> }[]) =>
    paramChildren.map(p => {
      const t = String(p.properties.type ?? 'int')
      const n = String(p.properties.name ?? '')
      return n ? `${t} ${n}` : t
    }).join(', ')

export function openBraceFor(style: StylePreset): (ctx: Parameters<NodeGenerator>[1]) => string {
  return style.brace_style === 'Allman'
    ? (ctx: Parameters<NodeGenerator>[1]) => `\n${indent(ctx)}{`
    : () => ' {'
}

/**
 * `if` 的產生器——**兩顆元件共用的排版演算法**。
 *
 * ## ⚠️ 為什麼它必須是模組層級
 *
 * 它原本是 `registerStatementGenerators` 內部捕獲 `style` 的閉包，而
 * `cpp:if` 與 `cpp:if_else` **註冊的是同一個函式物件**：
 *
 * ```ts
 * g.set('cpp:if', ifGenerator)
 * g.set('cpp:if_else', ifGenerator)   // ← 同一個
 * ```
 *
 * > **可搬性第 5 條：一顆元件的五路實作若是另一顆的別名，那顆就搬不動**
 * > ——除非先把共用的部分提升成兩邊都拿得到的東西。
 *
 * ⚠️ **同一個檔案裡的第三個**（`openBrace`、`formatParams` 是前兩個）。
 * 三次都是同一個病：**一個閉包 helper 會把它所在的整個函式變成不可分割的單位。**
 *
 * ⚠️ 內部的 `elseBody[0].componentId === 'cpp:if'` 是 else-if 鏈的判別。
 * 它今天還寫在這裡；`cpp:if` 要搬進膠囊時，那一句得先變成一條性狀宣告。
 */
export function ifGeneratorFor(style: StylePreset): NodeGenerator {
  const openBrace = openBraceFor(style)
  const ifGenerator: NodeGenerator = (node, ctx) => {
    const cond = generateExpression((node.children.condition ?? [])[0], ctx)
    const thenBody = node.children.then_body ?? []
    const elseBody = node.children.else_body ?? []
    const header = `${indent(ctx)}if (${cond})${openBrace(ctx)}\n`
    trackOwnText(ctx, header)
    let code = header
    code += generateBody(thenBody, indented(ctx))
    code += `${indent(ctx)}}`
    if (elseBody.length === 1 && isElseIfChainable(elseBody[0].componentId) && elseBody[0].properties.isElseIf === 'true') {
      // else-if chain: produce "} else if (...) {" instead of nested "} else { if ... }"
      const elseIfSep = style.brace_style === 'Allman' ? '\n' + indent(ctx) : ' '
      trackOwnText(ctx, `${indent(ctx)}}` + elseIfSep + 'else ')
      code += elseIfSep + 'else '
      // Recursively generate the if node at same indentation (no extra indent)
      code += ifGenerator(elseBody[0], ctx).replace(new RegExp('^' + indent(ctx)), '')
      return code
    }
    if (elseBody.length > 0) {
      const elseHeader = `${style.brace_style === 'Allman' ? '\n' + indent(ctx) : ' '}else${openBrace(ctx)}\n`
      trackOwnText(ctx, `${indent(ctx)}}` + elseHeader)
      code += elseHeader
      code += generateBody(elseBody, indented(ctx))
      code += `${indent(ctx)}}`
    }
    code += '\n'
    return code
  }
  return ifGenerator
}

/**
 * ⚠️ **這個模組不再註冊任何產生器**——`statements.ts` 那 24 顆全部搬進膠囊了。
 *
 * 檔案留著，因為裡面有三個**共用的排版演算法**：
 * `formatParams`、`openBraceFor`、`ifGeneratorFor`。
 * 三個都曾經是 `registerStatementGenerators` 內部的閉包，而
 * **一個閉包 helper 會把它所在的整個函式變成不可分割的單位**——
 * 那個單位是「一個檔案」不是「一顆元件」，正是它們擋住膠囊化的方式。
 *
 * 提升它們是這一輪 F 最早的三個前置重構。
 */
