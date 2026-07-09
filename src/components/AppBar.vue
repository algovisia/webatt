<template>
  <div class="app-bar">
    <div class="bar-left">
      <md-button class="md-icon-button" aria-label="Buka navigasi" @click="$emit('toggle-drawer')">
        <span class="material-symbols-outlined" aria-hidden="true">menu</span>
      </md-button>
      <div class="bar-center">
        <div class="title">{{ title }}</div>
      </div>
    </div>
    <div class="bar-right">
      <div v-if="displayName" class="user-chip" aria-live="polite">
        <span class="material-symbols-outlined" aria-hidden="true">account_circle</span>
        <span class="user-name">{{ displayName }}</span>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'AppBar',
  props: {
    title: {
      type: String,
      default: 'Absen'
    },
    user: {
      type: Object,
      default: () => null
    }
  },
  computed: {
    displayName() {
      if (!this.user || typeof this.user !== 'object') {
        return '';
      }
      return (
        this.user.name ||
        this.user.full_name ||
        this.user.fullName ||
        this.user.display_name ||
        this.user.username ||
        ''
      );
    }
  }
};
</script>

<style scoped>
.app-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 8px;
  min-height: 64px;
  width: 100vw;
  background-color: var(--surface-color);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  position: fixed;
  top: 0;
  left: 0;
  z-index: 1000;
}

.bar-left {
  display: flex;
}

.bar-center {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin: 0 12px;
}

.title {
  font-size: 24px;
  font-weight: 700;
  line-height: 28px;
}

.bar-right {
  display: flex;
  align-items: center;
  gap: 4px;
}

.user-chip {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 999px;
  background: rgba(124, 77, 255, 0.12);
  color: var(--text-primary);
  font-weight: 600;
  font-size: 14px;
  margin-right: 4px;
}

.user-name {
  max-width: 140px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.material-symbols-outlined {
  font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
}

.md-icon-button {
  width: 44px;
  height: 44px;
}
</style>
