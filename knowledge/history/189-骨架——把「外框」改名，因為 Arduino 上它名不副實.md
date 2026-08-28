# 189 · 骨架——把「外框」改名，因為 Arduino 上它名不副實

**日期**：2026-08-28
**前一步**：[188](188-Arduino要腳手架而它逼出了「哪一塊是外框」的第六份實作.md)

## 轉折

使用者：「**我們要把那個東西叫做外框嗎？還是有其他更好的名字？他的本質是什麼？**」

把三份宣告攤開，共同的東西**不是「框」**：

```
main         preamble: using namespace std;   entryPoint: int main() {   entryFunctions: [main]
arduino      preamble: []                     entryPoint: []             entryFunctions: [setup, loop]
python-none  preamble: []                     entryPoint: []             entryFunctions: []
```

Arduino 那一份**三段程式碼全是空的**，只有 `entryFunctions` 有東西。
也就是說：對 Arduino 而言它完全沒有在描述任何「框」。

## 本質：執行環境與程式之間的約定

```
C++       作業系統呼叫 main，一次
Arduino   開機呼叫 setup 一次，然後【一直】呼叫 loop
Python    沒有人呼叫誰，從第一行往下跑
```

`entryFunctions` 有兩顆不是巧合——**Arduino 的約定本來就是兩個回呼**。

> **「框」是這個約定在 C++ 上碰巧呈現的樣子。
> 換一個平台它就不包了。**

## 🔴 而「殼」這條路要避開

程式碼裡當時是 `Shell`／`entryShell`／`程式外殼`。而這個 repo 的知識庫
把「殼」用成**貶義**：「一條規範沒有機械化的檢查，它本身就是殼」
「空殼宣告」「而殼看起來像完成」。

> **拿一個一路被當成「假東西」的字去命名一個真東西，讀者會被絆一下。**

## 拍板：鷹架留著，宣告叫骨架

兩個詞各答一個問題，而它們在改名前混在一起：

```
骨架   這支程式【固定有】哪幾塊——平台決定的，跟教學無關
鷹架   那幾塊【給學生看多少】——hidden → ghost → editable
```

⚠️ 而「鷹架」這個詞本來就選得準：教育上的 scaffolding 是**逐步撤走的支撐**，
而 `hidden → ghost → editable` 正是學生**逐步接手骨架**的過程。
它形容的是支撐的濃度，不是被支撐的那個東西——那個東西該有自己的名字。

## 代價：低，而那是查過才敢說的

`entryShell` 只住在目標宣告的 JSON 與介面字串裡，**不在 `SAVED_STATE_FIELDS`**
（查過），所以不需要一次性轉換（P8 的存檔條款）。

改名時撞到兩處：
- `\bshell\b` 的全域取代把 `./app-shell`（版面模組，與骨架無關）改成了 `app-skeleton`
- 參數 `entryShell` 改名後與區域變數 `const skeleton = skeletonById(...)` 撞名

**兩處都是型別檢查當場抓到的。**

## 而它還留著一條沒解的

這份宣告**綁了兩種東西**：

```
using namespace std;   ← 不是約定，不寫它程式照樣跑。它是慣例／風格
int main() {           ← 是約定，沒有它跑不動
```

哪天出現「競賽的快速 IO 前言」（`ios::sync_with_stdio(false)`，必須在
`main` 的第一行），那一段就會逼著問「這到底是約定還是慣例」。
