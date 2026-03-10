import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

describe('AppShell', () => {
  it('app-shell.ts should export createAppLayout function', () => {
    const filePath = path.resolve(__dirname, '../../../src/ui/app-shell.ts')
    const content = fs.readFileSync(filePath, 'utf-8')
    expect(content).toContain('export function createAppLayout')
  })

  it('app-shell.ts should export setupSelectors function', () => {
    const filePath = path.resolve(__dirname, '../../../src/ui/app-shell.ts')
    const content = fs.readFileSync(filePath, 'utf-8')
    expect(content).toContain('export function setupSelectors')
  })

  it('app-shell.ts should export setupToolbarButtons function', () => {
    const filePath = path.resolve(__dirname, '../../../src/ui/app-shell.ts')
    const content = fs.readFileSync(filePath, 'utf-8')
    expect(content).toContain('export function setupToolbarButtons')
  })

  it('app-shell.ts should export updateStatusBar function', () => {
    const filePath = path.resolve(__dirname, '../../../src/ui/app-shell.ts')
    const content = fs.readFileSync(filePath, 'utf-8')
    expect(content).toContain('export function updateStatusBar')
  })

  it('app-shell.ts should NOT import SyncController or any panel class directly', () => {
    const filePath = path.resolve(__dirname, '../../../src/ui/app-shell.ts')
    const content = fs.readFileSync(filePath, 'utf-8')
    const importLines = content.match(/^import\s+.*from\s+['"]([^'"]+)['"]/gm) ?? []
    for (const line of importLines) {
      expect(line).not.toContain('sync-controller')
      expect(line).not.toContain('execution-controller')
    }
  })

})
