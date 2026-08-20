<script setup lang="ts">
import { ref } from 'vue';

const isMockMode = ref(true);
const network = ref<'preprod' | 'mainnet' | 'mock'>('mock');

const toggleMode = () => {
  if (network.value === 'mock') {
    network.value = 'preprod';
  } else if (network.value === 'preprod') {
    network.value = 'mainnet';
  } else {
    network.value = 'mock';
  }
};
</script>

<template>
  <div class="app">
    <header class="header">
      <h1>MCP Payment Gateway</h1>
      <div class="controls">
        <span class="mode-badge" :class="network">
          {{ network.toUpperCase() }}
        </span>
        <button @click="toggleMode" class="toggle-btn">
          Toggle Network
        </button>
      </div>
    </header>
    
    <nav class="nav">
      <router-link to="/dashboard">Operator Dashboard</router-link>
      <router-link to="/agent-flow">Agent Flow</router-link>
      <router-link to="/stats">Public Stats</router-link>
    </nav>

    <main class="main">
      <router-view />
    </main>
  </div>
</template>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: #f5f5f5;
  color: #333;
}

.app {
  min-height: 100vh;
}

.header {
  background: #1a1a2e;
  color: white;
  padding: 1rem 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header h1 {
  font-size: 1.5rem;
}

.controls {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.mode-badge {
  padding: 0.25rem 0.75rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: bold;
}

.mode-badge.mock {
  background: #f59e0b;
}

.mode-badge.preprod {
  background: #3b82f6;
}

.mode-badge.mainnet {
  background: #10b981;
}

.toggle-btn {
  padding: 0.5rem 1rem;
  background: #4b5563;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.toggle-btn:hover {
  background: #6b7280;
}

.nav {
  background: #16213e;
  padding: 0.5rem 2rem;
  display: flex;
  gap: 1rem;
}

.nav a {
  color: #9ca3af;
  text-decoration: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
}

.nav a:hover, .nav a.router-link-active {
  background: #1f2937;
  color: white;
}

.main {
  padding: 2rem;
  max-width: 1200px;
  margin: 0 auto;
}
</style>
