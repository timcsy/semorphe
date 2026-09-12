vector<vector<int>> g;
vector<int> depth;

void dfs(int u, int p, int d) {
    depth[u] = d;
    vector<int> nb = g[u];
    for (int v : nb) {
        if (v != p) dfs(v, u, d + 1);
    }
}

int main() {
    vector<int> e0;
    e0.push_back(1);
    e0.push_back(2);
    vector<int> e1;
    e1.push_back(0);
    e1.push_back(3);
    vector<int> e2;
    e2.push_back(0);
    e2.push_back(5);
    vector<int> e3;
    e3.push_back(1);
    e3.push_back(4);
    vector<int> e4;
    e4.push_back(3);
    vector<int> e5;
    e5.push_back(2);
    g.push_back(e0);
    g.push_back(e1);
    g.push_back(e2);
    g.push_back(e3);
    g.push_back(e4);
    g.push_back(e5);
    for (int i = 0; i < 6; i++) depth.push_back(0);
    dfs(0, -1, 0);
    int best = 0;
    for (int i = 0; i < 6; i++) {
        if (depth[i] > depth[best]) best = i;
    }
    cout << best << endl;
    cout << depth[best] << endl;
    return 0;
}
