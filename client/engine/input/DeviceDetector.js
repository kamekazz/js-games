export function isTouchDevice() {
  const hasFinePointer = window.matchMedia?.('(pointer: fine)').matches ?? true;
  return !hasFinePointer;
}

export function isMobile() {
  return isTouchDevice() && window.innerWidth < 1024;
}

export function getDeviceType() {
  if (!isTouchDevice()) return 'desktop';
  if (window.innerWidth < 768) return 'phone';
  return 'tablet';
}
