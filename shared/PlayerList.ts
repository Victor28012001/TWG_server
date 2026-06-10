import Player from './Player';

export default class PlayerList {
    private players: Player[] = [];

    add(newPlayer: Player): void {
        this.players.push(newPlayer);
    }

    find(playerId: string): Player | null {
        for (const player of this.players) {
            if (player.id === playerId) {
                return player;
            }
        }
        return null;
    }

    remove(player: Player): void {
        const arrIndex = this.players.indexOf(player);
        if (arrIndex >= 0) {
            this.players.splice(arrIndex, 1);
        }
    }

    getAll(): Player[] {
        return this.players;
    }
}
