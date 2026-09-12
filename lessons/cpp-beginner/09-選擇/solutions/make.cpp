int main() {
    int a, b;
    cin >> a >> b;
    if (a == b) {
        cout << "平手" << endl;
    } else if ((a + 1) % 3 == b) {
        cout << "B" << endl;
    } else {
        cout << "A" << endl;
    }
    return 0;
}
