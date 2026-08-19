<template>
  <div class="login-page">
    <div class="login-card" role="form" aria-label="Form login karyawan">
      <div class="card-header">
        <div class="logo">
          <span class="material-symbols-outlined" aria-hidden="true">badge</span>
        </div>
        <h1>Login</h1>
        <p>Gunakan akun Akun Anda untuk login</p>
      </div>

      <md-progress-bar v-if="loading" class="loading-bar" md-mode="indeterminate" />

      <form @submit.prevent="handleSubmit" novalidate>
        <md-field :class="{ 'md-invalid': fieldErrors.username }">
          <label for="login-username">Username / Email</label>
          <md-input
            id="login-username"
            v-model.trim="form.username"
            :disabled="loading"
            autocomplete="username"
            required
          />
          <span v-if="fieldErrors.username" class="md-error">{{ fieldErrors.username }}</span>
        </md-field>

        <md-field :class="{ 'md-invalid': fieldErrors.password }">
          <label for="login-password">Password</label>
          <md-input
            :type="showPassword ? 'text' : 'password'"
            id="login-password"
            v-model="form.password"
            :disabled="loading"
            autocomplete="current-password"
            required
          />
          <span v-if="fieldErrors.password" class="md-error">{{ fieldErrors.password }}</span>
          <button
            type="button"
            class="toggle-password"
            :aria-label="showPassword ? 'Sembunyikan password' : 'Tampilkan password'"
            @click="togglePassword"
          >
            <span class="material-symbols-outlined" aria-hidden="true">
              {{ showPassword ? 'visibility_off' : 'visibility' }}
            </span>
          </button>
        </md-field>

        <p v-if="generalError" class="error-message" role="alert">{{ generalError }}</p>

        <md-button
          type="submit"
          class="md-raised md-primary submit-button"
          :disabled="loading"
        >
          {{ loading ? 'Memproses...' : 'Login' }}
        </md-button>
      </form>

      <div class="server-info">
        <span class="material-symbols-outlined" aria-hidden="true">cloud_done</span>
        <span>Terhubung ke {{ apiBaseLabel }}</span>
      </div>
    </div>
  </div>
</template>

<script>
import { useAuthStore } from '../store/auth';
import { API_BASE_URL } from '../config/api';

const authStore = useAuthStore();

export default {
  name: 'LoginPage',
  data() {
    return {
      form: {
        username: '',
        password: ''
      },
      showPassword: false,
      fieldErrors: {},
      generalError: null
    };
  },
  computed: {
    loading() {
      return authStore.loading;
    },
    apiBaseLabel() {
      try {
        const url = new URL(API_BASE_URL);
        return url.hostname;
      } catch (error) {
        return API_BASE_URL;
      }
    }
  },
  methods: {
    togglePassword() {
      this.showPassword = !this.showPassword;
    },
    resetErrors() {
      this.fieldErrors = {};
      this.generalError = null;
    },
    resolveFieldErrors(payloadErrors) {
      if (!payloadErrors || typeof payloadErrors !== 'object') {
        return;
      }
      const next = {};
      Object.entries(payloadErrors).forEach(([field, messages]) => {
        if (Array.isArray(messages) && messages.length) {
          next[field] = messages[0];
        }
      });
      this.fieldErrors = next;
    },
    async handleSubmit() {
      this.resetErrors();
      const { username, password } = this.form;

      if (!username || !password) {
        this.generalError = 'Isi username dan password untuk melanjutkan.';
        if (!username) {
          this.fieldErrors.username = 'Username wajib diisi.';
        }
        if (!password) {
          this.fieldErrors.password = 'Password wajib diisi.';
        }
        return;
      }

      try {
        await authStore.login({ username, password });
        const redirect = this.$route.query.redirect || '/';
        this.$router.replace(redirect);
      } catch (error) {
        this.generalError = error?.payload?.message || error?.message || 'Login gagal.';
        this.resolveFieldErrors(error?.payload?.errors);
      }
    }
  }
};
</script>

<style scoped>
.login-page {
  display: grid;
  min-height: 100vh;
  place-items: center;
  background: linear-gradient(180deg, rgba(124, 77, 255, 0.1), rgba(124, 77, 255, 0));
  padding: 32px 16px;
}

.login-card {
  width: min(420px, 100%);
  background: var(--card-bg);
  border-radius: 24px;
  padding: 32px 28px;
  box-shadow: 0 24px 60px rgba(31, 26, 51, 0.12);
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.card-header {
  display: flex;
  flex-direction: column;
  gap: 12px;
  text-align: center;
}

.card-header h1 {
  font-size: 28px;
  margin: 0;
  font-weight: 700;
  color: var(--text-secondary);
}

.card-header p {
  margin: 0;
  color: var(--text-secondary);
  font-size: 15px;
}

.logo {
  width: 64px;
  height: 64px;
  margin: 0 auto;
  border-radius: 20px;
  background: rgba(124, 77, 255, 0.12);
  color: var(--primary-color);
  display: grid;
  place-items: center;
  font-size: 28px;
}

.loading-bar {
  border-radius: 999px;
}

form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

form .md-field {
  position: relative;
  background: white;
  border-bottom: 1px solid var(--md-theme-primary);
  color: var(--md-theme-accent);
}

.toggle-password {
  position: absolute;
  top: 50%;
  right: 8px;
  transform: translateY(-50%);
  border: none;
  background: transparent;
  color: var(--text-secondary);
  padding: 6px;
  cursor: pointer;
}

.toggle-password .material-symbols-outlined {
  font-size: 22px;
}

.error-message {
  margin: 4px 0 0;
  color: #d32f2f;
  font-size: 14px;
}

.submit-button {
  min-height: 44px;
  font-weight: 600;
  border-radius: 14px;
}

.server-info {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text-secondary);
}

.server-info .material-symbols-outlined {
  font-size: 18px;
}

@media (max-width: 480px) {
  .login-card {
    padding: 24px 20px;
    border-radius: 20px;
  }
}
</style>
