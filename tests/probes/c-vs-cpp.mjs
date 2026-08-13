/**
 * **探測（不是護欄）：C99 與 C++17 在這批教學語料上差多少**
 *
 * ## 為什麼是探測不是護欄
 *
 * `build-guardrail` 第 1 步：一條規範對一個可數的量。**而這裡沒有規範**
 * ——沒有東西該被推向零。這支腳本回答的是一個經驗問題：
 * 「C 和 C++ 難分難捨」到底難在哪、有多難。
 *
 * 跑法：`node tests/probes/c-vs-cpp.mjs`（不會被 vitest 撿到——它不是 .test.ts）
 *
 * ## ⚠️ 第一版問錯了問題，而那本身是這支腳本最有價值的產出
 *
 * 第一版數的是「兩邊都編得過而輸出不同的段數」，得到 **0 / 5**
 * ——看起來像「C 與 C++ 完全一致」，實際上是**只有 5 段兩邊都編得過**。
 * 262 段裡有 **230 段**倒在第一行的 `#include <iostream>`。
 *
 * > **一個語料庫如果全部用同一種風格寫成，它量不出「風格差多少」
 * > ——它只會告訴你它自己選了哪一種。**
 *
 * 這是 `build-guardrail` 6.5「先問紅的是世界，還是語料」的**第四次**，
 * 而形式是新的：不是語料壞掉，是**語料的分佈本身帶著答案**。
 *
 * → 所以這一版數的是「**C 編不過的第一個錯誤是什麼**」，把「寫法差異」
 *   與「語言差異」分開。見 `knowledge/draft/2026-08-13-C和C++難分難捨.md`。
 */
import fs from 'node:fs'; import path from 'node:path'; import { execSync } from 'node:child_process'; import os from 'node:os'
const dir = path.join(process.cwd(), 'tests/integration')
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cvscpp2-'))
function fetchCorpus() {
  const out = []
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.test.ts')) continue
    for (const m of fs.readFileSync(path.join(dir, f), 'utf8').matchAll(/`([^`]{4,600})`/g)) {
      const c = m[1].replace(/\\\\/g, '\\')
      if (!/int\s+main/.test(c) || c.includes('${')) continue
      out.push(c)
    }
  }
  return [...new Set(out)]
}
const undecidable = (c) => /\bcin\s*>>|\bscanf\s*\(|getline\s*\(|\brand\s*\(/.test(c)
const corpus = fetchCorpus().filter((c) => !undecidable(c))

// ① C 編不過的第一個錯誤是什麼
const reasons = new Map()
let cOk = 0
for (let i = 0; i < corpus.length; i++) {
  const src = path.join(tmp, `p${i}.c`); fs.writeFileSync(src, corpus[i])
  try { execSync(`gcc -x c -std=c99 -fsyntax-only ${src}`, { stdio: 'pipe', timeout: 15000 }); cOk++ }
  catch (e) {
    const err = String(e.stderr ?? '')
    const first = err.split('\n').find((l) => l.includes('error:')) ?? '(?)'
    const kind = /'iostream' file not found/.test(first) ? 'A. #include <iostream>'
      : /unknown type name 'namespace'|expected identifier.*namespace/.test(first) ? 'B. using namespace std'
      : /'string' file not found|'vector' file not found|'algorithm' file not found|file not found/.test(first) ? 'C. 其他 C++ 標頭'
      : /unknown type name 'class'|unknown type name 'bool'/.test(first) ? 'D. class／bool 等關鍵字'
      : /use of undeclared identifier 'cout'|'endl'/.test(first) ? 'E. cout／endl'
      : `F. 其他：${first.replace(/^.*error: /, '').slice(0, 46)}`
    reasons.set(kind, (reasons.get(kind) ?? 0) + 1)
  }
}
console.log(`\n═══ ${corpus.length} 段語料，C99 編得過 ${cOk} 段\n`)
console.log('  而編不過的第一個錯誤是什麼：')
for (const [k, v] of [...reasons].sort((a,b)=>b[1]-a[1]).slice(0,10)) console.log(`   ${String(v).padStart(4)}  ${k}`)
console.log('\n  ⚠️ 若前幾名都是「C++ 專屬的寫法」，那代表**語料選了一邊**，')
console.log('     而不是「C 與 C++ 差很多」——那兩件事完全不同。')
fs.rmSync(tmp, { recursive: true, force: true })
