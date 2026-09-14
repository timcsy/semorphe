#include <iostream>
using namespace std;
int main() {
    int a = 7, b = 3;
    bool big = a > b;
    cout << big << endl;
    cout << (a > 5 && b < 5) << endl;
    cout << !(a == b) << endl;
    return 0;
}
