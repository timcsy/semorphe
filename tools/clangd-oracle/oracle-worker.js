/**
 * 在 worker 裡跑 clangd `--check`，逐筆回報診斷代號。
 *
 * ⚠️ **必須是 worker**：clangd.js build 時只開了 `worker` 環境，
 * 主緒載入會 `Aborted(web environment detected but not enabled at build time)`。
 */
const CXX = '/usr/include/wasm32-wasi/c++/v1'

/**
 * ⚠️ **sysroot 在 wasm 裡，而 clangd 找不到它**——沒有這個檔的時候它報
 * `'iostream' file not found`，**那看起來像「sysroot 不存在」**。
 */
const FLAGS = [
  '-xc++', '-std=c++20', '--target=wasm32-wasi',
  '-isystem' + CXX, '-isystem/usr/include/wasm32-wasi', '-isystem/usr/include',
].join('\n')

async function check(code) {
  const out = []
  const mod = await import('./wasm/clangd.js')
  const M = await mod.default({
    noInitialRun: true,
    print: (s) => out.push(s),
    printErr: (s) => out.push(s),
    locateFile: (p) => './wasm/' + p,
  })
  M.FS.writeFile('/compile_flags.txt', FLAGS)
  M.FS.writeFile('/main.cpp', code)
  try { M.callMain(['--check=/main.cpp']) } catch (e) { /* callMain 正常結束也會丟 ExitStatus */ }

  const text = out.join('\n')
  // 只取 **E 級**，而 IncludeCleaner 那類沒有方括號代號，自然被這個樣式排除。
  const errs = [...text.matchAll(/^E\[[0-9:.]+\] \[([a-z_]+)\] Line (\d+): (.+)$/gm)]
    .map((m) => ({ code: m[1], line: +m[2], msg: m[3] }))
  return { errs, done: /All checks completed/.test(text) }
}

onmessage = async (e) => {
  const samples = e.data
  const rows = []
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i]
    try {
      const r = await check(s.code)
      rows.push({ group: s.group, name: s.name, ...r })
    } catch (err) {
      rows.push({ group: s.group, name: s.name, threw: String(err).slice(0, 120) })
    }
    if (i % 5 === 0) postMessage({ type: 'log', s: `${i + 1}/${samples.length}` })
  }
  postMessage({ type: 'done', rows })
}
