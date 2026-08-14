# Research：語法錯誤走診斷通道 ＋ 診斷帶來源

**Date**: 2026-08-14

本檔只記**查證過的地面真相**與**它推翻了什麼**。所有行號可 grep。

---

## 一、spec 留給 plan 的第一個問題：兩條路在哪裡會合

### 今天是兩條完全獨立的路

```
診斷    app.ts:675  runBlockDiagnostics()
          workspace.getAllBlocks() → adapt() → runDiagnostics(blocks, rules)
          → bus / registeredViews().onDiagnostics({ diagnostics })
          ⚠️ 【吃積木】，而樹在這裡拿不到

殘差    monaco-panel.ts:100  renderResidual(tree)
          由 onSemanticUpdate 觸發，走 event.tree
          ⚠️ 【吃樹】，而它只在程式碼面板裡，積木面板拿不到
```

**語法錯誤的資料在樹上，而診斷的管線吃積木——所以它今天不可能走診斷通道。**

### 🔴 而診斷的觸發點只有一個，那是 Blockly 的變更

`app.ts:534` 逐字：

```typescript
this.blocklyPanel?.onChange(() => {
  …
  this.runBlockDiagnostics(); this.autoSave()
})
```

**診斷只在積木變動時跑。** 實務上程式碼改動也會間接觸發（code→blocks 同步之後
積木變了），⚠️ **而那是巧合不是設計**——`e2e/diagnostics.spec.ts` 的檔頭
自己記過這個缺口：

> 「而它因此**測不到**「app 真的會在積木變動時跑診斷」——
> 那是另一條線，今天沒有防線。」

### 決策 1：會合點在 `app.ts`，而樹從匯流排來

```
core        新增一個【純函式】：走一遍樹，把 syntax_error 節點變成 Diagnostic
app.ts      訂閱 semantic:update → 快取 tree ＋ 重跑診斷
            診斷 = [ …規則吃積木產出的, …樹產出的 ]   一次事件，一個完整集合
monaco      renderResidual 濾掉 syntax_error（否則同一件事顯示兩次）
```

- **Rationale**：`onDiagnostics` 的契約是「這是當前的完整集合」，
  兩個來源必須**合併成一次廣播**，否則後一次會清掉前一次
  （`setModelMarkers` 與 `setWarningText(null)` 都是全集取代）。
- **Alternatives considered**：
  - **monaco 自己把 syntax_error 改成 Error** ❌ 積木面板還是拿不到，
    而且繞過 `rule`+`params` 那整套
  - **把語法錯誤變成一條 `DiagnosticRule`** ❌ 規則吃積木，
    而積木上看不出少了分號（tree-sitter 復原後那顆積木是完整的）
  - **讓 `runDiagnostics` 也吃樹** ❌ 它今天的契約是吃積木，
    混兩種輸入會讓「規則」與「樹的性質」纏在一起

⚠️ **順帶修掉一個既有缺口**：訂閱 `semantic:update` 之後，
診斷也會在**程式碼改動**時跑，而不是只在積木變動時。
**那是上面那條註解說的「今天沒有防線」的那一條線。**

---

## 二、spec 留給 plan 的第二個問題：參數該帶什麼

### Constitution I（簡約優先／YAGNI）的疑問

> 語法錯誤的訊息只有一種深度，那 `params` 是不是空的？空的話還要不要這個機制？

**不是空的，而消費者今天就在跑。** `monaco-panel.ts:132` 的 `residualMessage`：

```typescript
private residualMessage(cause: string, raw: string): string {
  const snippet = raw.trim().replace(/\s+/g, ' ').slice(0, 40)
  const tail = snippet ? `：${snippet}` : ''
  if (cause === 'syntax_error') return `這一段的語法不完整，積木上會少一塊${tail}`
  …
```

**它已經把壞掉的原文接在訊息後面了。** 搬進診斷通道之後那段原文就是
`params.snippet`——**同一筆資訊，換一個載體**。

| | |
|---|---|
| 是不是為未來預留？ | ❌ 不是——今天的訊息就在用那段原文 |
| 空的 `params` 行不行？ | ❌ 訊息會退化（少掉「是哪一段」） |

⚠️ **而兩個面板對它的用法不同**，這正好是兩面板分開組裝的又一個實例：
程式碼側**不需要** snippet（波浪已經指在那一行上），積木側**需要**
（積木上看不出對應哪一段原始碼）。

---

## 三、來源的值：今天只有兩個，而它們有真的產出端

```
component   runDiagnostics(blocks, rules) 產出的        3 個規則身分
parser      走樹找 degradationCause==='syntax_error'    1 個規則身分 SYNTAX_ERROR
```

⚠️ **不加 `compiler` 與 `runtime`**：委派編譯器與執行期觀察都還沒有產出端
（`vision` 階段 6.6 的「不在這個階段的」逐字列了委派編譯器）。
Constitution I：**不為假設性未來需求預留**。

---

## 四、⚠️ 最大的風險：三個降級原因共用同一段程式碼

`monaco-panel.ts:100-124` 的 `renderResidual` 走一遍樹，
**對任何 `degradationCause` 都畫 Info 級 marker**。

```
syntax_error            → 🔴 要搬走
unsupported             → ✅ 留下
nonstandard_but_valid   → ✅ 留下
```

> **一起搬走的話，學生會看到「你的程式有 12 個錯誤」，
> 而其中 11 個是我們的問題。**

→ US3 是為這件事寫的。而它的測試要**同時**驗證：搬走的搬走了、留下的留下了。

⚠️ 而 `DEGRADATION_VISUALS`（`category-colors.ts:48`）只有兩個鍵
（`syntax_error` 紅、`unsupported` 灰）——**`nonstandard_but_valid` 沒有視覺**。
本輪不補（超出範圍），但記在這裡。

---

## 五、確認：不動任何基線

```
audit-projection-residual:94   isResidual(id) = id==='raw_code' || id==='unresolved'
syntax_error 標在【被 lift 出來的節點】上（cpp:var_declare）——不是 raw_code
tests/baselines/projection-residual.json  residual2 = {charCount:0, nodeCount:0, ratePercent:0}
```

**語法錯誤不在殘差的分母裡，也不在診斷的分母裡。** 搬動它不會動到任何基線。

⚠️ 而**這正是它需要被搬的理由**：它有畫面而沒有任何指標在數它
（見 `knowledge/history/062`）。搬完之後它第一次進入一個分母。

---

## 六、風險與對策

| 風險 | 出處 | 對策 |
|---|---|---|
| 🔴 三種降級原因一起被搬走 | §四 | US3 ＋ SC-003；測試要**同時**驗證搬走的與留下的 |
| 同一件事顯示兩次（診斷 ＋ 殘差） | 決策 1 | `renderResidual` 必須濾掉 `syntax_error`，而那要有測試 |
| 兩次廣播互相清掉 | `setModelMarkers` 是全集取代 | 兩個來源**合併成一次** `onDiagnostics` |
| 訂閱 `semantic:update` 造成重複觸發 | 決策 1 | 診斷是冪等的（全集取代），重跑無害 |
| SC-001 靠「全部改成 Error」通過 | 檢查清單第三輪 | SC-003 與 Edge Case「兩種同時出現」 |

---

## 七、決策彙總

1. **會合點在 `app.ts`**，core 新增一個純函式把樹上的 `syntax_error` 變成 Diagnostic
2. **`params` 帶壞掉的原文片段**——今天的訊息已經在用它
3. **來源只有兩個值**（元件宣告／語法解析），不預留
4. **`renderResidual` 濾掉 `syntax_error`**，另外兩種一行都不動
5. **診斷改由 `semantic:update` 觸發**（順帶補上「程式碼改動不跑診斷」那個缺口）
