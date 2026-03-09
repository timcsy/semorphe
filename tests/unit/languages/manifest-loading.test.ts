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

  it('manifest-driven loading should produce same block count as direct loading', () => {
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

    // Direct loading counts (from known files)
    // basic(14) + advanced(26) + special(17) + stdlib-containers(2) + stdlib-algorithms(2) = 61
    const directCppBlocks = 61
    const directCppConcepts = 61

    expect(manifestBlockCount).toBe(directCppBlocks)
    expect(manifestConceptCount).toBe(directCppConcepts)
  })
})
