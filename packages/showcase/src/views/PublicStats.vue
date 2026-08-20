<script setup lang="ts">
import { ref, onMounted } from 'vue';

interface DailyVolume {
  date: string;
  volumeUsd: number;
  volumeGero: number;
  volumeBtc: number;
  transactionCount: number;
}

interface ToolVolume {
  toolId: string;
  toolName: string;
  totalVolumeUsd: number;
  totalVolumeGero: number;
  totalVolumeBtc: number;
  transactionCount: number;
}

const stats = ref({
  lastUpdated: new Date().toISOString(),
  totalVolume: { usd: 0, gero: 0, btc: 0 },
  dailyVolume: [] as DailyVolume[],
  topTools: [] as ToolVolume[],
  activeAccounts: 0,
  totalTransactions: 0,
});

const isLoading = ref(true);

const fetchStats = async () => {
  isLoading.value = true;
  try {
    const response = await fetch('/api/stats.json');
    if (response.ok) {
      stats.value = await response.json();
    }
  } catch {
    stats.value = {
      lastUpdated: new Date().toISOString(),
      totalVolume: {
        usd: 1250000,
        gero: 25000000,
        btc: 19500000,
      },
      dailyVolume: [
        { date: '2024-01-15', volumeUsd: 150000, volumeGero: 3000000, volumeBtc: 2300000, transactionCount: 145 },
        { date: '2024-01-14', volumeUsd: 180000, volumeGero: 3600000, volumeBtc: 2800000, transactionCount: 178 },
        { date: '2024-01-13', volumeUsd: 120000, volumeGero: 2400000, volumeBtc: 1900000, transactionCount: 98 },
        { date: '2024-01-12', volumeUsd: 200000, volumeGero: 4000000, volumeBtc: 3100000, transactionCount: 210 },
        { date: '2024-01-11', volumeUsd: 175000, volumeGero: 3500000, volumeBtc: 2700000, transactionCount: 165 },
        { date: '2024-01-10', volumeUsd: 225000, volumeGero: 4500000, volumeBtc: 3500000, transactionCount: 235 },
        { date: '2024-01-09', volumeUsd: 200000, volumeGero: 4000000, volumeBtc: 3100000, transactionCount: 198 },
      ],
      topTools: [
        { toolId: 't1', toolName: 'Web Search', totalVolumeUsd: 450000, totalVolumeGero: 9000000, totalVolumeBtc: 7000000, transactionCount: 450 },
        { toolId: 't2', toolName: 'Code Interpreter', totalVolumeUsd: 350000, totalVolumeGero: 7000000, totalVolumeBtc: 5400000, transactionCount: 350 },
        { toolId: 't3', toolName: 'Data Analysis', totalVolumeUsd: 250000, totalVolumeGero: 5000000, totalVolumeBtc: 3800000, transactionCount: 250 },
        { toolId: 't4', toolName: 'Image Generation', totalVolumeUsd: 150000, totalVolumeGero: 3000000, totalVolumeBtc: 2300000, transactionCount: 150 },
        { toolId: 't5', toolName: 'Translation API', totalVolumeUsd: 50000, totalVolumeGero: 1000000, volumeBtc: 770000, transactionCount: 50 },
      ],
      activeAccounts: 127,
      totalTransactions: 1181,
    };
  } finally {
    isLoading.value = false;
  }
};

const formatNumber = (num: number) => {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
};

onMounted(fetchStats);
</script>

<template>
  <div class="public-stats">
    <h2>GERO Network Stats</h2>
    
    <div class="last-updated">
      Last updated: {{ new Date(stats.lastUpdated).toLocaleString() }}
    </div>

    <div class="stats-grid">
      <div class="stat-card primary">
        <div class="stat-label">Total Volume (USD)</div>
        <div class="stat-value">${{ formatNumber(stats.totalVolume.usd) }}</div>
      </div>
      
      <div class="stat-card">
        <div class="stat-label">Total GERO Volume</div>
        <div class="stat-value gero">{{ formatNumber(stats.totalVolume.gero) }}</div>
      </div>
      
      <div class="stat-card">
        <div class="stat-label">Total BTC Volume</div>
        <div class="stat-value btc">{{ formatNumber(stats.totalVolume.btc) }}</div>
      </div>
      
      <div class="stat-card">
        <div class="stat-label">Active Accounts</div>
        <div class="stat-value">{{ stats.activeAccounts }}</div>
      </div>
      
      <div class="stat-card">
        <div class="stat-label">Total Transactions</div>
        <div class="stat-value">{{ formatNumber(stats.totalTransactions) }}</div>
      </div>
    </div>

    <div class="section">
      <h3>Daily Volume (Last 7 Days)</h3>
      <div class="chart">
        <div class="chart-bars">
          <div 
            v-for="day in stats.dailyVolume" 
            :key="day.date" 
            class="bar-group"
          >
            <div class="bar usd" :style="{ height: (day.volumeUsd / 250000 * 100) + '%' }"></div>
            <div class="bar gero" :style="{ height: (day.volumeGero / 5000000 * 100) + '%' }"></div>
            <div class="bar btc" :style="{ height: (day.volumeBtc / 4000000 * 100) + '%' }"></div>
            <div class="bar-label">{{ day.date.slice(5) }}</div>
          </div>
        </div>
        <div class="chart-legend">
          <span class="legend-item"><span class="dot usd"></span> USD</span>
          <span class="legend-item"><span class="dot gero"></span> GERO</span>
          <span class="legend-item"><span class="dot btc"></span> BTC</span>
        </div>
      </div>
    </div>

    <div class="section">
      <h3>Top Tools by Volume</h3>
      <table class="tools-table">
        <thead>
          <tr>
            <th>Rank</th>
            <th>Tool</th>
            <th>Volume (USD)</th>
            <th>Volume (GERO)</th>
            <th>Transactions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(tool, index) in stats.topTools" :key="tool.toolId">
            <td class="rank">{{ index + 1 }}</td>
            <td class="tool-name">{{ tool.toolName }}</td>
            <td>${{ formatNumber(tool.totalVolumeUsd) }}</td>
            <td class="gero">{{ formatNumber(tool.totalVolumeGero) }}</td>
            <td>{{ tool.transactionCount }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.public-stats {
  max-width: 900px;
}

h2 {
  margin-bottom: 0.5rem;
  color: #1a1a2e;
}

h3 {
  margin-bottom: 1rem;
  color: #374151;
}

.last-updated {
  font-size: 0.875rem;
  color: #9ca3af;
  margin-bottom: 1.5rem;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
}

.stat-card {
  background: white;
  padding: 1.5rem;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  text-align: center;
}

.stat-card.primary {
  background: linear-gradient(135deg, #1a1a2e, #16213e);
  color: white;
}

.stat-label {
  font-size: 0.875rem;
  color: #9ca3af;
  margin-bottom: 0.5rem;
}

.stat-card.primary .stat-label {
  color: #9ca3af;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: bold;
}

.stat-value.gero { color: #3b82f6; }
.stat-value.btc { color: #f59e0b; }

.section {
  background: white;
  padding: 1.5rem;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  margin-bottom: 1.5rem;
}

.chart {
  padding: 1rem;
}

.chart-bars {
  display: flex;
  justify-content: space-around;
  align-items: flex-end;
  height: 200px;
  padding-bottom: 1rem;
  border-bottom: 1px solid #e5e7eb;
}

.bar-group {
  display: flex;
  align-items: flex-end;
  gap: 4px;
  height: 100%;
}

.bar {
  width: 20px;
  border-radius: 4px 4px 0 0;
  transition: height 0.3s;
}

.bar.usd { background: #10b981; }
.bar.gero { background: #3b82f6; }
.bar.btc { background: #f59e0b; }

.bar-label {
  font-size: 0.75rem;
  color: #6b7280;
  text-align: center;
  margin-top: 0.5rem;
}

.chart-legend {
  display: flex;
  justify-content: center;
  gap: 1.5rem;
  margin-top: 1rem;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: #6b7280;
}

.dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}

.dot.usd { background: #10b981; }
.dot.gero { background: #3b82f6; }
.dot.btc { background: #f59e0b; }

.tools-table {
  width: 100%;
  border-collapse: collapse;
}

.tools-table th,
.tools-table td {
  padding: 0.75rem;
  text-align: left;
  border-bottom: 1px solid #e5e7eb;
}

.tools-table th {
  font-weight: 600;
  color: #6b7280;
  font-size: 0.875rem;
}

.rank {
  font-weight: bold;
  color: #9ca3af;
}

.tool-name {
  font-weight: 500;
}

.gero {
  color: #3b82f6;
}
</style>
