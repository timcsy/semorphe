int main() {
    int n = 4;
    for (int i = 1; i <= n; i++) {
        for (int j = 0; j < n - i; j++) cout << " ";
        for (int j = 0; j < 2 * i - 1; j++) cout << "*";
        cout << endl;
    }
    for (int i = n - 1; i >= 1; i--) {
        for (int j = 0; j < n - i; j++) cout << " ";
        for (int j = 0; j < 2 * i - 1; j++) cout << "*";
        cout << endl;
    }
    return 0;
}
