import Vue from 'vue';

const STORAGE_KEY = 'webatt.theme';

const state = Vue.observable({
  isDark: true
});

function loadTheme() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== null) {
      state.isDark = stored === 'dark';
    } else {
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
        state.isDark = false;
      }
    }
  } catch (error) {
    console.warn('Gagal membaca preferensi tema:', error);
  }
  applyTheme();
}

function applyTheme() {
  if (state.isDark) {
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.setAttribute('data-theme', 'light');
  }
}

function toggleTheme() {
  state.isDark = !state.isDark;
  persist();
  applyTheme();
}

function setDark(value) {
  state.isDark = value;
  persist();
  applyTheme();
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, state.isDark ? 'dark' : 'light');
  } catch (error) {
    console.warn('Gagal menyimpan preferensi tema:', error);
  }
}

// Inisialisasi tema saat modul dimuat
loadTheme();

// Expose the reactive state directly so Vue computed properties can track it
export { state as themeState };

export function useThemeStore() {
  return {
    state,
    toggleTheme,
    setDark
  };
}
