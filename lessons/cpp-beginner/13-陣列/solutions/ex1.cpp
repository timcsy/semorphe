int main() {
    int a[5] = {3, 1, 4, 1, 5};
    int mx = a[0];
    for (int i = 1; i < 5; i++) {
        if (a[i] > mx) mx = a[i];
    }
    cout << mx << endl;
    return 0;
}
