import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { createRouter, createWebHistory } from 'vue-router';
import App from './App.vue';
import OperatorDashboard from './views/OperatorDashboard.vue';
import AgentFlowWalkthrough from './views/AgentFlowWalkthrough.vue';
import PublicStats from './views/PublicStats.vue';
import Staking from './views/Staking.vue';

const routes = [
  { path: '/', redirect: '/dashboard' },
  { path: '/dashboard', component: OperatorDashboard },
  { path: '/agent-flow', component: AgentFlowWalkthrough },
  { path: '/stats', component: PublicStats },
  { path: '/staking', component: Staking },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

const pinia = createPinia();
const app = createApp(App);

app.use(pinia);
app.use(router);
app.mount('#app');
