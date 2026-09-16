// **`bits/stdc++.h` 的墊片**——它是 GCC 專屬的，Apple clang 沒有。
//
// 🔴 它存在的理由是一個量測工具的缺陷，不是產品的：`StudyCpp` 那 218 支
//    學生程式裡有 206 支用它（競賽習慣），而在 macOS 上它們會【全部編不過】
//    ——於是「參照編譯器收下幾支」量出 6/218，而那個數字是我造的。
//
// > **一份「有 N 個缺陷」的報告，先問那 N 裡有幾個是量測工具自己的。**
//
// ⚠️ 它只給參照編譯器用，不進產品。
#pragma once
#include <algorithm>
#include <array>
#include <bitset>
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <deque>
#include <functional>
#include <iomanip>
#include <iostream>
#include <iterator>
#include <limits>
#include <list>
#include <map>
#include <numeric>
#include <queue>
#include <set>
#include <sstream>
#include <stack>
#include <string>
#include <tuple>
#include <unordered_map>
#include <unordered_set>
#include <utility>
#include <vector>
