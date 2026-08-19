<template>
  <div class="settings-page">
    <header class="page-header">
      <h1>Pengaturan</h1>
      <p>Sesuaikan pengalaman aplikasi Anda.</p>
    </header>

    <section class="card">
      <div class="card-row">
        <div>
          <div class="row-title">Tema</div>
          <div class="row-subtitle">Pilih mode gelap atau terang.</div>
        </div>
        <button class="theme-toggle" aria-label="Ganti tema" @click="toggleTheme">
          <span class="material-symbols-outlined">{{ isDark ? 'dark_mode' : 'light_mode' }}</span>
        </button>
      </div>
    </section>

    <section class="card">
      <div class="card-row">
        <div>
          <div class="row-title">Hapus data lokal</div>
          <div class="row-subtitle">
            Bersihkan riwayat absen yang tersimpan di perangkat ini.
          </div>
        </div>
        <md-button class="md-accent" @click="clearData">Hapus</md-button>
      </div>
    </section>
  </div>
</template>

<script>
import { useAttendanceStore } from '../store/attendance';
import { useThemeStore, themeState } from '../store/theme';

const store = useAttendanceStore();
const themeStore = useThemeStore();

export default {
  name: 'PengaturanPage',
  computed: {
    isDark() {
      return themeState.isDark;
    }
  },
  methods: {
    toggleTheme() {
      themeStore.toggleTheme();
    },
    clearData() {
      if (confirm('Hapus seluruh data lokal?')) {
        store.clearAll();
      }
    }
  }
};
</script>

<style scoped>
.settings-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.page-header h1 {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
}

.page-header p {
  margin: 4px 0 0;
  color: var(--text-primary);
}

.card {
  background: var(--card-bg);
  color: var(--text-primary);
  border-radius: 16px;
  padding: 20px 16px;
  box-shadow: 0 8px 24px rgba(31, 26, 51, 0.05);
}

.card-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.row-title {
  font-weight: 600;
  font-size: 16px;
}

.row-subtitle {
  font-size: 14px;
  color: var(--text-secondary);
}

.theme-toggle {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: none;
  background: var(--cell-bg);
  color: var(--text-primary);
  cursor: pointer;
  transition: background 0.2s ease, transform 0.15s ease;
}

.theme-toggle:hover {
  transform: scale(1.1);
}

.theme-toggle:active {
  transform: scale(0.95);
}

.theme-toggle .material-symbols-outlined {
  font-size: 22px;
}
</style>
