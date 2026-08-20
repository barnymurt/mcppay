<script setup lang="ts">
import { ref, computed } from 'vue';

const tierMode = ref<'demo' | 'production'>('demo');

const tierNames = ['Tier 0 (Base)', 'Tier 1', 'Tier 2', 'Tier 3 (Max)'];

const tierConfig = computed(() => {
  if (tierMode.value === 'demo') {
    return {
      tier1Usd: 0.04,
      tier2Usd: 0.40,
      tier3Usd: 4.00,
      feeDiscountBps: [0, 50, 150, 250],
      satchelDiscountBps: [0, 200, 400, 600],
      rateLimitMultiplier: [1, 10, 100, 1000],
    };
  }
  return {
    tier1Usd: 50,
    tier2Usd: 200,
    tier3Usd: 1000,
    feeDiscountBps: [0, 100, 250, 500],
    satchelDiscountBps: [0, 300, 600, 900],
    rateLimitMultiplier: [1, 10, 100, 1000],
  };
});

const currentTier = ref(0);
const geroStaked = ref(0);
const geroUsdRate = ref(0.05);
const accountId = ref('demo-account-123');

const stakedUsd = computed(() => geroStaked.value * geroUsdRate.value);

const nextTierThreshold = computed(() => {
  if (currentTier.value >= 3) return 0;
  if (currentTier.value === 0) return tierConfig.value.tier1Usd;
  if (currentTier.value === 1) return tierConfig.value.tier2Usd;
  return tierConfig.value.tier3Usd;
});

const usdToNextTier = computed(() => Math.max(0, nextTierThreshold.value - stakedUsd.value));

const progressPercent = computed(() => {
  if (currentTier.value >= 3) return 100;
  const prevThreshold = currentTier.value === 0 ? 0 :
                        currentTier.value === 1 ? tierConfig.value.tier1Usd :
                        tierConfig.value.tier2Usd;
  const range = nextTierThreshold.value - prevThreshold;
  const progress = stakedUsd.value - prevThreshold;
  return Math.min(100, Math.max(0, (progress / range) * 100));
});

const currentFeeDiscount = computed(() => tierConfig.value.feeDiscountBps[currentTier.value] / 100);
const currentSatchelDiscount = computed(() => tierConfig.value.satchelDiscountBps[currentTier.value] / 100);
const currentRateLimit = computed(() => tierConfig.value.rateLimitMultiplier[currentTier.value]);

const stakeAmount = ref(100);
const isStaking = ref(false);
const message = ref('');

const unstakeAmount = ref(100);
const isUnstaking = ref(false);
const unstakeMessage = ref('');
const unstakeAvailableAt = ref<string | null>(null);

const tierMessage = computed(() => {
  if (currentTier.value === 3) return 'You have max tier! Enjoy maximum fee discounts.';
  if (usdToNextTier.value > 0) return `Stake $${usdToNextTier.value.toFixed(2)} more USD equivalent to reach Tier ${currentTier.value + 1}`;
  return 'You qualify for the next tier!';
});

const handleStake = async () => {
  isStaking.value = true;
  message.value = '';

  await new Promise(resolve => setTimeout(resolve, 500));

  const newStaked = geroStaked.value + stakeAmount.value;
  const newStakedUsd = newStaked * geroUsdRate.value;

  let newTier = 0;
  if (newStakedUsd >= tierConfig.value.tier3Usd) newTier = 3;
  else if (newStakedUsd >= tierConfig.value.tier2Usd) newTier = 2;
  else if (newStakedUsd >= tierConfig.value.tier1Usd) newTier = 1;

  const oldTier = currentTier.value;
  geroStaked.value = newStaked;
  currentTier.value = newTier;

  message.value = newTier > oldTier
    ? `Successfully staked ${stakeAmount.value} GERO. Tier improved from ${oldTier} to ${newTier}!`
    : `Successfully staked ${stakeAmount.value} GERO.`;

  isStaking.value = false;
};

const handleUnstake = async () => {
  isUnstaking.value = true;
  unstakeMessage.value = '';

  await new Promise(resolve => setTimeout(resolve, 500));

  if (geroStaked.value < unstakeAmount.value) {
    unstakeMessage.value = 'Insufficient staked balance';
    isUnstaking.value = false;
    return;
  }

  const newStaked = geroStaked.value - unstakeAmount.value;
  const newStakedUsd = newStaked * geroUsdRate.value;

  let newTier = 0;
  if (newStakedUsd >= tierConfig.value.tier3Usd) newTier = 3;
  else if (newStakedUsd >= tierConfig.value.tier2Usd) newTier = 2;
  else if (newStakedUsd >= tierConfig.value.tier1Usd) newTier = 1;

  geroStaked.value = newStaked;
  currentTier.value = newTier;

  const availableAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  unstakeAvailableAt.value = availableAt.toISOString();

  unstakeMessage.value = `Unstake requested. ${unstakeAmount.value} GERO will be available at ${availableAt.toLocaleString()}`;

  isUnstaking.value = false;
};

const setTier = (tier: number) => {
  currentTier.value = tier;
  if (tierMode.value === 'demo') {
    if (tier === 0) geroStaked.value = 0;
    else if (tier === 1) geroStaked.value = 100;
    else if (tier === 2) geroStaked.value = 1000;
    else geroStaked.value = 10000;
  } else {
    if (tier === 0) geroStaked.value = 0;
    else if (tier === 1) geroStaked.value = Math.floor(50 / geroUsdRate.value);
    else if (tier === 2) geroStaked.value = Math.floor(200 / geroUsdRate.value);
    else geroStaked.value = Math.floor(1000 / geroUsdRate.value);
  }
};
</script>

<template>
  <div class="staking-view">
    <h2>GERO Staking</h2>

    <div class="tier-selector">
      <label>Tier Mode:</label>
      <select v-model="tierMode">
        <option value="demo">Demo (100/1k/10k GERO)</option>
        <option value="production">Production ($50/$200/$1000 USD)</option>
      </select>
      <span class="tier-hint">Switch to see different tier thresholds</span>
    </div>

    <div class="current-tier">
      <div class="tier-badge" :class="'tier-' + currentTier">
        {{ tierNames[currentTier] }}
      </div>
      <div class="staked-info">
        <div class="staked-amount">
          <span class="label">Staked:</span>
          <span class="value">{{ (geroStaked / 1000000).toFixed(2) }} GERO</span>
        </div>
        <div class="staked-usd">
          <span class="label">USD Equivalent:</span>
          <span class="value">${{ stakedUsd.toFixed(2) }}</span>
        </div>
      </div>
    </div>

    <div class="tier-selector-buttons">
      <span>Quick-set tier:</span>
      <button v-for="t in 4" :key="t-1" @click="setTier(t-1)" :class="{ active: currentTier === t-1 }">
        Tier {{ t-1 }}
      </button>
    </div>

    <div class="progress-section">
      <div class="progress-header">
        <span>Progress to next tier</span>
        <span>{{ progressPercent.toFixed(0) }}%</span>
      </div>
      <div class="progress-bar">
        <div class="progress-fill" :style="{ width: progressPercent + '%' }"></div>
      </div>
      <div class="next-tier-info" v-if="currentTier < 3">
        ${{ usdToNextTier.toFixed(2) }} more to reach {{ tierNames[currentTier + 1] }}
      </div>
      <div class="next-tier-info max" v-else>
        Maximum tier achieved!
      </div>
    </div>

    <div class="message" v-if="message">{{ message }}</div>

    <div class="actions">
      <div class="action-card stake">
        <h3>Stake GERO</h3>
        <div class="input-group">
          <input type="number" v-model="stakeAmount" min="1" />
          <span class="unit">GERO</span>
        </div>
        <button @click="handleStake" :disabled="isStaking" class="stake-btn">
          {{ isStaking ? 'Staking...' : 'Stake' }}
        </button>
        <p class="action-hint">Move GERO from liquid to staked balance</p>
      </div>

      <div class="action-card unstake">
        <h3>Request Unstake</h3>
        <div class="input-group">
          <input type="number" v-model="unstakeAmount" min="1" />
          <span class="unit">GERO</span>
        </div>
        <button @click="handleUnstake" :disabled="isUnstaking" class="unstake-btn">
          {{ isUnstaking ? 'Requesting...' : 'Request Unstake' }}
        </button>
        <p class="action-hint">24-hour lockup before tokens become liquid</p>
      </div>
    </div>

    <div class="unstake-notice" v-if="unstakeMessage">
      {{ unstakeMessage }}
    </div>

    <div class="benefits">
      <h3>Your Tier Benefits</h3>
      <div class="benefit-grid">
        <div class="benefit">
          <span class="benefit-label">MCP Fee Discount</span>
          <span class="benefit-value">{{ currentFeeDiscount }}%</span>
        </div>
        <div class="benefit">
          <span class="benefit-label">Satchel Fee Discount</span>
          <span class="benefit-value">{{ currentSatchelDiscount }}%</span>
        </div>
        <div class="benefit">
          <span class="benefit-label">Rate Limit Multiplier</span>
          <span class="benefit-value">{{ currentRateLimit }}x</span>
        </div>
        <div class="benefit">
          <span class="benefit-label">Fiat Off-Ramp</span>
          <span class="benefit-value">{{ currentTier >= 1 ? '✓ Enabled' : '✗ Locked' }}</span>
        </div>
      </div>
    </div>

    <div class="tier-message">
      {{ tierMessage }}
    </div>

    <div class="explanation">
      <h3>How Staking Works</h3>
      <ol>
        <li><strong>Stake GERO</strong> - Lock GERO tokens to activate tier benefits</li>
        <li><strong>Earn discounts</strong> - Tier 1+ users get reduced MCP fees and Satchel bank fees</li>
        <li><strong>Unlock access</strong> - Tier 1+ enables fiat off-ramp via Satchel Bank</li>
        <li><strong>Request unstake</strong> - 24-hour lockup period before tokens return to liquid balance</li>
      </ol>
    </div>
  </div>
</template>

<style scoped>
.staking-view {
  max-width: 800px;
}

h2 {
  margin-bottom: 1rem;
  color: #1a1a2e;
}

h3 {
  margin-bottom: 0.75rem;
  color: #374151;
}

.tier-selector {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
}

.tier-selector select {
  padding: 0.5rem;
  border: 1px solid #d1d5db;
  border-radius: 4px;
}

.tier-hint {
  color: #9ca3af;
  font-size: 0.875rem;
}

.current-tier {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  padding: 1.5rem;
  background: white;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  margin-bottom: 1rem;
}

.tier-badge {
  padding: 0.5rem 1rem;
  border-radius: 8px;
  font-weight: bold;
  font-size: 1.25rem;
}

.tier-badge.tier-0 { background: #e5e7eb; color: #374151; }
.tier-badge.tier-1 { background: #d1fae5; color: #065f46; }
.tier-badge.tier-2 { background: #dbeafe; color: #1e40af; }
.tier-badge.tier-3 { background: #fef3c7; color: #92400e; }

.staked-info {
  flex: 1;
}

.staked-amount, .staked-usd {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.25rem;
}

.staked-amount .label, .staked-usd .label {
  color: #6b7280;
}

.staked-amount .value, .staked-usd .value {
  font-weight: 600;
}

.tier-selector-buttons {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
}

.tier-selector-buttons span {
  color: #6b7280;
}

.tier-selector-buttons button {
  padding: 0.25rem 0.75rem;
  border: 1px solid #d1d5db;
  background: white;
  border-radius: 4px;
  cursor: pointer;
}

.tier-selector-buttons button.active {
  background: #3b82f6;
  color: white;
  border-color: #3b82f6;
}

.progress-section {
  padding: 1.5rem;
  background: white;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  margin-bottom: 1.5rem;
}

.progress-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.5rem;
  font-size: 0.875rem;
  color: #6b7280;
}

.progress-bar {
  height: 12px;
  background: #e5e7eb;
  border-radius: 6px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #3b82f6, #10b981);
  transition: width 0.3s ease;
}

.next-tier-info {
  margin-top: 0.5rem;
  font-size: 0.875rem;
  color: #6b7280;
  text-align: center;
}

.next-tier-info.max {
  color: #10b981;
  font-weight: 600;
}

.message {
  padding: 0.75rem;
  background: #d1fae5;
  color: #065f46;
  border-radius: 4px;
  margin-bottom: 1rem;
}

.actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin-bottom: 1rem;
}

.action-card {
  padding: 1.5rem;
  background: white;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.input-group {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.input-group input {
  flex: 1;
  padding: 0.5rem;
  border: 1px solid #d1d5db;
  border-radius: 4px;
}

.input-group .unit {
  display: flex;
  align-items: center;
  color: #6b7280;
}

.stake-btn, .unstake-btn {
  width: 100%;
  padding: 0.75rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 600;
}

.stake-btn {
  background: #10b981;
  color: white;
}

.stake-btn:disabled {
  background: #9ca3af;
}

.unstake-btn {
  background: #f59e0b;
  color: white;
}

.unstake-btn:disabled {
  background: #9ca3af;
}

.action-hint {
  margin-top: 0.75rem;
  font-size: 0.75rem;
  color: #9ca3af;
}

.unstake-notice {
  padding: 0.75rem;
  background: #fef3c7;
  color: #92400e;
  border-radius: 4px;
  margin-bottom: 1.5rem;
}

.benefits {
  padding: 1.5rem;
  background: white;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  margin-bottom: 1.5rem;
}

.benefit-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.benefit {
  display: flex;
  justify-content: space-between;
  padding: 0.75rem;
  background: #f9fafb;
  border-radius: 4px;
}

.benefit-label {
  color: #6b7280;
}

.benefit-value {
  font-weight: 600;
}

.tier-message {
  padding: 1rem;
  background: #eff6ff;
  color: #1e40af;
  border-radius: 4px;
  text-align: center;
  margin-bottom: 1.5rem;
}

.explanation {
  padding: 1.5rem;
  background: #f9fafb;
  border-radius: 8px;
}

.explanation ol {
  margin-left: 1.5rem;
}

.explanation li {
  margin-bottom: 0.5rem;
  color: #374151;
}
</style>
