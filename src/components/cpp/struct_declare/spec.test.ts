/**
 * `cpp:struct_declare` 的自證測——C 的 `typedef struct [Tag] { … } Alias;`（2026-11-08，C 盲測的下一刀）。
 * 原本整句照原文降級（再之前更糟：`typedef Point mytype;`），C 最常見的寫法判不出來。
 * 三種：匿名（只靠別名）、Tag 與別名相同、Tag 與別名不同（別名展開成 Tag）。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../../../../tests/helpers/setup-lifter'
import { registerCppLanguage } from '../../../languages/cpp/generators'
import { generateCode } from '../../../core/projection/code-generator'
import { expectCellaOut } from '../../../../tests/helpers/cella-run'
import type { Lifter } from '../../../core/lift/lifter'
import type { SemanticNode, StylePreset } from '../../../core/types'
import cStyle from '../../../languages/cpp/styles/c.json'

let tsParser: Parser
let lifter: Lifter
beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  tsParser = new Parser()
  tsParser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  lifter = createTestLifter()
  registerCppLanguage()
})
const lift = (code: string): SemanticNode => lifter.lift(tsParser.parse(code)!.rootNode as never) as SemanticNode
const find = (n: SemanticNode, id: string, out: SemanticNode[] = []): SemanticNode[] => {
  if (n.componentId === id) out.push(n)
  for (const kids of Object.values(n.slots ?? {})) for (const k of kids as SemanticNode[]) find(k, id, out)
  return out
}
const shape = (n: SemanticNode): unknown => [n.componentId, n.properties, Object.entries(n.slots ?? {}).map(([k, v]) => [k, v.map(shape)])]

const SRC = `#include <stdio.h>
typedef struct {
    int x;
    int y;
} Point;
typedef struct Node {
    int val;
    struct Node* next;
} Node;
typedef struct node_s {
    int k;
} NodeT;
int main() {
    Point p;
    p.x = 3;
    p.y = 4;
    Node b;
    b.val = 7;
    b.next = 0;
    NodeT t;
    t.k = 5;
    printf("%d %d %d\\n", p.x * p.y, b.val, t.k);
    return 0;
}
`

describe('cpp:struct_declare：C 的 typedef struct', () => {
  it('lift：三種都成為 struct（不是原文降級），別名記在 typedef_alias；匿名的沒有編名字', () => {
    const ss = find(lift(SRC), 'cpp:struct_declare')
    expect(ss.map((s) => [s.properties.name, s.properties.typedef_alias])).toEqual([['', 'Point'], ['Node', 'Node'], ['node_s', 'NodeT']])
    expect(find(lift(SRC), 'raw_code')).toEqual([])
  })

  it('產碼：一字不差，來回不走樣', () => {
    const t = lift(SRC)
    const out = generateCode(t, 'cpp', cStyle as StylePreset)
    for (const line of ['typedef struct {', '} Point;', 'typedef struct Node {', '} Node;', 'typedef struct node_s {', '} NodeT;', 'Point p;', 'NodeT t;']) {
      expect(out, out).toContain(line)
    }
    expect(out).not.toContain('MyStruct')
    expect(out).not.toContain('struct Point')
    expect(JSON.stringify(shape(lift(out)))).toBe(JSON.stringify(shape(t)))
  })

  it('🔴 執行（C）：三種都判得出', async () => {
    await expectCellaOut(SRC, '12 7 5\n', { lang: 'c' })
  })

  it('沒有別名的照舊：`struct P { int a; };`', () => {
    const out = generateCode(lift('struct P {\n    int a;\n};\nint main() {\n    return 0;\n}\n'), 'cpp', cStyle as StylePreset)
    expect(out).toContain('struct P {')
    expect(out).not.toContain('typedef')
  })

  it('裝不下的照原文降級：一句兩個別名、帶星號的別名', () => {
    const t = lift('typedef struct Q { int a; } Q, *QPtr;\nint main() {\n    return 0;\n}\n')
    // 頂層那一句照原文（unresolved 帶原文；裡面附的子節點只是參考，不參與產碼）
    expect(t.slots.body[0].componentId).not.toBe('cpp:struct_declare')
    expect(generateCode(t, 'cpp', cStyle as StylePreset)).toContain('typedef struct Q { int a; } Q, *QPtr;')
  })
})
