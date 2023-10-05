export enum SocketEvents {
    // all

    SERVER_ALL_SESSION_START = 'server-all-session-start',
    SERVER_ALL_SESSION_END = 'server-all-session-end',


    // boss

    BOSS_SERVER_JOIN = 'boss-server-join',
    BOSS_SERVER_RUN_SESSION = 'boss-server-run-session',
    BOSS_SERVER_PAUSE_SESSION = 'boss-server-pause-session',

    SERVER_BOSS_ADD_LIP = 'server-boss-add-lip',
    SERVER_BOSS_REMOVE_LIP = 'server-boss-remove-lip',


    // guest

    GUEST_SERVER_JOIN = 'guest-server-join',

    SERVER_GUEST_UPDATE_LIP = 'server-guest-update-lip',


    // tool

    TOOL_SERVER_JOIN = 'tool-server-join',

    SERVER_TOOL_SHOW_HOME = 'server-tool-show-home',
    SERVER_TOOL_SHOW_SONG = 'server-tool-show-song',
    SERVER_TOOL_CALL_SINGER = 'server-tool-call-singer',
    SERVER_TOOL_CONNECT_AUTO = 'server-tool-connect-auto',
}