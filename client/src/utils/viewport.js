/**
 * Динамічне управління viewport висотою для мобільних браузерів
 * Вирішує проблему з адресною строкою в Safari, Chrome Mobile
 */

export const initViewportHeight = () => {
  // Функція для встановлення реальної висоти viewport
  const setViewportHeight = () => {
    // Отримуємо максимально точну висоту viewport (visualViewport, fallback innerHeight)
    const viewportHeight = window.visualViewport?.height || window.innerHeight;
    const vh = viewportHeight * 0.01;
    // Встановлюємо CSS змінну
    document.documentElement.style.setProperty('--vh', `${vh}px`);

    // Додаткові змінні для різних сценаріїв
    const safeAreaBottom = parseInt(
      getComputedStyle(document.documentElement).getPropertyValue('env(safe-area-inset-bottom)') || '0'
    );

    // Висота bottom nav (динамічно, якщо елемент вже в DOM)
    const navEl = document.querySelector('.bottom-nav-mobile');
    const bottomNavHeight = navEl?.offsetHeight || 56;

    // Встановлюємо змінні
    document.documentElement.style.setProperty('--bottom-nav-height', `${bottomNavHeight}px`);
    document.documentElement.style.setProperty('--safe-area-bottom', `${safeAreaBottom}px`);
    document.documentElement.style.setProperty('--app-bottom-offset', `${bottomNavHeight + safeAreaBottom}px`);

    // Для messenger специфічно
    const isMessengerPage = window.location.pathname === '/messages';
    if (isMessengerPage) {
      document.body.classList.add('messenger-page');
      // Повна висота без bottom nav
      document.documentElement.style.setProperty('--messenger-height', `${window.innerHeight}px`);
    } else {
      document.body.classList.remove('messenger-page');
    }
  };

  // Встановлюємо початкове значення
  setViewportHeight();

  // Оновлюємо при зміні розміру вікна
  window.addEventListener('resize', setViewportHeight);
  window.addEventListener('orientationchange', setViewportHeight);

  // Для iOS Safari - відслідковуємо зміну висоти при скролі
  let lastHeight = window.innerHeight;
  const checkHeight = () => {
    if (window.innerHeight !== lastHeight) {
      lastHeight = window.innerHeight;
      setViewportHeight();
    }
  };

  window.addEventListener('scroll', checkHeight);
  window.addEventListener('touchmove', checkHeight);

  // Cleanup функція
  return () => {
    window.removeEventListener('resize', setViewportHeight);
    window.removeEventListener('orientationchange', setViewportHeight);
    window.removeEventListener('scroll', checkHeight);
    window.removeEventListener('touchmove', checkHeight);
  };
};
