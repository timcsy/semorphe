# Research：擴充裡跑的就是網頁版本身

**Feature**: 140-app-in-host　**Date**: 2026-08-18

---

## 一、`CodeView` 的形狀 —— 而 **C 類不可以變成一堆空樁**

### 問題

四類裡的 C 類（`relayout` / `applyMobileOptions` / `applyDesktopOptions` /
`getEditor`）在這個宿主裡**沒有意義**——編輯器不歸我們管。

⚠️ 而最順手的做法是「實作成空函式」。**這個專案明令不要那樣做**
（`component-generate` skill 步驟五）：

> **宣告性概念不要寫 noop——在宣告裡寫 `skipPaths` ＋ `skipReasons`。**
> **顯式的空與遺漏的空要分得出來，而一個 noop 函式兩者長得一樣。**

### Decision：**必要的用必填欄位，沒有的用【可選欄位 ＋ 一份理由】**

```
必要（A/B/D）   getCode / setCode / setCodePreserveCursor / onChange
                addHighlight / clearHighlight / dismissPendingHighlight / onCursorChange
                connectBus / dispose / onSemanticUpdate / onExecutionAtNode
可選（C）       relayout? / applyMobileOptions? / applyDesktopOptions? / getEditor?
＋ absentReasons: Record<缺的那一項, 理由>
```

**Rationale**：
- 🟢 型別系統就表達得出「這個宿主沒有」——呼叫端寫 `codeView.relayout?.()`，
  **而那不是防禦性程式碼，是讀得出意圖的程式碼**。
- 🔴 而 `absentReasons` 讓「刻意沒有」與「忘了實作」分得出來
  ——⚠️ **配一條測試**：每一個沒實作的可選方法，`absentReasons` 裡必須有一筆。

**Alternatives considered**：
- 全部必填 ＋ 空實作 → ❌ 正是被明令禁止的那個做法。
- 能力旗標陣列（`absent: ['relayout']`）→ ⚠️ 型別上仍然可呼叫，
  **而「可以呼叫但會出事」比「呼叫不到」更糟**。

---

## 二、注入點 —— **一份 `HostProfile`，不是散落的 `if`**

### Decision

```
HostProfile
  id                'web' | 'vscode'          🔴 只用於診斷，不得拿來做行為分支
  createCodeView    (container) => CodeView
  createStorage     () => StorageLike
  features          { fileButtons, mobileLayout, codeKeyboard }
  featureReasons    Record<關掉的那一項, 理由>
```

**Rationale**：
🔴 **它讓「這個宿主沒有什麼」變成一份【看得完】的宣告**，
而不是散落在 `app.ts`／`app-shell.ts` 裡的 `if`。

> **一份「這個宿主缺什麼」的清單，如果只存在於各處的 `if` 裡，
> 那麼每一個新宿主都要把那些 `if` 各撞一次才學得會。**

⚠️ 而這句話有出處：`component-generate` skill 記著
「一張『加一顆元件要做什麼』的清單，如果只存在於七條護欄的失敗訊息裡……」
——**同一個病的另一個位置**。

🔴 **而 `id` 明令不得拿來做行為分支**：一旦有人寫
`if (profile.id === 'vscode')`，這份宣告就退化成一個標籤，
而**能力清單就不再是真相**。⚠️ 配一條測試 grep 它。

**Alternatives considered**：
- 塞進 `App` 的建構子參數 → ⚠️ 三個獨立的參數，而「有哪些差異」讀不出來。
- `createAppLayout` 多幾個參數 → 同上，且 `App` 那一半仍然要各自傳。

### 網頁版的 profile **必須是今天的行為，逐字**

🔴 **驗收方式不是「看起來一樣」，是「網頁版全套零變化」**——
而那要在**抽介面的那一步就驗**，不是最後才驗（US4）。

---

## 三、`getCode()` 必須是同步的，而文字在另一個行程

`app.ts` 有六處 `getCode()`，全部是同步用法。
而在這個宿主裡，文字的真相在主行程。

**Decision**：Webview 側的實作保一份**本地鏡像**，`getCode()` 回鏡像。
🟢 **而 spec 139 已經有了**（`docText`）——只是它現在住在一個手工殼裡，
要搬進 `VscodeCodeView`。

⚠️ **鏡像會過期一瞬間**（我們送出編輯到宿主回報之間）。
🟢 而 spec 139 的**樂觀更新 ＋ `baseVersion` 比對**已經處理了：
編輯是根據舊版本算的就丟掉並重送。**那個機制原封搬過來。**

---

## 四、🔴 開機不得覆蓋檔案 —— 而它今天**一定會**

```
app.ts:645  restoreState() → :296  if (state.code) this.monacoPanel?.setCode(state.code)
app.ts:118  this.storageService = new StorageService()      ← 寫死
```

在這個宿主裡，那條路徑會**用上一次的存檔蓋掉使用者真的檔案**。

**Decision**：儲存服務走 `HostProfile.createStorage()`，
而這個宿主注入的實作**不記文件內容**：

```
save()   丟掉 code / tree / blocklyState，只留偏好類
load()   一律回「空」——🔴 因為【檔案才是真相】，沒有東西要還原
```

**Rationale**：⚠️ 不是「記得不要呼叫 `setCode`」——那是靠自律。
**讓它拿不到東西可還原，才是機制。**

🔴 **而它要有一支測試釘住**（FR-004）：
餵一個「存檔裡有程式碼」的假儲存，斷言 `setCode` **一次都沒被呼叫**。

> **一個「不會發生」的保證，如果只寫在註解裡，
> 它會在某次重構之後安靜地失效。**

---

## 五、行動版元件與檔案按鈕

```
MobileTabBar / MobileMenu / CodeKeyboard   ⚠️ CodeKeyboard 需要 getEditor()
setupFileButtons（開檔／存檔／匯入匯出）   ⚠️ 在 IDE 裡沒有意義（FR-006）
```

**Decision**：由 `features` 關掉，並在 `featureReasons` 寫理由。

🔴 **而 FR-006 說「不出現」而不是「出現但沒作用」** ——
所以是**不建那些 DOM**，不是建了再 `display:none`。

> **一個長得一樣而按下去沒反應的按鈕，比沒有那顆按鈕更糟
> ——因為它讓「像」變成一個謊。**

---

## 六、⚠️ 一個本輪會踩到而 spec 139 沒踩到的東西

spec 139 的 Webview 只用了 `BlocklyPanel`。
本輪要跑 `App`，而 `App.init()` 會建**整個版面**（`<header>`／`<main>`／
`<footer>`／分割窗格），並且讀 `document.getElementById('app')`。

**Decision**：Webview 的 HTML 提供 `#app` 這個容器，**其餘交給 `App`**。
⚠️ 而 spec 139 那個手工的 `#canvas`／`#readout`／`#bar`／`#out` **全部拆掉**。

🔴 **而診斷讀數不是丟掉，是搬家**（FR-009）：
搬進**宿主的輸出頻道**，而不是佔著面板的版面。

---

## 未解（本輪不解，記著）

```
❓ 面板很窄時版面收不收得起來 —— 網頁版有行動版版面，而我們關掉了它
   ⚠️ 那可能讓窄面板變得難用，而本輪【不重新設計介面】
❓ 樣式表：網頁版的 CSS 假設自己是整個頁面，而 Webview 裡它是一塊面板
❓ 同一份程式碼開兩個面板 —— 本輪不支援，而要說得出來
```
