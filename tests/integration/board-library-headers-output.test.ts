/**
 * spec 150：**產出端真的換了嗎。**
 *
 * ## 🔴 為什麼這一支與宣告那一支分開
 *
 * `board-library-headers.test.ts` 量的是**宣告**（替換表寫對了、能力宣告了）。
 * 而這個專案撞過**四次**「機制有了沒人接上」——
 * 宣告齊全而**沒有人查它**。所以產出這條路要自己有一支。
 *
 * ⚠️ **能力邊界**：本機沒有 Arduino 核心，所以這裡守的是**產出的字串**，
 * 不是「編得過」（spec 146 那支有 `gcc`，這一支沒有）。
 */
import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import type { Lifter } from '../../src/core/lift/lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { generateCode, setHeaderAliases, setDependencyResolver, setProgramScaffold, setScaffoldConfig } from '../../src/core/projection/code-generator'
import { CppScaffold } from '../../src/languages/cpp/cpp-scaffold'
import { createPopulatedRegistry } from '../../src/languages/cpp/std'
import type { StylePreset, Target } from '../../src/core/types'
import googleStyle from '../../src/languages/cpp/styles/google.json'
import d1mini from '../../src/languages/cpp/targets/wemos-d1-mini.json'
import esp32 from '../../src/languages/cpp/targets/esp32.json'

let tsParser: Parser
let lifter: Lifter

beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  tsParser = new Parser()
  tsParser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  lifter = createTestLifter()
  registerCppLanguage()
  const resolver = createPopulatedRegistry()
  setDependencyResolver(resolver)
  // 🔴 **產品走的是【鷹架】那條路**——第一版沒裝鷹架，於是測到的是
  //    `generate.ts` 裡那條 legacy 分支，而**使用者永遠走不到它**。
  //    測試綠而瀏覽器裡完全沒作用，是這一刀最貴的一次教訓。
  setProgramScaffold(new CppScaffold(resolver))
  setScaffoldConfig({ scaffoldDepth: 0 })
})

// ⚠️ **全域狀態要還原**——否則這一支會汙染同一個 worker 裡的別支。
afterEach(() => setHeaderAliases(undefined))

const SRC = '#include <WiFi.h>\nvoid setup(){ WiFi.begin("ssid", "pw"); }\nvoid loop(){}'
/** ⚠️ **沒有手寫 include** ——標頭由 `requires` 自動補，走的是鷹架的另一個出口。 */
const SRC_AUTO = 'void setup(){ WiFi.begin("ssid", "pw"); }\nvoid loop(){}'

function gen(target: { headerAliases?: Readonly<Record<string, string>> }, src = SRC): string {
  setHeaderAliases((target as Target).headerAliases)
  const t = lifter.lift(tsParser.parse(src).rootNode as never)
  expect(t, 'lift 回了 null → 這一條空過').not.toBeNull()
  const out = generateCode(t!, 'cpp', googleStyle as unknown as StylePreset)
  expect(out, '產出是空的 → 這一條空過').toContain('setup')
  return out
}

describe('spec 150 · 產出端（🔴 走【鷹架】那條路——產品走的那條）', () => {
  it('★ 錨點：ESP32 的產出仍然是 `<WiFi.h>`', () => {
    const out = gen(esp32 as never)
    expect(out, `ESP32 的產出被動到了：\n${out.slice(0, 120)}`).toContain('#include <WiFi.h>')
  })

  it('🔴 D1 mini 的產出是 `<ESP8266WiFi.h>`', () => {
    const out = gen(d1mini as never)
    expect(out, `D1 mini 仍然吐 <WiFi.h>：\n${out.slice(0, 120)}`).toContain('#include <ESP8266WiFi.h>')
    expect(out.match(/#include <WiFi\.h>/), '兩個標頭同時出現了').toBeNull()
  })

  it('🔴 學生【手寫】的 `#include <WiFi.h>` 也換掉', () => {
    // ⚠️ 這與 spec 146 的界線不同，而理由更硬：
    //    146 不改手寫的 `<stdio.h>`，因為**C++ 看得懂它**；
    //    這裡不改的話，那份程式碼在這塊板子上**編不過**。
    //    🟢 而 C 方言那一段本來就會換手寫的引入——這裡與它一致。
    const out = gen(d1mini as never)
    expect(out.match(/#include <WiFi\.h>/), '手寫的 <WiFi.h> 留下來了').toBeNull()
  })

  it('🔴 【自動補】的標頭也要換——鷹架有兩個引入出口', () => {
    // 🔴 注入實測：只補「手寫」那個出口的話，這一條仍然綠
    //    ——**兩個出口要各有一條測試**。
    const out = gen(d1mini as never, SRC_AUTO)
    expect(out, `自動補的標頭沒換：\n${out.slice(0, 120)}`).toContain('#include <ESP8266WiFi.h>')
    expect(out.match(/#include <WiFi\.h>/), '自動補的 <WiFi.h> 留下來了').toBeNull()
  })

  it('★ 錨點：而 ESP32 自動補的仍然是 `<WiFi.h>`', () => {
    expect(gen(esp32 as never, SRC_AUTO)).toContain('#include <WiFi.h>')
  })

  it('🔴 沒有替換表 → 一個字都不換', () => {
    setHeaderAliases(undefined)
    const t = lifter.lift(tsParser.parse(SRC).rootNode as never)
    const out = generateCode(t!, 'cpp', googleStyle as unknown as StylePreset)
    expect(out).toContain('#include <WiFi.h>')
  })

  it('🔴 換回沒有替換表的目標時，上一塊板子的替換不得留著', () => {
    gen(d1mini as never)          // 先在 ESP8266 上產一次
    setHeaderAliases(undefined)   // 換到沒有板子的目標
    const t = lifter.lift(tsParser.parse(SRC).rootNode as never)
    const out = generateCode(t!, 'cpp', googleStyle as unknown as StylePreset)
    expect(out, '上一塊板子的替換留下來了').toContain('#include <WiFi.h>')
  })
})
