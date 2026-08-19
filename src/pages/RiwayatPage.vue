<template>
  <div class="riwayat-page">
    <header class="page-header">
      <h1>Riwayat</h1>
      <p>Lihat catatan absen Anda sebelumnya.</p>
    </header>

    <md-field class="search-field">
      <label for="filter">Cari</label>
      <md-input
        id="filter"
        v-model.trim="keyword"
        @input="onFilter"
        placeholder="Cari catatan"
      />
    </md-field>

    <attendance-list
      :records="filteredRecords"
      @view-details="viewDetails"
      @delete-record="deleteRecord"
    />

  </div>
</template>

<script>
import AttendanceList from '../components/AttendanceList.vue';
import { useAttendanceStore } from '../store/attendance';

const store = useAttendanceStore();

export default {
  name: 'RiwayatPage',
  components: { AttendanceList },
  data() {
    return {
      keyword: '',
      filteredRecords: store.records
    };
  },
  created() {
    store.refresh().catch(() => {});
  },
  watch: {
    keyword() {
      this.onFilter();
    },
    records: {
      handler() {
        this.onFilter();
      },
      deep: true
    }
  },
  computed: {
    records() {
      return store.records;
    }
  },
  methods: {
    onFilter() {
      const term = this.keyword.toLowerCase();
      if (!term) {
        this.filteredRecords = this.records;
        return;
      }
      this.filteredRecords = this.records.filter(record => {
        const note = record.note || '';
        return (
          record.type.toLowerCase().includes(term) ||
          note.toLowerCase().includes(term)
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
    }
  }
};
</script>

<style scoped>
.riwayat-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.page-header h1 {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
}

.page-header p {
  margin: 4px 0 0;
  color: var(--text-primary);
}

.search-field {
  background: var(--card-bg);
  border-radius: 16px;
  padding: 8px 16px 4px;
  box-shadow: 0 8px 24px rgba(31, 26, 51, 0.05);
}
</style>
