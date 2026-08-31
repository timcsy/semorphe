/** `cpp:program` 的 **generate** 路——從共用檔原封剪過來（批次第四十二批：樹根與進入點）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import type { SemanticNode } from '../../../core/types'
import { indented, generateBody, trackOwnText } from '../../../core/projection/code-generator'
import { computeAutoIncludes } from '../../../languages/cpp/auto-include'
import { normalizeHeader, cIoHeaderFor, toCHeader } from '../../../languages/cpp/header-aliases'
import { isCDialect, C_BOOL_HEADER, usesBool, collectStructNames } from '../../../languages/cpp/target-dialect'
import type { DependencyResolver } from '../../../core/dependency-resolver'
import { isIncludeDirective } from '../../../languages/cpp/core/node-traits'
import { buildInclude } from '../include/lift'
import { isFunctionDefinition } from '../../../core/component/traits'
// 🔴 「骨架已經在樹裡了嗎」由**骨架宣告**回答（2026-08-28）
import { skeletonById, skeletonPresent } from '../../../core/skeleton'

/**
 * 把一行 `#include <cstdio>` 換成 C 世界的名字。
 * ⚠️ 用的是 `header-aliases` 那張**既有**的表，沒有新增資料。
 */
/** 這個 `#include` 在 C 世界裡有沒有對應的東西。沒有的就不該產出。 */
function hasCEquivalent(line: string): boolean {
  const m = /#include\s*<([^>]+)>/.exec(line)
  if (!m) return true
  return toCHeader(m[1]) !== m[1] || m[1].endsWith('.h')
}

function cHeaderLine(line: string): string {
  // 🔴 **先問「C 裡什麼標頭滿足這個需求」，再問「它在 C 裡叫什麼」**
  //    ——與 legacy 那條路**逐字同一條規則**（spec 146 定的）。
  //
  // ⚠️ 而 spec 146 只把它落在 legacy 那條：`toCHeader('iostream')` 回 `'iostream'`
  //    （那是刻意的——它答的是「名字」），於是**鷹架那條的手寫 `<iostream>`
  //    在 C 目標下原樣留著**，編不過。
  //    🟢 spec 151 的雙路徑護欄第一次跑就抓到它。
  //
  // > **同一件事寫在兩條路上，修其中一條的測試會綠。**
  return line.replace(/#include\s*<([^>]+)>/g,
    (_m, h: string) => `#include <${cIoHeaderFor(h) ?? toCHeader(h)}>`)
}

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:program', (node, ctx) => {
    // spec 150：這塊板子把某個標頭叫成別的名字。⚠️ 省略 ＝ 不換。
    const bareOf = (h: string) => h.replace(/^<|>$/g, '')
    const aliasTable = new Map(
      Object.entries(ctx.headerAliases ?? {}).map(([k, v]) => [bareOf(k), bareOf(v)]),
    )
    const aliasHeader = (h: string) => aliasTable.get(bareOf(h)) ?? bareOf(h)
    const aliasIncludeLine = (line: string) =>
      aliasTable.size === 0 ? line
        : line.replace(/#include\s*<([^>]+)>/g, (_m, h: string) => `#include <${aliasHeader(h)}>`)

      const body = node.children.body ?? []
      // C 目標的型別名要加 `struct` 標籤——先收集這棵樹宣告了哪些 struct。
      if (isCDialect(ctx.style)) ctx._structNames = collectStructNames(node)

      // Scaffold-driven code generation: when ProgramScaffold is available
      // and the tree body does NOT already contain a main function (i.e., body-only tree from L0).
      // If the tree has func_def(main), it's a full tree — use legacy path to avoid duplication.
      // ⚠️ 問**性狀**不問身分——一顆膠囊裡寫另一顆的身分，反向檢查會指名。
      //
      // 🔴 而「哪一個函式是進入點」**也不該寫死在這裡**（2026-08-28）。
      //    上一版的註解說它「是整個程式的知識，不是那顆函式的性質」
      //    ——那句話對，**而它的家是骨架宣告，不是一個字面值**。
      //    Arduino 的進入點是 `setup` ＋ `loop`，寫死 `'main'` 連數量都錯。
      //
      // ⚠️ 問的是 `skeletonPresent`（骨架**已經生出來了**嗎），
      //    不是「有沒有一顆叫那個名字的函式」——見那個函式的說明：
      //    Arduino 的骨架在程式碼裡是空的，所以這條包裝路徑要一直走
      //    （它同時負責吐出自動引入，少了它板子的標頭會安靜地不見）。
      const skeleton = skeletonById(ctx.programScaffold?.skeleton?.() ?? 'main')
      const framePresent = skeletonPresent(skeleton, (name) =>
        body.some(n => isFunctionDefinition(n.componentId) && n.properties.name === name))
      if (ctx.programScaffold && ctx.scaffoldConfig && !framePresent) {
        // Collect manual includes from body for deduplication
        const manualImports: string[] = []
        for (const n of body) {
          if (isIncludeDirective(n.componentId) && typeof n.properties.header === 'string') {
            manualImports.push(`<${n.properties.header}>`)
          }
        }

        const scaffoldResult = ctx.programScaffold.resolve(node, {
          ...ctx.scaffoldConfig,
          manualImports,
        })
        // Build output: scaffold imports → manual includes → preamble → entryPoint → body → epilogue
        // Always output all scaffold items regardless of visibility (code must be complete)
        let code = ''

        // 🔴 **C 目標也要走這一條**（2026-08-17）——而它差點被漏掉。
        //
        // ⚠️ `cpp:program` 有【兩條產出路徑】：這一條（有鷹架，UI 走的）
        // 與下面的 legacy（測試走的）。本輪第一版只改了 legacy，
        // **`c-style-parity` 10/10 而瀏覽器上仍然產出 `<iostream>`**。
        //
        // > **一份只走得到其中一條路徑的測試，會讓另一條路徑的缺陷全綠通過。**
        //
        // （`experience`「重構後開瀏覽器實測」——這一次是它抓到的。）
        const cDialect = isCDialect(ctx.style)
        if (cDialect) ctx._structNames = collectStructNames(node)

        // Scaffold imports (auto-generated)
        for (const item of scaffoldResult.imports) {
          // 🔴 **C 裡沒有 `<iostream>`**——而鷹架是 C++ 的鷹架，它不知道這件事。
          // ⚠️ 那不是「換一個名字」，是**那個東西在那個世界不存在**
          // （research Q2 的 13 種）。所以是**丟掉**，不是轉換。
          if (cDialect && !hasCEquivalent(item.code)) continue
          code += cDialect ? cHeaderLine(item.code) : aliasIncludeLine(item.code)
          code += '\n'
        }
        // 🔴 **C 的標頭，鷹架一個都給不了**——它是 C++ 的鷹架。
        //
        // ⚠️ 而根因比「鷹架不知道 C」更深：`cpp:print` 的 `requires` 宣告的是
        // `<iostream>`，**而它用 `printf` 產出時要的是 `<stdio.h>`**。
        // 那是「宣告」與「產出」不一致——`style-exceptions` 已經在**分析**
        // 同一件事（`IO_PREF_TO_HEADER`），而**產出這一側今天沒有人接**。
        //
        // > **一顆元件宣告它需要什麼，而那個宣告假設了一種產出風格。**
        //
        // 🔴 本輪用最小的補法（照 `ioPreference` 補），**而根因記在 findings**。
        if (cDialect) {
          if (usesBool(node)) code += `#include <${C_BOOL_HEADER}>\n`
          if (ctx.style.io_style === 'printf' && /printf|scanf/.test(generateBody(body.filter(n => !isIncludeDirective(n.componentId)), indented(ctx)))) {
            code += '#include <stdio.h>\n'
          }
        }

        // Manual includes from body (deduplicated)
        const seenIncludes = new Set<string>()
        for (const n of body) {
          if (isIncludeDirective(n.componentId)) {
            // ⚠️ 分隔符不用 `:`——**元件身分本身含冒號**（`cpp:include`），
            // 用冒號組複合鍵會讓 `cpp:include:iostream` 的切法變曖昧。
            // 全樹只有這一處把身分與別的東西組成鍵（其餘六處組字串都只是給人看的訊息）。
            const key = `${n.componentId} ${normalizeHeader(String(n.properties.header))}`
            if (seenIncludes.has(key)) continue
            seenIncludes.add(key)
            const line = generateBody([n], ctx)
            code += cDialect ? cHeaderLine(line) : aliasIncludeLine(line)
          }
        }

        // Preamble
        for (const item of scaffoldResult.preamble) {
          // `using namespace std;` 在 C 裡不合法——⚠️ 而 `c.json` 的
          // `namespace_style: 'explicit'` 早就表達了這件事，
          // 只是鷹架這條路徑沒有讀到它。
          if (cDialect && /using namespace/.test(item.code)) continue
          code += item.code + '\n'
        }

        // Track scaffold lines for source mapping before generating user body
        trackOwnText(ctx, code)

        const userBody = body.filter(n => !isIncludeDirective(n.componentId))

        // 進入點 ＋ 本體 ＋ 收尾——**逐顆函式**，不是把四段攤平。
        //
        // 🔴 **2026-08-31：這裡本來讀 `scaffoldResult.entryPoint`／`epilogue`
        //    這兩個【攤平的】清單**，於是 Arduino 的兩顆進入點被吐成
        //
        // ```
        // void setup() {      ← entryPoint[0]
        // void loop() {       ← entryPoint[1]
        //   …本體…
        // }                   ← epilogue[0]
        // }                   ← epilogue[1]
        // ```
        //
        //    ——**兩顆平行的函式被寫成一個假的巢狀關係**，而使用者看到的
        //    正是那個（「我選了 Arduino 骨架」→ `loop` 跑到 `setup` 裡面）。
        //
        // > **一個「開頭清單 ＋ 本體 ＋ 收尾清單」的形狀，
        // > 只表達得出【一個】框。第二個框進來時它不會報錯，它會產出巢狀。**
        //
        // ⚠️ 縮排仍然問資料（有沒有框），不問目標叫什麼名字：沒有進入點時
        //    函式定義就是頂層，縮排會變成一個假的巢狀關係。
        const entryFns = skeleton?.entryFunctions ?? []
        if (entryFns.length === 0) {
          code += generateBody(userBody, ctx)
        } else {
          // 鬆散的語句只有**一個**去處——由宣告指定（Arduino 是 `loop`）
          const host = entryFns.find((f) => f.hostsBody) ?? entryFns[0]
          code += entryFns.map((f) => {
            let block = f.open.map((l) => l.code + '\n').join('')
            if (f === host) block += generateBody(userBody, indented(ctx))
            block += f.close.map((l) => l.code + '\n').join('')
            return block
          }).join('\n')
        }

        return code
      }

      // 🔴 **板子的標頭替換**（spec 150）——`<WiFi.h>` → `<ESP8266WiFi.h>`。
      //
      // ⚠️ **它要套在【三個】產出點上**：鷹架的自動引入、鷹架的手寫引入、
      //    以及下面那條沒有鷹架的舊路徑。
      //    🔴 第一版只寫在舊路徑上——而**產品走的是鷹架那條**，
      //    於是單元測試綠、瀏覽器裡完全沒作用。
      //
      // > **一個有兩條路徑的產出點，修其中一條的測試會綠
      // > ——而使用者走的是另一條。**
      //
      // 🟢 **手寫的引入也換**：與 C 方言那一段一致（它也換手寫的 `<iostream>`），
      //    而理由更硬——不換的話那份程式碼在這塊板子上**編不過**。

      // Fallback: auto-include without scaffold (legacy path)
      let effectiveBody = body

      // 🔴 **C 目標：`bool` 要 `<stdbool.h>`**（2026-08-17，階段 6.10）
      //
      // `draft/2026-08-13-C和C++難分難捨.md`§五 的對照實驗：C 風格投影餵
      // `gcc -std=c99` → 6/10，而失敗的 4 段裡 **3 段是 `bool`**。
      //
      // ⚠️ 這是一個【刻意的簡化】：完整設計裡「C99 提供什麼」是 `provides`
      // 那一格的事，而**本輪沒做 `provides`**——見 `target-dialect.ts` 檔頭。
      if (isCDialect(ctx.style) && usesBool(node)) {
        effectiveBody = [buildInclude(C_BOOL_HEADER), ...effectiveBody]
      }
      if (ctx.dependencyResolver) {
        const autoEdges = computeAutoIncludes(node, ctx.dependencyResolver as DependencyResolver)
        if (autoEdges.length > 0) {
          // Find insertion point: after existing #include blocks
          const lastIncludeIdx = body.reduce((acc, n, i) =>
            isIncludeDirective(n.componentId) ? i : acc, -1)
          const insertAt = lastIncludeIdx + 1
          const autoNodes: SemanticNode[] = autoEdges.map(e =>
            buildInclude(e.header.replace(/^<|>$/g, ''))
          )
          effectiveBody = [
            ...body.slice(0, insertAt),
            ...autoNodes,
            ...body.slice(insertAt),
          ]
        }
      }

      // 🔴 **板子的標頭替換**——`<WiFi.h>` → `<ESP8266WiFi.h>`（spec 150）。
      //
      // ⚠️ **它與下面那段是兩件事，所以是兩段程式碼**：
      //
      // ```
      // 這裡    【這塊板子】上它叫什麼      WiFi.h → ESP8266WiFi.h
      // 下面    C 世界裡它叫什麼／誰滿足它   cmath → math.h ／ iostream → stdio.h
      // ```
      //
      // > **兩個函式如果回傳同一種型別，很容易被合成一個
      // > ——而它們答的是不同的問題**（spec 146 的病歷）。
      //
      // 🟢 而板子與 C 方言**互斥**（C 目標沒有板子），所以順序不會撞在一起。
      if (aliasTable.size > 0) {
        // ⚠️ **`properties.header` 存的是【裸名】（`WiFi.h`），而替換表寫的是 `<WiFi.h>`**
        //    ——給人讀的那一面帶角括號比較不會寫錯，所以兩邊都先剝掉。
        effectiveBody = effectiveBody.map(n => {
          if (!isIncludeDirective(n.componentId) || typeof n.properties.header !== 'string') return n
          const alias = aliasHeader(n.properties.header)
          return alias === bareOf(n.properties.header) ? n : buildInclude(alias)
        })
      }

      // 🔴 **C 目標：標頭名換成 C 世界的名字**——`<cstdio>` → `<stdio.h>`。
      // ⚠️ 用的是 `header-aliases` 那張【既有】的表的反向，**沒有新增資料**。
      if (isCDialect(ctx.style)) {
        effectiveBody = effectiveBody.map(n => {
          if (!isIncludeDirective(n.componentId) || typeof n.properties.header !== 'string') return n
          // 🔴 **先問「C 裡什麼標頭滿足這個需求」，再問「它在 C 裡叫什麼」。**
          //    兩個問題不同——`<iostream>` 在 C 裡**不存在**（不是換個名字），
          //    而 `<cmath>` 只是換名字。合成一個函式會讓
          //    「C 有沒有這個標頭」的判斷全部誤判（spec 146 實測，既有測試抓到）。
          const io = cIoHeaderFor(n.properties.header)
          return buildInclude(io ?? toCHeader(n.properties.header))
        })
      }

      // Deduplicate #include directives with identical or equivalent headers
      const seen = new Set<string>()
      const deduped = effectiveBody.filter(n => {
        if (isIncludeDirective(n.componentId)) {
          const key = `${n.componentId}:${normalizeHeader(String(n.properties.header))}`
          if (seen.has(key)) return false
          seen.add(key)
        }
        return true
      })
      return generateBody(deduped, ctx)
    })
}
