vector<int> par;

int find(int x) {
    if (par[x] == x) return x;
    par[x] = find(par[x]);
    return par[x];
}

void unite(int a, int b) {
    par[find(a)] = find(b);
}

int main() {
    for (int i = 0; i < 7; i++) par.push_back(i);
    unite(0, 1);
    unite(1, 2);
    unite(3, 4);
    unite(5, 6);
    int groups = 0;
    for (int i = 0; i < 7; i++) {
        if (find(i) == i) groups = groups + 1;
    }
    cout << groups << endl;
    return 0;
}
