#include <iostream>
#include <vector>
using namespace std;
int main() {
    vector<int> v;
    v.push_back(3);
    v.push_back(1);
    v.push_back(4);
    cout << v.size() << endl;
    for (int x : v) {
        cout << x << endl;
    }
    return 0;
}
