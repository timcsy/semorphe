# Research：辨識層只認得一半的語法錯誤

**Date**: 2026-08-14

---

## Q1（plan 的第一個問題）：傳播旗標與「最深節點才標記」會不會共存

### 既有邏輯（`lifter.ts:141-163`）

```
setConfidenceHigh(r)：
  if (hasErrorDescendant(node)) {
    claimed = 任一【子語義節點】的子樹裡已經有 syntax_error
    if (!claimed) 標記 r
  }
```

⚠️ **關鍵**：`claimed` 查的是**語義樹**（已 lift 的），不是 AST。
而 lift 是**由下而上**——處理到父節點時，子節點已經標好了。

### 🔴 而這正是它為什麼能與旗標共存

```
A: int x = 1 ⏎ return 0;

translation_unit    [hasError]   → cpp:program        claimed ✅ 跳過
 function_definition [hasError]  → cpp:func_def       claimed ✅ 跳過
  compound_statement [hasError]  → cpp:block          claimed ✅ 跳過
   declaration       [hasError]  → cpp:var_declare    🔴 標記在這裡
    init_declarator  （無旗標）
```

> **既有邏輯找的是「最深的【已 lift】節點」，不是「最深的 AST 節點」。
> 旗標傳播多深都沒關係——第一個 lift 得出來的那一層就會認領它。**

### 決策 1：改判定，**不改落點邏輯**

- **Rationale**：落點邏輯上一輪就是為了防止標記往上飄而寫的，而它的判準
  （語義樹上有沒有人認領）與「錯誤怎麼表示」無關。
- ⚠️ **而 US3 是它的可否證版本**：若標記真的往上飄，
  第四十三條護欄與 SC-004 會抓到。
- **Alternatives considered**：
  - **只在 `declaration` 之類的特定型別上看旗標** ❌ 那是硬編一份清單，
    而清單會與文法漂移
  - **改用「最深的有旗標的 AST 節點」** ❌ 那個節點可能根本不 lift，
    標記會落在一個語義樹上不存在的地方

## Q1-b：`AstNode` 沒有 `hasError`

```
src/core/lift/types.ts:2-20   type / text / isNamed / children / namedChildren /
                              childForFieldName / parent / startIndex / 位置
                              🔴 沒有 hasError
```

⚠️ 而**執行期有**：lifters 收到的是 tree-sitter 的節點（`as never` 轉進去），
本輪的 AST 探測就是讀 `x.hasError` 印出來的。

### 決策 2：`hasError?: boolean`（選用），而理由不是「怕壞」

四個測試檔造假的 AST 樹。**它們描述的是「一棵沒有錯誤的樹」**
——省略 `hasError` 讀成 `undefined`／falsy，**語義上正確**。

⚠️ 而這**不是**靜默回退（`audit-silent-fallback` 那一族）：
回退是「判不出來時猜一個值」，這裡是「**這個屬性對假樹沒有意義**」。

⚠️ 而必要欄位在這裡**沒有保護力**：`tests/` 不在 `tsconfig` 的 `include` 裡
（`experience`「刪掉欄位讓型別檢查去找」那條），改成必要也不會有人被擋。

---

## Q2：US5 的新上限要設多少

```
單獨跑     204 秒   綠
全套並行   502 秒／575 秒   🔴 超過 300 秒上限
```

### 決策 3：**900 秒**，而理由要寫在數字旁

- **1.5 倍於最差實測**（575 → 900）。
- ⚠️ 而**上限的用途是偵測卡死，不是強制速度**——那句話要寫進檔案，
  否則下一個人會把它讀成「這支測試被允許跑 15 分鐘」。
- **Alternatives considered**：
  - **移出 `npm test`** ❌ `run-cpp.ts` 檔頭逐字：
    「**沒有人跑的護欄等於沒有護欄**」
  - **抽樣** ❌ 同一段檔頭：「不抽樣。抽樣的護欄不能當棘輪，
    而且靜默的抽樣會讓『涵蓋了全部』這句話變成假的」
  - **拆成三支（競賽／APCS／Arduino）** 🟡 可行，而它**不解決問題**
    ——三支共用同一個並行編譯器池，總時間不變。⚠️ 記在這裡，不做

---

## 風險與對策

| 風險 | 出處 | 對策 |
|---|---|---|
| 🔴 合法程式被誤標（旗標傳播） | spec US3 | **第四十三條護欄已經在了**（55 段／誤標 0）——`history/017` 的安全網這次不必先蓋 |
| 標記往上飄到 `cpp:program` | SC-004 | 決策 1 的分析 ＋ 一支釘住落點的測試 |
| `unsupported` 被順手改到 | FR-005 | `determineDegradationCause` 的**順序不動**：先判 `syntax_error`，那一格改了不影響後兩格 |
| 上限提高等於關掉保護 | 決策 3 | 1.5 倍而非 10 倍；而**理由寫在數字旁** |
| 假樹沒有 `hasError` 而行為改變 | 決策 2 | `undefined` → falsy → **與今天完全相同** |

---

## 決策彙總

1. **改判定（`hasErrorDescendant` 認旗標），不改落點邏輯**
2. **`hasError?: boolean` 選用**——假樹描述的是沒有錯誤的樹
3. **上限 900 秒**，而「上限是偵測卡死不是強制速度」要寫在旁邊
4. **`rawCode` 一律用節點原文**——A/C 本來就會落到它，B 統一過去
