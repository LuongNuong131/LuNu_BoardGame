import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router';

// Global Styles
import './assets/main.css';

const app = createApp(App);
const pinia = createPinia();

// Thứ tự cực kỳ quan trọng: Khởi tạo Pinia -> Kích hoạt Router -> Mount App
app.use(pinia);
app.use(router);

app.mount('#app');