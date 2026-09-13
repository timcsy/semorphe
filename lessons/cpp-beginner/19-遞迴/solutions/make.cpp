void hanoi(int n, char from, char to, char via) {
    if (n > 0) {
        hanoi(n - 1, from, via, to);
        cout << from << " -> " << to << endl;
        hanoi(n - 1, via, to, from);
    }
}

int main() {
    int n;
    cin >> n;
    hanoi(n, 'A', 'C', 'B');
    return 0;
}
