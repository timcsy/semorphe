int main() {
    int count = 0;
    for (int i = 1; i <= 100; i++) {
        if (i % 3 != 0) continue;
        if (i % 5 == 0) continue;
        count = count + 1;
    }
    cout << count << endl;
    return 0;
}
