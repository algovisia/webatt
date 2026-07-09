<template>
  <md-dialog :md-active.sync="localActive" class="confirm-dialog">
    <md-dialog-title>Konfirmasi Absen</md-dialog-title>
    <md-dialog-content>
      <p class="dialog-type">Jenis absen: <strong>{{ typeLabel }}</strong></p>
      <p class="dialog-time">Waktu saat ini: <strong>{{ timeLabel }}</strong></p>
      <p class="dialog-location">
        Lokasi: <strong>{{ locationLabel }}</strong>
      </p>
      <p class="dialog-hint">
        Pastikan informasi sudah benar sebelum melanjutkan.
      </p>
      <div class="camera-section">
        <p class="camera-label">Verifikasi Foto</p>
        <div class="camera-frame" :class="{ 'camera-frame--preview': hasPhoto }">
          <video
            v-show="!cameraError && !hasPhoto"
            ref="videoEl"
            autoplay
            playsinline
            muted
          ></video>
          <img
            v-if="hasPhoto"
            :src="snapshotUrl"
            alt="Hasil foto absensi"
            class="camera-preview"
          />
          <div class="camera-status" :class="{ 'camera-status--error': cameraError }">
            {{ cameraStatusLabel }}
          </div>
        </div>
        <div class="camera-actions">
          <md-button
            class="md-raised md-primary"
            @click="capturePhoto"
            :disabled="!isCameraReady || !!cameraError || isCapturing || hasPhoto"
          >
            Ambil Foto
          </md-button>
          <md-button v-if="hasPhoto" class="md-secondary" @click="retakePhoto">
            Ulangi Foto
          </md-button>
        </div>
        <p v-if="captureError" class="capture-error">{{ captureError }}</p>
      </div>
    </md-dialog-content>
    <md-dialog-actions>
      <md-button class="md-secondary" @click="close">Batal</md-button>
      <md-button class="md-primary" @click="confirm" :disabled="!hasPhoto">Konfirmasi</md-button>
    </md-dialog-actions>
  </md-dialog>
</template>

<script>
export default {
  name: 'ConfirmCheckinDialog',
  props: {
    value: {
      type: Boolean,
      default: false
    },
    currentTime: {
      type: Date,
      required: true
    },
    location: {
      type: [Object, String, null],
      default: null
    },
    locationCoords: {
      type: [Object, null],
      default: null
    },
    typeLabel: {
      type: String,
      default: 'Check-in'
    }
  },
  data() {
    return {
      localActive: this.value,
      stream: null,
      isCameraReady: false,
      isRequestingStream: false,
      isCapturing: false,
      snapshotUrl: null,
      capturedBlob: null,
      cameraError: null,
      captureError: null
    };
  },
  watch: {
    value(val) {
      this.localActive = val;
    },
    localActive(val) {
      this.$emit('input', val);
      if (val) {
        this.$nextTick(() => this.prepareCamera());
      } else {
        this.teardownCamera();
      }
    }
  },
  mounted() {
    if (this.localActive) {
      this.prepareCamera();
    }
  },
  beforeDestroy() {
    this.teardownCamera(true);
  },
  computed: {
    timeLabel() {
      const hours = this.currentTime.getHours().toString().padStart(2, '0');
      const minutes = this.currentTime.getMinutes().toString().padStart(2, '0');
      return `${hours}:${minutes}`;
    },
    locationLabel() {
      if (!this.location) {
        return 'Lokasi tidak tersedia';
      }
      if (typeof this.location === 'string') {
        return this.location;
      }
      const { lat, lng } = this.location;
      return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    },
    hasPhoto() {
      return Boolean(this.snapshotUrl && this.capturedBlob);
    },
    cameraStatusLabel() {
      if (this.cameraError) {
        return this.cameraError;
      }
      if (this.hasPhoto) {
        return 'Foto berhasil diambil';
      }
      if (!this.isCameraReady) {
        return 'Menyiapkan kamera...';
      }
      return 'Posisikan wajah Anda sebelum mengambil foto';
    }
  },
  methods: {
    close() {
      this.localActive = false;
      this.$emit('cancel');
      this.teardownCamera();
    },
    confirm() {
      if (!this.hasPhoto || !this.capturedBlob) {
        this.captureError = 'Mohon ambil foto terlebih dahulu.';
        return;
      }
      this.$emit('confirm', { photo: this.capturedBlob });
      this.localActive = false;
      this.teardownCamera();
    },
    async prepareCamera() {
      if (this.stream || this.isRequestingStream) {
        return;
      }
      this.cameraError = null;
      this.captureError = null;

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        this.cameraError = 'Perangkat tidak mendukung kamera.';
        return;
      }

      this.isRequestingStream = true;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'user' },
            width: { ideal: 640 },
            height: { ideal: 480 }
          },
          audio: false
        });
        this.stream = stream;
        const videoEl = this.$refs.videoEl;
        if (videoEl) {
          videoEl.srcObject = stream;
          videoEl.play().catch(() => {});
        }
        this.isCameraReady = true;
      } catch (error) {
        const denied =
          error && (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError');
        this.cameraError = denied
          ? 'Akses kamera ditolak. Izinkan kamera untuk melanjutkan.'
          : 'Tidak dapat mengakses kamera.';
        console.error('Gagal mengakses kamera', error);
      } finally {
        this.isRequestingStream = false;
      }
    },
    teardownCamera(resetPhoto = true) {
      if (this.stream) {
        this.stream.getTracks().forEach(track => track.stop());
        this.stream = null;
      }
      this.isCameraReady = false;
      this.isRequestingStream = false;
      if (resetPhoto) {
        this.resetPhoto({ silent: true });
      }
    },
    resetPhoto({ silent = false } = {}) {
      if (this.snapshotUrl && this.snapshotUrl.startsWith('blob:')) {
        URL.revokeObjectURL(this.snapshotUrl);
      }
      this.snapshotUrl = null;
      this.capturedBlob = null;
      this.captureError = null;
      if (!silent) {
        this.$emit('photo-reset');
      }
    },
    retakePhoto() {
      this.resetPhoto();
      if (!this.stream) {
        this.prepareCamera();
      }
    },
    capturePhoto() {
      if (!this.isCameraReady || !this.$refs.videoEl) {
        return;
      }
      this.captureError = null;
      this.isCapturing = true;

      const videoEl = this.$refs.videoEl;
      const canvas = document.createElement('canvas');
      const width = videoEl.videoWidth || 640;
      const height = videoEl.videoHeight || 480;
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) {
        this.captureError = 'Kamera tidak tersedia untuk saat ini.';
        this.isCapturing = false;
        return;
      }
      context.drawImage(videoEl, 0, 0, width, height);
      const overlayDetails = this.buildPhotoOverlayDetails();
      if (overlayDetails) {
        this.drawPhotoOverlay(context, canvas, overlayDetails);
      }

      const finalizeCapture = (blob, previewUrl = null) => {
        this.isCapturing = false;
        if (!blob) {
          this.captureError = 'Gagal mengambil foto. Coba lagi.';
          return;
        }
        this.resetPhoto({ silent: true });
        this.capturedBlob = blob;
        this.snapshotUrl = previewUrl || URL.createObjectURL(blob);
        this.$emit('photo-captured', blob);
      };

      try {
        const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
        const blob = this.dataUrlToBlob(dataUrl);
        finalizeCapture(blob, dataUrl);
      } catch (error) {
        console.warn('Gagal membuat data URL foto', error);
        if (canvas.toBlob) {
          canvas.toBlob(
            blob => {
              finalizeCapture(blob);
            },
            'image/jpeg',
            0.92
          );
        } else {
          finalizeCapture(null);
        }
      }
    },
    buildPhotoOverlayDetails() {
      return {
        heading: `Jenis: ${this.typeLabel}`,
        lines: [
          `Lokasi: ${this.locationLabel}`,
          ...this.overlayCoordinateLines(),
          `Waktu: ${this.formatOverlayTimestamp(new Date())}`
        ]
      };
    },
    overlayCoordinateLines() {
      const coords =
        this.normalizeCoords(this.locationCoords) || this.normalizeCoords(this.location);
      if (!coords) {
        return [];
      }
      return [`Koordinat: ${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`];
    },
    normalizeCoords(value) {
      if (!value || typeof value !== 'object') {
        return null;
      }
      const lat = Number(value.lat);
      const lng = Number(value.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return null;
      }
      return { lat, lng };
    },
    formatOverlayTimestamp(dateValue) {
      const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
      if (!date || Number.isNaN(date.getTime())) {
        return 'Tidak diketahui';
      }
      const pad = num => num.toString().padStart(2, '0');
      const day = pad(date.getDate());
      const month = pad(date.getMonth() + 1);
      const year = date.getFullYear();
      const hours = pad(date.getHours());
      const minutes = pad(date.getMinutes());
      const seconds = pad(date.getSeconds());
      return `${day}-${month}-${year} ${hours}:${minutes}:${seconds}`;
    },
    drawPhotoOverlay(context, canvas, details) {
      if (!context || !canvas || !details) {
        return;
      }
      const baseFontSize = Math.max(16, Math.round(canvas.width * 0.035));
      const headingFontSize = Math.max(baseFontSize, Math.round(canvas.width * 0.04));
      const padding = Math.max(16, Math.round(canvas.width * 0.04));
      const maxWidth = canvas.width - padding * 2;
      const textEntries = [];

      if (details.heading) {
        textEntries.push(
          ...this.wrapOverlayText(
            context,
            details.heading,
            `600 ${headingFontSize}px "Inter", "Segoe UI", sans-serif`,
            maxWidth,
            Math.round(headingFontSize * 1.25)
          )
        );
      }

      (details.lines || []).forEach(line => {
        textEntries.push(
          ...this.wrapOverlayText(
            context,
            line,
            `500 ${baseFontSize}px "Inter", "Segoe UI", sans-serif`,
            maxWidth,
            Math.round(baseFontSize * 1.3)
          )
        );
      });

      if (!textEntries.length) {
        return;
      }

      const textHeight = textEntries.reduce((sum, item) => sum + item.lineHeight, 0);
      const boxWidth = maxWidth + padding;
      const boxHeight = textHeight + padding;
      const startX = padding / 2;
      const startY = canvas.height - boxHeight - padding / 2;

      context.save();
      context.fillStyle = 'rgba(0, 0, 0, 0.68)';
      context.fillRect(startX, startY, boxWidth, boxHeight);
      context.fillStyle = '#fff';
      context.textBaseline = 'top';
      let cursorY = startY + padding / 2;
      textEntries.forEach(entry => {
        context.font = entry.font;
        context.fillText(entry.text, startX + padding / 2, cursorY, maxWidth);
        cursorY += entry.lineHeight;
      });
      context.restore();
    },
    wrapOverlayText(context, text, font, maxWidth, lineHeight) {
      if (!text) {
        return [];
      }
      context.save();
      context.font = font;
      const words = `${text}`.split(/\s+/).filter(Boolean);
      const lines = [];
      let currentLine = '';
      words.forEach(word => {
        const candidate = currentLine ? `${currentLine} ${word}` : word;
        if (context.measureText(candidate).width <= maxWidth) {
          currentLine = candidate;
        } else {
          if (currentLine) {
            lines.push(currentLine);
          }
          currentLine = word;
        }
      });
      if (currentLine) {
        lines.push(currentLine);
      }
      context.restore();
      return lines.map(line => ({
        text: line,
        font,
        lineHeight
      }));
    },
    dataUrlToBlob(dataUrl) {
      const parts = dataUrl.split(',');
      if (parts.length < 2) {
        return null;
      }
      const mimeMatch = parts[0].match(/:(.*?);/);
      const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
      const binary = atob(parts[1]);
      const len = binary.length;
      const buffer = new Uint8Array(len);
      for (let i = 0; i < len; i += 1) {
        buffer[i] = binary.charCodeAt(i);
      }
      try {
        return new Blob([buffer], { type: mime });
      } catch (error) {
        console.error('Gagal membuat Blob dari foto', error);
        return null;
      }
    }
  }
};
</script>

<style scoped>
.confirm-dialog {
  border-radius: 16px;
  min-width: 320px;
}

.dialog-type,
.dialog-time,
.dialog-location {
  font-size: 15px;
  margin: 0 0 8px;
}

.dialog-hint {
  margin: 16px 0 0;
  font-size: 13px;
  color: var(--text-secondary);
}

.camera-section {
  margin-top: 16px;
}

.camera-label {
  font-weight: 600;
  margin-bottom: 8px;
  font-size: 14px;
}

.camera-frame {
  position: relative;
  width: 100%;
  padding-top: 56%;
  border-radius: 16px;
  background: #000;
  overflow: hidden;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08);
}

.camera-frame--preview {
  border: 2px solid rgba(76, 175, 80, 0.7);
}

.camera-frame video,
.camera-frame img {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.camera-status {
  position: absolute;
  left: 12px;
  bottom: 12px;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  background: rgba(0, 0, 0, 0.65);
  color: #fff;
}

.camera-status--error {
  background: rgba(211, 47, 47, 0.85);
}

.camera-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 12px;
  flex-wrap: wrap;
}

.capture-error {
  margin-top: 8px;
  font-size: 13px;
  color: #d32f2f;
}
</style>
