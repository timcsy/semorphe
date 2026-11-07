/** `c-to-cpp.ts` 的格式判斷——不經 Cella（型別直接給）。兩邊判決相同那條在 `tests/integration/c-to-cpp-verdict.test.ts`。 */
import { describe, it, expect } from 'vitest'
import { createNode } from '../../../../src/core/semantic-tree'
import { printfAsCout, scanfAsCin, convertCToCpp } from '../../../../src/languages/cpp/c-to-cpp'
import '../../../../src/languages/cpp/generators'

const v = (name: string) => createNode('cpp:var_ref', { name })
const printf = (format: string, args: ReturnType<typeof v>[]) => createNode('cpp:print_formatted', { format }, { args })
const scanf = (format: string, args: ReturnType<typeof v>[]) => createNode('cpp:input_formatted', { format }, { args })
const shape = (n: ReturnType<typeof v> | null) =>
  n && (n.slots.values ?? []).map((x) => (x.componentId === 'cpp:literal_string' ? `"${x.properties.value}"` : x.properties.name ?? x.componentId))

describe('printf → cout', () => {
  it('文字、轉換、結尾換行', () => {
    const a = v('a'); const b = v('b')
    expect(shape(printfAsCout(printf('%d + %d\\n', [a, b]), { [a.id]: 'int', [b.id]: 'int' })))
      .toEqual(['a', '" + "', 'b', 'cpp:endl'])
  })
  it('%% 是一個百分號；%i 等於 %d；%lld 配 long long', () => {
    const a = v('a'); const n = v('n')
    expect(shape(printfAsCout(printf('%i%%, %lld', [a, n]), { [a.id]: 'int', [n.id]: 'long long' })))
      .toEqual(['a', '"%, "', 'n'])
  })
  it('引數數目對不上、型別不符、有寬度 → null', () => {
    const a = v('a')
    expect(printfAsCout(printf('%d %d', [a]), { [a.id]: 'int' })).toBeNull()
    expect(printfAsCout(printf('%d', [a]), { [a.id]: 'char' })).toBeNull()
    expect(printfAsCout(printf('%3d', [a]), { [a.id]: 'int' })).toBeNull()
    expect(printfAsCout(printf('%d', [a]), {})).toBeNull()
  })
})

describe('scanf → cin', () => {
  it('只有空白分隔的轉換', () => {
    const a = v('a'); const b = v('b')
    expect(scanfAsCin(scanf('%d %lf', [a, b]), { [a.id]: 'int', [b.id]: 'double' })).not.toBeNull()
  })
  it('%c 要前面有空白（cin >> 會跳空白、%c 不會）', () => {
    const c = v('c')
    expect(scanfAsCin(scanf('%c', [c]), { [c.id]: 'char' })).toBeNull()
    expect(scanfAsCin(scanf(' %c', [c]), { [c.id]: 'char' })).not.toBeNull()
  })
  it('%s 只收 char 陣列；%f 配 double 不收（要 %lf）', () => {
    const s = v('s'); const d = v('d')
    expect(scanfAsCin(scanf('%s', [s]), { [s.id]: 'char[20]' })).not.toBeNull()
    expect(scanfAsCin(scanf('%f', [d]), { [d.id]: 'double' })).toBeNull()
  })
})

describe('整棵樹', () => {
  it('只換語句位置的；不改原樹', () => {
    const a = v('a')
    const body = [printf('%d\\n', [a])]
    const root = createNode('cpp:program', {}, { body })
    const r = convertCToCpp(root, { [a.id]: 'int' })
    expect([r.converted, r.kept]).toEqual([1, 0])
    expect(r.tree.slots.body[0].componentId).toBe('cpp:print')
    expect(root.slots.body[0].componentId).toBe('cpp:print_formatted')
  })
})
