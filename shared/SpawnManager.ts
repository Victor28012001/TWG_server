// shared/SpawnManager.ts
export interface SpawnPoint {
    id: number;
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number };
    isOccupied: boolean;
    occupiedBy: string | null;
    lastOccupiedTime: number | null;
}

export default class SpawnManager {
    private spawnPoints: Map<number, SpawnPoint> = new Map();
    private playerSpawnMap: Map<string, number> = new Map();

    constructor(numSpawnPoints: number = 40, yPosition: number = 150, spread: number = 1800) {
        // Generate spawn points dynamically like the floating boxes
        const spawns = [];
        
        for (let i = 0; i < numSpawnPoints; i++) {
            // Generate random positions within the spread range
            const posX = (Math.random() - 0.5) * spread;
            const posZ = (Math.random() - 0.5) * spread;
            
            spawns.push({
                x: posX,
                y: yPosition,
                z: posZ
            });
        }
        
        spawns.forEach((pos, index) => {
            this.spawnPoints.set(index, {
                id: index,
                position: pos,
                rotation: { x: 0, y: Math.random() * Math.PI * 2 },
                isOccupied: false,
                occupiedBy: null,
                lastOccupiedTime: null
            });
        });
        
        console.log(`Generated ${this.spawnPoints.size} spawn points at Y=${yPosition}`);
    }

    // Method to update spawn points (can be called from client if needed)
    updateSpawnPoints(spawnPositions: Array<{x: number, y: number, z: number}>) {
        this.spawnPoints.clear();
        spawnPositions.forEach((pos, index) => {
            this.spawnPoints.set(index, {
                id: index,
                position: pos,
                rotation: { x: 0, y: Math.random() * Math.PI * 2 },
                isOccupied: false,
                occupiedBy: null,
                lastOccupiedTime: null
            });
        });
        console.log(`Updated to ${this.spawnPoints.size} spawn points`);
    }

    // ✅ Get random spawn point (not necessarily free)
    getRandomSpawnPoint(): { position: { x: number; y: number; z: number }, rotation: { x: number; y: number } } | null {
        if (this.spawnPoints.size === 0) return null;
        
        // Convert map to array for random selection
        const spawnArray = Array.from(this.spawnPoints.values());
        const randomIndex = Math.floor(Math.random() * spawnArray.length);
        const spawn = spawnArray[randomIndex];
        
        return {
            position: spawn.position,
            rotation: spawn.rotation
        };
    }

    // ✅ Get random unoccupied spawn point
    getRandomFreeSpawnPoint(playerId?: string): { position: { x: number; y: number; z: number }, rotation: { x: number; y: number } } | null {
        // Release player's previous spawn if exists
        if (playerId && this.playerSpawnMap.has(playerId)) {
            const prevId = this.playerSpawnMap.get(playerId);
            if (prevId !== undefined) {
                const prevSpawn = this.spawnPoints.get(prevId);
                if (prevSpawn) {
                    prevSpawn.isOccupied = false;
                    prevSpawn.occupiedBy = null;
                }
            }
            this.playerSpawnMap.delete(playerId);
        }
        
        // Get all unoccupied spawn points
        const freeSpawns = Array.from(this.spawnPoints.values()).filter(spawn => !spawn.isOccupied);
        
        let selectedSpawn: SpawnPoint;
        
        if (freeSpawns.length === 0) {
            // All spawns occupied, use random spawn
            const spawnArray = Array.from(this.spawnPoints.values());
            const randomIndex = Math.floor(Math.random() * spawnArray.length);
            selectedSpawn = spawnArray[randomIndex];
            
            // Remove previous occupant if any
            if (selectedSpawn.occupiedBy) {
                this.playerSpawnMap.delete(selectedSpawn.occupiedBy);
            }
        } else {
            // Pick random free spawn point
            const randomIndex = Math.floor(Math.random() * freeSpawns.length);
            selectedSpawn = freeSpawns[randomIndex];
        }
        
        // Assign the spawn point
        if (playerId) {
            selectedSpawn.isOccupied = true;
            selectedSpawn.occupiedBy = playerId;
            selectedSpawn.lastOccupiedTime = Date.now();
            this.playerSpawnMap.set(playerId, selectedSpawn.id);
        }
        
        console.log(`Player ${playerId} assigned to random spawn point ${selectedSpawn.id} at (${selectedSpawn.position.x}, ${selectedSpawn.position.y}, ${selectedSpawn.position.z})`);
        
        return {
            position: selectedSpawn.position,
            rotation: selectedSpawn.rotation
        };
    }

    // Get a free spawn point for a new player (sequential, not random)
    getFreeSpawnPoint(playerId: string): { position: { x: number; y: number; z: number }, rotation: { x: number; y: number } } | null {
        // First, check if player already has a spawn point
        const existingSpawnId = this.playerSpawnMap.get(playerId);
        if (existingSpawnId !== undefined) {
            const existingSpawn = this.spawnPoints.get(existingSpawnId);
            if (existingSpawn && existingSpawn.occupiedBy === playerId) {
                return {
                    position: existingSpawn.position,
                    rotation: existingSpawn.rotation
                };
            }
        }

        // Find first unoccupied spawn point
        for (const [id, spawn] of this.spawnPoints) {
            if (!spawn.isOccupied) {
                spawn.isOccupied = true;
                spawn.occupiedBy = playerId;
                spawn.lastOccupiedTime = Date.now();
                this.playerSpawnMap.set(playerId, id);
                
                console.log(`Player ${playerId} assigned to spawn point ${id} at (${spawn.position.x}, ${spawn.position.y}, ${spawn.position.z})`);
                return {
                    position: spawn.position,
                    rotation: spawn.rotation
                };
            }
        }

        // If all spawn points are occupied, find the least recently used one
        let oldestSpawn: SpawnPoint | null = null;
        let oldestTime = Infinity;

        for (const spawn of this.spawnPoints.values()) {
            if (spawn.lastOccupiedTime && spawn.lastOccupiedTime < oldestTime) {
                oldestTime = spawn.lastOccupiedTime;
                oldestSpawn = spawn;
            }
        }

        if (oldestSpawn) {
            if (oldestSpawn.occupiedBy) {
                this.playerSpawnMap.delete(oldestSpawn.occupiedBy);
            }
            
            oldestSpawn.occupiedBy = playerId;
            oldestSpawn.lastOccupiedTime = Date.now();
            this.playerSpawnMap.set(playerId, oldestSpawn.id);
            
            console.log(`Player ${playerId} assigned to spawn point ${oldestSpawn.id} (LRU)`);
            return {
                position: oldestSpawn.position,
                rotation: oldestSpawn.rotation
            };
        }

        // Fallback to first spawn point
        const fallbackSpawn = this.spawnPoints.get(0);
        return fallbackSpawn ? {
            position: fallbackSpawn.position,
            rotation: fallbackSpawn.rotation
        } : null;
    }

    // Release a spawn point when player disconnects
    releaseSpawnPoint(playerId: string): void {
        const spawnId = this.playerSpawnMap.get(playerId);
        if (spawnId !== undefined) {
            const spawn = this.spawnPoints.get(spawnId);
            if (spawn) {
                spawn.isOccupied = false;
                spawn.occupiedBy = null;
                spawn.lastOccupiedTime = Date.now();
            }
            this.playerSpawnMap.delete(playerId);
            console.log(`Spawn point ${spawnId} released by player ${playerId}`);
        }
    }

    // Get all spawn points (for syncing to client)
    getAllSpawnPoints(): SpawnPoint[] {
        return Array.from(this.spawnPoints.values());
    }
    
    // Get spawn point positions only (for creating boxes)
    getSpawnPositions(): Array<{x: number, y: number, z: number}> {
        return Array.from(this.spawnPoints.values()).map(sp => sp.position);
    }
}