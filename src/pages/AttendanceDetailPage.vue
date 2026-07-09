<template>
  <div class="attendance-detail-page">
    <header class="detail-header">
      <md-button class="md-icon-button" aria-label="Kembali" @click="goBack">
        <span class="material-symbols-outlined" aria-hidden="true">arrow_back</span>
      </md-button>
      <div class="detail-title">
        <p class="detail-type">{{ typeLabel }}</p>
        <h1>Detail Absensi</h1>
        <p class="detail-date">{{ dateLabel }}</p>
        <p v-if="timeLabel" class="detail-time">{{ timeLabel }}</p>
      </div>
    </header>

    <section v-if="loading" class="detail-state" aria-live="polite">
      Memuat detail absensi...
    </section>
    <section v-else-if="error" class="detail-state" role="alert">
      <p>{{ error }}</p>
      <md-button class="md-primary" @click="reload">Coba lagi</md-button>
    </section>
    <section v-else-if="!record" class="detail-state">
      <p>Data absensi tidak ditemukan.</p>
      <md-button class="md-primary" @click="goBack">Kembali</md-button>
    </section>

    <section v-else class="detail-content">
      <div class="info-grid">
        <div class="info-block">
          <p class="info-label">Jenis</p>
          <p class="info-value">{{ typeLabel }}</p>
        </div>
        <div class="info-block">
          <p class="info-label">Tanggal</p>
          <p class="info-value">{{ dateLabel }}</p>
          <p class="info-sub">{{ timeLabel }}</p>
        </div>
        <div class="info-block">
          <p class="info-label">Lokasi</p>
          <p class="info-value">{{ locationLabel }}</p>
          <p v-if="coordLabel" class="info-sub">{{ coordLabel }}</p>
        </div>
        <div class="info-block">
          <p class="info-label">Catatan</p>
          <p class="info-value">
            {{ record.note || 'Tidak ada catatan' }}
          </p>
        </div>
      </div>

      <div class="photo-section">
        <p class="info-label">Foto Bukti</p>
        <div v-if="photoUrl" class="photo-frame">
          <img :src="photoUrl" alt="Foto bukti absensi" />
        </div>
        <div v-else class="photo-placeholder">
          Tidak ada foto yang dilampirkan.
        </div>
      </div>
    </section>
  </div>
</template>

<script>
import { API_BASE_URL } from '../config/api';
import { useAttendanceStore } from '../store/attendance';

const attendanceStore = useAttendanceStore();
const API_ORIGIN = new URL(API_BASE_URL).origin;
const dateFormatter = new Intl.DateTimeFormat('id-ID', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric'
});
const timeFormatter = new Intl.DateTimeFormat('id-ID', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit'
});

export default {
  name: 'AttendanceDetailPage',
  data() {
    return {
      loading: true,
      error: null
    };
  },
  computed: {
    recordId() {
      return this.$route.params.attendanceId;
    },
    record() {
      return attendanceStore.records.find(record => record.id === this.recordId) || null;
    },
    typeLabel() {
      const map = {
        checkin: 'Check-in',
        checkout: 'Check-out',
        lembur: 'Lembur',
        dinas_luar: 'Dinas Luar'
      };
      return map[this.record?.type] || 'Absensi';
    },
    dateLabel() {
      if (!this.record?.timestamp) {
        return 'Tanggal tidak tersedia';
      }
      try {
        return dateFormatter.format(new Date(this.record.timestamp));
      } catch {
        return 'Tanggal tidak tersedia';
      }
    },
    timeLabel() {
      if (!this.record?.timestamp) {
        return '';
      }
      try {
        return timeFormatter.format(new Date(this.record.timestamp));
      } catch {
        return '';
      }
    },
    coordLabel() {
      const coords = this.record?.coords;
      if (!coords || !Number.isFinite(coords.lat) || !Number.isFinite(coords.lng)) {
        return '';
      }
      return `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`;
    },
    locationLabel() {
      if (!this.record) {
        return 'Lokasi tidak tersedia';
      }
      const meta = this.record.meta || {};
      if (this.record.type === 'checkin' || this.record.type === 'dinas_luar') {
        return meta.check_in_location || this.record.locationName || 'Lokasi tidak tersedia';
      }
      if (this.record.type === 'checkout' || this.record.type === 'lembur') {
        return meta.check_out_location || this.record.locationName || 'Lokasi tidak tersedia';
      }
      return this.record.locationName || meta.location || 'Lokasi tidak tersedia';
    },
    photoUrl() {
      if (!this.record) {
        return null;
      }
      const meta = this.record.meta || {};
      let path = '';
      if (this.record.type === 'checkin' || this.record.type === 'dinas_luar') {
        path = meta.check_in_photo || '';
      } else if (this.record.type === 'checkout' || this.record.type === 'lembur') {
        path = meta.check_out_photo || '';
      }
      if (!path) {
        return null;
      }
      if (/^https?:\/\//i.test(path)) {
        return path;
      }
      const trimmed = path.replace(/^\/+/, '');
      const relativePath = trimmed.startsWith('storage/')
        ? `/${trimmed}`
        : `/storage/${trimmed}`;
      return `${API_ORIGIN}${relativePath}`;
    }
  },
  watch: {
    '$route.params.attendanceId': {
      immediate: true,
      handler() {
        this.reload();
      }
    }
  },
  methods: {
    async reload() {
      this.error = null;
      this.loading = true;
      try {
        if (!this.record) {
          await attendanceStore.refresh({ force: true });
        }
        if (!this.record) {
          this.error = 'Catatan absensi tidak ditemukan.';
        }
      } catch {
        this.error = 'Gagal memuat detail absensi.';
      } finally {
        this.loading = false;
      }
    },
    goBack() {
      if (window.history.length > 1) {
        this.$router.back();
      } else {
        this.$router.push({ name: 'Riwayat' });
      }
    }
  }
};
</script>

<style scoped>
.attendance-detail-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.detail-header {
  display: flex;
  align-items: center;
  gap: 16px;
  background: #fff;
  padding: 16px;
  border-radius: 16px;
  box-shadow: 0 8px 24px rgba(31, 26, 51, 0.08);
}

.detail-title h1 {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  color: var(--surface-color);
}

.detail-type {
  margin: 0 0 4px;
  font-size: 14px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--primary-color);
}

.detail-date,
.detail-time {
  margin: 0;
  color: var(--text-secondary);
}

.detail-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
  background: #fff;
  padding: 20px;
  border-radius: 20px;
  box-shadow: 0 16px 40px rgba(31, 26, 51, 0.08);
}

.detail-state {
  background: #fff;
  border-radius: 16px;
  padding: 24px;
  text-align: center;
  color: var(--text-secondary);
  box-shadow: 0 8px 24px rgba(31, 26, 51, 0.08);
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 12px;
}

.info-block {
  background: var(--md-theme-accent);
  border-radius: 12px;
  padding: 12px;
  border: 1px solid rgba(124, 77, 255, 0.12);
}

.info-label {
  text-transform: uppercase;
  font-size: 11px;
  letter-spacing: 0.08em;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.info-value {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.info-sub {
  font-size: 13px;
  color: var(--surface-color);
  margin: 2px 0 0;
}

.photo-section {
  margin-top: 8px;
}

.photo-frame {
  margin-top: 8px;
  border-radius: 16px;
  overflow: hidden;
  background: #000;
  min-height: 220px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.photo-frame img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.photo-placeholder {
  margin-top: 8px;
  padding: 32px 16px;
  border-radius: 16px;
  background: rgba(15, 5, 37, 0.04);
  text-align: center;
  color: var(--text-secondary);
  font-size: 14px;
}

@media (max-width: 600px) {
  .detail-header {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
