const GAS_URL = 'https://script.google.com/macros/s/AKfycbxmwsZ1-7u3Z8vDknC3i0arVjyBNw50JoGTBjQ7SzActHDaXciDHnuPOGwYezSYqWgXug/exec';

const KakeiboAPI = {
  // 資産データの取得
  async fetchDashboardData() {
    const response = await fetch(GAS_URL);
    if (!response.ok) throw new Error('Network response was not ok');
    return await response.json();
  },

  // 取引データの送信（収入・支出・振替）
  async postTransaction(payload) {
    const response = await fetch(GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(payload)
    });
    if (!response.ok) throw new Error('Network response was not ok');
    return await response.json();
  }
};