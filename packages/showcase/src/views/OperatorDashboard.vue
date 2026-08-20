<script setup lang="ts">
import { ref, onMounted } from 'vue';

interface Account {
  id: string;
  name: string;
  balance_usd: number;
  balance_gero: number;
  balance_btc: number;
}

const accounts = ref<Account[]>([]);
const selectedAccount = ref<Account | null>(null);
const fundAmount = ref(100);
const fundCurrency = ref<'USD' | 'GERO' | 'BTC'>('USD');
const isLoading = ref(false);

const fetchAccounts = async () => {
  try {
    const response = await fetch('/api/accounts');
    accounts.value = await response.json();
  } catch (error) {
    accounts.value = [
      { id: 'acc_1', name: 'Demo Agent', balance_usd: 10000, balance_gero: 500000, balance_btc: 10000 },
      { id: 'acc_2', name: 'Test Agent', balance_usd: 5000, balance_gero: 100000, balance_btc: 5000 },
    ];
  }
};

const fundAccount = async () => {
  if (!selectedAccount.value) return;
  
  isLoading.value = true;
  try {
    await fetch(`/api/accounts/${selectedAccount.value.id}/topup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: fundAmount.value,
        currency: fundCurrency.value,
      }),
    });
    await fetchAccounts();
  } finally {
    isLoading.value = false;
  }
};

onMounted(fetchAccounts);
</script>

<template>
  <div class="dashboard">
    <h2>Operator Dashboard</h2>
    
    <div class="section">
      <h3>Accounts</h3>
      <div class="accounts-list">
        <div 
          v-for="account in accounts" 
          :key="account.id"
          class="account-card"
          :class="{ selected: selectedAccount?.id === account.id }"
          @click="selectedAccount = account"
        >
          <h4>{{ account.name }}</h4>
          <div class="balances">
            <span class="balance usd">${{ (account.balance_usd / 100).toFixed(2) }}</span>
            <span class="balance gero">{{ (account.balance_gero / 1000000).toFixed(2) }} GERO</span>
            <span class="balance btc">{{ (account.balance_btc / 100000000).toFixed(8) }} BTC</span>
          </div>
        </div>
      </div>
    </div>

    <div class="section" v-if="selectedAccount">
      <h3>Fund Account</h3>
      <div class="fund-form">
        <div class="form-group">
          <label>Amount</label>
          <input v-model.number="fundAmount" type="number" min="1" />
        </div>
        <div class="form-group">
          <label>Currency</label>
          <select v-model="fundCurrency">
            <option value="USD">USD</option>
            <option value="GERO">GERO</option>
            <option value="BTC">BTC</option>
          </select>
        </div>
        <button @click="fundAccount" :disabled="isLoading" class="fund-btn">
          {{ isLoading ? 'Funding...' : 'Fund Account' }}
        </button>
      </div>
    </div>

    <div class="section">
      <h3>Recent Transactions</h3>
      <table class="tx-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Type</th>
            <th>Amount</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>2024-01-15</td>
            <td>Payment</td>
            <td>10 GERO</td>
            <td class="success">Settled</td>
          </tr>
          <tr>
            <td>2024-01-14</td>
            <td>Top-up</td>
            <td>$100 USD</td>
            <td class="success">Completed</td>
          </tr>
          <tr>
            <td>2024-01-14</td>
            <td>Payment</td>
            <td>0.001 BTC</td>
            <td class="pending">Pending</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.dashboard {
  max-width: 800px;
}

h2 {
  margin-bottom: 1.5rem;
  color: #1a1a2e;
}

h3 {
  margin-bottom: 1rem;
  color: #374151;
}

.section {
  background: white;
  padding: 1.5rem;
  border-radius: 8px;
  margin-bottom: 1.5rem;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.accounts-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 1rem;
}

.account-card {
  padding: 1rem;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.account-card:hover {
  border-color: #3b82f6;
}

.account-card.selected {
  border-color: #3b82f6;
  background: #eff6ff;
}

.account-card h4 {
  margin-bottom: 0.5rem;
}

.balances {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.875rem;
}

.balance.usd { color: #10b981; }
.balance.gero { color: #3b82f6; }
.balance.btc { color: #f59e0b; }

.fund-form {
  display: flex;
  gap: 1rem;
  align-items: flex-end;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.form-group label {
  font-size: 0.875rem;
  color: #6b7280;
}

.form-group input,
.form-group select {
  padding: 0.5rem;
  border: 1px solid #d1d5db;
  border-radius: 4px;
}

.fund-btn {
  padding: 0.5rem 1.5rem;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.fund-btn:disabled {
  background: #9ca3af;
  cursor: not-allowed;
}

.tx-table {
  width: 100%;
  border-collapse: collapse;
}

.tx-table th,
.tx-table td {
  padding: 0.75rem;
  text-align: left;
  border-bottom: 1px solid #e5e7eb;
}

.tx-table th {
  font-weight: 600;
  color: #6b7280;
  font-size: 0.875rem;
}

.success { color: #10b981; }
.pending { color: #f59e0b; }
</style>
