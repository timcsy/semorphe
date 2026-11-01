/**
 * **建置時編好的 Cella 模組**（第 210 刀）——建置工具產出的名字，要與 worker 抓的名字對得上。
 *
 * 對不上的症狀不是紅、是慢：worker 抓不到就靜靜退回現場編譯（判斷功能從 0.3 秒回到 20 秒以上），
 * 而線上沒有任何東西會出聲。
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'

const tool = fs.readFileSync('tools/precompile-cella.ts', 'utf8')
const worker = fs.readFileSync('src/providers/cella/worker.ts', 'utf8')

describe('編好的模組：名字兩邊對得上', () => {
  it('🔴 判決依家族、除錯依分支——工具編的與 worker 抓的是同一套名字', () => {
    expect(tool).toMatch(/name: `verdict-\$\{f\}`/)
    expect(tool).toMatch(/name: `debugger-\$\{b\}`/)
    expect(worker).toMatch(/fetchPrecompiled\(`verdict-\$\{family\}`\)/)
    expect(worker).toMatch(/fetchPrecompiled\(`debugger-\$\{b\}`\)/)
  })

  it('🔴 工具涵蓋 worker 會用到的每一族、每一個分支', () => {
    expect(tool).toMatch(/\['cfamily', 'python'\]/)
    expect(tool).toMatch(/\['c', 'cpp', 'arduino', 'python'\]/)
  })

  it('★ 兩個宿主的建置都跑它：網頁版在 vite build 之前、擴充進 dist/cella-modules', () => {
    expect(JSON.parse(fs.readFileSync('package.json', 'utf8')).scripts.build).toMatch(/precompile-cella\.ts public\/cella-modules && vite build/)
    expect(fs.readFileSync('tools/build-vscode.ts', 'utf8')).toMatch(/precompile-cella\.ts', join\(OUT, 'dist', 'cella-modules'\)/)
  })
})
