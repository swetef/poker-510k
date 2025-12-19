// ==========================================
// 游戏服务端全局配置文件
// 方便后续调整游戏平衡性、修改常驻房间参数
// ==========================================

// 常驻房间配置 (服务器重启后会自动创建这些房间)
const PERMANENT_ROOMS = {
    '888': { 
        deckCount: 2,           // 几副牌
        maxPlayers: 4,          // 最大人数
        targetScore: 1000,      // 目标分数
        turnTimeout: 60000,     // 出牌时间(毫秒)
        showCardCountMode: 1,   // 剩牌显示模式
        isTeamMode: false,      // 是否组队
        enableRankPenalty: false, // 排名赏罚
        rankPenaltyScores: [50, 20], // 赏罚分数配置
        shuffleStrategy: 'CLASSIC' // 洗牌策略: CLASSIC(随机), NO_SHUFFLE(不洗牌)
    },
    '666': { 
        deckCount: 3, 
        maxPlayers: 6, 
        targetScore: 1000, 
        turnTimeout: 60000,
        showCardCountMode: 1,
        isTeamMode: true, 
        enableRankPenalty: false,
        rankPenaltyScores: [50, 20],
        shuffleStrategy: 'NO_SHUFFLE'
    }
};

// 可以在这里添加更多全局常量
const GLOBAL_CONFIG = {
    SERVER_PORT: 3001,
    // 比如：Bot 的思考时间波动范围
    BOT_THINK_MIN: 1000,
    BOT_THINK_MAX: 2000
};

module.exports = {
    PERMANENT_ROOMS,
    GLOBAL_CONFIG
};