export function isTouchDevice() {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

export function isMobile() {
  return isTouchDevice() && window.innerWidth < 1024;
}

export function getDeviceType() {
  if (!isTouchDevice()) return 'desktop';
  if (window.innerWidth < 768) return 'phone';
  return 'tablet';
}
