import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

describe('AppShell', () => {
  it('app-shell.ts should export createAppLayout function', () => {
    const filePath = path.resolve(__dirname, '../../../src/ui/app-shell.ts')
    const content = fs.readFileSync(filePath, 'utf-8')
    expect(content).toContain('export function createAppLayout')
  })

  it('🪦 `setupSelectors` 已退場——那四顆下拉變成 `ControlState` 的渲染器', () => {
    // 2026-08-25：桌機狀態列／IDE 狀態列／行動版設定表**讀同一份**。
    // 加一顆 picker 不再需要動任何一個渲染器。
    const content = fs.readFileSync(path.resolve(__dirname, '../../../src/ui/app-shell.ts'), 'utf-8')
    expect(content, '🔴 又長回來了').not.toContain('export function setupSelectors')
    // 正向錨點：而接線的那一支還在（否則這條可能是「整個檔沒讀到」而空過）
    expect(content).toContain('export function setupToolbarButtons')
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
