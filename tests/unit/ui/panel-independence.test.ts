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
})
