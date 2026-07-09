<template>
  <div class="home-page">
    <div class="type-row" role="group" aria-label="Jenis absen dan waktu">
      <md-menu md-direction="bottom-start">
        <md-button
          class="md-raised type-button"
          md-menu-trigger
          aria-label="Pilih jenis absen"
        >
          <span>{{ selectedTypeLabel }}</span>
          <span class="material-symbols-outlined" aria-hidden="true">
            expand_more
          </span>
        </md-button>
        <md-menu-content>
          <md-menu-item
            v-for="option in typeOptions"
            :key="option.value"
            @click="setType(option.value)"
          >
            {{ option.label }}
          </md-menu-item>
        </md-menu-content>
      </md-menu>
      <span class="time-chip" aria-live="polite">{{ timeLabel }}</span>
    </div>

    <primary-cta-card
      :type-label="selectedTypeLabel"
      @cta-click="openDialog"
    />

    <button class="section-header" @click="goTo('/riwayat')">
      <span>Riwayat Absen</span>
      <span class="material-symbols-outlined" aria-hidden="true">arrow_forward</span>
    </button>

    <attendance-list
      :records="records"
      @view-details="viewDetails"
      @delete-record="deleteRecord"
    />

    <confirm-checkin-dialog
      v-model="dialogActive"
      :current-time="currentTime"
      :location="dialogLocation"
      :location-coords="dialogCoords"
      :type-label="selectedTypeLabel"
      @confirm="confirmCheckin"
      @cancel="resetDialog"
    />
  </div>
</template>

<script>
import PrimaryCtaCard from '../components/PrimaryCtaCard.vue';
import AttendanceList from '../components/AttendanceList.vue';
import ConfirmCheckinDialog from '../components/ConfirmCheckinDialog.vue';
import { useAttendanceStore } from '../store/attendance';
import { useGeofenceStore } from '../store/geofence';
import { useAuthStore } from '../store/auth';
import { ApiError } from '../utils/apiClient';
import { GEOFENCE_CENTER, GEOFENCE_RADIUS_METERS } from '../config/geofence';
import { distanceInMeters } from '../utils/geo';

const store = useAttendanceStore();
const geofenceStore = useGeofenceStore();
const authStore = useAuthStore();

export default {
  name: 'HomeAbsen',
  components: {
    PrimaryCtaCard,
    AttendanceList,
    ConfirmCheckinDialog
  },
  props: {
    currentTime: {
      type: Date,
      required: true
    },
    offline: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      dialogActive: false,
      dialogLocation: null,
      dialogCoords: null,
      selectedType: 'checkin',
      geofenceErrorNotified: false,
      isSubmitting: false,
      reauthenticating: false
    };
  },
  computed: {
    geofenceLocations() {
      const locations = geofenceStore.locations;
      if (locations.length) {
        return locations;
      }
      return [
        {
          id: 'fallback',
          name: 'Lokasi Default',
          center: GEOFENCE_CENTER,
          radius: GEOFENCE_RADIUS_METERS
        }
      ];
    },
    geofenceError() {
      return geofenceStore.error;
    },
    records() {
      return store.records;
    },
    typeOptions() {
      return [
        { label: 'Check-in', value: 'checkin' },
        { label: 'Check-out', value: 'checkout' },
        { label: 'Dinas Luar', value: 'dinas_luar' },
        { label: 'Lembur', value: 'lembur' }
      ];
    },
    selectedTypeLabel() {
      const match = this.typeOptions.find(item => item.value === this.selectedType);
      return match ? match.label : 'Pilih Jenis';
    },
    timeLabel() {
      const source = this.currentTime instanceof Date ? this.currentTime : new Date();
      const hours = source.getHours().toString().padStart(2, '0');
      const minutes = source.getMinutes().toString().padStart(2, '0');
      return `${hours}:${minutes}`;
    }
  },
  created() {
    this.ensureGeofenceData();
    store.refresh().catch(() => {});
  },
  mounted() {
    this.handleTokenOnMount();
  },
  methods: {
    async handleTokenOnMount() {
      if (this.reauthenticating || !authStore.token) {
        return;
      }
      const expiresAt = authStore.expiresAt;
      if (!expiresAt || expiresAt > Date.now()) {
        return;
      }
      const credentials = authStore.credentials;
      if (!credentials) {
        store.pushMessage('Sesi login telah berakhir. Silakan login kembali.');
        this.redirectToLogin();
        return;
      }
      try {
        this.reauthenticating = true;
        await authStore.relogin();
        await store.refresh({ force: true });
      } catch (error) {
        const message =
          error instanceof ApiError
            ? error.message
            : 'Sesi login telah berakhir. Silakan login kembali.';
        store.pushMessage(message);
        this.redirectToLogin();
      } finally {
        this.reauthenticating = false;
      }
    },
    openDialog() {
      this.dialogActive = true;
      this.dialogLocation = 'Mendeteksi lokasi...';
      this.dialogCoords = null;
      this.ensureGeofenceData();
      this.fetchPreviewLocation();
    },
    resetDialog() {
      this.dialogActive = false;
      this.dialogLocation = null;
    },
    goTo(path) {
      this.$router.push(path);
    },
    setType(value) {
      this.selectedType = value;
    },
    async confirmCheckin(payload = {}) {
      if (this.isSubmitting) {
        return;
      }
      const photoBlob = payload?.photo ?? null;
      if (!photoBlob) {
        store.pushMessage('Foto absensi wajib diambil sebelum mengirim.');
        this.resetDialog();
        return;
      }
      if (!navigator.onLine) {
        store.pushMessage('Tidak dapat absen saat offline. Silakan periksa koneksi Anda.');
        this.resetDialog();
        return;
      }

      try {
        this.isSubmitting = true;
        await this.ensureGeofenceData();
        const coords = await this.fetchLocation();
        if (!coords) {
          store.pushMessage('Lokasi tidak tersedia. Aktifkan layanan lokasi dan coba lagi.');
          this.resetDialog();
          return;
        }

        const evaluation = this.evaluateLocation(coords);
        const enforceGeofence = !['dinas_luar', 'lembur'].includes(this.selectedType);
        if (enforceGeofence && !evaluation.within) {
          store.pushMessage(
            `Anda berada di luar area absensi${
              evaluation.fence?.name ? ` (${evaluation.fence.name})` : ''
            } (jarak ${this.formatDistanceLabel(evaluation.distance)} dari titik terdekat).`
          );
          this.resetDialog();
            return;
          }

        const submissionType = this.selectedType === 'dinas_luar' ? 'dinas_luar' : this.selectedType;
        const note =
          submissionType === 'dinas_luar'
            ? evaluation.fence?.name || 'Dinas luar'
            : submissionType === 'lembur'
            ? 'Lembur'
            : '';
        const compressedPhoto = await this.compressPhotoBlob(photoBlob);

        await store.submit(submissionType, {
          coords,
          note,
          locationName: evaluation.fence?.name ?? null,
          photoFile: compressedPhoto
        });
        this.resetDialog();
      } catch (error) {
        console.log('confirmCheckin error', error);
        if (!(error instanceof ApiError)) {
          store.pushMessage('Gagal memproses absensi. Silakan coba lagi.');
        }
        this.resetDialog();
      } finally {
        this.isSubmitting = false;
      }
    },
    fetchPreviewLocation() {
      if (!('geolocation' in navigator)) {
        this.dialogLocation = 'Perangkat tidak mendukung lokasi';
        this.dialogCoords = null;
        return;
      }
      navigator.geolocation.getCurrentPosition(
        position => {
          const { latitude, longitude } = position.coords;
          const coords = { lat: latitude, lng: longitude };
          this.dialogLocation = this.locationPreviewLabel(coords);
          this.dialogCoords = coords;
        },
        () => {
          this.dialogLocation = 'Lokasi tidak tersedia';
          this.dialogCoords = null;
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
    },
    fetchLocation() {
      if (!('geolocation' in navigator)) {
        return Promise.resolve(null);
      }

      return new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          position => {
            resolve({
              lat: position.coords.latitude,
              lng: position.coords.longitude
            });
          },
          error => {
            reject(error);
          },
          { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
        );
      });
    },
    viewDetails(record) {
      if (!record || !record.id) {
        store.pushMessage('Catatan absensi tidak tersedia.');
        return;
      }
      this.$router.push({
        name: 'RiwayatDetail',
        params: { attendanceId: record.id }
      });
    },
    deleteRecord() {
      store.pushMessage('Penghapusan catatan belum didukung pada aplikasi ini.');
    },
    redirectToLogin() {
      if (this.$route.name === 'Login') {
        return;
      }
      const target = { name: 'Login' };
      if (this.$route.fullPath && this.$route.fullPath !== '/login') {
        target.query = { redirect: this.$route.fullPath };
      }
      this.$router.replace(target);
    },
    isWithinAllowedArea(coords) {
      return this.evaluateLocation(coords).within;
    },
    formatDistanceLabel(distance) {
      if (!isFinite(distance)) {
        return 'tidak diketahui';
      }
      if (distance >= 1000) {
        return `${(distance / 1000).toFixed(2)} km`;
      }
      return `${distance.toFixed(distance < 20 ? 1 : 0)} m`;
    },
    locationPreviewLabel(coords) {
      const evaluation = this.evaluateLocation(coords);
      const status = evaluation.within ? 'Dalam radius' : 'Di luar radius';
      const fenceLabel = evaluation.fence?.name ? ` • ${evaluation.fence.name}` : '';
      return `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)} · ${status}${fenceLabel} (${this.formatDistanceLabel(
        evaluation.distance
      )})`;
    },
    evaluateLocation(coords) {
      if (
        !coords ||
        !Number.isFinite(coords.lat) ||
        !Number.isFinite(coords.lng)
      ) {
        return { within: false, fence: null, distance: Infinity };
      }

      let nearest = null;
      this.geofenceLocations.forEach(fence => {
        if (!fence || !fence.center) {
          return;
        }
        const distance = distanceInMeters(coords, fence.center);
        if (!isFinite(distance)) {
          return;
        }
        if (!nearest || distance < nearest.distance) {
          nearest = { fence, distance };
        }
      });

      if (!nearest) {
        return { within: false, fence: null, distance: Infinity };
      }

      const within = nearest.distance <= nearest.fence.radius;
      return {
        within,
        fence: nearest.fence,
        distance: nearest.distance
      };
    },
    async compressPhotoBlob(blob) {
      if (!blob) {
        return null;
      }
      const targetName = `attendance-${this.selectedType}-${Date.now()}.jpg`;
      const maxDimension = 1024;
      const maxBytes = 2 * 1024 * 1024;

      try {
        const image = await this.loadImageFromBlob(blob);
        const largestSide = Math.max(image.width, image.height);
        const scale = largestSide > maxDimension ? maxDimension / largestSide : 1;
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(image.width * scale) || image.width || 640;
        canvas.height = Math.round(image.height * scale) || image.height || 480;
        const context = canvas.getContext('2d');
        if (!context) {
          throw new Error('Context kamera tidak tersedia');
        }
        context.drawImage(image.element, 0, 0, canvas.width, canvas.height);

        let compressed = await this.canvasToBlob(canvas, 'image/jpeg', 0.78);
        if (!compressed || compressed.size > maxBytes) {
          compressed = await this.canvasToBlob(canvas, 'image/jpeg', 0.65);
        }
        const finalBlob = compressed && compressed.size < blob.size ? compressed : blob;
        return this.blobToFile(finalBlob, targetName);
      } catch (error) {
        console.log('compressPhotoBlob error', error);
        console.warn('Gagal mengompres foto absen', error);
        return this.blobToFile(blob, targetName);
      }
    },
    loadImageFromBlob(blob) {
      return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(blob);
        const image = new Image();
        image.onload = () => {
          URL.revokeObjectURL(url);
          resolve({
            element: image,
            width: image.naturalWidth || image.width,
            height: image.naturalHeight || image.height
          });
        };
        image.onerror = err => {
          URL.revokeObjectURL(url);
          reject(err);
        };
        image.src = url;
      });
    },
    canvasToBlob(canvas, type = 'image/jpeg', quality = 0.8) {
      return new Promise(resolve => {
        if (!canvas) {
          resolve(null);
          return;
        }
        if (canvas.toBlob) {
          canvas.toBlob(blob => resolve(blob), type, quality);
          return;
        }
        const dataUrl = canvas.toDataURL(type, quality);
        resolve(this.dataUrlToBlob(dataUrl));
      });
    },
    dataUrlToBlob(dataUrl) {
      if (!dataUrl) {
        return null;
      }
      const parts = dataUrl.split(',');
      if (parts.length < 2) {
        return null;
      }
      const mimeMatch = parts[0].match(/:(.*?);/);
      const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
      const binary = atob(parts[1]);
      const len = binary.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i += 1) {
        bytes[i] = binary.charCodeAt(i);
      }
      try {
        return new Blob([bytes], { type: mime });
      } catch (error) {
        console.log('dataUrlToBlob error', error);
        console.error('Gagal membuat Blob dari data URL', error);
        return null;
      }
    },
    blobToFile(blob, fileName) {
      if (!blob) {
        return null;
      }
      if (typeof File === 'function') {
        try {
          return new File([blob], fileName, {
            type: blob.type || 'image/jpeg',
            lastModified: Date.now()
          });
        } catch (error) {
          console.log('blobToFile error', error);
          console.warn('Gagal membuat File dari Blob', error);
        }
      }
      const fallback = new Blob([blob], { type: blob.type || 'image/jpeg' });
      fallback.name = fileName;
      return fallback;
    },
    async ensureGeofenceData() {
      await geofenceStore.ensureLocations();
      if (this.geofenceError && !this.geofenceErrorNotified) {
        store.pushMessage('Gagal memuat lokasi absen dari server. Menggunakan pengaturan cadangan.');
        this.geofenceErrorNotified = true;
      }
    }
  }
};
</script>

<style scoped>
.home-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.type-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.type-button {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-width: 180px;
  border-radius: 16px;
  padding: 10px 16px;
  font-weight: 600;
  background: #fff;
  color: var(--surface-color);
  box-shadow: 0 8px 24px rgba(31, 26, 51, 0.08);
}

.type-button .material-symbols-outlined {
  font-size: 20px;
  margin-left: 0px !important;
}

.time-chip {
  padding: 8px 14px;
  border-radius: 999px;
  background: rgba(124, 77, 255, 0.18);
  color: var(--text-primary);
  font-weight: 600;
  font-size: 15px;
}
.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0;
  border: none;
  background: transparent;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
  cursor: pointer;
  text-align: left;
}

.section-header .material-symbols-outlined {
  font-size: 22px;
}
</style>
