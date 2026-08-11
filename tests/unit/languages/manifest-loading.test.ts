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

    // ⚠️ **這個下限隨 F（膠囊搬家）下降**——manifest 列的是**共用宣告檔**，
    // 而膠囊的積木不在那些檔裡。它量的是「manifest 指的路徑讀得到東西」，
    // 不是「這個語言有幾顆積木」。
    //
    // > 一個入口條件錨在「還沒被搬走的有幾顆」上，會在搬家成功的路上變紅。
    //
    // 2026-08-11：58 → 30（保守下限，留給後續搬家空間）。
    expect(manifestBlockCount).toBeGreaterThanOrEqual(30)
    // core(42) concepts + std module concepts (19+) = 61+
    // ⚠️ 同上：這個下限也隨 F 下降（manifest 列的是共用宣告檔）。2026-08-11：42 → 20。
    expect(manifestConceptCount).toBeGreaterThanOrEqual(20)
    // Blocks and concepts should both be non-trivial
    expect(manifestBlockCount).toBeGreaterThan(0)
    expect(manifestConceptCount).toBeGreaterThan(0)
  })
})
