// App Version Control
const APP_VERSION = process.env.REACT_APP_APP_VERSION || '3.0.1';
const BUILD_ID = process.env.REACT_APP_BUILD_ID || process.env.REACT_APP_COMMIT_SHA || '';
const BUILD_DATE = process.env.REACT_APP_BUILD_DATE || '';
const VERSION_KEY = BUILD_ID ? `${APP_VERSION}.${BUILD_ID}` : APP_VERSION;

export { APP_VERSION, BUILD_DATE, BUILD_ID };

// Version check function
export const checkVersion = () => {
  const stored = localStorage.getItem('app_version');
  if (stored !== VERSION_KEY) {
    console.log(`🔄 New version detected: ${VERSION_KEY} (was ${stored})`);

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
    localStorage.setItem('app_version', VERSION_KEY);
    if (BUILD_ID) {
      localStorage.setItem('build_id', BUILD_ID.toString());
    }

    // Force reload
    window.location.reload(true);
  }
};

// Auto-check on load
checkVersion();

document.documentElement.dataset.build = VERSION_KEY;

console.log(`📱 Biolab Logistik Planner v${APP_VERSION}`);
console.log(`🏗️ Build ID: ${BUILD_ID || 'n/a'}`);
console.log(`📅 Build Date: ${BUILD_DATE || 'n/a'}`);
