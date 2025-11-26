// App Version Control
export const APP_VERSION = '3.0.0';
export const BUILD_DATE = new Date().toISOString();
export const BUILD_ID = Date.now();

// Version check function
export const checkVersion = () => {
  const stored = localStorage.getItem('app_version');
  if (stored !== APP_VERSION) {
    console.log(`🔄 New version detected: ${APP_VERSION} (was ${stored})`);

    // Clear all caches
    if ('caches' in window) {
      caches.keys().then(names => {
        names.forEach(name => {
          caches.delete(name);
        });
      });
    }

    // Clear local storage except user data
    const userToken = localStorage.getItem('token');
    const userId = localStorage.getItem('userId');
    localStorage.clear();

    // Restore user data
    if (userToken) localStorage.setItem('token', userToken);
    if (userId) localStorage.setItem('userId', userId);

    // Store new version
    localStorage.setItem('app_version', APP_VERSION);
    localStorage.setItem('build_id', BUILD_ID.toString());

    // Force reload
    window.location.reload(true);
  }
};

// Auto-check on load
checkVersion();

console.log(`📱 Biolab Logistik Planner v${APP_VERSION}`);
console.log(`🏗️ Build ID: ${BUILD_ID}`);
console.log(`📅 Build Date: ${BUILD_DATE}`);