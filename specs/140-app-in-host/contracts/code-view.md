# Contract：程式碼視圖這個**角色**

**Feature**: 140-app-in-host　**Date**: 2026-08-18

> `App` 只認識這個角色，**不認識任何一個具體的編輯器**。

---

## 一、必要的能力（A／B／D 三類）

```
── A 文字內容 ──────────────────────────────
getCode(): string                     🔴 【同步】——呼叫點有六處，全是同步用法
setCode(code): void
setCodePreserveCursor(code, linesDelta): void
onChange(cb): void

── B 高亮與游標 ────────────────────────────
addHighlight(startLine, endLine, variant): void      ⚠️ 行號是 1-based（沿用今天）
clearHighlight(): void
dismissPendingHighlight(): void
onCursorChange(cb: (line) => void): void

── D 生命週期 ─────────────────────────────
connectBus(bus): void
dispose(): void
onSemanticUpdate(event) / onExecutionAtNode(event)   🟢 既有的視圖介面已經有
```

⚠️ **`getCode()` 同步這一條是硬的**。文字的真相若在另一個行程，
實作**必須保一份本地鏡像**——而鏡像過期的處置見第三節。

---

## 二、🔴 可選的能力，而**缺席要有理由**

```
relayout?()                版面變了要重排
applyMobileOptions?()      切成行動版
applyDesktopOptions?()     切回桌面版
getEditor?()               把底層編輯器交出去（給輔助輸入用）

absentReasons: Record<缺的那一項, 理由>
```

**規則**

```
🟢 有這個能力    實作它，`absentReasons` 不得有它
🔴 沒有這個能力  不實作，而 `absentReasons` 必須有一筆【理由】
```

⚠️ **為什麼不用空實作**——專案明令（`component-generate` skill 步驟五）：

> **宣告性概念不要寫 noop。顯式的空與遺漏的空要分得出來，
> 而一個 noop 函式兩者長得一樣。**

**呼叫端**寫 `codeView.relayout?.()` —— 🟢 而那**不是防禦性程式碼，
是讀得出意圖的程式碼**：這一格本來就可能不存在。

**驗收**：一支測試逐一比對「沒實作的可選方法」與 `absentReasons` 的鍵，
🔴 **兩邊必須一模一樣**——多一個是說謊，少一個是遺漏。

---

## 三、鏡像會過期，而處置是**比對版本不是等待**

文字的真相在另一個行程時：

```
我們送出編輯 → 樂觀更新本地鏡像 → 宿主套用 → 回報新版本
```

⚠️ 中間那一瞬間鏡像是「預期的內容」而不是「已確認的內容」。

**處置**：每次送出都帶**這次是根據哪一個版本算的**；
宿主若發現文件已經不是那個版本 → **丟掉這次編輯並重送全文**。

🔴 **那不是防迴圈**（防迴圈是另一件事，用回音的身分）——
**它防的是踩掉別人的修改**。

> **兩個問題長得像，而它們的性質不同。**

---

## 四、宿主的宣告

```
HostProfile
  id                僅供診斷
                    🔴 **不得拿來做行為分支** —— 一旦有人寫 `id === '…'`，
                       這份宣告就退化成一個標籤，能力清單不再是真相
  createCodeView    (container) => CodeView
  createStorage     () => 存檔服務
  features          { fileButtons, mobileLayout, codeKeyboard }
  featureReasons    Record<關掉的那一項, 理由>
```

⚠️ **`features` 關掉的東西是「不建」，不是「建了再藏起來」**（FR-006）：

> **一個長得一樣而按下去沒反應的按鈕，比沒有那顆按鈕更糟
> ——因為它讓「像」變成一個謊。**

**驗收**：一支測試 grep `profile.id ===`／`id === 'vscode'` → **零筆**。

---

## 五、存檔服務在這個宿主裡的契約

```
save()   🔴 丟掉文件內容（程式碼／語義樹／積木狀態），只留偏好類
load()   🔴 一律回「空」
```

**為什麼是「拿不到東西可還原」而不是「記得不要還原」**：

> **一個「不會發生」的保證，如果只寫在註解裡，
> 它會在某次重構之後安靜地失效。**

⚠️ 而它是本規格唯一一條**做錯了會毀損使用者資料**的
——所以它有一支專屬的測試（FR-004）。
