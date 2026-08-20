/**
 * `python:program` 的 **generate** 路——**一個 Python 檔就是它的敘述串，沒有外殼**。
 *
 * ⚠️ 這是與 C++ 的**第二個分歧點**（第一個是字面常數）：
 * C++ 那顆程式根要產出 `#include` ＋ `int main() { … return 0; }`，
 * 而 Python 的模組**什麼都不包**——檔案本身就是進入點。
 *
 * > 兩顆都叫「程式的根」，而它們在觀察集「產出的形式」下**不落在同一類**。
 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { generateBody } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('python:program', (node, ctx) => generateBody(node.children.body ?? [], ctx))
}
