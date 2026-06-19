// shared/LobbyManager.ts
import Lobby, { LobbyState } from './Lobby.js';

export default class LobbyManager {
    private lobbies = new Map<string, Lobby>();
    private playerToLobby = new Map<string, string>(); // playerId -> lobbyId

    createLobby(lobbyId: string, hostId: string, hostName: string): Lobby {
        const lobby = new Lobby(lobbyId, hostId, hostName);
        this.lobbies.set(lobbyId, lobby);
        this.playerToLobby.set(hostId, lobbyId);
        return lobby;
    }

    getLobby(lobbyId: string): Lobby | undefined {
        return this.lobbies.get(lobbyId);
    }

    getPlayerLobby(playerId: string): Lobby | undefined {
        const lobbyId = this.playerToLobby.get(playerId);
        return lobbyId ? this.lobbies.get(lobbyId) : undefined;
    }

    addPlayerToLobby(lobbyId: string, playerId: string, playerName: string): boolean {
        const lobby = this.lobbies.get(lobbyId);
        if (!lobby) return false;

        if (lobby.addPlayer(playerId, playerName)) {
            this.playerToLobby.set(playerId, lobbyId);
            return true;
        }
        return false;
    }

    removePlayerFromLobby(playerId: string): Lobby | undefined {
        const lobbyId = this.playerToLobby.get(playerId);
        if (!lobbyId) return undefined;

        const lobby = this.lobbies.get(lobbyId);
        if (!lobby) return undefined;

        // Remove player's vote before removing from lobby
        const playerData = lobby.players.get(playerId);
        if (playerData) {
            // Player might have a vote that needs cleanup
            const playerVote = lobby.getPlayerVote?.(playerId);
            if (playerVote && lobby.mapVotes) {
                const currentCount = lobby.mapVotes.get(playerVote) || 0;
                lobby.mapVotes.set(playerVote, Math.max(0, currentCount - 1));
            }
        }

        lobby.removePlayer(playerId);
        this.playerToLobby.delete(playerId);

        return lobby;
    }

    // Add method to check if lobby exists and is empty
    isLobbyEmpty(lobbyId: string): boolean {
        const lobby = this.lobbies.get(lobbyId);
        return lobby ? lobby.isEmpty() : true;
    }

    getAvailableLobbies(excludeFull: boolean = true): Lobby[] {
        return Array.from(this.lobbies.values())
            .filter(lobby => {
                if (lobby.state !== LobbyState.WAITING) return false;
                if (excludeFull && lobby.players.size >= lobby.maxPlayers) return false;
                return true;
            });
    }

    getAllLobbies(): Lobby[] {
        return Array.from(this.lobbies.values());
    }

    removeLobby(lobbyId: string): boolean {
        return this.lobbies.delete(lobbyId);
    }

    getLobbiesCount(): number {
        return this.lobbies.size;
    }
}
