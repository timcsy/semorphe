struct Node {
    int val;
    Node* next;
};

int main() {
    Node* head = new Node();
    head->val = 1;
    Node* second = new Node();
    second->val = 2;
    second->next = nullptr;
    head->next = second;

    Node* mid = new Node();
    mid->val = 99;
    mid->next = head->next;
    head->next = mid;

    Node* p = head;
    while (p != nullptr) {
        cout << p->val << endl;
        p = p->next;
    }
    return 0;
}
