import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import type { Lifter } from '../../src/core/lift/lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { generateCode } from '../../src/core/projection/code-generator'
import { renderToBlocklyState } from '../../src/core/projection/block-renderer'
import { setupTestRenderer } from '../helpers/setup-renderer'
import type { StylePreset } from '../../src/core/types'

const style: StylePreset = {
  id: 'apcs',
  name: { 'zh-TW': 'APCS', en: 'APCS' },
  io_style: 'cout',
  naming_convention: 'camelCase',
  indent_size: 4,
  brace_style: 'K&R',
  namespace_style: 'using',
  header_style: 'individual',
}

let tsParser: Parser
let lifter: Lifter

beforeAll(async () => {
  await Parser.init({
    locateFile: (scriptName: string) => `${process.cwd()}/public/${scriptName}`,
  })
  tsParser = new Parser()
  const lang = await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`)
  tsParser.setLanguage(lang)

  lifter = createTestLifter()
  registerCppLanguage()
  setupTestRenderer()
})

function liftCode(code: string) {
  const tree = tsParser.parse(code)
  return lifter.lift(tree.rootNode as any)
}

describe('Four-level lift pipeline', () => {
  describe('Level 1: Direct pattern match', () => {
    it('should lift simple variable declaration (exact match)', () => {
      const tree = liftCode('int x = 5;')
      expect(tree).not.toBeNull()
      const body = tree!.slots.body
      expect(body).toHaveLength(1)
      expect(body[0].componentId).toBe('cpp:var_declare')
      expect(body[0].properties.name).toBe('x')
      expect(body[0].properties.type).toBe('int')
    })

    it('should lift arithmetic expression (direct pattern)', () => {
      const tree = liftCode('int y = a + b * c;')
      expect(tree).not.toBeNull()
      const decl = tree!.slots.body[0]
      expect(decl.componentId).toBe('cpp:var_declare')
      expect(decl.slots.initializer).toHaveLength(1)
      expect(decl.slots.initializer[0].componentId).toBe('cpp:arithmetic')
    })

    it('should lift if/else with nested body', () => {
      const tree = liftCode('if (x > 0) {\n    y = 1;\n} else {\n    y = 2;\n}')
      expect(tree).not.toBeNull()
      const ifNode = tree!.slots.body[0]
      expect(ifNode.componentId).toBe('cpp:if')
      expect(ifNode.slots.then_body.length).toBeGreaterThan(0)
      expect(ifNode.slots.else_body.length).toBeGreaterThan(0)
    })
  })

  describe('Level 2: Source range metadata', () => {
    it('should attach sourceRange to lifted nodes', () => {
      const tree = liftCode('int x = 5;')
      expect(tree).not.toBeNull()
      const decl = tree!.slots.body[0]
      expect(decl.metadata?.sourceRange).toBeDefined()
      expect(decl.metadata!.sourceRange!.startLine).toBe(0)
    })

    it('should preserve source ranges through nested structures', () => {
      const tree = liftCode('if (x > 0) {\n    y = 1;\n}')
      expect(tree).not.toBeNull()
      const ifNode = tree!.slots.body[0]
      expect(ifNode.metadata?.sourceRange).toBeDefined()
      const assign = ifNode.slots.then_body[0]
      expect(assign.metadata?.sourceRange).toBeDefined()
    })
  })

  describe('Level 3: Unresolved preservation', () => {
    it('should create unresolved node for partially-liftable construct', () => {
      // A class has named slots (member functions, fields) that can be lifted
      const tree = liftCode('class Foo {\npublic:\n    int x;\n    void bar() { return; }\n};')
      expect(tree).not.toBeNull()
      const body = tree!.slots.body
      expect(body.length).toBeGreaterThan(0)
      // The class should be unresolved or raw_code
      const classNode = body[0]
      expect(['unresolved', 'raw_code', 'cpp:class_def']).toContain(classNode.componentId)
      if (classNode.componentId === 'unresolved') {
        expect(classNode.metadata?.rawCode).toContain('class Foo')
        expect(classNode.slots.slots.length).toBeGreaterThan(0)
      }
    })

    it('should mark unresolved nodes with confidence=inferred', () => {
      const tree = liftCode('namespace ns {\n    int x = 5;\n}')
      expect(tree).not.toBeNull()
      const body = tree!.slots.body
      const nsNode = body[0]
      if (nsNode.componentId === 'unresolved') {
        expect(nsNode.metadata?.confidence).toBe('inferred')
      }
    })
  })

  describe('Level 4: Raw code degradation', () => {
    it('should degrade template to raw_code', () => {
      const tree = liftCode('template<typename T> T max(T a, T b) { return a > b ? a : b; }')
      expect(tree).not.toBeNull()
      const body = tree!.slots.body
      expect(body.length).toBeGreaterThan(0)
      // Template should be raw_code, unresolved, or cpp_template_function
      expect(['raw_code', 'unresolved', 'cpp:template_function']).toContain(body[0].componentId)
    })

    /**
     * 🔴 **2026-09-20：這一支不再是「降級」，而那是刻意的。**
     *
     * 帶參數的 `#define` 在此之前整行掉進 `unresolved`，而**它從來不是誠實的降級**：
     * 使用處（`MAX(a,b)` 出現的那一行）被 tree-sitter 解成一棵看起來合法的樹，
     * 產出的程式碼因此**靜默少東西**。
     *
     * 現在定義那一行有自己的身分（`cpp:define_func`），
     * 而**展開**由 `languages/cpp/lang/macro-expand.ts` 的樹修復負責
     * ——只在「代入之後解得乾淨」時接手，否則讓開。
     *
     * ⚠️ 這一支改成釘住**新的正確行為**，而不是刪掉：
     * 它守的是「定義那一行不得再掉進 raw_code／unresolved」。
     */
    it('帶參數的 #define 不再降級——它有自己的身分', () => {
      const tree = liftCode('#define MAX(a, b) ((a) > (b) ? (a) : (b))')
      expect(tree).not.toBeNull()
      const body = tree!.slots.body
      expect(body.length).toBeGreaterThan(0)
      expect(body[0].componentId).toBe('cpp:define_func')
    })

    /**
     * 🔴 **語法錯誤在【運算式位置】時，產回去會靜默少一段。**
     *（2026-09-20，管線 201 第五關量到的）
     *
     * ```
     * 位置          原文              產回去           出聲嗎
     * 語句          x @@ 2;           x @@            🟢 UNRECOGNIZED_CODE
     * 括號運算式    cout << (x @@ 2)  cout << (x)     🔴 安靜，而 @@ 2 不見了
     * 宣告的初值    int x = @@@;      int x =         🔴 安靜，而整行壞掉
     * ```
     *
     * 🔴 **語句那一路早就誠實了**（`raw_code` ＋ `unresolved`），
     * 而運算式那一路沒有——`lifter.ts` 的 `setConfidenceHigh` 會標上
     * `degradationCause: 'syntax_error'` ＋ `rawCode`，**而產生器不讀它**。
     *
     * > **「這一段我看不懂」如果只在【執行】那一路出聲，
     * > 那麼【程式碼】那一路的沉默就是一個錯的答案。**
     *
     * **為什麼不是現在**：修法是讓產生器在
     * `metadata.degradationCause === 'syntax_error'` 時**原文照抄**，
     * 而那會動到**每一個**語法錯誤的產出——包含「少一個分號」這種最常見的，
     * 今天它被順手補回去（`int x = 1` → `int x = 1;`）。
     * 那個改變要整族一起量，不是在巨集這一刀順手做。
     *
     * 🔴 **何時該修**：產生器讀 `degradationCause` 的那一刀
     *（與「接收者的空值預設」那一根同一個形狀：一個共用退路要整族一起改）。
     */
    it.fails('[UNSUPPORTED:產生器不讀 degradationCause] 運算式位置的語法錯誤要原文照抄', () => {
      const tree = liftCode('int main(){ int x = 1; int y = (x @@ 2); return y; }')
      expect(tree).not.toBeNull()
      const code = generateCode(tree!, 'cpp', style)
      // ★ 正向錨點：這一段真的被 lift 了（否則下面在驗空氣）
      expect(code).toContain('int x = 1')
      expect(code, '🔴 `@@ 2` 靜默消失了').toContain('@@')
    })

    it('★ 錨點：語句位置的語法錯誤【已經】誠實了——不得退步', () => {
      const tree = liftCode('int main(){ int x = 1; x @@ 2; return x; }')
      expect(tree).not.toBeNull()
      const code = generateCode(tree!, 'cpp', style)
      expect(code, '🔴 語句位置也開始吞掉語法錯誤了').toContain('@@')
    })

    it('should not crash on complex C++ constructs', () => {
      const complexCode = `
#include <iostream>
#include <vector>
using namespace std;

template<typename T>
class Container {
public:
    vector<T> data;
    void add(T item) { data.push_back(item); }
    T get(int idx) { return data[idx]; }
};

int main() {
    Container<int> c;
    c.add(42);
    cout << c.get(0) << endl;
    return 0;
}
`
      const tree = liftCode(complexCode)
      expect(tree).not.toBeNull()
      expect(tree!.componentId).toBe('cpp:program')
      // Should have multiple body nodes — no crashes
      expect(tree!.slots.body.length).toBeGreaterThan(0)
    })
  })

  describe('Round-trip preservation', () => {
    it('should preserve raw_code through code generation', () => {
      const tree = liftCode('template<typename T> T id(T x) { return x; }')
      expect(tree).not.toBeNull()
      const code = generateCode(tree!, 'cpp', style)
      expect(code).toContain('template')
    })

    it('should produce valid block state from code with unknown constructs', () => {
      const tree = liftCode('int x = 5;\ntemplate<typename T> class Foo {};')
      expect(tree).not.toBeNull()
      const state = renderToBlocklyState(tree!)
      expect(state.blocks.blocks).toHaveLength(1)
      // First block should be var_declare, chained with raw_code
      expect(state.blocks.blocks[0].type).toBe('cpp_var_declare')
      expect(state.blocks.blocks[0].next).toBeDefined()
    })
  })
})
