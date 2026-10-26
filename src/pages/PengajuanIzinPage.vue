<template>
  <div class="izin-page">
    <header class="page-header">
      <h1>Pengajuan Izin</h1>
      <p>Isi form dan lampirkan foto bukti.</p>
    </header>

    <form class="card" @submit.prevent="submit">
      <label class="field">
        <span>Jenis Izin</span>
        <select v-model="idJenisIzin" required>
          <option value="" disabled>Pilih jenis izin</option>
          <option v-for="j in jenisIzin" :key="j.id_jenis_izin" :value="j.id_jenis_izin">
            {{ j.nama_jenis_izin }}
          </option>
        </select>
      </label>

      <label class="field">
        <span>Tanggal Mulai</span>
        <input v-model="tanggalMulai" type="date" required />
      </label>

      <label class="field">
        <span>Tanggal Selesai (opsional)</span>
        <input v-model="tanggalSelesai" type="date" :min="tanggalMulai" />
      </label>

      <label class="field">
        <span>Keterangan</span>
        <textarea v-model="keterangan" rows="3" maxlength="1000" required></textarea>
      </label>

      <label class="field">
        <span>Foto Bukti</span>
        <input type="file" accept="image/*" required @change="onFile" />
      </label>

      <md-button class="md-raised md-primary" type="submit" :disabled="submitting || compressing">
        {{ compressing ? 'Mengompres foto...' : submitting ? 'Mengirim...' : 'Kirim Pengajuan' }}
      </md-button>
    </form>
  </div>
</template>

<script>
import { apiRequest, ApiError } from '../utils/apiClient';
import { useAuthStore } from '../store/auth';
import { useAttendanceStore } from '../store/attendance';

const auth = useAuthStore();
const store = useAttendanceStore();

const MAX_FOTO_BYTES = 200 * 1024;

// Resize + lower JPEG quality until the file is <= maxBytes.
async function compressImage(file, maxBytes) {
  const bitmap = await createImageBitmap(file);
  let scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
  for (;;) {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    for (let quality = 0.8; quality >= 0.4; quality -= 0.1) {
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
      if (blob && blob.size <= maxBytes) {
        return new File([blob], `izin-${Date.now()}.jpg`, { type: 'image/jpeg' });
      }
    }
    scale *= 0.75;
    if (canvas.width < 200) throw new Error('Tidak dapat mengompres foto');
  }
}

export default {
  name: 'PengajuanIzinPage',
  data() {
    return {
      jenisIzin: [],
      idJenisIzin: '',
      tanggalMulai: '',
      tanggalSelesai: '',
      keterangan: '',
      foto: null,
      submitting: false,
      compressing: false
    };
  },
  async created() {
    try {
      const payload = await apiRequest('/v1/jenis-izin');
      this.jenisIzin = payload?.data ?? [];
    } catch (error) {
      store.pushMessage('Gagal memuat jenis izin.');
    }
  },
  methods: {
    async onFile(event) {
      const file = event.target.files[0] || null;
      this.foto = null;
      if (!file) return;
      this.compressing = true;
      try {
        this.foto = await compressImage(file, MAX_FOTO_BYTES);
      } catch (error) {
        store.pushMessage('Foto tidak dapat diproses. Pilih file gambar lain.');
        event.target.value = '';
      } finally {
        this.compressing = false;
      }
    },
    async submit() {
      if (!this.foto) {
        store.pushMessage('Foto bukti wajib diisi.');
        return;
      }
      const data = new FormData();
      data.append('id_jenis_izin', this.idJenisIzin);
      data.append('tanggal_mulai', this.tanggalMulai);
      if (this.tanggalSelesai) data.append('tanggal_selesai', this.tanggalSelesai);
      data.append('keterangan', this.keterangan);
      data.append('foto_izin', this.foto);

      this.submitting = true;
      try {
        await apiRequest('/v1/attendance/izin', { method: 'POST', data, token: auth.token });
        store.pushMessage('Pengajuan izin berhasil.');
        store.refresh({ force: true }).catch(() => {});
        this.$router.push('/');
      } catch (error) {
        store.pushMessage(error instanceof ApiError ? error.message : 'Gagal mengirim pengajuan izin.');
      } finally {
        this.submitting = false;
      }
    }
  }
};
</script>

<style scoped>
.izin-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.card {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 16px;
  border-radius: 16px;
  background: var(--card-bg);
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-weight: 600;
  color: var(--text-primary);
}

.field input,
.field select,
.field textarea {
  padding: 10px 12px;
  border: 1px solid rgba(128, 128, 128, 0.4);
  border-radius: 10px;
  background: transparent;
  color: var(--text-primary);
  font: inherit;
}
</style>
