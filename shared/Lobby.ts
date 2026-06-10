// shared/Lobby.ts
export interface LobbyPlayerData {
    id: string;
    name: string;
    isReady: boolean;
    selectedLoadout?: string[];
}

export enum LobbyState {
    WAITING = 'waiting',
    VOTING = 'voting',
    READY = 'ready',
    STARTING = 'starting',
    IN_GAME = 'in_game'
}

export interface MapVote {
    mapKey: string;
    mapName: string;
    votes: number;
}

export default class Lobby {
    public id: string;
    public hostId: string;
    public state: LobbyState = LobbyState.WAITING;
    public players: Map<string, LobbyPlayerData> = new Map();
    public mapVotes: Map<string, number> = new Map(); // mapKey -> vote count
    public playerVotes: Map<string, string> = new Map(); // playerId -> mapKey (track individual votes)
    public selectedMap: string = 'shooting_range';
    public createdAt: number = Date.now();
    public maxPlayers: number = 10;
    public gameDuration: number = 600000; // Default 10 minutes in milliseconds
    public maxGameDuration: number = 1800000; // Max 30 minutes
    public minGameDuration: number = 60000; // Min 1 minute

    // Available maps with loadout support
    public availableMaps = [
        { key: 'shooting_range', name: 'Shooting Range', hasLoadout: true, hasRooms: true },
        { key: 'greeble_map', name: 'Ancient Ruins', hasLoadout: true, hasRooms: false },
        { key: 'lowpoly_environment', name: 'Low Poly Valley', hasLoadout: true, hasRooms: false }
    ];

    constructor(id: string, hostId: string, hostName: string) {
        this.id = id;
        this.hostId = hostId;
        this.players.set(hostId, {
            id: hostId,
            name: hostName,
            isReady: false
        });
        
        // Initialize vote map
        this.availableMaps.forEach(m => {
            this.mapVotes.set(m.key, 0);
        });
    }

    addPlayer(playerId: string, playerName: string): boolean {
        if (this.players.size >= this.maxPlayers) {
            return false;
        }
        if (this.players.has(playerId)) {
            return false;
        }
        this.players.set(playerId, {
            id: playerId,
            name: playerName,
            isReady: false
        });
        return true;
    }

    removePlayer(playerId: string): boolean {
        if (!this.players.has(playerId)) {
            return false;
        }
        
        // Remove player's vote if they had one
        const previousVote = this.playerVotes.get(playerId);
        if (previousVote) {
            const currentCount = this.mapVotes.get(previousVote) || 0;
            this.mapVotes.set(previousVote, Math.max(0, currentCount - 1));
            this.playerVotes.delete(playerId);
        }
        
        this.players.delete(playerId);
        
        // If host left, reassign
        if (playerId === this.hostId && this.players.size > 0) {
            const firstPlayer = Array.from(this.players.values())[0];
            this.hostId = firstPlayer.id;
        }
        
        return true;
    }

    setPlayerReady(playerId: string, isReady: boolean): boolean {
        const player = this.players.get(playerId);
        if (!player) return false;
        player.isReady = isReady;
        return true;
    }

    setPlayerLoadout(playerId: string, loadout: string[]): boolean {
        const player = this.players.get(playerId);
        if (!player) return false;
        player.selectedLoadout = loadout;
        return true;
    }

    voteForMap(playerId: string, mapKey: string): boolean {
        if (!this.players.has(playerId)) {
            console.log(`❌ Player ${playerId} not in lobby`);
            return false;
        }
        if (!this.mapVotes.has(mapKey)) {
            console.log(`❌ Invalid map key: ${mapKey}`);
            return false;
        }
        
        // Remove player's previous vote
        const previousVote = this.playerVotes.get(playerId);
        if (previousVote) {
            const previousCount = this.mapVotes.get(previousVote) || 0;
            this.mapVotes.set(previousVote, Math.max(0, previousCount - 1));
            console.log(`🗳️ Removed previous vote for ${previousVote}`);
        }
        
        // Add new vote
        const newCount = (this.mapVotes.get(mapKey) || 0) + 1;
        this.mapVotes.set(mapKey, newCount);
        this.playerVotes.set(playerId, mapKey);
        
        console.log(`🗳️ Player ${playerId} voted for ${mapKey}, new count: ${newCount}`);
        console.log(`📊 Current vote counts:`, Object.fromEntries(this.mapVotes));
        
        // Determine selected map (highest votes)
        let maxVotes = -1;
        let winningMap = this.selectedMap;
        for (const [map, count] of this.mapVotes.entries()) {
            if (count > maxVotes) {
                maxVotes = count;
                winningMap = map;
            }
        }
        this.selectedMap = winningMap;
        
        return true;
    }

    getVoteResults(): MapVote[] {
        const results: MapVote[] = [];
        
        for (const map of this.availableMaps) {
            results.push({
                mapKey: map.key,
                mapName: map.name,
                votes: this.mapVotes.get(map.key) || 0
            });
        }
        
        console.log(`📊 getVoteResults returning:`, results);
        return results.sort((a, b) => b.votes - a.votes);
    }

    getPlayerVote(playerId: string): string | null {
        return this.playerVotes.get(playerId) || null;
    }

    setSelectedMap(mapKey: string): boolean {
        if (!this.mapVotes.has(mapKey)) {
            return false;
        }
        this.selectedMap = mapKey;
        return true;
    }

    canStart(): boolean {
        if (this.players.size < 2) return false;
        return true;
    }

    areAllPlayersReady(): boolean {
        if (this.players.size < 2) return false;
        return Array.from(this.players.values()).every(p => p.isReady);
    }

    getPlayerList(): LobbyPlayerData[] {
        return Array.from(this.players.values());
    }

    isEmpty(): boolean {
        return this.players.size === 0;
    }

    setGameDuration(duration: number): boolean {
        // Validate duration is within bounds
        if (duration < this.minGameDuration || duration > this.maxGameDuration) {
            return false;
        }
        this.gameDuration = duration;
        return true;
    }

    getGameDuration(): number {
        return this.gameDuration;
    }

    getGameDurationMinutes(): number {
        return Math.round(this.gameDuration / 60000);
    }

    reset(): void {
        this.state = LobbyState.WAITING;
        this.players.forEach(p => p.isReady = false);
        // Reset votes but keep structure
        this.mapVotes.forEach((_, key) => this.mapVotes.set(key, 0));
        this.playerVotes.clear();
        this.selectedMap = 'shooting_range';
        this.gameDuration = 600000; // Reset to default
    }
}