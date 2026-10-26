import Vue from 'vue';
import VueRouter from 'vue-router';
import { useAuthStore } from '../store/auth';

Vue.use(VueRouter);

const Home = () => import('../pages/HomeAbsen.vue');
const Riwayat = () => import('../pages/RiwayatPage.vue');
const AttendanceDetail = () => import('../pages/AttendanceDetailPage.vue');
const Pengaturan = () => import('../pages/PengaturanPage.vue');
const PengajuanIzin = () => import('../pages/PengajuanIzinPage.vue');
const Login = () => import('../pages/LoginPage.vue');

const router = new VueRouter({
  mode: 'hash',
  routes: [
    {
      path: '/login',
      name: 'Login',
      component: Login,
      meta: { guestOnly: true, title: 'Masuk' }
    },
    {
      path: '/',
      name: 'Absen',
      component: Home,
      meta: { requiresAuth: true, title: 'Absen' }
    },
    {
      path: '/riwayat',
      name: 'Riwayat',
      component: Riwayat,
      meta: { requiresAuth: true, title: 'Riwayat' }
    },
    {
      path: '/riwayat/:attendanceId',
      name: 'RiwayatDetail',
      component: AttendanceDetail,
      meta: { requiresAuth: true, title: 'Detail Absensi' }
    },
    {
      path: '/izin',
      name: 'PengajuanIzin',
      component: PengajuanIzin,
      meta: { requiresAuth: true, title: 'Pengajuan Izin' }
    },
    {
      path: '/pengaturan',
      name: 'Pengaturan',
      component: Pengaturan,
      meta: { requiresAuth: true, title: 'Pengaturan' }
    },
    {
      path: '*',
      redirect: '/'
    }
  ]
});

router.afterEach(to => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (to.meta && to.meta.title) {
    document.title = `WebAtt • ${to.meta.title}`;
  }
});

router.beforeEach(async (to, from, next) => {
  const auth = useAuthStore();
  if (typeof auth.checkExpiration === 'function') {
    auth.checkExpiration();
  }
  const isAuthenticated = auth.isAuthenticated;

  if (to.matched.some(record => record.meta.requiresAuth) && !isAuthenticated) {
    next({
      name: 'Login',
      query: { redirect: to.fullPath }
    });
    return;
  }

  if (to.matched.some(record => record.meta.guestOnly) && isAuthenticated) {
    next({ path: '/' });
    return;
  }

  if (isAuthenticated && !auth.user) {
    const profile = await auth.fetchProfile();
    if (!profile) {
      await auth.logout({ notifyServer: false });
      next({
        name: 'Login',
        query: { redirect: to.fullPath }
      });
      return;
    }
  }

  next();
});

export default router;
