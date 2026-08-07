# Phase 0 研究：參數規格化

## 決定 1：用 **TypeScript AST** 判定「誰讀了哪個參數」，不要用大括號配對

### 為什麼

規劃階段的掃描用「從註冊呼叫往後找到下一個註冊呼叫」切區塊，報了 17 顆對不上，
而自我驗證當場失敗（`print.value` 是假的）。

`typescript` **已經是 devDependency**（5.9.3），用編譯器 API 拿得到精確的節點邊界——
**不新增任何依賴**。

### 而換成 AST 之後，假報還在——錯法是新的

AST 版仍然報 `print.value`。查證：`src/languages/cpp/std/iostream/generators.ts:37`

```ts
fmtParts.push((v.properties.value as string) ?? '')
```

`v` 是 `values.map(v => …)` 的**子節點**，不是 `print` 自己。
**掃描器把子節點的屬性讀取算到父元件頭上。**

→ 判準要**綁定 callback 的第一個參數名**，只算 `<那個名字>.properties.X`。

> 三次修判準，三種不同的錯法（區塊切割 → 子節點混淆 → 見下）。
> 每一次抓到它的都是**已知答案的樣本**，而不是讀程式碼。

## 決定 2：已知答案的樣本——**答案必須是查過的，不是記得的**

最終判準跑在五個樣本上：

| 樣本 | 期望 | 為什麼 |
|---|---|---|
| `var_declare.init_style` | **讀了** | `core/generators/declarations.ts:30` 用它分支 |
| `array_declare.size` | **讀了** | `interpreter/executors/arrays.ts:16` 讀它 |
| `print.value` | **沒讀** | 那一行是子節點的 `value`（見決定 1） |
| `cpp_define.value` | **讀了** | `core/generators/statements.ts:248`，真的是自己的 |
| `cpp_include.local` | **沒讀** | ⚠️ 我原本以為「讀了」——**查了才發現沒有任何程式碼讀它** |

⚠️ 最後一筆是這一輪第三次「**我的期望答案錯了，不是掃描器錯了**」
（前兩次：`generateCode` 真的零呼叫者、`print.value` 真的是子節點）。

> `build-guardrail` 第 6 步說「先在已知答案的樣本上驗過」。
> **這一輪補上它沒說出來的前提：那個答案必須是查過的。**
> 用記得的答案驗工具，驗的是記憶不是工具——而我因此差點丟掉三個正確的結果。

## 決定 3：`cpp_include.local` 揭露了反方向——**寫了沒人讀**

它不在宣告裡、也沒有任何程式碼讀它，而**實例確實帶著它**（辨識器寫進去的）。

所以 FR-001 的雙向不是對稱的裝飾：

| 方向 | 意味著 | 處置 |
|---|---|---|
| **讀了沒宣告** | 規格不完整 | 補宣告 |
| **宣告了沒人讀** | 殘骸或未接上 | 刪，或說明它為誰而存在 |
| **寫了沒宣告也沒人讀** | ⚠️ 純粹的死資料 | 刪寫入端 |

第三種是這次才看見的，因為它同時躲過前兩種。

## 決定 4：種類詞彙——**生不出檢查的種類不該存在**

實例側幾乎全是字串，所以 JS 型別說不出任何東西。從 54 個屬性名導出五類，
每一類都以「它能讓什麼失敗」定義：

| 種類 | 檢查 | 若拿掉這一類會怎樣 |
|---|---|---|
| `identifier` | 非空 ＋ 合法識別字 | 空的變數名會靜靜產出壞程式碼 |
| `type_expr` | 非空 | `long long` 被截斷那條債的所在 |
| `enum` | **值必須在集合裡** | 最強的一條：`operator: "**"` 當場知道 |
| `literal` | 只驗存在 | 內容是使用者的資料，不該有意見 |
| `count` | 非負整數 | `rows: "-1"` 會炸在執行期 |

⚠️ **54 個屬性名裡 30 個只出現一次**，歸類要逐筆附證據（哪顆元件、誰讀它、怎麼用）。
憑名字猜會做出一份看起來完整、而實際上沒有指涉物的規格。

## 決定 5：順序——消費者先、小批次之、展開最後

與 100／101 同一條紀律，但這次多一層：**小批做完時消費者的報告必須有變化**（SC-004）。
沒有變化就代表規格寫了而沒人讀——**那時停下來，比展開到 124 顆便宜得多**。

---

## 決定 6（**推翻決定 5 的一部分**）：`properties` 不是描述，是**驅動抽取的資料**

### 實作時才發現

`PatternExtractor.deriveRenderMapping`（`src/core/projection/pattern-extractor.ts:243`）
拿 `concept.properties` 去比對積木欄位名：

```ts
const properties = concept.properties ?? []
…
const semProp = this.findMatchingProperty(argName, properties)   // 'NAME' → 'name'
if (semProp) mapping.fields[argName] = semProp
```

**所以「把宣告改成符合實際」不是文件工作，它會改變行為。**

### 兩次實測撞牆

| 我做的 | 結果 |
|---|---|
| 把 `input` 的參數列從 `['name']` 改成 `['from','type','variable']` | 來回轉換紅：`input → arithmetic, var_ref`——`name` 是**抽取器經推導對應**讀的，我的掃描器看不到那條路 |
| 刪掉 `cpp_increment` 看似死掉的大寫退路（`?? properties.NAME`） | 來回轉換紅：`i++` vs `j--`——那個退路是**抽取器餵的**，因為 `cpp_increment` 的 `renderMapping` 沒有 `fields` 對應 |

兩次都**還原了**。

### 這改變了 C1 的形狀

- **第三條讀取路徑**：除了 TS 產生器／執行器、`codeTemplate.pattern`，還有
  **`deriveRenderMapping` 經由積木欄位名的隱式讀取**。掃描器看得到前兩條。
- **判定改成棘輪，不是硬性零**。我先前判成硬性零，理由是「留一筆規範就不成立」——
  那句話仍然對，而**判準選硬性零還是棘輪，看的是修法的代價**：
  這裡每一筆修法都要驗行為，屬於「大量既有違規、慢慢還」。
  → `build-guardrail` 第 6.8 步要補上這半句。

### 沒有還原的一筆

`cpp_ifdef`／`cpp_ifndef` 的 `{ condition: name, name }`——**同一個值兩個名字**，
而產生器讀 `name`、執行器讀 `condition`，**兩條路各讀各的**。
去重之後全綠，並補了一支迴歸測試（`tests/integration/ifdef-param-name.test.ts`）
釘住「只有 `condition` 的節點也要產得對」。

> 那一筆是護欄真正的第一個戰果：**它逼出了一個沒有人知道的分歧**。
