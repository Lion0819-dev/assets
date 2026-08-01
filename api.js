const GAS_URL = 'https://script.google.com/macros/s/AKfycbxmwsZ1-7u3Z8vDknC3i0arVjyBNw50JoGTBjQ7SzActHDaXciDHnuPOGwYezSYqWgXug/exec';

const KakeiboAPI = {
  // 資産データの取得
  async fetchDashboardData() {
    const response = await fetch(GAS_URL);
    if (!response.ok) throw new Error('Network response was not ok');
    return await response.json();
  },

  // 汎用POSTリクエストヘルパー
  async _post(data) {
    const response = await fetch(GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Network response was not ok');
    return await response.json();
  },

  // 取引データの送信（収入・支出・振替）
  async postTransaction(payload) {
    return await this._post(payload);
  },

  // 口座の追加
  async addAccount(accountData) {
    return await this._post({ action: 'addAccount', ...accountData });
  },

  // 口座の削除
  async deleteAccount(accountName) {
    return await this._post({ action: 'deleteAccount', name: accountName});
  }
};