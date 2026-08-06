# Phase 0 研究：四條護欄的技術決策

**Feature**: 049-audit-guardrails ｜ **Date**: 2026-08-06

spec 刻意留給 plan 的五項技術決策，全部在此定案。另記錄研究過程中查到的**三個既有事實**，它們直接改變了 D3 的設計。

---

## 研究中查到的既有事實（先講，因為決策依賴它們）

### F1. `src/languages/cpp/module.ts` 是死碼

`initCppModule()` 定義於 `src/languages/cpp/module.ts:42`，**全專案零呼叫**（`grep -rn "initCppModule" src/ tests/` 只命中定義本身）。

它是唯一會建立 `TemplateGenerator` 並把 `codeTemplate` 灌進去的地方（`module.ts:46,77,82`）。

### F2. 應用程式從來沒有接上 TemplateGenerator

`setTemplateGenerator()` 定義於 `code-generator.ts:49`，**`src/` 內零呼叫**。

`generateNode`（`code-generator.ts:205-211`）的優先權是：

```ts
const tg = ctx.templateGenerator ?? globalTemplateGenerator
const templateResult = tg?.generate(...) ?? null
if (templateResult !== null) { ... } else { /* 手寫 generator */ }
```

`globalTemplateGenerator` 恆為 `null`；app 走 `sync-controller.ts:180` 的 `generateCodeWithMapping`，不帶 `ctx.templateGenerator`。
→ **實際 app 中，JSON 的 `codeTemplate` 一行都沒被用到，永遠走手寫 generator。**

只有四個測試檔在區域性接上它（`roundtrip-l1`、`p3-json-only`、`roundtrip-all`、`template-generator` 單元測試）。

### F3. 93 個概念宣告了 `codeTemplate`

掃 `src/languages/cpp` + `src/blocks` 的所有 JSON：**93 個 conceptId 帶 `codeTemplate`**。

這 93 個在 app 中全部退回手寫 generator。**其中若有任何一個沒有手寫 generator，它在 app 裡會靜默生不出東西，卻在接了 template 的那四個測試裡正常。**

> **這正是 experience.md:104「測試會騙人」那條的現況版本，而且方向與原文相反**——原文記的是「app 中 template 優先、測試中 hand-written 優先」，現況是 **app 完全沒有 template**。這條教訓的敘述已經過期，但它警告的失效模式**依然活著、而且規模是 93 個概念**。
>
> ⚠️ 這是 spec Out of Scope 的東西（本功能只量不修），但它把 FR-023「兩種載入組態」從「保險」升級成**本功能最有價值的產出之一**。

---

## D1：「提及某個元件身分」怎麼判定（FR-012 / FR-042）

**決定**：**字邊界比對原始碼文字，並把「程式碼中的引用」與「僅出現在註解中」分開計數。**

- 判定規則：以 componentId 為字串，要求前後皆非 `[A-Za-z0-9_]`（避免 `cpp_string_at` 命中 `cpp_string_at_expr`）
- 先移除行註解與區塊註解 → 得到**程式碼引用**（計入基線）
- 對被移除的註解另跑一次 → 得到**註解引用**（列在報表，不計入基線）
- 判定規則本身寫進護欄檔頂端的說明，並在報表中重述（FR-012 要求「定義並記錄」）

**理由**：

- 純 `includes()` 會誤報（前綴命中），使護欄失去可信度——這是 Risks 表明列的風險
- 走 AST 解析（ts-morph 之類）要新增相依、變慢，而且對「一個計數用的護欄」是過度設計 —— 違反憲章 I「簡約優先／YAGNI：三行相似程式碼優於一個過早的抽象」
- 註解分開計數是必要的區分：`block-registrar.ts:1483` 的命中是 `// cpp_string_at — character access with string-variable dropdown`，**那是註解不是耦合**。若把它算成違規，維護者會為了降數字去刪有用的註解

**否決的替代方案**：

| 方案 | 否決理由 |
|---|---|
| 純子字串比對 | 前綴誤報，可信度歸零 |
| TypeScript AST 走訪 | 新增相依 + 變慢；過度設計 |
| 只看 import 陳述 | 抓不到本功能的主要目標——硬編的 `case 'cpp_string_at':` 這類字串字面 |

---

## D2：基線存哪裡（FR-004）

**決定**：**每條護欄一個 JSON 檔，放在 `tests/baselines/` 下，納入版本控制。**

```
tests/baselines/
  neutrality.json      # { total, files: { "src/ui/app.ts": ["print", ...] } }
  completeness.json    # { implemented, shell, missing, byComponent: {...} }
  defect-ledger.json   # { total, byBlocker: { "print": 10, ... } }
  locality.json        # { limits: { "cpp_string_at": { files: 13, dirs: 7 } } }
```

**理由**：

- FR-004 要求「調整基線是顯式的、可在版本歷史中看見的動作」——JSON diff 直接顯示是哪一筆變了，而且 code review 看得見
- **明確否決 vitest snapshot**：`vitest -u` 會**靜默更新**所有快照，正好摧毀棘輪。一個「跑一下就自動接受惡化」的機制，就是本專案剛立的 `concepts/執行機構.md` 在講的殼
- 內嵌常數在測試檔裡也可行，但基線改動會混在測試邏輯的 diff 裡，不如獨立檔清楚

**否決的替代方案**：

| 方案 | 否決理由 |
|---|---|
| vitest snapshot（`toMatchSnapshot`） | `-u` 靜默更新 = 棘輪失效 |
| 測試檔內嵌常數 | 基線改動與邏輯改動混在同一個 diff |
| 產生後寫回同一個檔（自動更新） | 同 snapshot，等於沒有棘輪 |

---

## D3：兩種載入組態怎麼定義（FR-023）

**決定**：對比 **「現行組態」** 與 **「宣告組態」**。

| 組態 | 內容 |
|---|---|
| **現行組態（Actual）** | `createTestLifter()` + `setupTestRenderer()` + `registerCppLanguage()`，**不接** TemplateGenerator、**不套** Topic —— 與 app 目前的實際行為一致（見 F2） |
| **宣告組態（Declared）** | 同上，**加上**接好的 TemplateGenerator（載入 universal templates 與各 blockSpec 的 `codeTemplate`）與預設 Topic —— 即 JSON 所宣告的樣子 |

護欄在兩種組態下各跑一次完備性分類，**差異元件列進報表**。

**理由**：

- 原本以為的差異（app vs 測試）**現況並不存在**——兩邊都沒有 template（F2）。若照原設想去做，會做出一條永遠回報「無差異」的護欄，那本身就是殼
- 真正的差異在 **JSON 宣告了什麼 vs 執行時真的用了什麼**。93 個 `codeTemplate`（F3）全部處於「宣告了、沒被用」的狀態，差異報表會把它們全部照出來
- 這條差異報表同時回答一個後續期別必須知道的問題：**如果把 template 接回去，哪些概念的行為會變**

**否決的替代方案**：

| 方案 | 否決理由 |
|---|---|
| 「app 組態 vs 測試組態」 | 現況兩者相同，護欄會恆綠 = 殼 |
| 只跑一種組態 | 抓不到 F3 那 93 個宣告與實際的落差 |
| 三種以上組態（Topic 各跑一次） | 目前 Topic 數量與差異未知；違反 YAGNI，先做兩種，需要再加 |

---

## D4：停用測試的分類標記長什麼樣（FR-030～FR-035）

**決定**：**結構化前綴標記寫在測試標題裡。**

```ts
it.todo('[BLOCKED:print] fuzz_1: substr with computed indices and looping find')
it.skip('[TOMBSTONE:014-墓碑目錄#模擬-c-preprocessor-來解決巨集] executes correctly')
describe.skip('[DEADSKIP] fuzz: char literal in function return (fixed)', ...)
```

三種標記：

| 標記 | 意思 | 額外要求 |
|---|---|---|
| `[BLOCKED:<componentId>]` | 缺陷，被某個元件擋住 | 必須有 componentId（FR-031） |
| `[TOMBSTONE:<檔名#錨點>]` | 已否決決定的正確後果 | 必須連到 `knowledge/history/` 的決策記錄（FR-032） |
| `[DEADSKIP]` | 已修好但沒開回來 | 無（它的存在就是待辦） |

**理由**：

- **標記與測試同住，不可能漂移**——這是本專案頭號病灶「雙重真相」的直接規避。獨立的登錄檔會立刻長成第二個真相源
- 標題可用純文字掃描取得，不需要解析 TypeScript AST（同 D1 的簡約理由）
- 標記出現在測試輸出裡，維護者跑測試時就看得到

**否決的替代方案**：

| 方案 | 否決理由 |
|---|---|
| 測試上方的註解標記 | 需要把註解與測試對應起來（要解析 AST），且註解會與測試漂移 |
| 獨立的 `disabled-tests.json` 登錄檔 | **雙重真相**——測試改了登錄檔不會跟著改 |
| 自訂 vitest annotation API | 綁死測試框架，且需新增機制 |

---

## D5：護欄的執行頻率（SC-007）

**決定**：**四條全部進一般的 `npm test`，不分離。** 若實測後總耗時超出預算，再用 vitest 專案切分。

- 預算：四條合計新增 **≤ 10 秒**（現況 3006 測跑 20 秒）
- 完備性護欄與既有 audit 測試共用 `beforeAll` 的 parser／lifter 初始化，不重複載入 wasm

**理由**：

- 憲章 I「簡約優先／YAGNI：不得為假設性未來需求預留擴充」——先合併，量到痛再切
- 棘輪必須卡在**每次都會跑的地方**才有效（FR-003）；一開始就分離到「另外跑」的組別，等於自願讓它變成沒人看的報表

**否決的替代方案**：一開始就分離 —— 違反 YAGNI，且削弱棘輪。

---

## D6（追加）：完備性護欄的「最小樣本」從哪來

spec 的 FR-020 要求「實際執行五條路徑的最小樣本」，但沒說樣本從哪來。這是實作的關鍵決策，補在此。

**決定**：**不手寫樣本，從元件定義合成一個最小語義節點，跑一圈五路。**

```
ConceptDef ──合成──▶ 最小 Instance（properties 填預設、children 填最小子節點）
                        │
                        ├─ generate ─▶ 程式碼 ─ lift ─▶ Instance′   （比對 componentId）
                        ├─ render   ─▶ 積木   ─ extract ─▶ Instance″ （比對 componentId）
                        └─ execute  ─▶ 有沒有 executor、是不是未宣告的空操作
```

**理由**：

- 149 個元件手寫樣本 = 149 份新的維護負擔，而且**新增元件時會忘記補**——那正是本功能要治的病
- 合成能保證**覆蓋率為 100%**（SC-003 要求「無元件被靜默略過」），手寫必然有漏
- `ConceptDefJSON` 已經有 `properties`、`children`、`role`，足以合成
- lift 那條路不需要程式碼樣本——**generate 的輸出就是 lift 的輸入**，一圈 round-trip 即可

**「殼」的判定條件**（FR-021 要求定義）：

| 路徑 | 判為殼的條件 |
|---|---|
| generate | 輸出為空字串／等於佔位字串／擲出例外 |
| lift | 回來的節點 `componentId` 與原始不符，或 confidence 為 `raw_code` |
| render | 產不出積木，或退回泛用積木 |
| extract | 取回的節點 `componentId` 與原始不符 |
| execute | executor 已註冊但為空操作**且未顯式宣告** |

**未宣告的空操作**：FR-022 要求「本來就不需要某條路徑」必須顯式宣告。本功能引入該宣告欄位（`concepts.json` 的一個可選欄位，值列出本元件刻意不提供的路徑），但**不負責為既有元件補上**（spec Assumptions 已載明）。

**否決的替代方案**：

| 方案 | 否決理由 |
|---|---|
| 每個元件手寫最小程式碼樣本 | 149 份維護負擔；新增元件會忘記補；覆蓋率無法保證 |
| 沿用 `tests/fixtures/` 既有素材 | 覆蓋率未知且不完整，違反 SC-003 |
| 只檢查註冊表有沒有登記 | **這正是本功能要取代的「存在性檢查」**——它抓不到殼 |
