import PlayerProgression, { ProgressionData } from './PlayerProgression';

export interface PlayerData {
    id: string;
    name: string;
    color: number;
    pos: { x: number; y: number; z: number };
    rotation: { x: number; y: number };
    weaponIndex: number;
    animation?: string;
    loadout?: string[];
    health?: number;
    maxHealth?: number;
    weaponReserves?: { [weaponName: string]: number };
    progression?: ProgressionData;
}

export interface InventoryItem {
    id: string;
    type: 'vaccine' | 'ammo' | 'health' | 'grenade' | 'consumable'; // ✅ Added more types
    name: string;
    count: number;
    weaponName?: string;
    data?: any; // For additional item data
}

export interface Boost {
    type: string;
    multiplier: number;
    expiresAt: number;
}

export default class Player {
    public id: string;
    public name: string;
    public color: number;
    public pos: { x: number; y: number; z: number };
    public rotation: { x: number; y: number };
    public weaponIndex: number;
    public animation: string;
    public loadout: string[];
    public posHistory: { pos: any; time: number }[] = [];
    public health: number;
    public maxHealth: number;
    public weaponReserves: { [weaponName: string]: number } = {};
    public collectedAmmoThisRoom: Set<string> = new Set();
    public collectedVaccineThisRoom: boolean = false;
    public isDead: boolean = false;

    // Match system properties
    public kills: number = 0;
    public deaths: number = 0;
    public score: number = 0;
    public team?: 'red' | 'blue';
    public walletAddress: string | null = null;
    public progression: PlayerProgression;

    public inventory: InventoryItem[] = [];
    public vaccineActive: boolean = false;
    public vaccineExpiryTime: number = 0;
    public lastSpawnTime: number = 0;

    // Grenade properties
    public maxGrenades: number = 3;
    public grenadeCount: number = 3;

    // ✅ Store properties (for marketplace)
    public tokenBalance: number = 0;  // $JBKS token balance
    public unlockedWeapons: string[] = [];  // Weapons player has purchased
    public unlockedSkins: string[] = [];  // Skins player has purchased
    public activeBoosts: Boost[] = [];  // Active boosts (XP, token multipliers)

    constructor(id: string, name: string, color: number = 0xff0000, position?: { x: number; y: number; z: number }) {
        this.id = id;
        this.name = name;
        this.color = color;
        this.pos = position || { x: 0, y: 30, z: 0 };
        this.rotation = { x: 0, y: 0 };
        this.weaponIndex = 0;
        this.animation = "idle";
        this.loadout = [];
        this.health = 100;
        this.maxHealth = 100;
        this.isDead = false;
        this.progression = new PlayerProgression();
        this.lastSpawnTime = Date.now();
    }

    recordPosition(pos: any) {
        this.posHistory.push({
            pos: { ...pos },
            time: Date.now()
        });

        if (this.posHistory.length > 20) {
            this.posHistory.shift();
        }
    }

    hasGrenades(): boolean {
        return this.grenadeCount > 0;
    }

    useGrenade(): boolean {
        if (this.grenadeCount > 0) {
            this.grenadeCount--;
            return true;
        }
        return false;
    }

    addGrenade(amount: number = 1): void {
        this.grenadeCount = Math.min(this.maxGrenades, this.grenadeCount + amount);
    }

    setPos(pos: { x: number; y: number; z: number }): void {
        this.pos = pos;
        this.recordPosition(pos);
    }

    setSpawnPoint(spawnPoint: { position: { x: number; y: number; z: number }, rotation: { x: number; y: number } }): void {
        this.pos = spawnPoint.position;
        this.rotation = spawnPoint.rotation;
    }

    setRotation(rotation: { x: number; y: number }): void {
        this.rotation = rotation;
    }

    setWeaponIndex(index: number): void {
        this.weaponIndex = index;
    }

    setWalletAddress(address: string) {
        this.walletAddress = address;
    }

    setAnimation(animation: string): void {
        this.animation = animation;
    }

    setLoadout(loadout: string[]): void {
        this.loadout = loadout;
        loadout.forEach(weaponName => {
            if (!(weaponName in this.weaponReserves)) {
                this.weaponReserves[weaponName] = 1;
            }
        });
    }

    resetRoomCollections(): void {
        this.collectedAmmoThisRoom.clear();
        this.collectedVaccineThisRoom = false;
    }

    canCollectAmmo(weaponName: string): boolean {
        return !this.collectedAmmoThisRoom.has(weaponName);
    }

    recordAmmoCollection(weaponName: string): void {
        this.collectedAmmoThisRoom.add(weaponName);
        this.weaponReserves[weaponName] = (this.weaponReserves[weaponName] || 0) + 1;
    }

    takeDamage(amount: number): boolean {
        this.health = Math.max(0, this.health - amount);
        if (this.health <= 0) {
            this.isDead = true;
        }
        return this.health <= 0;
    }

    heal(amount: number): void {
        this.health = Math.min(this.maxHealth, this.health + amount);
    }

    isAlive(): boolean {
        return this.health > 0;
    }

    getProgressionData(): ProgressionData {
        return this.progression.getProgressionData();
    }

    serverFormat(): PlayerData {
        return {
            id: this.id,
            name: this.name,
            color: this.color,
            pos: this.pos,
            rotation: this.rotation,
            weaponIndex: this.weaponIndex,
            animation: this.animation,
            loadout: this.loadout,
            health: this.health,
            maxHealth: this.maxHealth,
            weaponReserves: this.weaponReserves
        };
    }

    resetHealth(): void {
        this.health = this.maxHealth;
        this.isDead = false;
        this.lastSpawnTime = Date.now();
    }

    resetWeaponReserves(): void {
        this.weaponReserves = {};
        if (this.loadout) {
            this.loadout.forEach(weaponName => {
                this.weaponReserves[weaponName] = 1;
            });
        }
    }

    fullReset(): void {
        this.resetHealth();
        this.resetWeaponReserves();
        this.resetRoomCollections();
        this.isDead = false;
        this.kills = 0;
        this.deaths = 0;
        this.score = 0;
        this.lastSpawnTime = Date.now();
        this.grenadeCount = this.maxGrenades;
        this.tokenBalance = 0;
    }

    clientFormat(): PlayerData {
        return {
            id: this.id,
            name: this.name,
            color: this.color,
            pos: this.pos,
            rotation: this.rotation,
            weaponIndex: this.weaponIndex,
            animation: this.animation,
            loadout: this.loadout || [],
            health: this.health,
            maxHealth: this.maxHealth,
            progression: this.getProgressionData(),
            weaponReserves: this.weaponReserves
        };
    }
}