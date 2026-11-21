# Slott on Android

The Android project is in `android/` (Capacitor 8 wrapper around the web app, app id `app.slott.wms`, name **Slott**).
Launcher icons were generated from `public/icon.svg` by `node scripts/make-android-icons.mjs`.

## Build an APK (needs Android Studio / Android SDK, not available on the build machine used so far)
```bash
npm run build
npx cap sync android
npx cap open android      # then Build > Build APK(s), or Build > Generate Signed Bundle for the Play Store
```
Before a Play Store release: change `appId` in `capacitor.config.json` if you want your own reverse-domain, sign the bundle with your own keystore, and bump `versionCode` in `android/app/build.gradle`.
The app talks to Supabase over HTTPS, so no extra native permissions are needed beyond Internet (camera is only used when QR scanning is switched on).
