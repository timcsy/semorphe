import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

const panelsDir = path.resolve(__dirname, '../../../src/ui/panels')
const syncControllerPath = path.resolve(__dirname, '../../../src/ui/sync-controller.ts')

const panelFiles = ['blockly-panel.ts', 'monaco-panel.ts', 'console-panel.ts', 'variable-panel.ts']

function getImports(filePath: string): string[] {
  const content = fs.readFileSync(filePath, 'utf-8')
  const importLines = content.match(/^import\s+.*from\s+['"]([^'"]+)['"]/gm) ?? []
  return importLines.map(line => {
    const match = line.match(/from\s+['"]([^'"]+)['"]/)
    return match ? match[1] : ''
  }).filter(Boolean)
}

describe('Panel independence', () => {
  for (const file of panelFiles) {
    const panelName = file.replace('.ts', '')

    it(`${panelName} should not import other panels`, () => {
      const filePath = path.join(panelsDir, file)
      if (!fs.existsSync(filePath)) return // skip if panel doesn't exist yet

      const imports = getImports(filePath)
      const otherPanels = panelFiles.filter(f => f !== file).map(f => f.replace('.ts', ''))

      for (const imp of imports) {
        for (const other of otherPanels) {
          expect(imp).not.toContain(other)
        }
      }
    })
  }

  it('sync-controller should not import any panel', () => {
    const imports = getImports(syncControllerPath)
    for (const imp of imports) {
      expect(imp).not.toContain('panels/')
    }
  })

  it('toolbox-builder should not import blockly', () => {
    const filePath = path.resolve(__dirname, '../../../src/ui/toolbox-builder.ts')
    const imports = getImports(filePath)
    for (const imp of imports) {
      expect(imp).not.toContain('blockly')
    }
  })

  it('app-shell should not import sync-controller or execution-controller', () => {
    const filePath = path.resolve(__dirname, '../../../src/ui/app-shell.ts')
    const imports = getImports(filePath)
    for (const imp of imports) {
      expect(imp).not.toContain('sync-controller')
      expect(imp).not.toContain('execution-controller')
    }
  })

  it('concepts.json should not contain blockDef fields', () => {
    const conceptFiles = [
      path.resolve(__dirname, '../../../src/blocks/semantics/universal-concepts.json'),
      path.resolve(__dirname, '../../../src/languages/cpp/core/concepts.json'),
    ]
    for (const filePath of conceptFiles) {
      const content = fs.readFileSync(filePath, 'utf-8')
      expect(content).not.toContain('"blockDef"')
      expect(content).not.toContain('"codeTemplate"')
    }
  })

  it('semantic-tree-view should not import blockly', () => {
    const filePath = path.resolve(__dirname, '../../../src/views/semantic-tree-view.ts')
    const imports = getImports(filePath)
    for (const imp of imports) {
      expect(imp).not.toContain('blockly')
      expect(imp).not.toContain('projections/')
      expect(imp).not.toContain('panels/')
    }
  })
})
