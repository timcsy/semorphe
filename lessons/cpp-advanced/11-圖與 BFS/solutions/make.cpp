int main() {
    vector<int> a0;
    a0.push_back(1);
    a0.push_back(2);
    vector<int> a1;
    a1.push_back(3);
    vector<int> a2;
    a2.push_back(3);
    vector<int> a3;
    a3.push_back(4);
    vector<int> a4;
    vector<vector<int>> g;
    g.push_back(a0);
    g.push_back(a1);
    g.push_back(a2);
    g.push_back(a3);
    g.push_back(a4);
    vector<int> dist(5, -1);
    queue<int> q;
    q.push(0);
    dist[0] = 0;
    while (!q.empty()) {
        int u = q.front();
        q.pop();
        vector<int> nb = g[u];
        for (int v : nb) {
            if (dist[v] == -1) {
                dist[v] = dist[u] + 1;
                q.push(v);
            }
        }
    }
    for (int i = 0; i < 5; i++) cout << i << " " << dist[i] << endl;
    return 0;
}
