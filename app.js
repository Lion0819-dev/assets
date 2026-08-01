document.addEventListener("DOMContentLoaded", () => {
  App.init();
});

const App = {
  currentAccounts: [],
  chartInstance: null,
  expenseChartInstance: null,
  categories: {
    expense: ["食費", "日用品", "交通費", "固定費", "交際費", "その他"],
    income: ["給料", "賞与", "副業", "臨時収入", "その他"],
  },

  init() {
    document.getElementById("txDate").value = new Date()
      .toISOString()
      .split("T")[0];
    this.bindEvents();
    this.updateCategoryOptions("expense");
    this.loadData();

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js");
    }
  },

  bindEvents() {
    // タブ切り替え
    document.getElementById("tabGroup").addEventListener("click", (e) => {
      if (e.target.classList.contains("tab-btn")) {
        this.switchTab(e.target.dataset.type);
      }
    });

    // フォーム送信
    document
      .getElementById("txForm")
      .addEventListener("submit", (e) => this.handleFormSubmit(e));

    // 手動更新ボタン
    document
      .getElementById("refreshBtn")
      .addEventListener("click", () => this.loadData());

    // モーダル・口座追加イベント
    document.getElementById("addAccountBtn").addEventListener("click", () => {
      document.getElementById("accountModal").classList.remove("hidden");
    });
    document.getElementById("closeModalBtn").addEventListener("click", () => {
      document.getElementById("accountModal").classList.add("hidden");
    });
    document
      .getElementById("addAccountForm")
      .addEventListener("submit", (e) => this.handleAddAccount(e));
  },

  switchTab(type) {
    document
      .querySelectorAll(".tab-btn")
      .forEach((btn) => btn.classList.remove("active"));
    document
      .querySelector(`.tab-btn[data-type="${type}"]`)
      .classList.add("active");
    document.getElementById("txType").value = type;

    const submitBtn = document.getElementById("submitBtn");
    const singleAcc = document.getElementById("singleAccountGroup");
    const transferAcc = document.getElementById("transferAccountGroup");
    const catGroup = document.getElementById("categoryGroup");

    if (type === "expense") {
      submitBtn.innerText = "支出を記録";
      submitBtn.style.background = "#ef4444";
      singleAcc.classList.remove("hidden");
      transferAcc.classList.add("hidden");
      catGroup.classList.remove("hidden");
      this.updateCategoryOptions("expense");
    } else if (type === "income") {
      submitBtn.innerText = "収入を記録";
      submitBtn.style.background = "#10b981";
      singleAcc.classList.remove("hidden");
      transferAcc.classList.add("hidden");
      catGroup.classList.remove("hidden");
      this.updateCategoryOptions("income");
    } else if (type === "transfer") {
      submitBtn.innerText = "振替を実行";
      submitBtn.style.background = "#8b5cf6";
      singleAcc.classList.add("hidden");
      transferAcc.classList.remove("hidden");
      catGroup.classList.add("hidden");
    }
  },

  updateCategoryOptions(type) {
    const select = document.getElementById("txCategory");
    select.innerHTML = "";
    this.categories[type].forEach((cat) => {
      const opt = document.createElement("option");
      opt.value = cat;
      opt.innerText = cat;
      select.appendChild(opt);
    });
  },

  async loadData() {
    try {
      const data = await KakeiboAPI.fetchDashboardData();
      this.currentAccounts = data.accounts || [];

      document.getElementById("totalAsset").innerText =
        "¥" + Number(data.totalAsset).toLocaleString();
      document.getElementById("updateTime").innerText =
        "同期: " +
        new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        });

      this.populateAccountSelects();
      this.renderAccountList(data.accounts);
      this.renderChart(data.accounts);
      this.renderExpenseChart(data.expenses || []);
    } catch (err) {
      this.showToast("データの取得に失敗しました", true);
    }
  },

  populateAccountSelects() {
    const opts = this.currentAccounts
      .map((a) => `<option value="${a.name}">${a.name}</option>`)
      .join("");
    document.getElementById("txAccount").innerHTML = opts;
    document.getElementById("txFromAccount").innerHTML = opts;
    document.getElementById("txToAccount").innerHTML = opts;
  },

  renderAccountList(accounts) {
    const container = document.getElementById("accountList");
    container.innerHTML = "";
    accounts.forEach((acc) => {
      const card = document.createElement("div");
      card.className = "account-card";
      card.innerHTML = `
        <div>
          <div class="account-name">${acc.name}</div>
          <div class="account-type">${acc.type}</div>
        </div>
        <div class="account-card-right">
          <div class="account-balance">¥${Number(acc.balance).toLocaleString()}</div>
          <button class="delete-btn" data-name="${acc.name}" title="削除">🗑</button>
        </div>
      `;

      card.querySelector(".delete-btn").addEventListener("click", (e) => {
        const name = e.currentTarget.dataset.name;
        this.handleDeleteAccount(name);
      });

      container.appendChild(card);
    });
  },

  // 口座追加ハンドラ
  async handleAddAccount(e) {
    e.preventDefault();
    const btn = document.getElementById("saveAccountBtn");
    btn.disabled = true;

    const payload = {
      name: document.getElementById("newAccountName").value.trim(),
      type: document.getElementById("newAccountType").value,
      balance: Number(document.getElementById("initialBalance").value),
    };

    try {
      const res = await KakeiboAPI.addAccount(payload);
      if (res.status === "success") {
        this.showToast("口座を追加しました!");
        document.getElementById("accountModal").classList.add("hidden");
        document.getElementById("addAccountForm").reset();
        await this.loadData();
      } else {
        this.showToast(res.message || "追加に失敗しました", true);
      }
    } catch (err) {
      this.showToast("送信エラーが発生しました", true);
    } finally {
      btn.disabled = false;
    }
  },

  // 口座削除ハンドラ
  async handleDeleteAccount(accountName) {
    if (
      !confirm(
        `「${accountName}」を削除してもよろしいですか？\n※残高データが消去されます。`
      )
    ) {
      return;
    }

    try {
      const res = await KakeiboAPI.deleteAccount(accountName);
      if (res.status === "success") {
        this.showToast("口座を削除しました");
        await this.loadData();
      } else {
        this.showToast(res.message || "削除に失敗しました", true);
      }
    } catch (err) {
      this.showToast("送信エラーが発生しました", true);
    }
  },

  // 資産ポートフォリオ描画
  renderChart(accounts) {
    const ctx = document.getElementById("assetChart").getContext("2d");
    if (this.chartInstance) this.chartInstance.destroy();

    this.chartInstance = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: accounts.map((a) => a.name),
        datasets: [
          {
            data: accounts.map((a) => a.balance),
            backgroundColor: [
              "#3b82f6",
              "#10b981",
              "#f59e0b",
              "#8b5cf6",
              "#ec4899",
              "#64748b",
            ],
            borderWidth: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "bottom",
            labels: { color: "#94a3b8", boxWidth: 12 },
          },
        },
        cutout: "70%",
      },
    });
  },

  // 支出カテゴリ別グラフ描画
  renderExpenseChart(expenses) {
    const canvas = document.getElementById("expenseChart");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    if (this.expenseChartInstance) this.expenseChartInstance.destroy();

    // 当月の支出データがない場合
    if (expenses.length === 0) {
      this.expenseChartInstance = new Chart(ctx, {
        type: "doughnut",
        data: {
          labels: ["データなし"],
          datasets: [
            {
              data: [1],
              backgroundColor: ["#334155"],
              borderWidth: 0,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: "bottom",
              labels: { color: "#94a3b8", boxWidth: 12 },
            },
            tooltip: { enabled: false },
          },
          cutout: "70%",
        },
      });
      return;
    }

    const categoryColors = [
      "#ef4444",
      "#f97316",
      "#f59e0b",
      "#eab308",
      "#84cc16",
      "#06b6d4",
      "#6366f1",
      "#a855f7",
    ];

    this.expenseChartInstance = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: expenses.map((e) => e.category),
        datasets: [
          {
            data: expenses.map((e) => e.amount),
            backgroundColor: categoryColors.slice(0, expenses.length),
            borderWidth: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "bottom",
            labels: { color: "#94a3b8", boxWidth: 12 },
          },
          tooltip: {
            callbacks: {
              label: function (context) {
                const value = context.raw || 0;
                return ` ${context.label}: ¥${value.toLocaleString()}`;
              },
            },
          },
        },
        cutout: "70%",
      },
    });
  },

  async handleFormSubmit(e) {
    e.preventDefault();
    const submitBtn = document.getElementById("submitBtn");
    submitBtn.disabled = true;

    const type = document.getElementById("txType").value;
    const payload = {
      type: type,
      date: document.getElementById("txDate").value,
      amount: Number(document.getElementById("txAmount").value),
      memo: document.getElementById("txMemo").value || "",
    };

    if (type === "transfer") {
      payload.fromAccount = document.getElementById("txFromAccount").value;
      payload.toAccount = document.getElementById("txToAccount").value;
      if (payload.fromAccount === payload.toAccount) {
        this.showToast("出金元と入金先が同じです", true);
        submitBtn.disabled = false;
        return;
      }
    } else {
      payload.account = document.getElementById("txAccount").value;
      payload.category = document.getElementById("txCategory").value;
    }

    try {
      const result = await KakeiboAPI.postTransaction(payload);
      if (result.status === "success") {
        this.showToast("反映しました！");
        document.getElementById("txAmount").value = "";
        document.getElementById("txMemo").value = "";
        await this.loadData();
      } else {
        this.showToast("エラーが発生しました", true);
      }
    } catch (err) {
      this.showToast("送信に失敗しました", true);
    } finally {
      submitBtn.disabled = false;
    }
  },

  showToast(msg, isError = false) {
    const toast = document.getElementById("toast");
    toast.innerText = msg;
    toast.className = "toast show" + (isError ? " error" : "");
    setTimeout(() => {
      toast.className = "toast";
    }, 3000);
  },
};