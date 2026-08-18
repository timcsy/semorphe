/**
 * 把打包好的擴充裝進本機的 VSCode 與 Arduino IDE。
 *
 * ## 🔴 為什麼這是一個腳本，不是三行手動指令
 *
 * 2026-08-18 差一點讓使用者去測**四個版本以前**的東西：
 *
 * ```
 * ~/.arduinoIDE/plugins/semorphe-vscode.vsix          ← 我覆蓋了它
 * ~/.arduinoIDE/deployedPlugins/semorphe-vscode/      ← 而 Theia 讀的是這裡
 *                                                        版本：0.4.2
 * ```
 *
 * Theia 把 vsix 解到 `deployedPlugins/<名字>/`，而**那個目錄名不含版本**
 * ——所以覆蓋 vsix **不會**讓它重新解。⚠️ 而它不報錯：面板照開，
 * 只是裡面是舊的。
 *
 * > **一個以「名字」為鍵的快取，遇到「內容換了而名字沒換」時，
 * > 會把陳舊顯示成正常。**
 *
 * 同一族的坑 VSCode 那側也有（`manifest.ts` 記著）：`contributes` 以
 * `(id, version)` 為鍵快取，所以**版本號不變就不會重建**。
 *
 * 兩邊的處置都一樣：**讓版本進到鍵裡，並且先刪掉舊的**。
 *
 * 用法：`npm run build:vscode && npm run install:ide`
 */
import { existsSync, readFileSync, rmSync, mkdirSync, copyFileSync, readdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { homedir } from 'node:os'
import { join } from 'node:path'

const VSIX = 'build/vscode/semorphe-vscode.vsix'
const PKG = 'build/vscode/package.json'

if (!existsSync(VSIX) || !existsSync(PKG)) {
  console.error(`🔴 找不到 ${VSIX} —— 先跑 \`npm run build:vscode\``)
  process.exit(1)
}

const manifest = JSON.parse(readFileSync(PKG, 'utf8'))
const { name, publisher, version } = manifest
const id = `${publisher}.${name}`
console.log(`📦 ${id} ${version}`)

// ── VSCode ──────────────────────────────────────────────
// ⚠️ 目錄名**必須**含版本：`contributes` 以 (id, version) 為鍵快取。
const vscodeRoot = join(homedir(), '.vscode', 'extensions')
if (existsSync(vscodeRoot)) {
  for (const entry of readdirSync(vscodeRoot)) {
    if (entry.startsWith(`${id}-`)) {
      rmSync(join(vscodeRoot, entry), { recursive: true, force: true })
      console.log(`  🗑  移除舊版 ${entry}`)
    }
  }
  const dest = join(vscodeRoot, `${id}-${version}`)
  mkdirSync(dest, { recursive: true })
  execFileSync('unzip', ['-q', join(process.cwd(), VSIX)], { cwd: dest })
  // vsce 的包把內容放在 `extension/` 底下，而 VSCode 要的是攤平的。
  const inner = join(dest, 'extension')
  if (existsSync(inner)) {
    for (const f of readdirSync(inner)) {
      execFileSync('mv', [join(inner, f), join(dest, f)])
    }
    rmSync(inner, { recursive: true, force: true })
  }
  console.log(`  ✅ VSCode → ${dest}`)
} else {
  console.log('  ⏭  沒有 ~/.vscode/extensions，略過')
}

// ── Arduino IDE（Theia）─────────────────────────────────
const arduino = join(homedir(), '.arduinoIDE')
if (existsSync(arduino)) {
  const plugins = join(arduino, 'plugins')
  mkdirSync(plugins, { recursive: true })
  for (const entry of readdirSync(plugins)) {
    if (entry.startsWith(name) && entry.endsWith('.vsix')) {
      rmSync(join(plugins, entry), { force: true })
      console.log(`  🗑  移除舊的 ${entry}`)
    }
  }
  copyFileSync(VSIX, join(plugins, `${name}-${version}.vsix`))
  // 🔴 **這一步是重點**：不刪的話 Theia 不會重新解。
  //
  // ⚠️ 而目錄名有**兩種形狀**，而第一版只認得其中一種：
  //
  // ```
  // deployedPlugins/semorphe-vscode/          ← 不帶版本（第一版只刪這個）
  // deployedPlugins/semorphe-vscode-0.7.1/    ← 帶版本（實測看到的是這種）
  // ```
  //
  // 🔴 **同版本重裝時，帶版本的那個目錄不會被刪**，於是 Theia 繼續用舊的解壓內容
  // ——而 vsix 已經換掉了。**症狀與檔頭那一段一模一樣，只是換了個形狀。**
  //
  // > **一個以「名字」為鍵的快取，被清乾淨的前提是【你認得出它所有的名字】。**
  const deployRoot = join(arduino, 'deployedPlugins')
  if (existsSync(deployRoot)) {
    for (const entry of readdirSync(deployRoot)) {
      if (entry === name || entry.startsWith(`${name}-`)) {
        rmSync(join(deployRoot, entry), { recursive: true, force: true })
        console.log(`  🗑  清掉 Theia 的解壓快取 ${entry}`)
      }
    }
  }
  console.log(`  ✅ Arduino IDE → ${plugins}/${name}-${version}.vsix`)
} else {
  console.log('  ⏭  沒有 ~/.arduinoIDE，略過')
}

console.log('\n⚠️ 兩邊都要【重開視窗】才會生效。')
