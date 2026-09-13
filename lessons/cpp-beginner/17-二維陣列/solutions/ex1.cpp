int main() {
    int g[2][3] = {{1, 2, 3}, {4, 5, 6}};
    for (int i = 0; i < 2; i++) {
        int sum = 0;
        for (int j = 0; j < 3; j++) {
            sum = sum + g[i][j];
        }
        cout << sum << endl;
    }
    return 0;
}
