// // shared/RoomManager.ts
import { ROOM_DEFINITIONS } from './RoomDefinitions';

export interface Room {
    id: string;
    buildingId: string;
    name: string;
    position: { x: number; y: number; z: number };
    ammoBoxPosition: { x: number; y: number; z: number };
    vaccineBoxPosition: { x: number; y: number; z: number };
    radius: number;
    ammoBox: {
        id: string;
        isOpen: boolean;
        openedAt: number | null;
        collectedBy: string[];        // player IDs who collected (any weapon)
        // NEW: per-weapon collection — key = weaponName, value = array of playerIds
        weaponCollections: { [weaponName: string]: string[] };
    };
    vaccineBox: {
        id: string;
        isOpen: boolean;
        openedAt: number | null;
        collectedBy: string[];
    };
    isActive: boolean;
    activeUntil: number | null;
}

export const AMMO_SLOTS_PER_WEAPON = 2;  // max players who can take ammo for 1 weapon

export default class RoomManager {
    private rooms: Map<string, Room> = new Map();
    private activeRoomId: string | null = null;
    private roomActiveDuration = 120000;
    private cooldownDuration = 2000;
    public _activationSetup: boolean = false;

    constructor() {
        this.initializeRooms();
        this.startRoomCycle();
    }

    private initializeRooms(): void {
        ROOM_DEFINITIONS.forEach(def => {
            this.rooms.set(def.id, {
                ...def,
                ammoBox: {
                    id: `${def.id}_ammo`,
                    isOpen: false,
                    openedAt: null,
                    collectedBy: [],
                    weaponCollections: {}   // NEW
                },
                vaccineBox: {
                    id: `${def.id}_vaccine`,
                    isOpen: false,
                    openedAt: null,
                    collectedBy: []
                },
                isActive: false,
                activeUntil: null
            });
        });
        console.log(`Initialized ${this.rooms.size} rooms`);
    }

    startRoomCycle(): void {
        this.activateRandomRoom();
        const cycle = () => {
            setTimeout(() => {
                this.activateRandomRoom();
                cycle();
            }, this.roomActiveDuration + this.cooldownDuration);
        };
        cycle();
    }

    activateRandomRoom(): Room | null {
        if (this.activeRoomId) {
            const currentRoom = this.rooms.get(this.activeRoomId);
            if (currentRoom) {
                currentRoom.isActive = false;
                currentRoom.activeUntil = null;
            }
        }

        const roomList = Array.from(this.rooms.values());
        if (roomList.length === 0) return null;

        const randomIndex = Math.floor(Math.random() * roomList.length);
        const selectedRoom = { ...roomList[randomIndex] };

        // Reset ALL box data including weapon slots
        selectedRoom.ammoBox = {
            id: `${selectedRoom.id}_ammo`,
            isOpen: false,
            openedAt: null,
            collectedBy: [],
            weaponCollections: {}   // clean slate each activation
        };
        selectedRoom.vaccineBox = {
            id: `${selectedRoom.id}_vaccine`,
            isOpen: false,
            openedAt: null,
            collectedBy: []
        };

        selectedRoom.isActive = true;
        selectedRoom.activeUntil = Date.now() + this.roomActiveDuration;

        this.rooms.set(selectedRoom.id, selectedRoom);
        this.activeRoomId = selectedRoom.id;

        console.log(`🏠 Room activated: ${selectedRoom.name}`);
        return selectedRoom;
    }

    // Updated openBox: weapon-aware for ammo, once-per-activation for vaccine
    openBox(
        roomId: string,
        boxType: 'ammo' | 'vaccine',
        playerId: string,
        playerName: string,
        weaponName?: string    // NEW — required for ammo
    ): {
        success: boolean;
        message?: string;
        boxType?: string;
        isFirstOpener?: boolean;
        collectionCount?: number;
        weaponName?: string;
    } {
        const room = this.rooms.get(roomId);
        if (!room) return { success: false, message: 'Room not found' };
        if (!room.isActive) return { success: false, message: 'Room not active' };
        if (Date.now() > (room.activeUntil || 0)) {
            room.isActive = false;
            return { success: false, message: 'Room expired' };
        }

        if (boxType === 'vaccine') {
            // Vaccine: one player collects once per activation — server trusts
            // client's "already collected" check but double-checks here
            if (room.vaccineBox.collectedBy.includes(playerId)) {
                return { success: false, message: 'Already collected vaccine' };
            }
            const isFirst = !room.vaccineBox.isOpen;
            room.vaccineBox.isOpen = true;
            room.vaccineBox.openedAt = Date.now();
            room.vaccineBox.collectedBy.push(playerId);
            console.log(`💉 ${playerName} collected vaccine in ${room.name}`);
            return { success: true, boxType: 'vaccine', isFirstOpener: isFirst,
                     collectionCount: room.vaccineBox.collectedBy.length };
        }

        // --- AMMO BOX (weapon-aware) ---
        if (!weaponName) {
            return { success: false, message: 'No weapon specified' };
        }

        const box = room.ammoBox;

        // Init this weapon's slot list if needed
        if (!box.weaponCollections[weaponName]) {
            box.weaponCollections[weaponName] = [];
        }
        const slotList = box.weaponCollections[weaponName];

        // Has this player already taken ammo for this weapon from this room?
        if (slotList.includes(playerId)) {
            return { success: false, message: `Already collected ammo for ${weaponName}` };
        }

        // Is this weapon's slot full (2 players max)?
        if (slotList.length >= AMMO_SLOTS_PER_WEAPON) {
            return { success: false,
                     message: `Ammo for ${weaponName} already taken by ${AMMO_SLOTS_PER_WEAPON} players` };
        }

        // Grant ammo
        slotList.push(playerId);
        if (!box.collectedBy.includes(playerId)) box.collectedBy.push(playerId);
        const isFirst = slotList.length === 1;
        box.isOpen = true;
        box.openedAt = Date.now();

        console.log(`📦 ${playerName} collected ammo for [${weaponName}] in ${room.name} ` +
                    `(${slotList.length}/${AMMO_SLOTS_PER_WEAPON} slots)`);

        return {
            success: true, boxType: 'ammo',
            isFirstOpener: isFirst,
            collectionCount: slotList.length,
            weaponName
        };
    }

    // NEW: get per-weapon slot status for a room (so client knows what's available)
    getWeaponSlotStatus(roomId: string): { [weaponName: string]: number } | null {
        const room = this.rooms.get(roomId);
        if (!room) return null;
        const result: { [weaponName: string]: number } = {};
        for (const [w, list] of Object.entries(room.ammoBox.weaponCollections)) {
            result[w] = list.length;
        }
        return result;
    }

    getActiveRoom(): Room | null {
        if (!this.activeRoomId) return null;
        const room = this.rooms.get(this.activeRoomId);
        if (!room) return null;
        if (room.activeUntil && Date.now() > room.activeUntil) {
            room.isActive = false;
            this.activeRoomId = null;
            return null;
        }
        return room;
    }

    getRoomStatus(roomId: string) {
        const room = this.rooms.get(roomId);
        if (!room) return null;
        return {
            isActive: room.isActive,
            timeRemaining: room.activeUntil
                ? Math.max(0, room.activeUntil - Date.now()) : 0,
            ammoBox: {
                isOpen: room.ammoBox.isOpen,
                collectedCount: room.ammoBox.collectedBy.length,
                weaponSlots: room.ammoBox.weaponCollections   // NEW
            },
            vaccineBox: {
                isOpen: room.vaccineBox.isOpen,
                collectedCount: room.vaccineBox.collectedBy.length
            }
        };
    }

    getAllRooms(): Room[] {
        return Array.from(this.rooms.values());
    }

    checkPlayerInRoom(playerPosition: { x: number; y: number; z: number }) {
        let closestRoom: string | null = null;
        let closestDistance = Infinity;
        this.rooms.forEach(room => {
            if (room.isActive) {
                const dx = playerPosition.x - room.position.x;
                const dy = playerPosition.y - room.position.y;
                const dz = playerPosition.z - room.position.z;
                const distance = Math.sqrt(dx*dx + dy*dy + dz*dz);
                if (distance < room.radius && distance < closestDistance) {
                    closestDistance = distance;
                    closestRoom = room.id;
                }
            }
        });
        return { roomId: closestRoom, distance: closestDistance };
    }

    cleanup(): void {}
}