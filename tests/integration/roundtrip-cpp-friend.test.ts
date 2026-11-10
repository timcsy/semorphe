/**
 * **friend 的 round-trip**（元件管線 389，2026-11-10）：friend 寫在各種位置，各量三件事——
 * ① 語義樹裡是那兩顆元件（不是原文）② lift → 產碼 → 再 lift 同一棵 ③ 交給 Cella 的輸出是對的（量於 2026-11-10，g++ 語意）。
 * ⚠️ 程式碼刻意寫成不帶插值的反引號字串：宣告完整性護欄的語料掃的就是這裡。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import { setupTestRenderer } from '../helpers/setup-renderer'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { generateCode } from '../../src/core/projection/code-generator'
import { expectCellaOut } from '../helpers/cella-run'
import apcs from '../../src/languages/cpp/styles/apcs.json'
import type { SemanticNode, StylePreset } from '../../src/core/types'

const PROGS: [string, string, Record<string, number>, string][] = [
  ['朋友類別讀私有欄位、改私有欄位', `#include <iostream>
using namespace std;
class Box {
    int v;
    friend class Keeper;
public:
    Box() : v(1) {}
    int get() const { return v; }
};
class Keeper {
public:
    void bump(Box& b) { b.v = b.v + 41; }
};
int main() {
    Box b;
    Keeper k;
    k.bump(b);
    cout << b.get() << endl;
    return 0;
}
`, { 'cpp:friend_class': 1 }, '42\n'],
  ['同一個類別兩個朋友函式、回傳指標、無名參數', `#include <iostream>
using namespace std;
class P {
    int a;
    friend int geta(const P& p);
    friend int* where(P&);
public:
    P() : a(9) {}
};
int geta(const P& p) { return p.a; }
int* where(P& p) { return &p.a; }
int main() {
    P p;
    *where(p) = 12;
    cout << geta(p) << endl;
    return 0;
}
`, { 'cpp:friend_function': 2 }, '12\n'],
  ['struct 裡的 friend、寫在 public 節的朋友類別', `#include <iostream>
using namespace std;
struct Q {
    friend class R;
private:
    int s = 3;
};
class R {
public:
    int look(Q q) { return q.s; }
};
int main() {
    Q q;
    R r;
    cout << r.look(q) << endl;
    return 0;
}
`, { 'cpp:friend_class': 1 }, '3\n'],
]

let parser: Parser
beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  registerCppLanguage()
  setupTestRenderer()
}, 120_000)
const S = apcs as unknown as StylePreset
const lift = (c: string): SemanticNode => createTestLifter().lift(parser.parse(c)!.rootNode as never) as SemanticNode
const all = (n: SemanticNode, o: SemanticNode[] = []): SemanticNode[] => { o.push(n); for (const k of Object.values(n.slots ?? {})) for (const c of k) all(c, o); return o }
const shape = (n: SemanticNode): unknown => [n.componentId, n.properties, Object.fromEntries(Object.entries(n.slots ?? {}).map(([k, v]) => [k, v.map(shape)]))]

describe('friend 的來回', () => {
  it.each(PROGS)('★ %s', async (_n, code, ids, out) => {
    const t = lift(code)
    for (const [id, count] of Object.entries(ids)) expect(all(t).filter((x) => x.componentId === id)).toHaveLength(count)
    expect(all(t).filter((x) => /raw_code|unresolved/.test(x.componentId)).map((x) => x.metadata?.rawCode)).toEqual([])
    expect(shape(lift(generateCode(t, 'cpp', S)))).toEqual(shape(t))
    await expectCellaOut(code, out)
  })
})
