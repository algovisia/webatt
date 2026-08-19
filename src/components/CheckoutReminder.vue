<template>
  <md-dialog :md-active="active" @md-closed="close">
    <md-dialog-title>Pengingat Check-out</md-dialog-title>

    <div style="padding: 0 24px">
      <p style="margin-top: 0; color: var(--text-secondary); font-size: 14px; line-height: 1.5;">
        {{ message }}
      </p>
      
      <md-checkbox v-model="dontRemindToday" class="md-primary" style="margin-top: 16px;">
        Jangan ingatkan saya lagi hari ini
      </md-checkbox>
    </div>

    <md-dialog-actions>
      <md-button class="md-primary" @click="close">Batal</md-button>
      <md-button class="md-primary" @click="confirm">Check-out Sekarang</md-button>
    </md-dialog-actions>
  </md-dialog>
</template>

<script>
export default {
  name: 'CheckoutReminder',
  props: {
    active: {
      type: Boolean,
      default: false
    },
    message: {
      type: String,
      default: 'Waktu check-out sudah tiba. Jangan lupa untuk melakukan absen check-out sebelum meninggalkan lokasi.'
    }
  },
  data() {
    return {
      dontRemindToday: false
    };
  },
  watch: {
    active(val) {
      if (val) {
        this.dontRemindToday = false;
      }
    }
  },
  methods: {
    close() {
      if (this.dontRemindToday) {
        this.$emit('dismiss-today');
      }
      this.$emit('update:active', false);
    },
    confirm() {
      if (this.dontRemindToday) {
        this.$emit('dismiss-today');
      }
      this.$emit('update:active', false);
      this.$emit('go-checkout');
    }
  }
};
</script>
