/**
 * 類別外定義的成員函式（照實降級成原文）要留在最外層——走一趟積木時隱藏骨架不能把它包進 main
 * （2026-11-06 元件管線 313 的瀏覽器驗收量到：包進去之後產回去編不過）。
 */
import { describe, it, expect } from 'vitest'
import { staysTopLevel } from '../../../src/core/component/traits'

const raw = (code: string) => ({ componentId: 'raw_code', properties: { code }, metadata: {} })

describe('staysTopLevel：類別外定義的原文', () => {
  it('★ 帶 X:: 限定、有本體的：留在外面', () => {
    expect(staysTopLevel(raw('int Counter::get() const {\n    return n;\n}'))).toBe(true)
    expect(staysTopLevel(raw('Counter::Counter() {\n    n = 0;\n}'))).toBe(true)
    expect(staysTopLevel(raw('Folder::~Folder() {\n}'))).toBe(true)
    expect(staysTopLevel(raw('const char* State::name() const {\n    return "S";\n}'))).toBe(true)
  })
  it('★ 呼叫、一般敘述：照舊可以包進 main', () => {
    expect(staysTopLevel(raw('std::sort(a, a + n);'))).toBe(false)
    expect(staysTopLevel(raw('std::for_each(a, a + n, [](int x) { cout << x; });'))).toBe(false)
    expect(staysTopLevel(raw('x = y;'))).toBe(false)
    expect(staysTopLevel(raw('if (x) {\n    y = A::f(1);\n}'))).toBe(false)
  })
  it('★ 原本的規則不變：# 開頭的原文留在外面', () => {
    expect(staysTopLevel({ componentId: 'raw_code', metadata: { rawCode: '#pragma once' } })).toBe(true)
  })
})
