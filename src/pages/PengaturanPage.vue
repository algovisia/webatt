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
          <div class="row-subtitle">Mode gelap akan segera hadir.</div>
        </div>
        <md-switch
          aria-label="Ganti tema"
          :value="false"
          @change="notifyComingSoon"
        />
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

const store = useAttendanceStore();

export default {
  name: 'PengaturanPage',
  methods: {
    notifyComingSoon() {
      alert('Mode gelap akan tersedia segera.');
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
  background: #fff;
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
</style>
