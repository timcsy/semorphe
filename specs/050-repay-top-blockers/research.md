# Phase 0 研究：六個實測發現，其中兩個推翻了 spec 的前提

**Feature**: 050-repay-top-blockers ｜ **Date**: 2026-08-06

研究階段對兩個目標缺口做了實證探測（合成程式碼 → lift → 印出語義樹）。**結果推翻了 spec 的兩個前提**，並發現上一個功能建的護欄本身量錯了一項。

本檔先列證據，spec 依此修正。

---

## F1：`cout << method_call() << endl` **已經能 lift** —— spec 的 US1 前提是錯的

spec 引用 `fuzz-cpp-string.test.ts` 檔頭：「Enable when: cout lifter can handle `cout << method_call() << endl;`」。

實測：

```
輸入： int main(){ string s="abc"; cout << s.substr(0,3) << endl; }

print [high]
  values: cpp_string_substr {obj=s} [high]
            pos: number_literal {value=0}
            len: number_literal {value=3}
  values: endl [high]
```

**它認得出來，而且運算元的概念身分完整保留。** 函式呼叫也一樣（`cout << f() << endl` → `print` 帶 `func_call_expr`）。

→ **檔頭記載的阻斷條件已經過期。** 那句話寫下時可能是真的，但程式碼後來動過，沒有人回來重驗。

---

## F2：`print` 的 round-trip **確實壞掉，但原因與檔頭宣稱的完全無關**

完備性護欄判 `print::lift` 為殼。追下去發現真正的原因：

```
合成節點：print { values: [number_literal 1] }
   ↓ generate（預設 style）
printf("%d", 1);
   ↓ lift
cpp_printf {format=%d}   ← 不是 print
```

對照組：

```
cout << 1 << endl;  ──lift──▶  print { values: [number_literal 1, endl] }   ✅
printf("%d", 1);    ──lift──▶  cpp_printf {format=%d}                        ❌ 不是 print
```

**`print` 走一圈之後變成了另一個概念。** 這是可逆性 R0 的破壞——概念身分沒有守住。

專案的既有紀律正好點名這件事：**「roundtrip 測試必須驗證語義樹使用正確 conceptId，不能只驗輸出字串」**。這裡就是那個情形：輸出字串是合法的 C++，執行結果也對，**只有身分變了**。

> **這是真缺口，只是先前被記成別的東西。** 完備性護欄抓到了正確的現象，而缺陷帳把它歸因成錯的原因。

---

## F3：`array_declare` 的無聲丟值 —— **確認，且比 spec 描述的更糟**

```
輸入： int main(){ int a[3] = {1,2,3}; }

array_declare {type=int,name=a} [high]     ← confidence 是 high
  size: number_literal {value=3}
                                            ← {1,2,3} 完全不存在
```

字元陣列同樣：`char c[4] = {'a','b','c'}` → 只剩 `size`。

**比 spec 描述的更糟的地方**：confidence 標的是 **`high`**，不是任何降級等級。系統不只丟了值，還**宣稱自己有高信心**。這正面違反 P6「降級必須可見」。

→ **US2 的前提完全成立**，且證據比 spec 寫的更強。

---

## F4：85 筆停用項目裡，**64 筆沒有測試本體**

| | 數量 | 是什麼 |
|---|---|---|
| `it.skip(..., () => {...})` | **21** | 真的測試，被關掉了 |
| `it.todo('標題')` | **64** | **只有名字**——測試程式從來不存在 |

`it.todo` 沒有 callback。fuzz 產生了程式、驗證它失敗、然後**把程式丟掉，只留下標題**。

→ **「把 40 筆開回來」對其中大多數不適用**——沒有東西可以開。要讓它們變成真的測試，得**重新產生程式**。

→ spec 的 SC-003「斷言與啟用前逐字相同」對這 64 筆**無法成立**：它們沒有斷言。

---

## F5：阻斷者歸因不可靠 —— 我用檔頭宣稱，逐筆註解卻各說各話

`fuzz-cpp-string.test.ts` 檔頭寫「**ALL** tests are `it.todo` because of a pre-existing cout lifter limitation」，我依此把 10 筆全標成 `[BLOCKED:print]`。逐筆註解卻是：

| 測試 | 註解寫的真正原因 |
|---|---|
| fuzz_3 | `while ((pos = s.find(...)) != npos)` generates malformed code —— **條件中的賦值** |
| fuzz_6 | function with const reference params **drops const** |
| fuzz_9 | **vector initializer_list** syntax not supported |
| fuzz_10 | **`find_first_not_of`／`find_last_not_of` not supported as concepts** |

**檔頭的宣稱本身就是錯的**，而我把它當成事實傳播了。這是「缺陷被記在錯的地方」再往下一層——**連「記在哪」的那個記載也是錯的**。

---

## F6：缺陷帳護欄量錯了一項 —— 它把「測試」和「測試的名字」當成同一種東西

`defect-ledger.json` 的 `total: 85` 混了兩種本質不同的東西（F4），而 `byBlocker` 的「修 `print` 解鎖 21 個測試」**是假的**——那 21 個不存在。

這是我在上一個功能剛寫進 `knowledge/concepts/執行機構.md` 的那條的**第三個實例**：

> 「檢查本身也會安靜地量錯，而錯誤的數字比沒有數字更糟——它給你假的安全感。」

而且這次的失效樣態是最陰險的一種：**數字是對的**（85 筆確實存在、`it.todo` 確實是停用狀態），**分類也是對的**，只有**語義**錯了——「停用測試」這個詞把兩種需要完全不同工作量的東西包在一起。

前兩次靠「結果不合理」抓到；這次是**拿它來規劃真實工作時才暴露**。這給那條教訓補了一個新的觸發點：**量測工具的錯，有一類只有在你照它行動時才會現形。**

---

## 對 spec 的影響

| spec 原本的主張 | 研究結論 | 處置 |
|---|---|---|
| US1：`print` 的 lift 吃不下深層運算元 | **F1 推翻** | **改寫**成 F2 的真缺口（round-trip 身分不保） |
| US2：`array_declare` 無聲丟值 | **F3 確認且加強** | 保留，證據升級 |
| US3：40 筆開回來、斷言逐字相同 | **F4 推翻**（64 筆沒有斷言） | **改寫**：分辨兩類，各自定義「恢復」的意思 |
| 「修 print 解鎖 21 個」 | **F5／F6 推翻** | 新增一個 story：**修好缺陷帳讓它量對** |

**спec 已依此修正**（見 `spec.md` 的「研究推翻的前提」一節）。

---

## 技術決策

### D1：初始值在語義結構中怎麼承載（FR-010、FR-014）

**決定**：`array_declare` 新增一個具名子槽 `values`，內容是逐個 lift 過的初始值節點。

- **區分「無初始值」與「空列表」**（FR-014）：前者 `values` 欄位**不存在**；後者 `values: []`。這是 `Record<string, SemanticNode[]>` 天然表達得出來的，不需要額外欄位。
- **多維**（FR-011）：巢狀的 `initializer_list` 遞迴 lift，每層一個節點——層次由樹本身表達，不壓平。

**理由**：`children` 是既有機制，`print` 的 `values` 已經是同樣的形狀（`{"values":"expression"}`）。不新增概念、不新增欄位型別。

**否決**：把初始值存成字串屬性（`"1,2,3"`）—— 直接違反既有教訓「**需要 parse 回結構才能用的字串，就不該是字串**」。

### D2：可見降級怎麼標（FR-004、FR-013）

**決定**：拿不到完整初始值時，**該節點的 `metadata.confidence` 降為 `inferred`，並設 `degradationCause`**；完全無法處理則整段走既有的 `raw_code` 路徑。

**理由**：`ConfidenceLevel` 與 `DegradationCause` 是既有型別（`src/core/types.ts`），降級與認知邊界那份概念檔已經定義了語義。**不發明新的標記方式。**

**這條是 US1 的核心**：F3 顯示現況是「丟了值卻標 `high`」——修法的成敗就在於**做不到的時候有沒有出聲**，不只是做得到的時候有沒有做對。

### D3：`print` 的 round-trip 身分要怎麼守（F2）

**決定**：本功能**只驗證與記錄，不改 style 預設**。

`print` 在預設 style 下生成 `printf`，而 `printf` lift 成 `cpp_printf`——要讓身分守住有兩條路：
1. 讓 `printf(...)` 在某些情況 lift 回 `print`（會與 `cpp_printf` 概念衝突）
2. 讓 `print` 的 generate 在 round-trip 語境下走 cout

**兩條都會動到跨風格的既有行為**，而「跨風格測試」是專案明列的已知坑。本功能的規模不該吞下這個決定。

→ 改為：**用一個測試把這個現象釘住**（記錄它是已知的、可重現的），並在缺陷帳留下正確歸因。實際修法留給後續。

**否決**：在本功能內順手改 style 預設或 lift 規則——它會影響所有輸出構造，風險遠大於本功能的收益。

### D4：`it.todo` 與 `it.skip` 要不要分開計數（F4、F6）

**決定**：**分開**。缺陷帳的量測結果新增 `withBody` / `titleOnly` 兩個數字，`byBlocker` 只統計**有本體的**。

**理由**：兩者需要完全不同的工作——一個是「修好就開回來」，一個是「重新產生測試程式」。混在一起統計會讓優先序失真，而優先序正是缺陷帳存在的唯一理由。

**否決**：把 `it.todo` 從統計中移除——它們仍然是已知的缺口，只是形態不同。移除等於再一次「記錄完就當處理過了」。

### D5：重新歸因要做到什麼程度（F5）

**決定**：**只更正逐筆註解已經寫明真正原因的那些**，不做新的診斷。

**理由**：逐筆註解是 fuzz 當時的一手記錄，比檔頭宣稱可信。而重新診斷 64 個沒有本體的項目需要重跑 fuzz——那是後續功能的事。

**已知不做**：那些註解也沒寫清楚的，維持現有標記並在報表中標為「歸因待確認」。
