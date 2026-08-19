<template>
<md-app-drawer :md-active.sync="localVisible" class="app-drawer">
    <div class="drawer-header">
      <div class="logo-placeholder" aria-hidden="true">
        <span v-if="avatarLetter" class="avatar-letter">{{ avatarLetter }}</span>
        <span v-else class="material-symbols-outlined">badge</span>
      </div>
      <div>
        <div class="app-name">{{ displayName || 'WebAtt' }}</div>
        <div class="app-tagline">{{ secondaryText }}</div>
      </div>
    </div>
    <md-list>
      <md-list-item
        v-for="item in items"
        :key="item.to"
        :class="{ active: item.to === activeRoute }"
        @click="handleNavigate(item.to)"
      >
        <span class="material-symbols-outlined" aria-hidden="true">
          {{ item.icon }}
        </span>
        <span class="md-list-item-text">{{ item.label }}</span>
      </md-list-item>
      <md-divider />
      <md-list-item class="logout-item" @click="handleLogout">
        <span class="material-symbols-outlined" aria-hidden="true">logout</span>
        <span class="md-list-item-text">Keluar</span>
      </md-list-item>
    </md-list>
    <footer class="drawer-footer" aria-live="polite">
      <transition name="fade">
        <div v-if="isLoading" class="drawer-footer__content">
          <md-progress-spinner md-mode="indeterminate" :md-diameter="30" />
          <span>Memuat data terbaru...</span>
        </div>
      </transition>
    </footer>
  </md-app-drawer>
</template>

<script>
import { useAttendanceStore } from '../store/attendance';

const attendanceStore = useAttendanceStore();

export default {
  name: 'AppDrawer',
  props: {
    activeRoute: {
      type: String,
      required: true
    },
    visible: {
      type: Boolean,
      default: false
    },
    user: {
      type: Object,
      default: () => null
    }
  },
  data() {
    return {
      localVisible: this.visible,
      items: [
        { label: 'Absen', to: '/', icon: 'home' },
        { label: 'Riwayat', to: '/riwayat', icon: 'history' },
        { label: 'Pengaturan', to: '/pengaturan', icon: 'settings' }
      ]
    };
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
    },
    secondaryText() {
      if (!this.user || typeof this.user !== 'object') {
        return 'Absensi mudah';
      }
      return (
        this.user.position?.name ||
        this.user.position_name ||
        this.user.department?.name ||
        this.user.department_name ||
        this.user.role ||
        'Absensi mudah'
      );
    },
    avatarLetter() {
      if (!this.displayName) {
        return '';
      }
      return this.displayName.charAt(0).toUpperCase();
    },
    isLoading() {
      return Boolean(attendanceStore.loading || attendanceStore.syncing);
    }
  },
  watch: {
    visible(value) {
      this.localVisible = value;
    },
    localVisible(value) {
      this.$emit('update:visible', value);
    }
  },
  methods: {
    handleNavigate(path) {
      this.$emit('navigate', path);
      this.localVisible = false;
    },
    handleLogout() {
      this.$emit('logout');
      this.localVisible = false;
    }
  }
};
</script>

<style>
.app-drawer {
  width: 280px;
  min-height: 100vh;
  background: var(--card-bg);
}

.drawer-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 24px 16px 16px;
}

.logo-placeholder {
  width: 48px;
  height: 48px;
  border-radius: 16px;
  background: rgba(124, 77, 255, 0.15);
  display: grid;
  place-items: center;
  color: var(--primary-color);
  font-size: 24px;
}

.avatar-letter {
  font-weight: 700;
}

.app-name {
  font-weight: 700;
  font-size: 18px;
}

.app-tagline {
  font-size: 14px;
  color: var(--text-secondary);
}

.md-list-item {
  min-height: 48px;
  border-radius: 12px;
  margin: 4px 8px;
  padding: 0 12px;
  color: var(--text-primary);
}

.md-list-item-text {
  font-weight: 500;
}

.active {
  background: rgba(124, 77, 255, 0.18);
  color: var(--primary-color);
}

.logout-item {
  margin-top: 8px;
  color: #d32f2f;
}

.material-symbols-outlined {
  margin-right: 0px;
}

.md-list-item-container:not(.md-list-item-default):not([disabled])>.md-list-item-content {
  color: var(--text-primary);
}

.drawer-footer {
  padding: 12px 16px 20px;
  border-top: 1px solid var(--border-color);
  min-height: 60px;
}

.drawer-footer__content {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  color: var(--text-secondary);
}

.drawer-footer__content span {
  flex: 1;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter,
.fade-leave-to {
  opacity: 0;
}

</style>
