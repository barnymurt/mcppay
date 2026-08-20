<script setup lang="ts">
import { ref, computed } from 'vue';

type Step = 'idle' | 'quote' | 'payment' | 'settlement' | 'complete';

const currentStep = ref<Step>('idle');
const selectedCurrency = ref<'GERO' | 'BTC'>('GERO');
const toolPrice = ref(1);
const agentBalance = ref(1000000);
const providerBalance = ref(0);
const txHash = ref('');
const isAnimating = ref(false);

const stepLabels: Record<Step, string> = {
  idle: 'Ready',
  quote: 'Getting Quote',
  payment: 'Processing Payment',
  settlement: 'Settling',
  complete: 'Complete',
};

const progressPercent = computed(() => {
  const steps: Step[] = ['idle', 'quote', 'payment', 'settlement', 'complete'];
  return (steps.indexOf(currentStep.value) / (steps.length - 1)) * 100;
});

const startFlow = async () => {
  isAnimating.value = true;
  
  currentStep.value = 'quote';
  await sleep(1000);
  
  currentStep.value = 'payment';
  await sleep(1500);
  
  currentStep.value = 'settlement';
  await sleep(1000);
  
  txHash.value = selectedCurrency.value === 'GERO' 
    ? `tx_${Date.now()}_gero`
    : `tx_${Date.now()}_btc`;
  
  const amount = selectedCurrency.value === 'GERO' 
    ? toolPrice.value * 1000000
    : Math.floor(toolPrice.value * 65000 * 100000000);
  
  agentBalance.value -= amount;
  providerBalance.value += amount;
  
  currentStep.value = 'complete';
  isAnimating.value = false;
};

const reset = () => {
  currentStep.value = 'idle';
  agentBalance.value = 1000000;
  providerBalance.value = 0;
  txHash.value = '';
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const formatGero = (val: number) => (val / 1000000).toFixed(2);
const formatBtc = (val: number) => (val / 100000000).toFixed(8);
</script>

<template>
  <div class="flow-walkthrough">
    <h2>Agent Payment Flow</h2>
    
    <div class="controls">
      <div class="currency-selector">
        <label>Pay with:</label>
        <select v-model="selectedCurrency" :disabled="isAnimating">
          <option value="GERO">GERO</option>
          <option value="BTC">BTC</option>
        </select>
      </div>
      <button @click="startFlow" :disabled="isAnimating" class="start-btn">
        {{ isAnimating ? 'Processing...' : 'Start Payment' }}
      </button>
      <button @click="reset" class="reset-btn">Reset</button>
    </div>

    <div class="progress-bar">
      <div class="progress-fill" :style="{ width: progressPercent + '%' }"></div>
    </div>
    <div class="step-indicator">
      <span v-for="step in (['idle', 'quote', 'payment', 'settlement', 'complete'] as Step[])" 
            :key="step"
            :class="{ active: currentStep === step }">
        {{ stepLabels[step] }}
      </span>
    </div>

    <div class="flow-diagram">
      <div class="node agent" :class="{ highlight: currentStep !== 'idle' }">
        <div class="node-icon">🤖</div>
        <div class="node-label">AI Agent</div>
        <div class="node-balance">
          {{ selectedCurrency === 'GERO' ? formatGero(agentBalance) : formatBtc(agentBalance) }} 
          {{ selectedCurrency }}
        </div>
      </div>

      <div class="arrow" :class="{ animate: currentStep === 'payment' }">
        <span class="arrow-line"></span>
        <span class="arrow-label">pay</span>
      </div>

      <div class="node mcp" :class="{ highlight: currentStep === 'quote' || currentStep === 'payment' }">
        <div class="node-icon">⚡</div>
        <div class="node-label">MCP Gateway</div>
        <div class="node-detail">0.5% fee</div>
      </div>

      <div class="arrow" :class="{ animate: currentStep === 'settlement' }">
        <span class="arrow-line"></span>
        <span class="arrow-label">settle</span>
      </div>

      <div class="node provider" :class="{ highlight: currentStep === 'settlement' || currentStep === 'complete' }">
        <div class="node-icon">🛠️</div>
        <div class="node-label">Tool Provider</div>
        <div class="node-balance">
          {{ selectedCurrency === 'GERO' ? formatGero(providerBalance) : formatBtc(providerBalance) }}
          {{ selectedCurrency }}
        </div>
      </div>
    </div>

    <div class="transaction-details" v-if="txHash">
      <h3>Transaction Details</h3>
      <div class="detail-row">
        <span class="detail-label">Transaction Hash:</span>
        <span class="detail-value mono">{{ txHash }}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Amount:</span>
        <span class="detail-value">{{ toolPrice }} {{ selectedCurrency }}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Fee (0.5%):</span>
        <span class="detail-value">
          {{ selectedCurrency === 'GERO' ? (toolPrice * 0.005).toFixed(2) : (toolPrice * 0.005).toFixed(6) }}
          {{ selectedCurrency }}
        </span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Status:</span>
        <span class="detail-value success">Confirmed</span>
      </div>
    </div>

    <div class="explanation">
      <h3>How It Works</h3>
      <ol>
        <li><strong>Agent requests quote</strong> - MCP calculates price in selected currency</li>
        <li><strong>Payment processing</strong> - GERO/BTC deducted from agent balance</li>
        <li><strong>Settlement</strong> - MCP collects 0.5% fee, sends rest to provider</li>
        <li><strong>Confirmation</strong> - Transaction recorded on blockchain</li>
      </ol>
    </div>
  </div>
</template>

<style scoped>
.flow-walkthrough {
  max-width: 900px;
}

h2 {
  margin-bottom: 1rem;
  color: #1a1a2e;
}

h3 {
  margin: 1rem 0 0.5rem;
  color: #374151;
}

.controls {
  display: flex;
  gap: 1rem;
  align-items: center;
  margin-bottom: 1.5rem;
}

.currency-selector {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.currency-selector select {
  padding: 0.5rem;
  border: 1px solid #d1d5db;
  border-radius: 4px;
}

.start-btn {
  padding: 0.5rem 1.5rem;
  background: #10b981;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.start-btn:disabled {
  background: #9ca3af;
  cursor: not-allowed;
}

.reset-btn {
  padding: 0.5rem 1rem;
  background: #6b7280;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.progress-bar {
  height: 8px;
  background: #e5e7eb;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 0.5rem;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #3b82f6, #10b981);
  transition: width 0.3s ease;
}

.step-indicator {
  display: flex;
  justify-content: space-between;
  margin-bottom: 2rem;
  font-size: 0.75rem;
  color: #9ca3af;
}

.step-indicator span.active {
  color: #3b82f6;
  font-weight: bold;
}

.flow-diagram {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 2rem;
  background: white;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  margin-bottom: 1.5rem;
}

.node {
  text-align: center;
  padding: 1rem;
  border-radius: 8px;
  transition: all 0.3s;
}

.node.highlight {
  background: #eff6ff;
  transform: scale(1.05);
}

.node-icon {
  font-size: 2rem;
  margin-bottom: 0.5rem;
}

.node-label {
  font-weight: 600;
  margin-bottom: 0.25rem;
}

.node-balance {
  font-size: 0.875rem;
  color: #6b7280;
}

.node-detail {
  font-size: 0.75rem;
  color: #9ca3af;
}

.arrow {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
  padding: 0 1rem;
}

.arrow-line {
  width: 100%;
  height: 2px;
  background: #d1d5db;
  position: relative;
}

.arrow-line::after {
  content: '▶';
  position: absolute;
  right: 0;
  top: -0.5rem;
  color: #d1d5db;
}

.arrow.animate .arrow-line {
  background: #3b82f6;
  animation: flow 0.5s ease infinite;
}

.arrow.animate .arrow-line::after {
  color: #3b82f6;
}

@keyframes flow {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
}

.arrow-label {
  font-size: 0.75rem;
  color: #9ca3af;
  margin-top: 0.5rem;
}

.transaction-details {
  background: white;
  padding: 1.5rem;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  margin-bottom: 1.5rem;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  padding: 0.5rem 0;
  border-bottom: 1px solid #e5e7eb;
}

.detail-row:last-child {
  border-bottom: none;
}

.detail-label {
  color: #6b7280;
}

.detail-value.mono {
  font-family: monospace;
  color: #3b82f6;
}

.success { color: #10b981; }

.explanation {
  background: #f9fafb;
  padding: 1.5rem;
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
