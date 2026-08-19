<template>
  <div class="cta-card" role="region" aria-label="Aksi absen">
    <div class="cta-content">
      <span class="cta-type">{{ typeLabel }}</span>
      <div class="cta-text">
        <h2>Siap untuk absen?</h2>
        <p>Pastikan Anda berada di lokasi yang sesuai sebelum melakukan absen.</p>
      </div>
      <md-button
        class="md-raised md-primary cta-button"
        @click="$emit('cta-click')"
        aria-label="Absen sekarang"
      >
        Absen Sekarang
      </md-button>
    </div>
  </div>
</template>

<script>
export default {
  name: 'PrimaryCtaCard',
  props: {
    typeLabel: {
      type: String,
      default: 'Check-in'
    }
  }
};
</script>

<style scoped>
.cta-card {
  background: var(--primary-color);
  color: #fff;
  border-radius: 20px;
  padding: 24px;
  box-shadow: 0 12px 32px var(--cta-shadow);
  margin-bottom: 24px;
}

.cta-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
  justify-content: center;
  align-items: center;
}

.cta-type {
  align-self: flex-start;
  background: rgba(255, 255, 255, 0.25);
  color: #fff;
  padding: 6px 12px;
  border-radius: 999px;
  font-size: 14px;
  font-weight: 600;
}

.cta-text h2 {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
}

.cta-text p {
  margin: 4px 0 0;
  font-size: 15px;
  line-height: 1.4;
  opacity: 0.9;
}

.cta-button {
  width: 100%;
  min-height: 56px;
  border-radius: 999px;
  font-size: 16px;
  font-weight: 600;
}
</style>
