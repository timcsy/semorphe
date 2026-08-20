/**
 * `python:func_call` 的 **generate** 路——**兩個形態共用一份**。
 *
 * ⚠️ 語句形態要縮排與換行，運算式形態不要。而「我現在是哪一種」不看形態，
 * 看 `ctx.asStatement`——**形態是投影，而產生器拿到的是語義樹**。
 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('python:func_call', (node, ctx) => {
    const name = String(node.properties.name ?? '')
    const args = (node.children.args ?? []).map((a) => generateExpression(a, ctx)).join(', ')
    const call = `${name}(${args})`
    // 語句位置由 `asStatement` 包縮排與換行（核心的共用機制），
    // 所以這裡回裸的呼叫式 —— 兩個形態一份程式碼。
    void indent
    return call
  })
}
