# Research：測試用的共用 Cella 判決入口

## R1. Node 上怎麼重用建置時編好的模組

- **Decision**：把 `tools/precompile-cella.ts` 裡「鍵 ＝ sha256(套件版本 ＋ 模組原始碼)、檔名 `<名字>.<鍵>.wasm`、有就讀、沒有就編並寫回」抽成 `tools/cella-module-cache.ts` 的一個函式，建置工具與測試 helper 都呼叫它。
- **Rationale**：測試若自己算一份鍵，會在其中一邊改了之後靜靜對不上——症狀不是紅，是慢（每檔重編十幾秒），而那正是盤點的風險 1 要擋的。同一份邏輯只住一處。
- **Alternatives considered**：
  - 測試讀 `public/cella-modules/manifest.json`（建置產物）——要先跑過 `npm run build`，乾淨的 checkout 上測試會失去模組；而且 CI 的測試步驟在建置之前。
  - vitest `globalSetup` 編一次、把 bytes 傳給各檔——跨行程只能傳可序列化的值，最後還是落到磁碟；磁碟快取本來就有。

## R2. 「只準備一次」的單位

- **Decision**：同一個**測試檔**裡用模組層級的 Promise 快取（第一次呼叫時建判決器，之後重用）；跨檔靠磁碟快取（不重編，只付「把編好的 bytes 實體化」的成本）。
- **Rationale**：vitest 的每個測試檔是各自的模組環境（`maxWorkers` 2），記憶體裡的東西跨不了檔。要量的是「一檔多花幾秒」＝實體化的成本，SC-003 記錄它。
- **Alternatives considered**：把所有 B 類放進同一個檔——違反就近性（膠囊自證測要留在膠囊裡）。

## R3. 走「產品同一條路」指的是哪幾步

- **Decision**：tree-sitter 解析 → `createTestLifter().lift` → `formalize(tree, { lang })` → `checker.verdict(program, stdin, steps)`。與 `tests/probes/binding-verdict.test.ts`、`cella-coverage-gap.test.ts` 同一條。
- **Rationale**：那兩支探針就是拿這條路驗課文與學生語料的，判決綁定語料 109 支與產品一致。
- **Alternatives considered**：直接手寫 Cella 的程式 JSON——不經過 formalize，就驗不到「我們有沒有翻對」，而那正是 B 類換判準後要守的東西。

## R4. 問題怎麼對回原始碼

- **Decision**：判決的 `problems[].at` 是語義樹節點的 id（formalize 送的 `n`）；在 lift 出來的樹裡找同 id 的節點，讀它的 `metadata.sourceRange`（`src/core/lift/lifter.ts:384` 起每個節點都有），切出那一段原始碼與行號放進失敗訊息。找不到（例如 `n` 是 `<id>/init` 這種衍生 id）就退到去掉 `/` 後綴的節點，再找不到就印 id 本身——不靜默省略。
- **Rationale**：P6——說得出「在哪裡」才是可見的降級。

## R5. 注入測試用什麼程式

- **Decision**：
  - unknown：`int main(){ while (true) {} }`——步數用盡（fuel）；依定義不會被「支援」掉（範例的壽命不受 Cella 長大影響，見 experience〈拿「今天還沒做的」當「不支援」的測試範例〉）。
  - reject：`int main(){ int x; cout << x; }`——讀未初始化的值（ubUninit），標準定死的未定義行為。
  - 翻不出：一個 formalize 依定義不收的構造（原樣保留的內嵌組語 `asm volatile("nop");`）。
  - 正向錨點：`cout << 1 + 2;` → accept、`3`。
- **Rationale**：每一個都是「依定義不會變」的事實，不會因為 Cella 或 formalize 補了東西就過期。

## R6. 三支示範檔

- **Decision**：`tests/integration/execution-cpp-containers.test.ts`（容器 LIFO／FIFO）、`tests/integration/vector-initializer-list.test.ts`（期望值來自 g++ 錄好的值）、`src/components/cpp/range_max/spec.test.ts`（膠囊自證測）——盤點的難度都是「低」。
- **Rationale**：一支整合測試的執行斷言、一支期望值來自外部編譯器、一支膠囊——涵蓋 6c-2 會遇到的三種形狀。
- **Alternatives considered**：挑碰到迭代器箭頭或 `vector<pair>` 巢狀大括號的檔——那兩個是 Cella 已修、下一版才發的誤判，留到 6c-2。
