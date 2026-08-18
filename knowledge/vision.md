# 願景

## 問題陳述

程式教育有一個根本鴻溝：**理解程式邏輯**和**掌握語法細節**之間的斷層。

傳統工具走兩個極端——Scratch/Blockly 讓學生拼積木但永遠碰不到真正的程式碼；文字教學讓初學者同時面對邏輯和語法的雙重認知負荷。兩者之間缺少一座橋。

**目標使用者：**

- **學生**（主要）：從零基礎到進階，涵蓋 APCS 考試準備、競程訓練、學校課程
- **教師**：設計教學路徑（Topic）、指定練習、追蹤學習軌跡
- **語言開發者**：透過模組化語言套件擴充新程式語言
- **課程設計者**：透過 Topic 系統定制不同教學情境的概念可見性和積木形態

## 核心想法

**程式碼和積木都不是本質——它們是同一個語義結構的不同投影。** 學生可以用積木理解邏輯，同時看到對應的真實程式碼，在兩者之間自由切換，最終過渡到純文字編程。

關鍵不是在程式碼上面疊一層積木——**只有語義層存在**，程式碼和積木都是參數化的投影。理論基礎見 [原則](principles.md)。

**和現有工具的根本差異：**

| 工具 | 做法 | Semorphe 的不同 |
|------|------|----------------|
| Blockly/Scratch | 積木 → 程式碼（單向，不可逆） | 程式碼 ↔ 積木（雙向，完美 round-trip） |
| Hedy | 每個等級有不同語法 | 同一語義樹，不同投影解析度 |
| 傳統 IDE | 以文字為中心，視覺化為附加 | 以語義為中心，文字和視覺都是投影 |
| Unison | AST hash 內容定址 | hash 語法層 vs hash 語義層 |
| LSP/LSIF | 跨檔案符號索引 | 位置導向 vs 語義導向 |

## 專案身份

| | |
|---|---|
| **名稱** | Semorphe（散模費 σημορφή）— σῆμα（語義）+ μορφή（形態） |
| **標語** | 唯一真實，各式投影 |
| **CLI** | `smorph` |
| **Logo** | `<Σ>` |
| **npm** | `semorphe` |
| **VSCode** | `semorphe-vscode` |　🔴 **而它同時是 Arduino IDE**（Theia，已驗證）→ [history/080](history/080-ArduinoIDE吃VSCode擴充而那不是一個平台是一個位置.md) |
| **技術棧** | TypeScript 5.x, Blockly 12.4.1, web-tree-sitter 0.26.6, Monaco Editor, Vite |

## 現狀

C++ 單語言可用，程式碼 ↔ 積木雙向 round-trip 成立，語義直譯器可執行。三層解耦（Core / Bus / View）已落地。Topic 系統已完成。

> **語言無關性仍然是破的，而破的位置換了**（2026-08-12 重寫）。
>
> | P9 的四條 | 2026-08-06 的說法 | 今天 |
> |---|---|---|
> | 核心層硬編語言專屬身分 | **主要症狀** | ✅ **歸零**（中立性護欄 `total: 0`） |
> | 碎裂（一個元件散在太多檔） | 平均擴散 8.5 檔 | ✅ **歸零**（177/177 膠囊化） |
> | 殼（路徑存在但空的） | 🈳92 ／ ❌5 | ✅ **歸零** |
> | **視圖層 import 語言套件** | 沒有人在看 | ❌ **現在在這裡** |
> | **執行器直接持有面板** | 沒有人在看 | ❌ **現在在這裡** |
>
> **前三條是階段 6.5 清掉的；後兩條不是新長出來的，是一直都在而沒有人量。**
> 它們被看見的原因是[第三十九條護欄](../tests/integration/audit-four-independences.test.ts)
> ——P9 自稱「每個 Phase 完成後必須通過」，而在那之前 **31 條護欄裡零檢查**。
>
> > **一個病從「主要症狀」變成「已歸零」時，要問的不是「好了嗎」，
> > 是「它搬到哪裡去了」。**
>
> **當下的實測值一律以 `tests/baselines/four-independences.json` 為準，不寫在這裡**——寫死的數字每交付一次就過期一次（這已經是第三次了）。
> ⚠️ 而 2026-08-18 的健檢抓到**這一段自己犯過同一個錯**：它寫著「不寫在這裡」，
> 卻在上表填了 `5 筆`／`73 處`，而基線當時已經是 67。**已拿掉。**這裡只說**問題的形狀**，數字歸護欄。
> 這句話從「尚未驗證」改成「已知是破的」的轉折，以及階段 7 角色隨之改變的理由，見 [history/015](history/015-語言無關性從尚未驗證到已知是破的.md)。
> 而「破的位置換了」這一次改寫的依據，見 [history/051](history/051-P9從沒有執行機構到病換了位置.md)。

**已完成元件：**

- **Core**：SemanticNode 型別、ConceptRegistry、BlockSpecRegistry、PatternLifter、PatternRenderer/Extractor、CodeGenerator、TemplateGenerator、BlockRenderer、Interpreter、Topic 系統、Storage、DependencyResolver（語言無關介面）、ProgramScaffold、CodeMapping + BlockMapping（nodeId-based 跨投影查詢）
- **C++ 語言套件**：core concepts/blocks/generators/lifters、std modules（iostream/cstdio/vector/algorithm/string/map/stack/queue/set/cstring/cmath）、ModuleRegistry、auto-include、lift-patterns、render strategies、style presets（apcs/competitive/google）、style-exceptions、manifest
- **UI**：Blockly/Monaco/Console/Variable 面板、Debug 工具列、SyncController、ToolboxBuilder、BlockRegistrar、AppShell、ExecutionController、Ghost Line
- **宿主層**：`CodeView`／`HostProfile` 兩個角色（網頁版注入編輯器面板，擴充注入交給 IDE 的空殼）、
  `src/vscode/`（VSCode ／ Arduino IDE 擴充：面板、範圍編輯、回音守衛、鏡像對帳、視圖狀態）

**已知差距：**

| 缺失項目 | 優先級 | 說明 |
|----------|--------|------|
| SemanticDiff 增量更新 | P2 | 全量替換 → 增量（Phase 9.2，nodeId 穩定性已部分完成） |
| 硬體描述層 | P3 | 等 Arduino 需求（Phase 8） |
| DataFlow 視圖 | P3 | 需 annotations 機制（Phase 9.1） |

## 架構

```
宿主環境（瀏覽器 / VSCode / Electron）
  ↕ ViewHost 介面
多個獨立視圖（積木 / 程式碼 / 主控台 / 變數 / 資料流 / 接線 / 模擬）
  ↕ SemanticBus（瀏覽器=EventEmitter / VSCode=postMessage）
SemanticCore（語義樹 + 概念註冊 + 投影引擎 + 直譯器，零 DOM 依賴）
  ↕ 語言套件介面
多個語言套件（C++ / Python / Arduino）+ 外部擴充套件
```

### 三層契約

- **Layer 1（語義宣告）**：concepts.json + lift-patterns + lifters — 所有消費者可用
- **Layer 2（投影提示）**：blockDef / renderMapping / codeTemplate / generator — 僅對應視圖消費
- **Layer 3（視圖策略）**：視圖根據 annotations 決定呈現 — 新增唯讀視圖不需改語言套件

### 語言套件目錄結構

```
languages/{lang}/
  ├─ manifest.json          ← 套件中繼資料
  ├─ core/                  ← 語言核心概念（concepts.json / blocks.json / generators/ / lifters/）
  ├─ std/                   ← 標準函式庫（目錄名即 header 名）
  ├─ lift-patterns.json     ← AST → 語義 pattern 規則
  └─ auto-include.ts / style-exceptions.ts / renderers/ / styles/
```

### 尚未實作但已有設計的規格

- **語義標註（Annotations）**：語言套件與視圖套件之間的開放契約（`control_flow`、`body_execution`、`introduces_scope`、`side_effects`、`hardware_binding` 等）。缺少 annotation 時用 generic fallback，不報錯——任何語言 × 視圖組合都能工作。
- **視圖套件規格**：按與語義樹的互動方式分類（可編輯 / 唯讀-執行 / 唯讀-分析 / 唯讀-硬體），結構為 `views/{name}/manifest.json` + `src/view.ts`⟨規劃⟩（實作 ViewHost）。
- **WebView 隔離模型**：瀏覽器每視圖 = `<div>`/`<iframe>` + EventEmitter；VSCode 中 blocks = WebviewPanel、code = 原生 TextEditor、console = Terminal + postMessage。**Core 跑在 Extension Host，不跑在 WebView。**
  > 🔴 **而這一條有兩個 2026-08-16 才被量出來的前提**（[history/069](history/069-vscode原型退休而它的兩個教訓被撈出來.md)）：
  > ① 膠囊登錄表用 `import.meta.glob`（**Vite 的轉換**），所以**那個宿主也必須用 Vite 建置**（已實測可行）；
  > ② `src/ui/app.ts` 有**六個單例**寫死了「只有一個文件」，而編輯器有 N 個
  > ——**那是這條路真正的成本，而它不在任何介面上**。
  > ⚠️ 而 `code = 原生 TextEditor` 有一個順帶的好處：**宿主的診斷本來就在**
  > （見 [draft/語義診斷系統](draft/2026-08-05-語義診斷系統.md) 的委派宿主分工）。
- **外部套件與硬體擴充**：`packages/{name}/` 含 semantics / projections / hardware。依賴規則：擴充可引用基礎套件概念，**不可引用其他擴充**（避免菱形依賴）。

### 長期方向

1. **多語言**：C++ → Python → Java → Go → Rust……同一語義結構，切換語言即切換投影
2. **語義套件市場**：語義契約 + 投影定義 + 多後端執行體。同一概念可有多個執行體（wasm / js / webgpu / remote），自動基準測試 + 自動後端選擇。教學價值：讓學習者直觀感受演算法複雜度
3. **可插拔執行與時空旅行除錯**：執行即投影；直譯器每步產生語義狀態快照，回溯 = 用歷史快照重新投影（viewParams 多一個 `timeStep`）
4. **硬體教育**：Arduino 接線視圖 + 模擬視圖，從軟體延伸到嵌入式
5. **AI 輔助**：LLM 作為語用分析師，在確定性 guardrails 內提供提示投影——建議下一步，但不自動修改語義結構
6. **自舉**：教學路徑本身成為可分享的語義套件；學習數據回饋優化 Topic 層級樹，目標是**結構還原度最大化**而非效能最大化

### 🟡 符合性的清償（宣告了的接點在積木上表達不出來）

- [ ] **進行中**（2026-08-14）——**12 → 11**（`122` 實作了一筆），
  而剩下 11 筆的逐筆理由寫在 `tests/baselines/conformance.json` 的 `_meta.note`

> 🔴 **而 `123` 想再清兩筆「假違規」，判定錯了並已回退**
> （[history/065](history/065-兩條護欄從相反方向量同一件事.md)）：
> `audit-declared-slots` 證明 lift **真的會產生**那兩個接點。
>
> ⚠️ **所以再判「假違規」之前，兩條護欄都要跑**——它們從相反方向量同一件事，
> 而那對關係就是「用宣告刷數字」的機械偵測器。
> **在此之前，11 筆一律當成真的。**

> ⚠️ 使用者撞過這個病一次（`int a[3] = {1,2,3}` 的初始值消失）。
> **這些是同一個機制的其他出口。**
>
> **子機制有三種，修法完全不同**：
> ① JSON 就是唯一真相（便宜，已做過一次 → 有模板）
> ② 有動態插槽而沒宣告對映
> ③ 🔴 積木在 `block-registrar` 命令式產生（**雙重真相**，兩邊都要改）
>
> 🔴 **而根因是同一個**：宣告與形態**分開寫**，而**沒有任何東西強制它們對齊**
> ——`audit-conformance` **偵測而不預防**。
> ⚠️ **預防機制是一個獨立的設計決定**（它會影響每一顆元件的加法），
> 而它今天**還沒有家**——不在任何階段裡。

### 離線可用

- [x] **已完成**（2026-08-16，spec `128`）——執行期外部請求 **4 → 0**，
  第四十五條護欄（`e2e/offline.spec.ts`）守著。
  🔴 而它是委派探針**順手掀出來的**，不是計畫裡的
  ——轉變見 [history/070](history/070-離線可用一直是半真的而它壞得不夠大聲.md)。

## 開發約束（跨階段，不隨階段退場）

> ⚠️ 這些**不是路線圖項目**——沒有完成的一天，所以它們住在這裡而不是某個階段裡。
> （2026-08-14 從階段 6.5 提出來：那條「不准紅著過夜」原本埋在一個**已完成的階段**裡，
> 而 [experience](experience.md)`:1293` 引用它時，它的定義正要隨那個階段被收斂掉。
> **一條被別處引用的規則，不能住在一個會退場的地方。**）

- **既有測試全程綠，一次都不准紅著過夜。** 測試數只准增加。
  ⚠️ **當下的值以 `npm test` 為準，不寫在這裡**——寫死的數字每交付一次就過期一次。
  而它與「先讓測試紅」不衝突：那條講的是不要**放著**，不是不要紅
  （見 `experience` 的「一個十秒能修的紅」）。
- **護欄的基線只准下降。** 上升時要**指名是哪一筆**，不得只改數字。
- **現況數字的唯一來源是 `tests/baselines/`**，不是這份文件。

## 路線圖

> **這一節只回答「下一步在哪」。**
> 🔴 已完成的交付細節**不留在這裡**——它們收斂成一行 ＋ 指向 `history/` 的指標
> （2026-08-18 收斂：路線圖 1032 → 約 200 行）。
> ⚠️ 判準：**這一行說得出下一步嗎？** 說的是「我們完成了什麼、當時長什麼樣」→ 收成指標。

### 🟡 進行中

#### 階段 6.7：語法錯誤的辨識層 —— 閘門已做，而三個缺口是主體

- [ ] **進行中**（2026-08-14，specs `120`／`121`）——執行閘門已做、兩個缺口已關。
  轉變見 [history/064](history/064-量出來的東西不是我們要找的.md)。

```
剩下的主體   ① ERROR 節點的身分（今天全部降級成 raw_code）
             ② 錯誤訊息的投影（訊息不是代號——階段 6.9 已做掉一半）
             ③ 修復建議（「你是不是要打 X」的候選集合）
```

### 🔜 下一步（已排序，未開工）

#### 階段 6.11：Arduino 的板子與腳位（第 4 項起）

第 1–3 項已完成（spec `137`，見 [history/077](history/077-虛擬硬體往後推而先做寬度.md)）。

- [ ] `arduino-uno`／`arduino-nano`／`esp32` 三個目標選得到，而它們**提供不同的常數與函式**
- [ ] 板子視圖顯示腳位狀態，且**它逼出了佈局那一格的需求**
- [ ] C／C++ 三個既有目標不得退步

⚠️ **虛擬硬體被推遲**的理由見 [history/077](history/077-虛擬硬體往後推而先做寬度.md)。

#### 階段 7：Python 語言套件

**為什麼是它**：`layer: universal` 今天是一份**還沒被驗證的外延主張**
——跨語言等價要等第二個語言進來才驗得了。

- [ ] Python code ↔ blocks roundtrip 成功
- [ ] C++ 既有測試不受影響
- [ ] 語言切換時 toolbox 自動更新
- [ ] manifest.json 加入 `topics` 欄位（manifest-driven plugin system 在這一刀統一做）

#### 階段 8：外部套件生態

- [ ] 安裝／移除套件後概念自動出現／降級
- [ ] 依賴鏈正確解析

設計脈絡：[draft/套件積木的粒度與預組](draft/2026-08-17-套件積木的粒度與預組.md)、
[draft/套件的物件在執行期是什麼](draft/2026-08-17-套件的物件在執行期是什麼.md)。

#### 階段 9+：進階擴充

```
9.1 DataFlow 視圖（消費 control_flow annotations）
9.2 SemanticDiff 增量更新（前置：階段 5b nodeId 穩定性）
9.3 接線視圖 ＋ 模擬視圖（硬體教育）
9.4 跨語言映射視圖（abstractConcept 驅動）
9.5 語義套件市場
```

- [ ] 唯讀視圖可從 annotations 自動生成，不需改語言套件
- [ ] style 變更的語義 diff 為零

> 🔴 **這五行不是裝飾——它們是被引用的**。
> `tests/baselines/annotation-adoption.json` 用 `pending-consumer:9.1 DataFlow 視圖`
> 替一個零讀取點的標註背書，而第 X 條護欄會**逐字**在本檔搜那個字串。
>
> ⚠️ 2026-08-18 的路線圖收斂把這一段刪成三行，護欄當場變紅：
>
> > **一個路線圖項目不只是計畫，它還是別人引用的【指涉】——
> > 收斂它的時候，被引用的那個名字要留下來。**

### 🧾 未清的債（跨階段，不屬於任何一刀）

🔴 **這些不會因為某一刀做完而消失——每一條都要有人領走。**

- [ ] **`execution:at-node`：拆掉那張中央對映表**（2026-08-12 升格）
      —— 設計見 [draft/執行器直接持有五個面板](draft/2026-08-11-執行器直接持有五個面板.md)
- [ ] **C2 資訊軸（邊）**——⚠️ **延後的理由（「今天沒有消費者」）已經失效兩次**。
      第一個真消費者是**語義診斷系統**，不是原本寫的 2D 面板。
- [ ] **`provides`／`reference` 兩格**（目標的完整設計還缺的兩格）
      —— ⚠️ 而 `requires` 缺一維：`cpp:print` 宣告 `<iostream>`，**而 printf 產出要 `<stdio.h>`**。
      設計脈絡 [draft/C 和 C++ 難分難捨](draft/2026-08-13-C和C++難分難捨.md)（**in-flight**，不退休）。
- [x] 🟡 **`TypeError: … reading 'indexOf'`**（Blockly 載入積木時，只在 Theia 出現）
      —— **修好範圍翻譯之後就不再復現**（2026-08-18 使用者回報）。
      🔴 **而「不再復現」不等於「證明修好」**：它從來沒有在 Chromium 重現過，
      所以沒有一個會紅的檢查在守它。⚠️ 結案的是**追查**，不是**保證**。
      🟢 留著的防線：`isolateFailingBlock`（再發生時直接指出是哪一顆積木 ＋ extraState）、
      `isStateStale`（殘的工作區不得覆蓋程式碼）。

### ⏳ 等使用者實測才能勾的驗收

⚠️ **不得因為「這一刀交付了」就自己勾掉**——它們要的是人在 IDE 裡按鍵拖曳。

🟢 **階段 6.16（零件積木）已結清**（2026-08-18，使用者在 Arduino IDE 實測回報
「結果不錯」）——擴充 0.8.1。三批的積木在真的 IDE 裡拿得到、標籤正確、
貼上的程式碼轉得成專屬積木。

```
🟢 已驗（2026-08-18，使用者實測）
   範圍編輯只重寫改到的那一段 · 回音不迴圈（零 setTimeout）
   工具箱／深色主題／zelos 與網頁版一致 · untitled buffer 全程可用
   網頁版不得退步（三次截圖 MD5 逐位元組相同）
   Arduino IDE 裡打得開、`.ino` 改積木檔案跟著變
   🟢 **`.ino` 改完之後 Arduino IDE 編得過**（2026-08-18 使用者回報）
      ——這是階段 6.13 掛了一天的最後一條，它證明產出的不只是「看起來對的文字」

🟠 還沒驗
   一次積木編輯 ＝ 一個 document undo 項；拖動位置不進 undo
   點積木 → 程式碼高亮並捲到位；移游標 → 對應積木被選取
   單步執行時積木依序高亮
   切分頁再切回來，捲動位置與縮放還在
   `settings.json` 設得動 target，且 `[arduino]` 的語言覆寫生效
```

### ✅ 已完成的里程碑（一行一筆 ＋ 指標）

| 階段 | 結果 | 轉變 |
|---|---|---|
| 0–5b 地基與解耦 | Core 零 DOM、面板零 import、跨投影查詢可用 | [069](history/069-vscode原型退休而它的兩個教訓被撈出來.md) |
| 6 Topic 系統 | 同一語言在不同 Topic 下有不同層級樹與積木覆蓋（2026-03-11） | — |
| 執行機構自己接上 | CI 真的跑測試；四項獨立性第一次會關；e2e 接上；識別字 618 → 0 | [050](history/050-識別字不再是中文-一條沒有機制的慣例漂了兩個月.md) |
| 目錄結構四件小整理 | `src/blocks/`／`src/views/` 消失，五個檔各歸其位（交付 2/4） | [052](history/052-同名不是重複的證據.md) |
| 6.5 元件膠囊重構 | **加一顆元件 ＝ 新增一個資料夾，零編輯**（177 顆全膠囊化） | [030](history/030-C1參數規格化-證據優先於名字.md)·[031](history/031-D命名空間遷移-身分不只以字串出現.md)·[049](history/049-F完成-把身分換成性狀.md) |
| 6.6 語義診斷系統 | 五條驗收全數達成 | [071](history/071-裁判有了而它看不懂的方言要先排掉.md) |
| 6.8 第一課 | 教材的第一個實例，四條驗收全數兌現（specs `124`／`125`） | — |
| 6.9 第二課 | 訊息不是代號；第四十四條護欄 | [066](history/066-護欄錨在供給端所以量不到消費端.md) |
| 6.10 目標（`target`） | 選一次而不是三次；C 的產出 6/10 → 10/10 | [072](history/072-target的兩個假設都倒了而它反而證明了target.md)·[074](history/074-機制有了沒人接上的第十一個而這次它有了執行機構.md) |
| 6.12 寬度 | 貼進來的 Arduino 程式碼轉得動；殘差與漂移各說得出數字 | [078](history/078-量完之後階段6-12的前提垮了一半.md)·[079](history/079-補量執行之後下一步又換了一次.md) |
| 6.13 擴充第一刀 | `.vsix` 產得出來，畫布在 VSCode 裡跑得順（16.7 ms） | [080](history/080-ArduinoIDE吃VSCode擴充而那不是一個平台是一個位置.md)·[081](history/081-第一刀畫得出積木而三個坑都不會拋錯.md) |
| 6.14 擴充長成能用的 | 雙向同步／高亮／執行／設定 | [082](history/082-擴充長成能用的而一個缺口只在大家都不那樣寫的地方.md) |
| 6.15 面板就是網頁版本身 | 程式碼那一格交給 IDE；`src/vscode/` 2170 → 1624 | [083](history/083-面板就是網頁版本身而四次修好都是我自己上一次修出來的.md) |
| 6.16 零件積木 | 四批 33 顆；貼上的 LLM 程式碼轉得成專屬積木**而形式一字不差**；四份盲測殘差 0.00% | [084](history/084-零件不是身分是參數而那份draft擋的是執行不是積木.md)·[過程](episodes/2026-08-18-三批零件積木.md) |

⚠️ **階段 6 與 6.8 沒有 `history/` 轉變**（做的時候還沒有這個習慣）
——那兩行因此寫得比其他行完整一點，因為沒有指標可以贖回它們。

## 關鍵延伸（主題觸發必讀）

| 觸發關鍵字 | MUST 讀 |
|---|---|
| 新增語言、語言套件、manifest、依賴解析 | `concepts/開放擴充.md` |
| Topic、認知層級、toolbox、scaffold | `concepts/漸進揭露.md` |
| 新視圖、viewType、可逆性、唯讀視圖 | `concepts/投影.md` |
| 元件、接點、埠、關係律、命名、跨域 | `concepts/元件.md` |
| 殼、規範沒有檢查、護欄、量測工具 | `concepts/執行機構.md` |
| 語義診斷、錯誤訊息投影 | `draft/2026-08-05-語義診斷系統.md` |
| 圖解、記憶體視覺化、資料結構圖鑑 | `draft/2026-08-05-圖解形態與資料結構圖鑑.md` |
| 硬體、Arduino、接線視圖、2D/3D 組裝 | `draft/2026-08-05-硬體域併入計畫.md` |
| 待解工程問題、效能、版本控制、沙箱 | `draft/2026-03-11-已知工程待解問題.md` |
