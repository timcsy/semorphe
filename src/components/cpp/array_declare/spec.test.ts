/**
 * `cpp:array_declare` 的自證測——初值的三種寫法（第 394 刀起）。
 *
 * 🔴 字元陣列用一個字串字面量初始化時不加大括號（`char s[20] = "Semorphe";`）；
 *    在此之前產成 `{"Semorphe"}`，那不是學生寫的那份，formalize 也因此被 Cella 判型別不合。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser } from 'web-tree-sitter'
import { registerCppLanguage } from '../../../languages/cpp/generators'
import { generateCode } from '../../../core/projection/code-generator'
import { createNode } from '../../../core/semantic-tree'
import apcs from '../../../languages/cpp/styles/apcs.json'
import type { StylePreset } from '../../../core/types'

beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  registerCppLanguage()
})

const decl = (type: string, values: ReturnType<typeof createNode>[] | undefined): string =>
  generateCode(createNode('cpp:program', {}, { body: [
    createNode('cpp:array_declare', { type, name: 'a' }, { size: [createNode('cpp:literal_number', { value: '20' })], ...(values ? { values } : {}) }),
  ] }), 'cpp', apcs as unknown as StylePreset)
const str = (v: string): ReturnType<typeof createNode> => createNode('cpp:literal_string', { value: v })

describe('膠囊自證：cpp:array_declare', () => {
  it('🔴 字元陣列的字串初值：不加大括號', () => {
    expect(decl('char', [str('Semorphe')])).toContain('char a[20] = "Semorphe";')
  })

  it('★ 字串的陣列、數字的陣列：照舊是大括號', () => {
    expect(decl('string', [str('a')])).toContain('string a[20] = {"a"};')
    expect(decl('int', [createNode('cpp:literal_number', { value: '1' }), createNode('cpp:literal_number', { value: '2' })])).toContain('int a[20] = {1, 2};')
  })

  it('★ 沒有初值：不產 `= {}`', () => {
    expect(decl('int', undefined)).toContain('int a[20];')
  })
})
