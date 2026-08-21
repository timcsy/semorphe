/**
 * `python:container_append` 的 **generate** 路。
 *
 * 🔴 **這一顆是 `role: 'statement'`，所以縮排與換行要自己收**。
 * 核心的 `asStatement` 只包 `expression`／`both` 那兩種角色——
 * 少了這一行的症狀是下一行黏上去：`nums.append(9)print(len(nums))`
 * ——**一段不合法的 Python，而它看起來只是排版怪**。
 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('python:container_append', (node, ctx) => {
    const o = generateExpression((node.children.obj ?? [])[0], ctx)
    const v = generateExpression((node.children.value ?? [])[0], ctx)
    return `${indent(ctx)}${o}.append(${v})\n`
  })
}
