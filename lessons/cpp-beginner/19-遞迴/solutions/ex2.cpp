int gcdLoop(int a, int b) {
    while (b != 0) {
        int t = a % b;
        a = b;
        b = t;
    }
    return a;
}

int gcdRec(int a, int b) {
    if (b == 0) return a;
    return gcdRec(b, a % b);
}

int main() {
    int a, b;
    cin >> a >> b;
    cout << gcdLoop(a, b) << endl;
    cout << gcdRec(a, b) << endl;
    return 0;
}
