# formalize 丟資訊盤點（480，2026-11-15）

**問題**：lift 記在語義樹上的屬性，formalize 送給 Cella 時有沒有被丟掉？被丟掉的那一份，Cella 就判不到。這影響整個網站的判決，不只語言轉換。

## 怎麼量的

- **靜態**：逐顆 `src/components/cpp/*/component.json` 的 `properties`，看 `formalize.ts` 有沒有提到那個名字。命中 44 顆，**多數是誤報**，因為共用工具會替元件讀屬性（`f.binary` 讀 `operator`、`f.declVar` 讀 `name`、`f.mcall` 讀 `obj`）。
- **動態**（判準用這一份）：308 支語料（StudyCpp 218 支加 lessons 90 支，Arduino 課文用 `board: uno`）。逐支 lift 之後，把每顆節點的 `properties` 包成 Proxy，跑一次 `formalize`，記下哪些「有值的屬性」從頭到尾沒被讀過。
  - 入口條件：308 支全部 lift 成功、全部 formalize 成功。
  - ⚠️ 探針的第一版讀數是零筆，原因是探針**自己**用 `Object.entries(n.properties)` 列屬性，這一步會把每一格都碰過一次。改成列原始物件之後才量得到東西（量測工具在被量過之前不可信，同 experience〈一個量測工具，在它自己被量過之前〉）。

## 結果：14 筆有屬性沒被讀到，0 筆是缺陷

| 屬性 | 有值／沒讀 | 判定 | 理由 |
|---|---|---|---|
| `var_declare.type` | 1319／239 | OK | 一行宣告多個時，外層那份不讀，由各個宣告子自己帶型別。已抽查：`const ll M=7, N=9`、`double a, *p, b[3]` 的宣告子型別都和外層一致 |
| `literal_number.value` | 2968／270 | OK | 272 處是 `sync_with_stdio(0)` 和 `cin.tie(0)` 的引數，136 加 136。判決不受它影響 |
| `forward_decl.return_type`、`param_decl.type`（`int&`） | 9／9、210／6 | OK（照權威） | 前置宣告整顆不送，Cella 的參照翻譯 `cpp_to_tree.py` 也丟掉它（`if self.forward(d): return None`）。6 筆 `int&` 都是前置宣告的參數 |
| `loop_range.var_name` | 29／5 | OK | 結構化繫結 `for (auto [P, W] : …)` 的名字由 `targets` 槽送（`binder`），`var_name` 是多出來的一份 |
| `container_{push,pop,empty,clear}.container_kind` | 125／125 | OK | 容器種類由 Cella 從接收者的型別得知 |
| `define_func.params` | 5／5 | OK | 函式形巨集在 lift 時就展開了，運算式位置的用法照實標翻不出 |
| `include.local` | 242／242 | OK | 單一檔案裡 `<x>` 和 `"x"` 判決相同 |
| `if.isElseIf` | 38／38 | OK | 只影響積木結構 |
| `comment.text`、`block_comment.text` | 388／388 | OK | 註解 |

**語料沒碰到、靜態列出來的**：

| 屬性 | 判定 |
|---|---|
| `pin_attach.device` | OK：只是積木標籤，從名字讀出來的（見 `pin_attach/generate.ts` 的註解） |
| `*_declare.ctorCount`（lcd、servo、dht） | OK：積木的插槽數。引數由 `initializer` 槽照實送（`libraryObject`） |
| `friend_class.tag` | OK：參照翻譯不分 class 和 struct |
| `doc_comment.brief`、`return_desc` | OK：註解 |
| 🟡 `method_def_outside.return_type` | **小缺口**。類別外的定義靠成員鍵（名字、參數型別、const）配對到類別裡的原型，沒比對回傳型別。`long A::f() {}` 對上類內的 `int f();` 是不合法的 C++，現在會照類別裡那一行送，於是判 accept。語料 0 支，學生寫錯才會碰到 |

## 下一步（推薦）

- 主體不必修：**量到的 0 筆會讓判決說錯**。
- 🟢 **已做**（480，和「C++ → Python 照實翻不出」同一條分支）：`method_def_outside` 的回傳型別和類別裡的宣告不同時照實翻不出（`f.miss`）。回歸：`tests/integration/cella-member-at.test.ts`「類別外定義的回傳型別與宣告不同…」

## 另一半：整棵子樹沒送出去的節點

槽沒辦法用 Proxy 量，因為核心的 `collect`、作用域走訪會把每個槽都走過一遍。改用另一種量法：送出去的 Cella 程式裡收集所有 `n`／`x` 的節點 id，再找**整棵子樹沒有任何一顆出現**的語義節點。註解、巨集、前置宣告、數字字面量（陣列長度折成常數）、`{}` 值初始化、`io_sync`／`io_tie` 不列入。307 支送得出程式（1 支整支翻不出）。

| 子樹 | 次數 | 判定 |
|---|---|---|
| `func_def.body → comma_expr` | 133 | OK：全是 `ios::sync_with_stdio(0), cin.tie(0);`，判決不受它影響。`i = 0, j = 0;` 這種的子節點都有送 |
| `struct_declare.members → var_declare`、`_multi_field` | 55 | OK：欄位照名字送成 `mbField`，`mbField` 不帶節點 id |
| `array_declare.size`／`array_2d_declare.rows,cols → var_ref` | 5 | OK：`const` 的 `N`／`LEN` 折成常數 |

**合起來：屬性 14 筆、子樹 5 類，會讓判決說錯的 0 筆。**
