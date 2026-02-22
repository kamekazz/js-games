/** Centralized DOM selectors for E2E tests. */

// Auth scene
export const AUTH = {
  username: '#auth-username',
  password: '#auth-password',
  submit: '#auth-submit',
  guest: '#auth-guest',
  error: '#auth-error',
  toggle: '#auth-toggle',
};

// Main menu
export const MENU = {
  name: '#menu-name',
  create: '#menu-create',
  code: '#menu-code',
  join: '#menu-join',
  error: '#menu-error',
  logout: '#menu-logout',
};

// HUD
export const HUD = {
  hpBar: '#hud-hp-bar',
  staminaBar: '#hud-stamina-bar',
  weaponName: '#hud-weapon-name',
  ammo: '#hud-ammo',
  ammoReserve: '#hud-ammo-reserve',
  reloadHint: '#hud-reload-hint',
  weaponHints: '#hud-weapon-hints',
  wave: '#hud-wave',
  kills: '#hud-kills',
  score: '#hud-score',
  actionContainer: '#hud-action-container',
  actionBar: '#hud-action-bar',
  actionLabel: '#hud-action-label',
  killFeed: '#hud-kill-feed',
};

// Game container / canvas
export const GAME = {
  container: '#game-container',
  canvas: '#game-container canvas',
};

// Results screen
export const RESULTS = {
  continueBtn: '#results-continue',
};
