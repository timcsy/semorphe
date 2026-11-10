# 概念探索：C++ — friend 宣告

## 摘要
- 語言：C++；目標：類別裡的 friend 宣告（[class.friend]）
- 發現概念 2 個（都是語言特定）：`cpp:friend_class`、`cpp:friend_function`
- 建議歸屬：進階（物件導向），需要先懂類別與存取控制

## 概念目錄（進階）

| 概念名稱 | 語法 | 語義意義 | 積木輸入 | Layer | 降級路徑 | 備註 |
|---|---|---|---|---|---|---|
| `cpp:friend_class` | `friend class X;` | 讓類別 X 讀得到我的私有成員 | 類別名 | lang-core | raw_code | Cella `mbFriendClass { name }` |
| `cpp:friend_function` | `friend R f(params);` | 讓函式 f 讀得到我的私有成員 | 回傳型別、名字、參數 | lang-core | raw_code | Cella `mbFriend { f, ret, params }`；帶本體的照實降級 |

## 依賴關係
依賴 `cpp:struct_declare`／類別的成員槽；參數沿用 `param_decl`。

## 建議實作順序
先 `friend_class`（一個欄位），再 `friend_function`。

## 需注意的邊界案例
- `friend struct X;`、`friend X;`（無 class 關鍵字）：Cella 只取名字；只收 `class`／`struct`，其餘降級。
- 模板 friend、限定名 friend（`friend void A::f();`）：照實降級。
- friend 不是類別的成員，宣告位置不受 public／private 影響。
- 語料（StudyCpp、課文）0 處，只在盲測 fuzz_8 出現。
