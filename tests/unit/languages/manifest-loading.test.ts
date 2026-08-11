import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import type { LanguageManifest } from '../../../src/core/types'

const manifestPath = path.resolve(__dirname, '../../../src/languages/cpp/manifest.json')
const cppDir = path.resolve(__dirname, '../../../src/languages/cpp')

describe('Language manifest loading', () => {
  it('manifest.json should contain required fields', () => {
    const manifest: LanguageManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))
    expect(manifest.id).toBe('cpp')
    expect(manifest.name).toBe('C++')
    expect(manifest.version).toBeDefined()
    expect(manifest.parser).toBeDefined()
    expect(manifest.parser.type).toBe('tree-sitter')
    expect(manifest.provides).toBeDefined()
  })

  it('provides.concepts paths should exist', () => {
    const manifest: LanguageManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))
    for (const relPath of manifest.provides.concepts) {
      const absPath = path.resolve(cppDir, relPath)
      expect(fs.existsSync(absPath), `Missing: ${absPath}`).toBe(true)
    }
  })

  it('provides.blocks paths should exist', () => {
    const manifest: LanguageManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))
    for (const relPath of manifest.provides.blocks) {
      const absPath = path.resolve(cppDir, relPath)
      expect(fs.existsSync(absPath), `Missing: ${absPath}`).toBe(true)
    }
  })

  it('provides.templates and liftPatterns paths should exist', () => {
    const manifest: LanguageManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))
    for (const relPath of [...manifest.provides.templates, ...manifest.provides.liftPatterns]) {
      const absPath = path.resolve(cppDir, relPath)
      expect(fs.existsSync(absPath), `Missing: ${absPath}`).toBe(true)
    }
  })

  it('manifest-driven loading should produce consistent counts', () => {
    const manifest: LanguageManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))

    // Count blocks from manifest paths
    let manifestBlockCount = 0
    for (const relPath of manifest.provides.blocks) {
      const absPath = path.resolve(cppDir, relPath)
      const blocks = JSON.parse(fs.readFileSync(absPath, 'utf-8'))
      manifestBlockCount += blocks.length
    }

    // Count concepts from manifest paths
    let manifestConceptCount = 0
    for (const relPath of manifest.provides.concepts) {
      const absPath = path.resolve(cppDir, relPath)
      const concepts = JSON.parse(fs.readFileSync(absPath, 'utf-8'))
      manifestConceptCount += concepts.length
    }

    // ⚠️ **這裡不准錨在「還有幾顆沒被搬走」上。**
    //
    // 前兩版都錨在那個數字上（58 → 30、42 → 20），而它**隨 F 下降**——
    // 於是每搬一批就要下調一次，而下調的動作與「護欄壞了」長得一模一樣。
    // 2026-08-11 第三次撞到（28 < 30）之後改掉。
    //
    // > **簽名：斷言的那個數字，是不是這條規範想推向零的？**
    // > 是 → 它會在成功的那天變紅。
    //
    // 這支測試真正要問的是「**manifest 指的每一條路徑都讀得到東西嗎**」，
    // 而那已經由上面的迴圈（`JSON.parse` 不丟錯）與下面的 `> 0` 回答了。
    // 錨改成**列了幾條路徑**——那是輸入量，不隨搬家變。
    expect(manifest.provides.blocks.length, 'manifest 沒列任何積木來源').toBeGreaterThan(3)
    expect(manifest.provides.concepts.length, 'manifest 沒列任何概念來源').toBeGreaterThan(3)
    // ⚠️ **這兩行也是「錨在會下降的數字上」**（同一支測試的第二處，2026-08-11）。
    // 上面那段註解剛講完這件事，而這裡的 `> 0` 數的是**共用宣告檔還剩幾筆**
    // ——F 搬到剩 4 顆時 `<cstdio>`／`<cstring>`／`<cctype>` 都空了，總和歸零。
    //
    // > **一個「非零」的斷言，在一個正在歸零的世界裡也是缺陷計數。**
    //
    // 真正要問的是「manifest 指的每一條路徑都讀得到 JSON 陣列」——
    // 而那已經由上面的迴圈（`JSON.parse` 不丟錯）回答了。這裡只斷言它們是陣列。
    expect(Number.isInteger(manifestBlockCount), 'manifest 的積木來源有讀不成陣列的').toBe(true)
    expect(Number.isInteger(manifestConceptCount), 'manifest 的概念來源有讀不成陣列的').toBe(true)
  })
})
