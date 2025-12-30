// 服务端常量定义 (CommonJS)

const SOCKET_EVENTS = {
    CONNECT: 'connect',
    DISCONNECT: 'disconnect',
    PING: 'ping',
    YOUR_ID: 'your_id',
    ERROR_MSG: 'error_msg',
    KICKED: 'kicked',

    CREATE_ROOM: 'create_room',
    JOIN_ROOM: 'join_room',
    ROOM_INFO: 'room_info',
    UPDATE_ROOM_CONFIG: 'update_room_config',
    ADD_BOT: 'add_bot',
    KICK_PLAYER: 'kick_player',
    SWITCH_SEAT: 'switch_seat',
    SPECTATOR_JOIN: 'spectator_join',

    ENTER_DRAW_PHASE: 'enter_draw_phase',
    DRAW_SEAT_CARD: 'draw_seat_card',
    SEAT_DRAW_UPDATE: 'seat_draw_update',
    SEAT_DRAW_FINISHED: 'seat_draw_finished',

    PLAYER_READY: 'player_ready',
    READY_STATE_UPDATE: 'ready_state_update',
    START_GAME: 'start_game',
    GAME_STARTED: 'game_started',
    NEXT_ROUND: 'next_round',
    GAME_STATE_UPDATE: 'game_state_update',
    HAND_UPDATE: 'hand_update',
    OBSERVATION_UPDATE: 'observation_update',
    
    PLAY_CARDS: 'play_cards',
    PASS_TURN: 'pass_turn',
    PLAY_ERROR: 'play_error',
    TOGGLE_AUTO_PLAY: 'toggle_auto_play',
    SWITCH_AUTOPLAY_MODE: 'switch_autoplay_mode',
    REQUEST_HINT: 'request_hint',

    ROUND_OVER: 'round_over',
    GRAND_GAME_OVER: 'grand_game_over',
};

const GAME_STATES = {
    LOGIN: 'LOGIN',
    LOBBY: 'LOBBY',
    DRAW_SEATS: 'DRAW_SEATS',
    GAME: 'GAME',
};

const SHUFFLE_STRATEGIES = {
    CLASSIC: 'CLASSIC',
    NO_SHUFFLE: 'NO_SHUFFLE',
    SIMULATION: 'SIMULATION',
    PRECISE: 'PRECISE',
};

const AUTOPLAY_MODES = {
    SMART: 'SMART',
    THRIFTY: 'THRIFTY',
    AFK: 'AFK',
};

module.exports = {
    SOCKET_EVENTS,
    GAME_STATES,
    SHUFFLE_STRATEGIES,
    AUTOPLAY_MODES
};