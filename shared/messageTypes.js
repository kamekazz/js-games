export const MessageTypes = {
  // Client → Server
  PLAYER_MOVE: 'player_move',
  PLAYER_SHOOT: 'player_shoot',
  PLAYER_RELOAD: 'player_reload',
  JOIN_ROOM: 'join_room',
  LEAVE_ROOM: 'leave_room',
  PLAYER_READY: 'player_ready',

  // Server → Client
  GAME_STATE: 'game_state',
  PLAYER_JOINED: 'player_joined',
  PLAYER_LEFT: 'player_left',
  ROOM_UPDATE: 'room_update',
  GAME_START: 'game_start',
  GAME_OVER: 'game_over',
  HIT_CONFIRM: 'hit_confirm',
  NIGHT_START: 'night_start',
  DAWN: 'dawn',
};
