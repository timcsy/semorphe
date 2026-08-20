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
      path.resolve(__dirname, '../../../src/core/universal-components.json'),
      path.resolve(__dirname, '../../../src/languages/cpp/core/components.json'),
    ]
    for (const filePath of conceptFiles) {
      const content = fs.readFileSync(filePath, 'utf-8')
      expect(content).not.toContain('"blockDef"')
      expect(content).not.toContain('"codeTemplate"')
    }
  })

  /**
   * ⚠️ **掃描對象換過（2026-08-12，spec 117）。**
   *
   * 原本掃 `src/views/semantic-tree-view.ts`——一個**假的視圖**，
   * 用來證明「只依賴 core 的視圖是可能的」。那個假視圖已完成任務並
   * 併進它唯一的測試（`tests/unit/views/`），而**契約接手了那個證明**。
   *
   * > **原本守的是「有一個假實作沒 import Blockly」，
   * > 現在守的是「所有視圖都必須實作的那份契約沒 import Blockly」。**
   *
   * ⚠️ 而這一支是**第二個**掃那個路徑的地方——第一個在
   * `tests/unit/views/semantic-tree-view.test.ts`。搬檔案時我 grep 的是
   * 類別名 `SemanticTreeView`，**看不到用路徑字串掃的這一支**。
   * 同族教訓：`experience.md`「身分不只以字串字面出現」。
   */
  it('★ 視圖契約不得 import blockly／投影／面板', () => {
    for (const f of ['view-host.ts', 'view-registry.ts']) {
      const filePath = path.resolve(__dirname, '../../../src/core', f)
      const imports = getImports(filePath)
      expect(imports.length, `${f} 一個 import 都沒讀到 → 掃描壞了`).toBeGreaterThan(0)
      for (const imp of imports) {
        expect(imp, `${f} import 了 ${imp}`).not.toContain('blockly')
        expect(imp).not.toContain('projections/')
        expect(imp).not.toContain('panels/')
      }
    }
  })
})
