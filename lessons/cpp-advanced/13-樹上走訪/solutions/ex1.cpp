vector<vector<int>> g;
vector<int> sz(3, 1);

void dfs(int u, int parent) {
    vector<int> nb = g[u];
    for (int v : nb) {
        if (v == parent) continue;
        dfs(v, u);
        sz[u] = sz[u] + sz[v];
    }
}

int main() {
    vector<int> a;
    a.push_back(1);
    vector<int> b;
    b.push_back(0);
    b.push_back(2);
    vector<int> c;
    c.push_back(1);
    g.push_back(a);
    g.push_back(b);
    g.push_back(c);
    dfs(0, -1);
    for (int i = 0; i < 3; i++) cout << sz[i] << endl;
    return 0;
}
