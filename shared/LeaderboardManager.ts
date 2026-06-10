interface LeaderboardEntry {
    playerId: string; 
    playerName: string;
    kills: number; 
    deaths: number; 
    kdRatio: number;
    score: number; 
    level: number; 
    headshots: number;
    highestKillstreak: number; 
    lastUpdated: number;
    wallet?: string;
    tokenBalance?: number;  // ✅ ADD THIS
}

export default class LeaderboardManager {
    private entries: Map<string, LeaderboardEntry> = new Map();
    private _broadcastFn: ((event: string, data: any) => void) | null = null;

    constructor() {
        setInterval(() => { 
            if (this._broadcastFn) this._broadcastFn('leaderboardUpdate', this.getLeaderboardData()); 
        }, 5000);
    }

    updatePlayer(playerId: string, playerName: string, stats: { 
        kills: number; 
        deaths: number; 
        level: number; 
        headshots: number; 
        highestKillstreak: number; 
        score: number; 
        wallet?: string;
        tokenBalance?: number;  // ✅ ADD THIS
    }) {
        const kdRatio = stats.deaths > 0 ? parseFloat((stats.kills / stats.deaths).toFixed(2)) : stats.kills;
        const existing = this.entries.get(playerId);
        this.entries.set(playerId, { 
            playerId, 
            playerName, 
            kills: stats.kills, 
            deaths: stats.deaths, 
            kdRatio, 
            score: stats.score, 
            level: stats.level, 
            headshots: stats.headshots, 
            highestKillstreak: stats.highestKillstreak, 
            lastUpdated: Date.now(), 
            wallet: stats.wallet || existing?.wallet,
            tokenBalance: stats.tokenBalance ?? existing?.tokenBalance ?? 0  // ✅ ADD THIS
        });
    }

    removePlayer(playerId: string) { 
        this.entries.delete(playerId); 
    }

    getTopPlayers(limit: number = 10, sortBy: string = 'score'): LeaderboardEntry[] {
        return Array.from(this.entries.values())
            .sort((a, b) => { 
                switch(sortBy) { 
                    case 'kills': return b.kills - a.kills; 
                    case 'kd': return b.kdRatio - a.kdRatio; 
                    case 'level': return b.level - a.level; 
                    case 'headshots': return b.headshots - a.headshots; 
                    case 'killstreak': return b.highestKillstreak - a.highestKillstreak;
                    case 'tokenBalance': return (b.tokenBalance || 0) - (a.tokenBalance || 0);  // ✅ ADD THIS
                    default: return b.score - a.score; 
                } 
            })
            .slice(0, limit);
    }

    getPlayerRank(playerId: string): number {
        return Array.from(this.entries.values()).sort((a, b) => b.score - a.score).findIndex(e => e.playerId === playerId) + 1;
    }

    getPlayerStats(playerId: string): LeaderboardEntry | null { 
        return this.entries.get(playerId) || null; 
    }

    getLeaderboardData(sortBy: string = 'score'): { entries: LeaderboardEntry[]; totalPlayers: number } {
        return { 
            entries: this.getTopPlayers(50, sortBy), 
            totalPlayers: this.entries.size 
        };
    }

    setBroadcastFunction(fn: (event: string, data: any) => void) { 
        this._broadcastFn = fn; 
    }
}