# In-App Attendance Reminders (Alarm Feature)

This plan outlines the implementation of an alarm-style attendance reminder system. It helps users remember to check in at their target start time, and notifies them exactly 1 minute before their target checkout time.

## User Review Required

> [!IMPORTANT]
> - Reminders will use both **HTML5 Web Notifications** (so they run in the background or when the browser tab is minimized, if permission is granted) and an **in-app alarm modal** (which plays a soft alert beep and pops up a premium dialog when the user is active in the app).
> - We will provide toggles and target times for both Check-in and Check-out reminders on the **Pengaturan (Settings)** page.

## Proposed Changes

We will create a reminder settings store, add a background clock watcher in the app shell, build the alarm UI, and add customization controls in settings.

---

### State Management

#### [NEW] [reminder.js](file:///D:/data/devapp/apps/webatt_karyawan/src/store/reminder.js)
Create a store using `Vue.observable` to manage reminder configurations and prevent duplicate triggers:
- **Settings**:
  - `checkinReminderEnabled` (default: `true`)
  - `checkinTargetTime` (default: `"08:00"`)
  - `checkoutReminderEnabled` (default: `true`)
  - `checkoutTargetTime` (default: `"17:00"`)
  - `checkoutOffsetMinutes` (default: `1`)
- **State Tracks**:
  - `lastCheckinTriggeredDate` (e.g. `"2026-06-03"`)
  - `lastCheckoutTriggeredDate` (e.g. `"2026-06-03"`)
- **Actions**:
  - `updateSettings(settings)`
  - `requestNotificationPermission()`
  - `clearTriggerHistory()`

---

### Core UI & Shell Integration

#### [MODIFY] [App.vue](file:///D:/data/devapp/apps/webatt_karyawan/src/App.vue)
- Import `useReminderStore` and `useAttendanceStore`.
- Update `startClock()` to check for reminders every minute:
  1. Get current date key (`YYYY-MM-DD`) and current time (`HH:MM`).
  2. If Check-in reminder is enabled:
     - Check if current time matches `checkinTargetTime` and date has not been triggered.
     - Verify if user has check-in records for today.
     - If not, trigger the **Check-in Alarm**.
  3. If Check-out reminder is enabled:
     - Calculate target notification time (`checkoutTargetTime` minus `checkoutOffsetMinutes` = `16:59` for `17:00`).
     - Check if current time matches this target time and date has not been triggered.
     - Verify if user has check-out records for today.
     - If not, trigger the **Check-out Alarm**.
- Add a beautiful `<md-dialog>` for the **In-App Alarm Alert**:
  - Displays a custom pulsing alarm icon.
  - Plays a gentle synthesized beep using the Web Audio API (cross-platform, zero dependencies).
  - Offers a **"Absen Sekarang" (Absen Now)** button which navigates to home page `/` and prompts the user, or a **"Nanti" (Dismiss)** button.

#### [MODIFY] [PengaturanPage.vue](file:///D:/data/devapp/apps/webatt_karyawan/src/pages/PengaturanPage.vue)
- Add a new Card section: **"Pengingat Absensi (Alarm)"**.
- Add interactive controls:
  - Toggle for Check-in Reminder.
  - Input field (Time Picker) for Target Check-in Time.
  - Toggle for Check-out Reminder (defaults to 1 minute before target).
  - Input field (Time Picker) for Target Check-out Time.
  - A button to request/test browser Notifications permission.

---

## Verification Plan

### Automated Tests
- Run `pnpm build` to verify there are no compilation or template syntax issues.

### Manual Verification
1. **Reminder Configuration**: Change the check-in time in settings to 1 minute from the current time. Ensure the toggle is enabled.
2. **Check-in Trigger**: Wait 1 minute. Verify that:
   - A browser notification displays (if permissions are granted).
   - An in-app alarm dialog opens with a pulsing icon and plays a soft notification beep.
3. **Absen Action**: Click "Absen Sekarang" in the alarm dialog. Verify it redirects you to the home page `/` with the attendance context ready.
4. **Checkout Trigger**: Set the checkout time in settings to 2 minutes from now. Since the offset is 1 minute, the alarm should trigger in 1 minute. Verify it prompts the user correctly.
5. **Double-trigger Prevention**: Verify that completing the check-in/out cancels any pending alarms for that slot, and that the alarm does not trigger twice on the same day.
