import Vue from 'vue';
import VueMaterial from 'vue-material';
import { registerSW } from 'virtual:pwa-register';
import App from './App.vue';
import router from './router';

import 'vue-material/dist/vue-material.min.css';
import './styles/theme.css';

Vue.use(VueMaterial);

if (typeof window !== 'undefined') {
  registerSW({
    immediate: true,
    onRegistered(registration) {
      if (registration) {
        console.debug('Service worker registered', registration);
      }
    },
    onRegisterError(error) {
      console.error('Service worker registration failed', error);
    }
  });
}

new Vue({
  router,
  render: h => h(App)
}).$mount('#app');
