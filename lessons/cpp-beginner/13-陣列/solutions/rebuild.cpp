#include <iostream>
using namespace std;
int main() {
    int a[5] = {3, 1, 4, 1, 5};
    int sum = 0;
    for (int i = 0; i < 5; i++) {
        sum = sum + a[i];
    }
    cout << sum << endl;
    return 0;
}
