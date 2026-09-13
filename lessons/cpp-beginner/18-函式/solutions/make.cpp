int toC(int f) {
    return (f - 32) * 5 / 9;
}

int main() {
    int f;
    cin >> f;
    cout << toC(f) << endl;
    return 0;
}
