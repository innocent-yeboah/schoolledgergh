/**
 * Example only. Capacitor is not installed in this repo.
 *
 * SchoolLedger's admin and SMS routes run on the Next.js server, so an Android
 * wrapper should load the deployed site instead of a static export:
 *
 *   server.url = "https://YOUR_DEPLOYMENT"
 *
 * Install later with:
 *   npm install @capacitor/core @capacitor/cli @capacitor/android
 *   npx cap init "SchoolLedger GH" gh.schoolledger.app --web-dir public
 *   npx cap add android
 */
const config = {
  appId: "gh.schoolledger.app",
  appName: "SchoolLedger GH",
  webDir: "public",
  server: {
    url: "https://YOUR_DEPLOYMENT",
    cleartext: false,
    androidScheme: "https",
  },
};

export default config;
