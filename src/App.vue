<template>
  <div id="app" class="md-theme-default app-shell">
    <md-app v-if="showShell">
      <app-drawer
        slot="md-app-drawer"
        :active-route="activeRoute"
        :visible.sync="drawerVisible"
        :user="currentUser"
        @navigate="onNavigate"
        @logout="handleLogout"
      />
      <md-app-toolbar class="app-toolbar" md-elevation="2">
        <app-bar
          :title="currentTitle"
          :user="currentUser"
          @toggle-drawer="drawerVisible = true"
          @open-calendar="onOpenCalendar"
          @open-menu="onOpenOverflow"
        />
      </md-app-toolbar>
      <md-app-content class="app-content">
        <transition name="page" mode="out-in">
          <router-view
            :key="$route.fullPath"
            :current-time="currentTime"
            :offline="isOffline"
            @request-drawer="drawerVisible = true"
          />
        </transition>
      </md-app-content>
    </md-app>
    <transition v-else name="page" mode="out-in">
      <router-view :key="$route.fullPath" />
    </transition>
    <md-snackbar
      v-if="showShell && snackbar"
      :md-active="snackbar.active"
      :md-duration="3000"
      md-position="center"
      @click.native="dismissSnackbar"
      @md-closed="onSnackbarClosed"
    >
      {{ snackbar?.message }}
    </md-snackbar>

    <checkout-reminder
      v-if="showShell"
      :active.sync="showCheckoutReminder"
      :message="reminderMessage"
      @dismiss-today="dismissReminder"
      @go-checkout="goToCheckout"
    />
    <transition name="offline-banner">
      <div v-if="isOffline" class="offline-banner" role="status">
        Anda offline
      </div>
    </transition>
  </div>
</template>

<script>
import AppBar from './components/AppBar.vue';
import AppDrawer from './components/AppDrawer.vue';
import CheckoutReminder from './components/CheckoutReminder.vue';
import { useAttendanceStore } from './store/attendance';
import { useAuthStore } from './store/auth';
import { useGeofenceStore } from './store/geofence';
import { distanceInMeters } from './utils/geo';

const authStore = useAuthStore();

export default {
  name: 'App',
  components: { AppBar, AppDrawer, CheckoutReminder },
  data() {
    return {
      drawerVisible: false,
      currentTime: new Date(),
      snackbar: null,
      snackbarTimer: null,
      isOffline: !navigator.onLine,
      unsubscribeAuth: null,
      showCheckoutReminder: false,
      reminderMessage: '',
      lastReminderTime: 0
    };
  },
  computed: {
    activeRoute() {
      return this.$route.path;
    },
    isAuthenticated() {
      return authStore.isAuthenticated;
    },
    currentUser() {
      return authStore.user;
    },
    isAuthScreen() {
      return this.$route.matched.some(record => record.meta?.guestOnly);
    },
    showShell() {
      return this.isAuthenticated && !this.isAuthScreen;
    },
    currentTitle() {
      return this.$route.meta?.title || 'WebAtt';
    }
  },
  created() {
    this.startClock();
    this.observeNetwork();
    const store = useAttendanceStore();
    this.unsubscribe = store.subscribe(this.showSnackbar);
    this.unsubscribeAuth = authStore.subscribe(this.handleAuthEvent);
  },
  beforeDestroy() {
    clearInterval(this.intervalId);
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);
    document.removeEventListener('visibilitychange', this.handleVisibility);
    this.clearSnackbarTimer();
    if (this.unsubscribe) {
      this.unsubscribe();
    }
    if (this.unsubscribeAuth) {
      this.unsubscribeAuth();
      this.unsubscribeAuth = null;
    }
  },
  methods: {
    startClock() {
      this.intervalId = setInterval(() => {
        this.currentTime = new Date();
        authStore.checkExpiration();
        this.checkCheckoutReminder();
      }, 60000);
      this.currentTime = new Date();
      setTimeout(() => this.checkCheckoutReminder(), 5000);
    },
    observeNetwork() {
      window.addEventListener('online', this.handleOnline);
      window.addEventListener('offline', this.handleOffline);
      document.addEventListener('visibilitychange', this.handleVisibility);
    },
    handleVisibility() {
      if (document.visibilityState === 'visible') {
        authStore.checkExpiration();
      }
    },
    handleOnline() {
      this.isOffline = false;
      const store = useAttendanceStore();
      store.refresh({ force: true }).catch(() => {});
    },
    handleOffline() {
      this.isOffline = true;
    },
    onNavigate(path) {
      if (path !== this.$route.path) {
        this.$router.push(path);
      }
      this.drawerVisible = false;
    },
    onOpenCalendar() {
      this.showSnackbar('Fitur kalender belum tersedia');
    },
    onOpenOverflow() {
      this.showSnackbar('Menu belum tersedia');
    },
    async handleLogout() {
      await authStore.logout();
      this.drawerVisible = false;
      this.$router.replace({ name: 'Login' });
    },
    handleAuthEvent(event) {
      if (!event) {
        return;
      }
      if (event.message) {
        this.showSnackbar(event.message);
      }
      if (event.type === 'expired') {
        this.drawerVisible = false;
        if (this.$route.name !== 'Login') {
          const redirect =
            this.$route.fullPath && this.$route.fullPath !== '/login'
              ? this.$route.fullPath
              : undefined;
          const target = { name: 'Login' };
          if (redirect) {
            target.query = { redirect };
          }
          this.$router.replace(target);
        }
      }
    },
    showSnackbar(message) {
      if (!message) {
        return;
      }
      this.clearSnackbarTimer();
      this.snackbar = { active: true, message };
      this.snackbarTimer = setTimeout(() => {
        this.dismissSnackbar();
      }, 3000);
    },
    dismissSnackbar() {
      this.clearSnackbarTimer();
      if (this.snackbar) {
        this.snackbar.active = false;
      }
    },
    onSnackbarClosed() {
      this.clearSnackbarTimer();
      this.snackbar = null;
    },
    clearSnackbarTimer() {
      if (this.snackbarTimer) {
        clearTimeout(this.snackbarTimer);
        this.snackbarTimer = null;
      }
    },
    async checkCheckoutReminder() {
      const attendanceStore = useAttendanceStore();
      if (!this.isAuthenticated || attendanceStore.isReminderDismissedToday()) {
        return;
      }
      
      const now = new Date();
      if (now.getTime() - this.lastReminderTime < 300000) {
        return;
      }

      const today = attendanceStore.today;
      if (!today || !today.has_attendance || today.can_check_in || !today.can_check_out) {
        return;
      }

      let shouldRemind = false;
      let message = '';

      if (now.getHours() >= 17) {
        shouldRemind = true;
        message = 'Waktu check-out sudah tiba (lewat 17:00). Jangan lupa untuk melakukan absen check-out sebelum meninggalkan lokasi.';
      }

      if (!shouldRemind && 'geolocation' in navigator) {
        try {
          const coords = await this.fetchCurrentLocation();
          if (coords) {
            const geofenceStore = useGeofenceStore();
            await geofenceStore.ensureLocations();
            const locations = geofenceStore.locations;
            
            let nearest = null;
            locations.forEach(loc => {
              if (!loc || !loc.center) return;
              const dist = distanceInMeters(coords, loc.center);
              if (Number.isFinite(dist) && (!nearest || dist < nearest.distance)) {
                nearest = { location: loc, distance: dist };
              }
            });

            if (nearest && nearest.distance > nearest.location.radius * 0.7) {
              shouldRemind = true;
              message = 'Anda terdeteksi mulai meninggalkan lokasi absen. Jangan lupa untuk melakukan absen check-out.';
            }
          }
        } catch (error) {
        }
      }

      if (shouldRemind) {
        this.reminderMessage = message;
        this.showCheckoutReminder = true;
        this.lastReminderTime = now.getTime();
      }
    },
    fetchCurrentLocation() {
      return new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
          () => resolve(null),
          { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
        );
      });
    },
    dismissReminder() {
      const attendanceStore = useAttendanceStore();
      attendanceStore.dismissReminderToday();
    },
    goToCheckout() {
      if (this.$route.path !== '/') {
        this.$router.push('/');
      }
    }
  }
};
</script>

<style scoped>
.app-shell {
  min-height: 100vh;
  background: var(--surface-color);
}

.app-toolbar {
  position: sticky;
  top: 0;
  z-index: 999;
  background: var(--surface-color);
  border-bottom: 1px solid var(--border-color);
}

.app-content {
  padding: 16px;
  margin-top: 25px;
}

.offline-banner {
  position: fixed;
  top: 76px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(31, 26, 51, 0.85);
  color: #fff;
  padding: 8px 16px;
  border-radius: 999px;
  font-size: 14px;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.2);
}

.offline-banner-enter-active,
.offline-banner-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.offline-banner-enter,
.offline-banner-leave-to {
  opacity: 0;
  transform: translate(-50%, -8px);
}
</style>
