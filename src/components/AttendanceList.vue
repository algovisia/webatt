<template>
  <section aria-label="Riwayat absen">
    <md-list class="attendance-list">
      <div
        v-for="group in groupedRecords"
        :key="group.dateKey"
        class="history-row"
      >
        <div class="history-date" aria-hidden="true">
          <span class="history-day">{{ group.dayLabel }}</span>
          <span class="history-short">{{ group.dateLabel }}</span>
          <div v-if="group.extras.length" class="history-tags">
            <span
              v-for="(tag, idx) in group.extras"
              :key="idx"
              class="history-tag"
            >
              {{ tag }}
            </span>
          </div>
        </div>
        <div class="history-data">
          <div
            class="history-cell"
            :class="{ 'history-cell--empty': !group.checkin }"
          >
            <div class="cell-label">Check-in</div>
            <div class="cell-value">
              <template v-if="group.checkin">
                {{ timeLabel(group.checkin.timestamp) }}
                <span v-if="group.checkin.note" class="cell-note">
                  {{ group.checkin.note }}
                </span>
                <span v-if="!group.checkin.synced" class="badge">Offline</span>
              </template>
              <span v-else>—</span>
            </div>
            <md-button
              v-if="group.checkin"
              class="cell-action md-icon-button"
              aria-label="Detail check-in"
              @click="$emit('view-details', group.checkin)"
            >
              <span class="material-symbols-outlined" aria-hidden="true">
                info
              </span>
            </md-button>
          </div>
          <div
            class="history-cell"
            :class="{ 'history-cell--empty': !group.checkout }"
          >
            <div class="cell-label">Check-out</div>
            <div class="cell-value">
              <template v-if="group.checkout">
                {{ timeLabel(group.checkout.timestamp) }}
                <span v-if="group.checkout.note" class="cell-note">
                  {{ group.checkout.note }}
                </span>
                <span v-if="!group.checkout.synced" class="badge">Offline</span>
              </template>
              <span v-else>—</span>
            </div>
            <md-button
              v-if="group.checkout"
              class="cell-action md-icon-button"
              aria-label="Detail check-out"
              @click="$emit('view-details', group.checkout)"
            >
              <span class="material-symbols-outlined" aria-hidden="true">
                info
              </span>
            </md-button>
          </div>
        </div>
      </div>
      <p v-if="!groupedRecords.length" class="empty-state">
        Belum ada riwayat absensi.
      </p>
    </md-list>
  </section>
</template>

<script>
const dayFormatter = new Intl.DateTimeFormat('id-ID', {
  weekday: 'long'
});

const shortDateFormatter = new Intl.DateTimeFormat('id-ID', {
  day: '2-digit',
  month: 'short'
});

const timeFormatter = new Intl.DateTimeFormat('id-ID', {
  hour: '2-digit',
  minute: '2-digit'
});

export default {
  name: 'AttendanceList',
  props: {
    records: {
      type: Array,
      required: true
    }
  },
  computed: {
    groupedRecords() {
      const groups = new Map();
      const pushExtra = (group, label) => {
        if (!label || group.extras.includes(label)) {
          return;
        }
        group.extras.push(label);
      };

      (this.records || []).forEach(record => {
        const timestamp = record.timestamp ? new Date(record.timestamp) : null;
        const dateKey = timestamp ? timestamp.toISOString().slice(0, 10) : record.meta?.date || `unknown-${record.id}`;
        if (!groups.has(dateKey)) {
          groups.set(dateKey, {
            dateKey,
            dayLabel: timestamp ? this.capitalize(dayFormatter.format(timestamp)) : 'Tidak diketahui',
            dateLabel: timestamp ? shortDateFormatter.format(timestamp) : '-',
            sortValue: timestamp ? timestamp.getTime() : 0,
            checkin: null,
            checkout: null,
            extras: []
          });
        }
        const group = groups.get(dateKey);
        if (record.type === 'checkout') {
          group.checkout = selectPreferableRecord(group.checkout, record);
        } else if (record.type === 'checkin' || record.type === 'dinas_luar') {
          group.checkin = selectPreferableRecord(group.checkin, record);
        } else if (record.type === 'lembur') {
          pushExtra(group, 'Lembur');
        }

        if (record.type === 'dinas_luar') {
          pushExtra(group, 'Dinas Luar');
        }
      });

      return Array.from(groups.values()).sort((a, b) => b.sortValue - a.sortValue);
    }
  },
  methods: {
    timeLabel(timestamp) {
      if (!timestamp) {
        return '—';
      }
      try {
        return timeFormatter.format(new Date(timestamp));
      } catch {
        return '—';
      }
    },
    capitalize(value) {
      if (typeof value !== 'string' || !value.length) {
        return value;
      }
      return value.charAt(0).toUpperCase() + value.slice(1);
    }
  }
};

function selectPreferableRecord(existing, candidate) {
  if (!existing) {
    return candidate;
  }
  const existingTime = existing.timestamp ? new Date(existing.timestamp).getTime() : 0;
  const candidateTime = candidate.timestamp ? new Date(candidate.timestamp).getTime() : 0;
  return candidateTime > existingTime ? candidate : existing;
}
</script>

<style scoped>
.attendance-list {
  background: #fff;
  border-radius: 20px;
  padding: 8px 0;
  box-shadow: 0 12px 32px rgba(31, 26, 51, 0.04);
}

.history-row {
  display: flex;
  gap: 16px;
  padding: 16px 20px;
  border-bottom: 1px solid rgba(15, 15, 36, 0.06);
}

.history-row:last-child {
  border-bottom: none;
}

.history-date {
  min-width: 110px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.history-day {
  font-weight: 700;
  text-transform: capitalize;
  color: var(--primary-color)
}

.history-short {
  font-size: 13px;
  color: var(--text-secondary);
}

.history-tags {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-top: 6px;
}

.history-tag {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(124, 77, 255, 0.12);
  color: var(--primary-color);
  text-transform: capitalize;
}

.history-data {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 12px;
  width: 100%;
}

.history-cell {
  position: relative;
  padding: 14px;
  border-radius: 16px;
  background: rgb(222 225 234 / 80%);
  border: 1px solid rgba(124, 77, 255, 0.12);
}

.history-cell--empty {
  opacity: 0.6;
}

.cell-label {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-secondary);
  margin-bottom: 6px;
}

.cell-value {
  font-size: 18px;
  font-weight: 600;
  color: var(--surface-color);
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.cell-note {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
}

.badge {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 8px;
  background: rgba(255, 193, 7, 0.2);
  color: #f57c00;
}

.cell-action {
  position: absolute;
  top: 6px;
  right: 6px;
}

.empty-state {
  text-align: center;
  padding: 24px;
  color: var(--text-secondary);
  font-size: 14px;
}

@media (max-width: 600px) {
  .history-row {
    flex-direction: column;
  }
  .history-date {
    flex-direction: row;
    align-items: baseline;
    gap: 8px;
  }
  .history-tags {
    margin-top: 0;
  }
}
</style>
