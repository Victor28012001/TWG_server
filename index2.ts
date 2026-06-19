// // import express, { Request, Response } from 'express';
// // import path from 'path';
// // import http from 'http';
// // import { Server, Socket } from 'socket.io';
// // import stylus from 'stylus';

// // // Imports
// // import Player from './shared/Player';
// // import PlayerList from './shared/PlayerList';
// // import Message from './shared/Message';
// // import MessageList from './shared/MessageList';
// // import RoomManager from './shared/RoomManager';
// // import { ROOM_DEFINITIONS } from './shared/RoomDefinitions';
// // import SpawnManager from './shared/SpawnManager';

// // // ---------------- MATCH SYSTEM ----------------

// // interface Match {
// //     id: string;
// //     players: PlayerList;
// //     messages: MessageList;
// //     roomManager: RoomManager;
// //     spawnManager: SpawnManager;
// //     voiceUsers: Map<string, any>;
// // }

// // class MatchManager {
// //     private matches = new Map<string, Match>();

// //     createMatch(): Match {
// //         const id = 'match_' + Math.random().toString(36).substr(2, 9);

// //         // Create spawn manager with 40 spawn points at Y=150
// //         const spawnManager = new SpawnManager(40, 150, 1800);

// //         const match: Match = {
// //             id,
// //             players: new PlayerList(),
// //             messages: new MessageList(),
// //             roomManager: new RoomManager(),
// //             spawnManager: spawnManager,
// //             voiceUsers: new Map()
// //         };

// //         this.matches.set(id, match);
// //         return match;
// //     }

// //     findMatch(maxPlayers = 10): Match {
// //         for (const match of this.matches.values()) {
// //             if (match.players.getAll().length < maxPlayers) return match;
// //         }
// //         return this.createMatch();
// //     }

// //     getMatch(id: string) {
// //         return this.matches.get(id);
// //     }

// //     removeMatch(id: string) {
// //         this.matches.delete(id);
// //     }

// //     getAllMatches() {
// //         return this.matches.values();
// //     }
// // }

// // const matchManager = new MatchManager();

// // // ---------------- SOCKET TYPE ----------------

// // interface CustomSocket extends Socket {
// //     data: {
// //         player?: Player;
// //         matchId?: string;
// //     };
// //     readCommand?: (message: string) => void;
// //     helpResponse?: () => void;
// //     changePlayerName?: (newName: string) => void;
// // }

// // // ---------------- SERVER ----------------

// // const app = express();
// // const server = http.createServer(app);
// // const io = new Server(server);

// // // Add this middleware to serve node_modules
// // app.use('/node_modules', express.static(path.join(__dirname, '../node_modules')));

// // app.set('port', process.env.PORT || 5000);
// // app.use(express.static(path.join(__dirname, '..', 'public')));
// // app.set('view engine', 'pug');

// // app.use(express.json());
// // app.use(express.urlencoded({ extended: true }));
// // app.use(stylus.middleware(path.join(__dirname, '../public')));

// // app.get('/', (req: Request, res: Response) => {
// //     res.render('index', { title: '3D Multiplayer Demo' });
// // });

// // server.listen(app.get('port'), '0.0.0.0', () => {
// //     console.log('Server running on port ' + app.get('port'));
// // });

// // // ---------------- HELPERS ----------------

// // function getMatch(socket: CustomSocket): Match | undefined {
// //     return matchManager.getMatch(socket.data.matchId!);
// // }

// // const usedColors = new Set();

// // function generatePlayerColor(): number {
// //     const colors = [
// //         0xff0000, 0x00ff00, 0x0000ff,
// //         0xffff00, 0xff00ff, 0x00ffff
// //     ];
// //     const color = colors[usedColors.size % colors.length];
// //     usedColors.add(color);
// //     return color;
// // }

// // // ---------------- GLOBAL ROOM TICK ----------------
// // function setupRoomActivationForMatch(match: Match) {
// //     const roomManager = match.roomManager;
// //     const originalActivate = roomManager.activateRandomRoom.bind(roomManager);

// //     roomManager.activateRandomRoom = function () {
// //         const room = originalActivate();
// //         if (room && room.id) {
// //             // Reset per-room collection state for all players in this match
// //             match.players.getAll().forEach(p => p.resetRoomCollections());

// //             io.to(match.id).emit("roomActivated", {
// //                 roomId: room.id,
// //                 buildingId: room.buildingId,
// //                 name: room.name,
// //                 position: room.position,
// //                 ammoBoxPosition: room.ammoBoxPosition,
// //                 vaccineBoxPosition: room.vaccineBoxPosition,
// //                 ammoBoxOpen: room.ammoBox.isOpen,
// //                 vaccineBoxOpen: room.vaccineBox.isOpen,
// //                 expiresAt: room.activeUntil
// //             });
// //         }
// //         return room;
// //     };
// //     roomManager.startRoomCycle();
// // }

// // // Setup room status interval for each match
// // setInterval(() => {
// //     for (const match of matchManager.getAllMatches()) {
// //         const activeRoom = match.roomManager.getActiveRoom();
// //         if (!activeRoom) continue;

// //         const status = match.roomManager.getRoomStatus(activeRoom.id);
// //         if (!status) continue;

// //         io.to(match.id).emit('roomStatus', {
// //             roomId: activeRoom.id,
// //             timeRemaining: status.timeRemaining,
// //             ammoBoxOpen: status.ammoBox.isOpen,
// //             ammoCollectedCount: status.ammoBox.collectedCount,
// //             vaccineBoxOpen: status.vaccineBox.isOpen,
// //             vaccineCollectedCount: status.vaccineBox.collectedCount
// //         });
// //     }
// // }, 1000);

// // // ---------------- SOCKET ----------------

// // io.on('connection', (socket: CustomSocket) => {

// //     console.log('Client connected:', socket.id);

// //     // -------- MATCHMAKING --------

// //     socket.on("findMatch", () => {
// //         const match = matchManager.findMatch();

// //         // Setup room activation for new matches
// //         if (!match.roomManager._activationSetup) {
// //             setupRoomActivationForMatch(match);
// //             match.roomManager._activationSetup = true;
// //         }

// //         socket.join(match.id);
// //         socket.data.matchId = match.id;

// //         socket.emit("matchJoined", { matchId: match.id });
// //     });

// //     // -------- SESSION --------

// //     socket.on('checkSession', () => {
// //         socket.emit('checkSessionCallback', {});
// //     });

// //     socket.on('initNewSession', (name: string) => {
// //         const match = getMatch(socket);
// //         if (!match) return;

// //         const spawn = match.spawnManager.getFreeSpawnPoint(socket.id);
// //         if (!spawn) return;

// //         const player = new Player(socket.id, name, generatePlayerColor(), spawn.position);
// //         player.setRotation(spawn.rotation);
// //         player.setWeaponIndex(0);
// //         player.setAnimation("idle");
// //         player.health = 100;
// //         player.maxHealth = 100;

// //         match.players.add(player);
// //         socket.data.player = player;

// //         socket.emit('showLoadout', player.clientFormat());
// //     });

// //     socket.on('confirmLoadout', (data: { weapons: string[] }) => {
// //         const match = getMatch(socket);
// //         const player = socket.data.player;
// //         if (!match || !player) return;

// //         player.setLoadout(data.weapons);

// //         socket.emit('initSelf', player.clientFormat());
// //         socket.emit('initRooms', ROOM_DEFINITIONS);

// //         // Send spawn points to client so they can create boxes
// //         const spawnPositions = match.spawnManager.getSpawnPositions();
// //         socket.emit('spawnPoints', spawnPositions);

// //         const activeRoom = match.roomManager.getActiveRoom();
// //         if (activeRoom) {
// //             socket.emit('roomActivated', {
// //                 roomId: activeRoom.id,
// //                 buildingId: activeRoom.buildingId,
// //                 name: activeRoom.name,
// //                 position: activeRoom.position,
// //                 ammoBoxPosition: activeRoom.ammoBoxPosition,
// //                 vaccineBoxPosition: activeRoom.vaccineBoxPosition,
// //                 ammoBoxOpen: activeRoom.ammoBox.isOpen,
// //                 vaccineBoxOpen: activeRoom.vaccineBox.isOpen,
// //                 expiresAt: activeRoom.activeUntil
// //             });
// //         }

// //         socket.to(match.id).emit('newPlayer', player.clientFormat());

// //         socket.to(match.id).emit('playerLoadout', {
// //             id: player.id,
// //             weapons: data.weapons
// //         });
// //     });

// //     // -------- PLAYER UPDATE (Server Reconciliation) --------

// //     socket.on('updatePlayer', (data) => {
// //         const match = getMatch(socket);
// //         if (!match) return;

// //         const player = match.players.find(data.id);
// //         if (!player) return;

// //         if (data.pos) {
// //             player.setPos(data.pos);
// //             if (!player.posHistory) player.posHistory = [];
// //             player.posHistory.push({ time: Date.now(), pos: { ...data.pos } });
// //             player.posHistory = player.posHistory.filter(p => Date.now() - p.time <= 200);
// //         }
// //         if (data.rotation) player.setRotation(data.rotation);
// //         if (data.weaponIndex !== undefined) player.setWeaponIndex(data.weaponIndex);
// //         if (data.animation !== undefined) player.setAnimation(data.animation);
// //         if (data.loadout !== undefined) player.setLoadout(data.loadout);

// //         const { roomId } = match.roomManager.checkPlayerInRoom(data.pos);
// //         if (roomId) socket.emit('enteredRoom', { roomId });

// //         socket.to(match.id).emit('updatePlayer', player.clientFormat());
// //     });

// //     // -------- FIRE WEAPON (Lag Compensation / Hit Rewind) --------

// //     socket.on('fireWeapon', (data) => {
// //         const match = getMatch(socket);
// //         const shooter = socket.data.player;
// //         if (!match || !shooter) return;

// //         if (!data.targetId) return;

// //         const hitTime = Date.now() - (data.clientPing || 0);
// //         const target = match.players.find(data.targetId);
// //         if (!target) return;

// //         let rewindPos = target.pos;
// //         if (target.posHistory && target.posHistory.length > 0) {
// //             const closest = target.posHistory.reduce((prev, curr) =>
// //                 Math.abs(curr.time - hitTime) < Math.abs(prev.time - hitTime) ? curr : prev
// //             );
// //             rewindPos = closest.pos;
// //         }

// //         const MAX_RANGE = 2000;
// //         const dx = shooter.pos.x - rewindPos.x;
// //         const dy = shooter.pos.y - rewindPos.y;
// //         const dz = shooter.pos.z - rewindPos.z;
// //         const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
// //         if (dist > MAX_RANGE) return;

// //         if (data.direction && data.position) {
// //             const toTarget = {
// //                 x: rewindPos.x - data.position.x,
// //                 y: rewindPos.y - data.position.y,
// //                 z: rewindPos.z - data.position.z,
// //             };
// //             const toTargetLen = Math.sqrt(toTarget.x ** 2 + toTarget.y ** 2 + toTarget.z ** 2);
// //             const dot = (toTarget.x / toTargetLen) * data.direction.x +
// //                 (toTarget.y / toTargetLen) * data.direction.y +
// //                 (toTarget.z / toTargetLen) * data.direction.z;
// //             if (dot < 0.7) return;
// //         }

// //         const damage = data.isHeadshot ? 50 : 25;
// //         const died = target.takeDamage(damage);

// //         io.to(match.id).emit('playerHit', {
// //             shooterId: shooter.id,
// //             targetId: target.id,
// //             weaponIndex: data.weaponIndex,
// //             damage: damage,
// //             health: target.health,
// //             maxHealth: target.maxHealth
// //         });

// //         if (died) {
// //             io.to(match.id).emit('playerDied', {
// //                 playerId: target.id,
// //                 playerName: target.name,
// //                 killerId: shooter.id,
// //             });

// //             setTimeout(() => {
// //                 match.spawnManager.releaseSpawnPoint(target.id);
// //                 match.players.remove(target);
// //                 match.voiceUsers.delete(target.id);
// //                 io.to(match.id).emit('removePlayer', { id: target.id });
// //                 if (match.players.getAll().length === 0) {
// //                     matchManager.removeMatch(match.id);
// //                 }
// //             }, 3000);
// //         }
// //     });

// //     socket.on('playerDied', (data: { id: string; killerId: string | null }) => {
// //         const match = getMatch(socket);
// //         const player = socket.data.player;
// //         if (!match || !player) return;

// //         io.to(match.id).emit('playerDied', {
// //             playerId: player.id,
// //             playerName: player.name,
// //             killerId: data.killerId,
// //         });

// //         setTimeout(() => {
// //             match.spawnManager.releaseSpawnPoint(player.id);
// //             match.players.remove(player);
// //             match.voiceUsers.delete(player.id);
// //             io.to(match.id).emit('removePlayer', { id: player.id });
// //             if (match.players.getAll().length === 0) {
// //                 matchManager.removeMatch(match.id);
// //             }
// //         }, 3000);
// //     });

// //     socket.on('playerWeaponSwitch', (data) => {
// //         const match = getMatch(socket);
// //         const player = socket.data.player;
// //         if (!match || !player) return;

// //         player.setWeaponIndex(data.weaponIndex);
// //         socket.to(match.id).emit('playerWeaponSwitch', {
// //             id: player.id,
// //             weaponIndex: player.weaponIndex
// //         });
// //     });

// //     socket.on('playerReload', () => {
// //         const match = getMatch(socket);
// //         const player = socket.data.player;
// //         if (!match || !player) return;
// //         socket.to(match.id).emit('playerReload', { id: player.id });
// //     });

// //     socket.on('initOthers', () => {
// //         const match = getMatch(socket);
// //         if (!match) return;
// //         const list = match.players.getAll()
// //             .filter(p => p.id !== socket.id)
// //             .map(p => p.clientFormat());
// //         socket.emit('initOthersCallback', list);
// //     });

// //     // -------- ROOM SYSTEM --------

// //     socket.on("requestActiveRoom", () => {
// //         const match = getMatch(socket);
// //         if (!match) return;

// //         const activeRoom = match.roomManager.getActiveRoom();
// //         if (activeRoom) {
// //             socket.emit("roomActivated", {
// //                 roomId: activeRoom.id,
// //                 buildingId: activeRoom.buildingId,
// //                 name: activeRoom.name,
// //                 position: activeRoom.position,
// //                 ammoBoxPosition: activeRoom.ammoBoxPosition,
// //                 vaccineBoxPosition: activeRoom.vaccineBoxPosition,
// //                 ammoBoxOpen: activeRoom.ammoBox.isOpen,
// //                 vaccineBoxOpen: activeRoom.vaccineBox.isOpen,
// //                 expiresAt: activeRoom.activeUntil
// //             });
// //         }
// //     });

// //     // socket.on('openBox', (data) => {
// //     //     const match = getMatch(socket);
// //     //     const player = socket.data.player;
// //     //     if (!match || !player) return;

// //     //     const result = match.roomManager.openBox(data.roomId, data.boxType, player.id, player.name);
// //     //     if (result.success) {
// //     //         io.to(match.id).emit('boxOpened', {
// //     //             ...data,
// //     //             playerId: player.id,
// //     //             playerName: player.name,
// //     //             isFirstOpener: result.isFirstOpener,
// //     //             collectionCount: result.collectionCount
// //     //         });
// //     //         if (data.boxType === 'ammo') {
// //     //             const weapons = ['rifle', 'shotgun', 'pistol', 'sniper'];
// //     //             const weapon = weapons[Math.floor(Math.random() * weapons.length)];
// //     //             socket.emit('ammoReceived', { weapon, amount: 999 });
// //     //         } else {
// //     //             socket.emit('vaccineReceived');
// //     //         }
// //     //     } else {
// //     //         socket.emit('boxError', { message: result.message });
// //     //     }
// //     // });

// //     socket.on('openBox', (data: {
// //         roomId: string;
// //         boxType: 'ammo' | 'vaccine';
// //         weaponName?: string;        // NEW
// //     }) => {
// //         const match = getMatch(socket);
// //         const player = socket.data.player;
// //         if (!match || !player) return;

// //         const result = match.roomManager.openBox(
// //             data.roomId,
// //             data.boxType,
// //             player.id,
// //             player.name,
// //             data.weaponName   // pass weapon name through
// //         );

// //         if (result.success) {
// //             // Record on the server-side player object
// //             if (data.boxType === 'ammo' && data.weaponName) {
// //                 player.recordAmmoCollection(data.weaponName);
// //             } else if (data.boxType === 'vaccine') {
// //                 player.collectedVaccineThisRoom = true;
// //             }

// //             io.to(match.id).emit('boxOpened', {
// //                 roomId: data.roomId,
// //                 boxType: data.boxType,
// //                 weaponName: data.weaponName,
// //                 playerId: player.id,
// //                 playerName: player.name,
// //                 isFirstOpener: result.isFirstOpener,
// //                 collectionCount: result.collectionCount
// //             });

// //             if (data.boxType === 'ammo' && data.weaponName) {
// //                 // Tell this player their weapon now has full ammo + reserves
// //                 socket.emit('ammoReceived', {
// //                     weaponName: data.weaponName,
// //                     reserves: player.weaponReserves[data.weaponName] || 0
// //                 });
// //             } else if (data.boxType === 'vaccine') {
// //                 socket.emit('vaccineReceived');
// //             }
// //         } else {
// //             socket.emit('boxError', { message: result.message });
// //         }
// //     });

// //     socket.on('requestRoomStatus', (data) => {
// //         const match = getMatch(socket);
// //         if (!match) return;
// //         const status = match.roomManager.getRoomStatus(data.roomId);
// //         if (status) {
// //             socket.emit('roomStatus', status);
// //         }
// //     });

// //     // -------- CHAT --------

// //     socket.on('sendMessage', (msg: string) => {
// //         const match = getMatch(socket);
// //         const player = socket.data.player;
// //         if (!match || !player) return;

// //         if (msg.startsWith('/')) {
// //             socket.readCommand?.(msg);
// //             return;
// //         }

// //         if (msg.length > 200) {
// //             socket.emit('serverResponse', { type: 'error', text: 'Too long' });
// //             return;
// //         }

// //         const message = new Message(msg, player, Date.now());
// //         match.messages.add(message);
// //         io.to(match.id).emit('newMessage', message);
// //     });

// //     // -------- VOICE (Proximity Chat) --------

// //     socket.on('voice-ready', () => {
// //         const match = getMatch(socket);
// //         const player = socket.data.player;
// //         if (!match || !player) return;

// //         match.voiceUsers.set(player.id, {
// //             socketId: socket.id,
// //             playerId: player.id,
// //             playerName: player.name
// //         });

// //         socket.to(match.id).emit('voice-user-connected', {
// //             userId: player.id,
// //             userName: player.name
// //         });

// //         const others = Array.from(match.voiceUsers.values())
// //             .filter(u => u.playerId !== player.id);
// //         socket.emit('voice-users-list', { users: others });
// //     });

// //     socket.on('voice-signal', (data) => {
// //         const match = getMatch(socket);
// //         if (!match) return;
// //         const target = match.voiceUsers.get(data.to);
// //         if (target) {
// //             socket.to(target.socketId).emit('voice-signal', data);
// //         }
// //     });

// //     socket.on('voice-speaking', (data) => {
// //         const match = getMatch(socket);
// //         if (!match) return;
// //         const speaker = socket.data.player;
// //         if (!speaker) return;

// //         const distance = (p1: Player, p2: Player) => {
// //             const dx = p1.pos.x - p2.pos.x;
// //             const dy = p1.pos.y - p2.pos.y;
// //             const dz = p1.pos.z - p2.pos.z;
// //             return Math.sqrt(dx * dx + dy * dy + dz * dz);
// //         };

// //         for (const user of match.voiceUsers.values()) {
// //             if (user.playerId === speaker.id) continue;
// //             const listener = match.players.find(user.playerId);
// //             if (!listener) continue;
// //             if (distance(speaker, listener) <= 20) {
// //                 socket.to(user.socketId).emit('voice-speaking', data);
// //             }
// //         }
// //     });

// //     // -------- RESPAWN --------

// //     socket.on('requestRespawn', () => {
// //         const match = getMatch(socket);
// //         const player = socket.data.player;
// //         if (!match || !player) return;

// //         match.spawnManager.releaseSpawnPoint(player.id);
// //         const spawn = match.spawnManager.getFreeSpawnPoint(player.id);
// //         if (!spawn) return;

// //         player.setPos(spawn.position);
// //         player.setRotation(spawn.rotation);
// //         io.to(match.id).emit('updatePlayer', player.clientFormat());
// //     });

// //     // Add an event to send spawn points to client
// //     socket.on('requestSpawnPoints', () => {
// //         const match = getMatch(socket);
// //         if (!match) return;

// //         const spawnPositions = match.spawnManager.getSpawnPositions();
// //         socket.emit('spawnPoints', spawnPositions);
// //     });

// //     // -------- COMMANDS --------

// //     socket.readCommand = function (str: string) {
// //         const cmd = str.split(' ');
// //         switch (cmd[0]) {
// //             case '/help':
// //                 socket.helpResponse?.();
// //                 break;
// //             case '/name':
// //                 socket.changePlayerName?.(cmd[1]);
// //                 break;
// //             default:
// //                 socket.emit('serverResponse', { type: 'error', text: 'Invalid command' });
// //         }
// //     };

// //     socket.helpResponse = function () {
// //         socket.emit('serverResponse', { type: 'success', text: 'Use /name <newName>' });
// //     };

// //     socket.changePlayerName = function (newName: string) {
// //         const player = socket.data.player;
// //         if (!player || !newName) return;
// //         player.name = newName;
// //         io.to(socket.data.matchId!).emit('updatePlayerName', player.clientFormat());
// //     };

// //     // -------- DISCONNECT --------

// //     socket.on('disconnect', () => {
// //         const match = getMatch(socket);
// //         if (!match) return;
// //         const player = socket.data.player;
// //         if (!player) return;

// //         match.spawnManager.releaseSpawnPoint(player.id);
// //         match.players.remove(player);
// //         match.voiceUsers.delete(player.id);
// //         io.to(match.id).emit('removePlayer', player.clientFormat());
// //         if (match.players.getAll().length === 0) {
// //             matchManager.removeMatch(match.id);
// //         }
// //     });
// // });

// import os from 'os';
// import express, { Request, Response } from 'express';
// import http from 'http';
// import { Server, Socket } from 'socket.io';

// // Imports
// import Player from './shared/Player';
// import PlayerList from './shared/PlayerList';
// import Message from './shared/Message';
// import MessageList from './shared/MessageList';
// import RoomManager from './shared/RoomManager';
// import { ROOM_DEFINITIONS } from './shared/RoomDefinitions';
// import SpawnManager from './shared/SpawnManager';
// import Lobby, { LobbyState } from './shared/Lobby';
// import LobbyManager from './shared/LobbyManager';

// // Add after matchManager
// const lobbyManager = new LobbyManager();


// // ---------------- MATCH SYSTEM ----------------

// interface Match {
//     id: string;
//     mapKey: string;          // ← NEW: which map this match is for
//     players: PlayerList;
//     messages: MessageList;
//     roomManager: RoomManager;
//     spawnManager: SpawnManager;
//     voiceUsers: Map<string, any>;
// }

// class MatchManager {
//     private matches = new Map<string, Match>();

//     createMatch(mapKey: string = 'shooting_range'): Match {
//         const id = 'match_' + Math.random().toString(36).substr(2, 9);

//         // Create spawn manager with 40 spawn points at Y=150
//         const spawnManager = new SpawnManager(40, 150, 1800);

//         const match: Match = {
//             id,
//             mapKey,
//             players: new PlayerList(),
//             messages: new MessageList(),
//             roomManager: new RoomManager(),
//             spawnManager: spawnManager,
//             voiceUsers: new Map()
//         };

//         this.matches.set(id, match);
//         return match;
//     }

//     findMatch(mapKey: string = 'shooting_range', maxPlayers = 10): Match {
//         for (const match of this.matches.values()) {
//             if (match.mapKey === mapKey && match.players.getAll().length < maxPlayers) {
//                 return match;
//             }
//         }
//         return this.createMatch(mapKey);
//     }

//     getMatch(id: string) {
//         return this.matches.get(id);
//     }

//     removeMatch(id: string) {
//         this.matches.delete(id);
//     }

//     getAllMatches() {
//         return this.matches.values();
//     }
// }

// const matchManager = new MatchManager();

// // ---------------- SOCKET TYPE ----------------

// interface CustomSocket extends Socket {
//     data: {
//         player?: Player;
//         matchId?: string;
//         lobbyId?: string;      // Add this
//         playerName?: string;   // Add this
//         pendingLoadout?: string[];
//     };
//     readCommand?: (message: string) => void;
//     helpResponse?: () => void;
//     changePlayerName?: (newName: string) => void;
// }

// // ---------------- SERVER ----------------

// const app = express();
// const server = http.createServer(app);

// // ========== MODIFIED: Configure CORS for mobile ==========
// const io = new Server(server, {
//     cors: {
//         origin: [
//             "http://localhost:3000",           // Local web development
//             "http://localhost:5000",           // Local server
//             "capacitor://localhost",           // Capacitor iOS/Android
//             "http://localhost",                // Generic localhost
//             "http://10.0.2.2:3000",            // Android emulator
//             "http://10.0.2.2:5000",            // Android emulator server
//             "http://192.168.*.*",              // Local network (wildcard - you may need specific IPs)
//             "*"                                 // For development only - remove in production
//         ],
//         methods: ["GET", "POST", "OPTIONS"],
//         credentials: true,
//         allowedHeaders: ["Content-Type", "Authorization"]
//     },
//     transports: ['websocket', 'polling'],      // Allow both transport methods
//     allowEIO3: true,                           // Allow Engine.IO v3 clients
//     pingTimeout: 60000,                        // Longer timeout for mobile networks
//     pingInterval: 25000                        // Ping interval for mobile
// });

// // ========== NEW: Health check and info endpoints ==========
// app.get('/api/health', (req: Request, res: Response) => {
//     res.json({
//         status: 'ok',
//         timestamp: Date.now(),
//         uptime: process.uptime()
//     });
// });

// app.get('/api/info', (req: Request, res: Response) => {
//     res.json({
//         version: '1.0.0',
//         platform: 'multiplayer',
//         websocket: true,
//         features: {
//             voiceChat: true,
//             rooms: true,
//             spawnPoints: 40
//         }
//     });
// });

// // Get local IP address for mobile connections
// app.get('/api/server-ip', (req: Request, res: Response) => {
//     const os = require('os');
//     const interfaces = os.networkInterfaces();
//     const addresses = [];

//     for (const name of Object.keys(interfaces)) {
//         for (const net of interfaces[name]) {
//             if (net.family === 'IPv4' && !net.internal) {
//                 addresses.push(net.address);
//             }
//         }
//     }

//     res.json({
//         ips: addresses,
//         port: app.get('port')
//     });
// });

// // Add this middleware to serve node_modules
// // app.use('/node_modules', express.static(path.join(__dirname, '../node_modules')));

// app.set('port', process.env.PORT || 5000);
// // app.use(express.static(path.join(__dirname, '..', 'public')));
// // app.set('view engine', 'pug');

// app.use(express.json());
// app.use(express.urlencoded({ extended: true }));
// // app.use(stylus.middleware(path.join(__dirname, '../public')));

// app.get('/', (req: Request, res: Response) => {
//     res.json({
//         status: 'online',
//         message: 'The Winnowing Games Server',
//         version: '1.0.0',
//         timestamp: Date.now()
//     });
// });

// // Health check endpoint
// app.get('/api/health', (req: Request, res: Response) => {
//     res.json({
//         status: 'ok',
//         timestamp: Date.now(),
//         uptime: process.uptime()
//     });
// });

// // Listen on all network interfaces (0.0.0.0) to allow mobile connections
// const PORT = app.get('port');
// server.listen(PORT, '0.0.0.0', () => {
//     console.log(`✅ Server running on:`);
//     console.log(`   - Local: http://localhost:${PORT}`);
//     console.log(`   - Network: http://172.28.224.49:${PORT}`);

//     // Display local IP addresses for mobile connections
//     // const os = require('os');  // ← Remove this line
//     const interfaces = os.networkInterfaces();
//     console.log(`\n📱 Connect mobile devices using these IPs:`);
//     for (const name of Object.keys(interfaces)) {
//         for (const net of interfaces[name]) {
//             if (net.family === 'IPv4' && !net.internal) {
//                 console.log(`   - http://${net.address}:${PORT}`);
//             }
//         }
//     }
// });

// // ---------------- HELPERS ----------------

// function getMatch(socket: CustomSocket): Match | undefined {
//     return matchManager.getMatch(socket.data.matchId!);
// }

// const usedColors = new Set();

// function generatePlayerColor(): number {
//     const colors = [
//         0xff0000, 0x00ff00, 0x0000ff,
//         0xffff00, 0xff00ff, 0x00ffff
//     ];
//     const color = colors[usedColors.size % colors.length];
//     usedColors.add(color);
//     return color;
// }

// // ---------------- GLOBAL ROOM TICK ----------------
// function setupRoomActivationForMatch(match: Match) {
//     const roomManager = match.roomManager;
//     const originalActivate = roomManager.activateRandomRoom.bind(roomManager);

//     roomManager.activateRandomRoom = function () {
//         const room = originalActivate();
//         if (room && room.id) {
//             // Reset per-room collection state for all players in this match
//             match.players.getAll().forEach(p => p.resetRoomCollections());

//             io.to(match.id).emit("roomActivated", {
//                 roomId: room.id,
//                 buildingId: room.buildingId,
//                 name: room.name,
//                 position: room.position,
//                 ammoBoxPosition: room.ammoBoxPosition,
//                 vaccineBoxPosition: room.vaccineBoxPosition,
//                 ammoBoxOpen: room.ammoBox.isOpen,
//                 vaccineBoxOpen: room.vaccineBox.isOpen,
//                 expiresAt: room.activeUntil
//             });
//         }
//         return room;
//     };
//     roomManager.startRoomCycle();
// }

// // Setup room status interval for each match
// setInterval(() => {
//     for (const match of matchManager.getAllMatches()) {
//         const activeRoom = match.roomManager.getActiveRoom();
//         if (!activeRoom) continue;

//         const status = match.roomManager.getRoomStatus(activeRoom.id);
//         if (!status) continue;

//         io.to(match.id).emit('roomStatus', {
//             roomId: activeRoom.id,
//             timeRemaining: status.timeRemaining,
//             ammoBoxOpen: status.ammoBox.isOpen,
//             ammoCollectedCount: status.ammoBox.collectedCount,
//             vaccineBoxOpen: status.vaccineBox.isOpen,
//             vaccineCollectedCount: status.vaccineBox.collectedCount
//         });
//     }
// }, 1000);

// // ---------------- SOCKET ----------------

// io.on('connection', (socket: CustomSocket) => {

//     console.log('Client connected:', socket.id, 'from:', socket.handshake.address);

//     // -------- MATCHMAKING --------

//     socket.on("findMatch", (data?: { mapKey?: string }) => {
//         const mapKey = data?.mapKey || 'shooting_range';
//         const match = matchManager.findMatch(mapKey);

//         if (!match.roomManager._activationSetup) {
//             if (mapKey === 'shooting_range') {
//                 setupRoomActivationForMatch(match);
//                 match.roomManager._activationSetup = true;
//             } else {
//                 match.roomManager._activationSetup = true;
//             }
//         }

//         socket.join(match.id);
//         socket.data.matchId = match.id;

//         socket.emit("matchJoined", { matchId: match.id, mapKey });
//     });

//     // -------- LOBBY SYSTEM --------
//     socket.on('createLobby', (data: { playerName: string; gameDuration?: number }) => {
//         const lobbyId = 'lobby_' + Math.random().toString(36).substr(2, 9);
//         const lobby = lobbyManager.createLobby(lobbyId, socket.id, data.playerName);

//         if (data.gameDuration) {
//             lobby.setGameDuration(data.gameDuration);
//         }

//         socket.data.lobbyId = lobbyId;
//         socket.data.playerName = data.playerName;
//         socket.join(lobbyId);

//         socket.emit('lobbyCreated', {
//             lobbyId,
//             isHost: true,
//             hostId: lobby.hostId,
//             players: lobby.getPlayerList(),
//             availableMaps: lobby.availableMaps,
//             selectedMap: lobby.selectedMap,
//             gameDuration: lobby.gameDuration,
//             gameDurationMinutes: lobby.getGameDurationMinutes(),
//             state: lobby.state
//         });

//         console.log(`✅ Lobby created: ${lobbyId} by ${data.playerName}`);
//     });

//     socket.on('joinLobby', (data: { lobbyId: string; playerName: string }) => {
//         const lobby = lobbyManager.getLobby(data.lobbyId);
//         if (!lobby) {
//             socket.emit('lobbyError', { message: 'Lobby not found' });
//             return;
//         }

//         if (lobby.players.size >= lobby.maxPlayers) {
//             socket.emit('lobbyError', { message: 'Lobby is full' });
//             return;
//         }

//         if (lobbyManager.addPlayerToLobby(data.lobbyId, socket.id, data.playerName)) {
//             socket.data.lobbyId = data.lobbyId;
//             socket.data.playerName = data.playerName;
//             socket.join(data.lobbyId);

//             const updatedLobby = lobbyManager.getLobby(data.lobbyId);

//             socket.emit('lobbyJoined', {
//                 lobbyId: data.lobbyId,
//                 isHost: false,
//                 hostId: updatedLobby!.hostId,
//                 players: updatedLobby!.getPlayerList(),
//                 availableMaps: updatedLobby!.availableMaps,
//                 selectedMap: updatedLobby!.selectedMap,
//                 gameDuration: updatedLobby!.gameDuration,
//                 gameDurationMinutes: updatedLobby!.getGameDurationMinutes(),
//                 state: updatedLobby!.state
//             });

//             socket.to(data.lobbyId).emit('playerJoinedLobby', {
//                 players: updatedLobby!.getPlayerList()
//             });

//             console.log(`✅ Player ${data.playerName} joined lobby: ${data.lobbyId}`);
//         }
//     });

//     socket.on('getAvailableLobbies', () => {
//         const lobbies = lobbyManager.getAvailableLobbies();
//         const lobbyData = lobbies.map(lobby => ({
//             id: lobby.id,
//             hostName: lobby.players.get(lobby.hostId)?.name || 'Unknown',
//             playerCount: lobby.players.size,
//             maxPlayers: lobby.maxPlayers,
//             selectedMap: lobby.selectedMap,
//             state: lobby.state
//         }));
//         socket.emit('availableLobbyList', { lobbies: lobbyData });
//     });

//     socket.on('voteForMap', (data: { lobbyId: string; mapKey: string }) => {
//         const lobby = lobbyManager.getLobby(data.lobbyId);
//         if (!lobby) {
//             socket.emit('lobbyError', { message: 'Lobby not found' });
//             return;
//         }

//         if (lobby.voteForMap(socket.id, data.mapKey)) {
//             const votes = lobby.getVoteResults();
//             const selectedMap = lobby.selectedMap;

//             io.to(data.lobbyId).emit('mapVotesUpdated', { votes, selectedMap });
//             console.log(`🗳️ Player voted for map: ${data.mapKey}`);
//         } else {
//             socket.emit('lobbyError', { message: 'Failed to vote for map' });
//         }
//     });

//     socket.on('setPlayerReady', (data: { lobbyId: string; isReady: boolean }) => {
//         const lobby = lobbyManager.getLobby(data.lobbyId);
//         if (!lobby) return;

//         if (lobby.setPlayerReady(socket.id, data.isReady)) {
//             io.to(data.lobbyId).emit('playerReadyStatusUpdated', {
//                 players: lobby.getPlayerList(),
//                 allReady: lobby.areAllPlayersReady()
//             });
//         }
//     });

//     socket.on('setLoadout', (data: { lobbyId: string; weapons: string[] }) => {
//         const lobby = lobbyManager.getLobby(data.lobbyId);
//         if (!lobby) return;

//         if (lobby.setPlayerLoadout(socket.id, data.weapons)) {
//             io.to(data.lobbyId).emit('playerLoadoutUpdated', {
//                 playerId: socket.id,
//                 loadout: data.weapons
//             });
//         }
//     });

//     socket.on('setGameDuration', (data: { lobbyId: string; durationMinutes: number }) => {
//         const lobby = lobbyManager.getLobby(data.lobbyId);
//         if (!lobby) return;

//         if (socket.id !== lobby.hostId) {
//             socket.emit('lobbyError', { message: 'Only host can set duration' });
//             return;
//         }

//         const durationMs = data.durationMinutes * 60000;
//         if (lobby.setGameDuration(durationMs)) {
//             io.to(data.lobbyId).emit('gameDurationUpdated', {
//                 gameDuration: lobby.gameDuration,
//                 gameDurationMinutes: lobby.getGameDurationMinutes()
//             });
//         }
//     });

//     // socket.on('startGame', (data: { lobbyId: string }) => {
//     //     const lobby = lobbyManager.getLobby(data.lobbyId);
//     //     if (!lobby) return;

//     //     if (socket.id !== lobby.hostId) {
//     //         socket.emit('lobbyError', { message: 'Only host can start' });
//     //         return;
//     //     }

//     //     if (!lobby.canStart()) {
//     //         socket.emit('lobbyError', { message: 'Not enough players' });
//     //         return;
//     //     }

//     //     const votes = lobby.getVoteResults();
//     //     if (votes.length > 0 && votes[0].votes > 0) {
//     //         lobby.setSelectedMap(votes[0].mapKey);
//     //     }

//     //     lobby.state = LobbyState.STARTING;

//     //     io.to(data.lobbyId).emit('gameStarting', {
//     //         mapKey: lobby.selectedMap,
//     //         mapName: lobby.availableMaps.find(m => m.key === lobby.selectedMap)?.name || lobby.selectedMap,
//     //         gameDuration: lobby.gameDuration,
//     //         gameDurationMinutes: lobby.getGameDurationMinutes(),
//     //         players: lobby.getPlayerList()
//     //     });

//     //     // Transition each player
//     //     const players = Array.from(lobby.players.keys());
//     //     const match = matchManager.findMatch(lobby.selectedMap);

//     //     if (!match.roomManager._activationSetup) {
//     //         if (lobby.selectedMap === 'shooting_range') {
//     //             setupRoomActivationForMatch(match);
//     //         }
//     //         match.roomManager._activationSetup = true;
//     //     }

//     //     for (const playerId of players) {
//     //         const playerSocket = io.sockets.sockets.get(playerId) as CustomSocket;
//     //         if (playerSocket) {
//     //             playerSocket.join(match.id);
//     //             playerSocket.data.matchId = match.id;

//     //             // Emit transitionToMatch as before
//     //             playerSocket.emit('transitionToMatch', {
//     //                 matchId: match.id,
//     //                 mapKey: lobby.selectedMap,
//     //                 gameDuration: lobby.gameDuration,
//     //                 gameDurationMinutes: lobby.getGameDurationMinutes()
//     //             });

//     //             // ✅ FIX: Auto-initiate the session for each player
//     //             // Get their name from the lobby player data
//     //             const lobbyPlayer = lobby.players.get(playerId);
//     //             const playerName = lobbyPlayer?.name || 'Operator';

//     //             const spawn = match.spawnManager.getFreeSpawnPoint(playerId);
//     //             if (spawn) {
//     //                 const player = new Player(
//     //                     playerId,
//     //                     playerName,
//     //                     generatePlayerColor(),
//     //                     spawn.position
//     //                 );
//     //                 player.setRotation(spawn.rotation);
//     //                 player.setWeaponIndex(0);
//     //                 player.setAnimation("idle");
//     //                 player.health = 100;
//     //                 player.maxHealth = 100;

//     //                 // Store loadout from lobby if set
//     //                 const loadoutNames = lobbyPlayer?.selectedLoadout || [];
//     //                 if (loadoutNames.length > 0) {
//     //                     player.setLoadout(loadoutNames);
//     //                 }

//     //                 match.players.add(player);
//     //                 playerSocket.data.player = player;

//     //                 // Send showLoadout so client proceeds normally
//     //                 playerSocket.emit('showLoadout', player.clientFormat());
//     //             }
//     //         }
//     //     }

//     //     console.log(`🎮 Game started in lobby: ${data.lobbyId}, match: ${match.id}`);
//     //     setTimeout(() => lobbyManager.removeLobby(data.lobbyId), 5000);
//     // });

//     // socket.on('startGame', (data: { lobbyId: string }) => {
//     //     const lobby = lobbyManager.getLobby(data.lobbyId);
//     //     if (!lobby) return;
//     //     if (socket.id !== lobby.hostId) {
//     //         socket.emit('lobbyError', { message: 'Only host can start' });
//     //         return;
//     //     }
//     //     if (!lobby.canStart()) {
//     //         socket.emit('lobbyError', { message: 'Not enough players' });
//     //         return;
//     //     }

//     //     const votes = lobby.getVoteResults();
//     //     if (votes.length > 0 && votes[0].votes > 0) {
//     //         lobby.setSelectedMap(votes[0].mapKey);
//     //     }

//     //     lobby.state = LobbyState.STARTING;

//     //     io.to(data.lobbyId).emit('gameStarting', {
//     //         mapKey: lobby.selectedMap,
//     //         mapName: lobby.availableMaps.find(m => m.key === lobby.selectedMap)?.name || lobby.selectedMap,
//     //         gameDuration: lobby.gameDuration,
//     //         gameDurationMinutes: lobby.getGameDurationMinutes(),
//     //         players: lobby.getPlayerList()
//     //     });

//     //     const players = Array.from(lobby.players.keys());
//     //     const match = matchManager.findMatch(lobby.selectedMap);

//     //     if (!match.roomManager._activationSetup) {
//     //         if (lobby.selectedMap === 'shooting_range') {
//     //             setupRoomActivationForMatch(match);
//     //         }
//     //         match.roomManager._activationSetup = true;
//     //     }

//     //     // Maps that use client-side spawn positioning
//     //     const CLIENT_SIDE_SPAWN_MAPS = new Set(['greeble_map', 'lowpoly_environment']);
//     //     const useClientSpawn = CLIENT_SIDE_SPAWN_MAPS.has(lobby.selectedMap);

//     //     for (const playerId of players) {
//     //         const playerSocket = io.sockets.sockets.get(playerId) as CustomSocket;
//     //         if (!playerSocket) continue;

//     //         playerSocket.join(match.id);
//     //         playerSocket.data.matchId = match.id;

//     //         playerSocket.emit('transitionToMatch', {
//     //             matchId: match.id,
//     //             mapKey: lobby.selectedMap,
//     //             gameDuration: lobby.gameDuration,
//     //             gameDurationMinutes: lobby.getGameDurationMinutes()
//     //         });

//     //         const lobbyPlayer = lobby.players.get(playerId);
//     //         const playerName = lobbyPlayer?.name || 'Operator';

//     //         let spawnPosition: { x: number; y: number; z: number };
//     //         let spawnRotation: { x: number; y: number } = { x: 0, y: 0 };

//     //         if (useClientSpawn) {
//     //             spawnPosition = { x: 0, y: 50, z: 0 };
//     //         } else {
//     //             // getFreeSpawnPoint allocates and returns in one call — no second call needed
//     //             const spawn = match.spawnManager.getFreeSpawnPoint(playerId);
//     //             if (!spawn) continue;
//     //             spawnPosition = spawn.position;
//     //             spawnRotation = spawn.rotation; // ✅ capture rotation here, same call
//     //         }

//     //         const player = new Player(
//     //             playerId,
//     //             playerName,
//     //             generatePlayerColor(),
//     //             spawnPosition
//     //         );

//     //         player.setRotation(spawnRotation); // works for both cases (origin rotation is fine for client-spawn maps)
//     //         player.setWeaponIndex(0);
//     //         player.setAnimation("idle");
//     //         player.health = 100;
//     //         player.maxHealth = 100;

//     //         const loadoutNames = lobbyPlayer?.selectedLoadout || [];
//     //         if (loadoutNames.length > 0) {
//     //             player.setLoadout(loadoutNames);
//     //         }

//     //         match.players.add(player);
//     //         playerSocket.data.player = player;
//     //         playerSocket.emit('showLoadout', player.clientFormat());
//     //     }

//     //     console.log(`🎮 Game started in lobby: ${data.lobbyId}, match: ${match.id}`);
//     //     setTimeout(() => lobbyManager.removeLobby(data.lobbyId), 5000);
//     // });

//     socket.on('startGame', (data: { lobbyId: string }) => {
//         const lobby = lobbyManager.getLobby(data.lobbyId);
//         if (!lobby) return;
//         if (socket.id !== lobby.hostId) {
//             socket.emit('lobbyError', { message: 'Only host can start' });
//             return;
//         }
//         if (!lobby.canStart()) {
//             socket.emit('lobbyError', { message: 'Not enough players' });
//             return;
//         }

//         const votes = lobby.getVoteResults();
//         if (votes.length > 0 && votes[0].votes > 0) {
//             lobby.setSelectedMap(votes[0].mapKey);
//         }

//         lobby.state = LobbyState.STARTING;

//         io.to(data.lobbyId).emit('gameStarting', {
//             mapKey: lobby.selectedMap,
//             mapName: lobby.availableMaps.find(m => m.key === lobby.selectedMap)?.name || lobby.selectedMap,
//             gameDuration: lobby.gameDuration,
//             gameDurationMinutes: lobby.getGameDurationMinutes(),
//             players: lobby.getPlayerList()
//         });

//         const players = Array.from(lobby.players.keys());
//         const match = matchManager.findMatch(lobby.selectedMap);

//         if (!match.roomManager._activationSetup) {
//             if (lobby.selectedMap === 'shooting_range') {
//                 setupRoomActivationForMatch(match);
//             }
//             match.roomManager._activationSetup = true;
//         }

//         for (const playerId of players) {
//             const playerSocket = io.sockets.sockets.get(playerId) as CustomSocket;
//             if (!playerSocket) continue;

//             playerSocket.join(match.id);
//             playerSocket.data.matchId = match.id;

//             // Store the lobby loadout on the socket so initNewSession can use it
//             const lobbyPlayer = lobby.players.get(playerId);
//             if (lobbyPlayer?.selectedLoadout?.length) {
//                 playerSocket.data.pendingLoadout = lobbyPlayer.selectedLoadout;
//             }

//             playerSocket.emit('transitionToMatch', {
//                 matchId: match.id,
//                 mapKey: lobby.selectedMap,
//                 gameDuration: lobby.gameDuration,
//                 gameDurationMinutes: lobby.getGameDurationMinutes()
//             });
//         }

//         console.log(`🎮 Game started in lobby: ${data.lobbyId}, match: ${match.id}`);
//         setTimeout(() => lobbyManager.removeLobby(data.lobbyId), 5000);
//     });


//     socket.on('leaveLobby', () => {
//         const lobbyId = socket.data.lobbyId;
//         if (!lobbyId) return;

//         const lobby = lobbyManager.removePlayerFromLobby(socket.id);
//         if (lobby) {
//             socket.leave(lobbyId);
//             if (lobby.isEmpty()) {
//                 io.to(lobbyId).emit('lobbyDisbanded');
//             } else {
//                 io.to(lobbyId).emit('playerLeftLobby', {
//                     players: lobby.getPlayerList(),
//                     newHostId: lobby.hostId
//                 });
//             }
//         }
//         socket.data.lobbyId = undefined;
//     });

//     // -------- SESSION --------

//     socket.on('checkSession', () => {
//         socket.emit('checkSessionCallback', {});
//     });

//     // socket.on('initNewSession', (name: string) => {
//     //     const match = getMatch(socket);
//     //     if (!match) return;

//     //     const spawn = match.spawnManager.getFreeSpawnPoint(socket.id);
//     //     if (!spawn) return;

//     //     const player = new Player(socket.id, name, generatePlayerColor(), spawn.position);
//     //     player.setRotation(spawn.rotation);
//     //     player.setWeaponIndex(0);
//     //     player.setAnimation("idle");
//     //     player.health = 100;
//     //     player.maxHealth = 100;

//     //     match.players.add(player);
//     //     socket.data.player = player;

//     //     socket.emit('showLoadout', player.clientFormat());
//     // });

//     socket.on('initNewSession', (name: string) => {
//         const match = getMatch(socket);
//         if (!match) return;

//         const CLIENT_SIDE_SPAWN_MAPS = new Set(['greeble_map', 'lowpoly_environment']);
//         const useClientSpawn = CLIENT_SIDE_SPAWN_MAPS.has(match.mapKey);

//         let spawnPosition: { x: number; y: number; z: number };
//         let spawnRotation: { x: number; y: number } = { x: 0, y: 0 };

//         if (useClientSpawn) {
//             // Client will reposition via MapManager — use neutral origin
//             spawnPosition = { x: 0, y: 0, z: 0 };
//         } else {
//             const spawn = match.spawnManager.getFreeSpawnPoint(socket.id);
//             if (!spawn) return;
//             spawnPosition = spawn.position;
//             spawnRotation = spawn.rotation;
//         }

//         const player = new Player(socket.id, name, generatePlayerColor(), spawnPosition);
//         player.setRotation(spawnRotation);
//         player.setWeaponIndex(0);
//         player.setAnimation("idle");
//         player.health = 100;
//         player.maxHealth = 100;

//         match.players.add(player);
//         socket.data.player = player;

//         // ✅ If player came from lobby with a pre-selected loadout, skip loadout screen
//         if (socket.data.pendingLoadout?.length) {
//             player.setLoadout(socket.data.pendingLoadout);
//             socket.data.pendingLoadout = undefined;

//             // Go straight to initSelf — same as confirmLoadout would do
//             socket.emit('initSelf', player.clientFormat());

//             if (match.mapKey === 'shooting_range') {
//                 socket.emit('initRooms', ROOM_DEFINITIONS);
//                 socket.emit('spawnPoints', match.spawnManager.getSpawnPositions());
//             }

//             const activeRoom = match.roomManager.getActiveRoom();
//             if (activeRoom && match.mapKey === 'shooting_range') {
//                 socket.emit('roomActivated', {
//                     roomId: activeRoom.id,
//                     buildingId: activeRoom.buildingId,
//                     name: activeRoom.name,
//                     position: activeRoom.position,
//                     ammoBoxPosition: activeRoom.ammoBoxPosition,
//                     vaccineBoxPosition: activeRoom.vaccineBoxPosition,
//                     ammoBoxOpen: activeRoom.ammoBox.isOpen,
//                     vaccineBoxOpen: activeRoom.vaccineBox.isOpen,
//                     expiresAt: activeRoom.activeUntil
//                 });
//             }

//             socket.to(match.id).emit('newPlayer', {
//                 ...player.clientFormat(),
//                 mapKey: match.mapKey
//             });
//             socket.to(match.id).emit('playerLoadout', {
//                 id: player.id,
//                 weapons: player.loadout || []
//             });
//         } else {
//             // No pre-selected loadout — show loadout selection screen as normal
//             socket.emit('showLoadout', player.clientFormat());
//         }
//     });

//     socket.on('confirmLoadout', (data: { weapons: string[] }) => {
//         const match = getMatch(socket);
//         const player = socket.data.player;
//         if (!match || !player) return;

//         player.setLoadout(data.weapons);
//         socket.emit('initSelf', player.clientFormat());

//         // Only emit initRooms for maps with rooms
//         if (match.mapKey === 'shooting_range') {
//             socket.emit('initRooms', ROOM_DEFINITIONS);
//             const spawnPositions = match.spawnManager.getSpawnPositions();
//             socket.emit('spawnPoints', spawnPositions);
//         }

//         const activeRoom = match.roomManager.getActiveRoom();
//         if (activeRoom && match.mapKey === 'shooting_range') {
//             socket.emit('roomActivated', {
//                 roomId: activeRoom.id,
//                 buildingId: activeRoom.buildingId,
//                 name: activeRoom.name,
//                 position: activeRoom.position,
//                 ammoBoxPosition: activeRoom.ammoBoxPosition,
//                 vaccineBoxPosition: activeRoom.vaccineBoxPosition,
//                 ammoBoxOpen: activeRoom.ammoBox.isOpen,
//                 vaccineBoxOpen: activeRoom.vaccineBox.isOpen,
//                 expiresAt: activeRoom.activeUntil
//             });
//         }

//         // Broadcast new player WITH mapKey so others can filter
//         socket.to(match.id).emit('newPlayer', {
//             ...player.clientFormat(),
//             mapKey: match.mapKey
//         });

//         socket.to(match.id).emit('playerLoadout', {
//             id: player.id,
//             weapons: data.weapons
//         });
//     });

//     // -------- PLAYER UPDATE (Server Reconciliation) --------

//     socket.on('updatePlayer', (data) => {
//         const match = getMatch(socket);
//         if (!match) return;
//         const player = match.players.find(data.id);
//         if (!player) return;

//         if (data.pos) {
//             player.setPos(data.pos);
//             if (!player.posHistory) player.posHistory = [];
//             player.posHistory.push({ time: Date.now(), pos: { ...data.pos } });
//             player.posHistory = player.posHistory.filter(p => Date.now() - p.time <= 200);
//         }
//         if (data.rotation) player.setRotation(data.rotation);
//         if (data.weaponIndex !== undefined) player.setWeaponIndex(data.weaponIndex);
//         if (data.animation !== undefined) player.setAnimation(data.animation);
//         if (data.loadout !== undefined) player.setLoadout(data.loadout);

//         const { roomId } = match.roomManager.checkPlayerInRoom(data.pos);
//         if (roomId) socket.emit('enteredRoom', { roomId });

//         // Include mapKey so clients can filter
//         socket.to(match.id).emit('updatePlayer', {
//             ...player.clientFormat(),
//             mapKey: match.mapKey
//         });
//     });

//     // -------- FIRE WEAPON (Lag Compensation / Hit Rewind) --------

//     socket.on('fireWeapon', (data) => {
//         const match = getMatch(socket);
//         const shooter = socket.data.player;
//         if (!match || !shooter) return;

//         if (!data.targetId) return;

//         const hitTime = Date.now() - (data.clientPing || 0);
//         const target = match.players.find(data.targetId);
//         if (!target) return;

//         let rewindPos = target.pos;
//         if (target.posHistory && target.posHistory.length > 0) {
//             const closest = target.posHistory.reduce((prev, curr) =>
//                 Math.abs(curr.time - hitTime) < Math.abs(prev.time - hitTime) ? curr : prev
//             );
//             rewindPos = closest.pos;
//         }

//         const MAX_RANGE = 2000;
//         const dx = shooter.pos.x - rewindPos.x;
//         const dy = shooter.pos.y - rewindPos.y;
//         const dz = shooter.pos.z - rewindPos.z;
//         const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
//         if (dist > MAX_RANGE) return;

//         if (data.direction && data.position) {
//             const toTarget = {
//                 x: rewindPos.x - data.position.x,
//                 y: rewindPos.y - data.position.y,
//                 z: rewindPos.z - data.position.z,
//             };
//             const toTargetLen = Math.sqrt(toTarget.x ** 2 + toTarget.y ** 2 + toTarget.z ** 2);
//             const dot = (toTarget.x / toTargetLen) * data.direction.x +
//                 (toTarget.y / toTargetLen) * data.direction.y +
//                 (toTarget.z / toTargetLen) * data.direction.z;
//             if (dot < 0.7) return;
//         }

//         const damage = data.isHeadshot ? 50 : 25;
//         const died = target.takeDamage(damage);

//         io.to(match.id).emit('playerHit', {
//             shooterId: shooter.id,
//             targetId: target.id,
//             weaponIndex: data.weaponIndex,
//             damage: damage,
//             health: target.health,
//             maxHealth: target.maxHealth
//         });

//         if (died) {
//             io.to(match.id).emit('playerDied', {
//                 playerId: target.id,
//                 playerName: target.name,
//                 killerId: shooter.id,
//             });

//             setTimeout(() => {
//                 match.spawnManager.releaseSpawnPoint(target.id);
//                 match.players.remove(target);
//                 match.voiceUsers.delete(target.id);
//                 io.to(match.id).emit('removePlayer', { id: target.id });
//                 if (match.players.getAll().length === 0) {
//                     matchManager.removeMatch(match.id);
//                 }
//             }, 3000);
//         }
//     });

//     socket.on('playerDied', (data: { id: string; killerId: string | null }) => {
//         const match = getMatch(socket);
//         const player = socket.data.player;
//         if (!match || !player) return;

//         io.to(match.id).emit('playerDied', {
//             playerId: player.id,
//             playerName: player.name,
//             killerId: data.killerId,
//         });

//         setTimeout(() => {
//             match.spawnManager.releaseSpawnPoint(player.id);
//             match.players.remove(player);
//             match.voiceUsers.delete(player.id);
//             io.to(match.id).emit('removePlayer', { id: player.id });
//             if (match.players.getAll().length === 0) {
//                 matchManager.removeMatch(match.id);
//             }
//         }, 3000);
//     });

//     socket.on('playerWeaponSwitch', (data) => {
//         const match = getMatch(socket);
//         const player = socket.data.player;
//         if (!match || !player) return;

//         player.setWeaponIndex(data.weaponIndex);
//         socket.to(match.id).emit('playerWeaponSwitch', {
//             id: player.id,
//             weaponIndex: player.weaponIndex
//         });
//     });

//     socket.on('playerReload', () => {
//         const match = getMatch(socket);
//         const player = socket.data.player;
//         if (!match || !player) return;
//         socket.to(match.id).emit('playerReload', { id: player.id });
//     });

//     socket.on('initOthers', () => {
//         const match = getMatch(socket);
//         if (!match) return;
//         const list = match.players.getAll()
//             .filter(p => p.id !== socket.id)
//             .map(p => ({ ...p.clientFormat(), mapKey: match.mapKey }));
//         socket.emit('initOthersCallback', list);
//     });

//     // -------- ROOM SYSTEM --------

//     socket.on("requestActiveRoom", () => {
//         const match = getMatch(socket);
//         if (!match) return;

//         const activeRoom = match.roomManager.getActiveRoom();
//         if (activeRoom) {
//             socket.emit("roomActivated", {
//                 roomId: activeRoom.id,
//                 buildingId: activeRoom.buildingId,
//                 name: activeRoom.name,
//                 position: activeRoom.position,
//                 ammoBoxPosition: activeRoom.ammoBoxPosition,
//                 vaccineBoxPosition: activeRoom.vaccineBoxPosition,
//                 ammoBoxOpen: activeRoom.ammoBox.isOpen,
//                 vaccineBoxOpen: activeRoom.vaccineBox.isOpen,
//                 expiresAt: activeRoom.activeUntil
//             });
//         }
//     });

//     socket.on('openBox', (data: {
//         roomId: string;
//         boxType: 'ammo' | 'vaccine';
//         weaponName?: string;
//     }) => {
//         const match = getMatch(socket);
//         const player = socket.data.player;
//         if (!match || !player) return;

//         const result = match.roomManager.openBox(
//             data.roomId,
//             data.boxType,
//             player.id,
//             player.name,
//             data.weaponName
//         );

//         if (result.success) {
//             if (data.boxType === 'ammo' && data.weaponName) {
//                 player.recordAmmoCollection(data.weaponName);
//             } else if (data.boxType === 'vaccine') {
//                 player.collectedVaccineThisRoom = true;
//             }

//             io.to(match.id).emit('boxOpened', {
//                 roomId: data.roomId,
//                 boxType: data.boxType,
//                 weaponName: data.weaponName,
//                 playerId: player.id,
//                 playerName: player.name,
//                 isFirstOpener: result.isFirstOpener,
//                 collectionCount: result.collectionCount
//             });

//             if (data.boxType === 'ammo' && data.weaponName) {
//                 socket.emit('ammoReceived', {
//                     weaponName: data.weaponName,
//                     reserves: player.weaponReserves[data.weaponName] || 0
//                 });
//             } else if (data.boxType === 'vaccine') {
//                 socket.emit('vaccineReceived');
//             }
//         } else {
//             socket.emit('boxError', { message: result.message });
//         }
//     });

//     socket.on('requestRoomStatus', (data) => {
//         const match = getMatch(socket);
//         if (!match) return;
//         const status = match.roomManager.getRoomStatus(data.roomId);
//         if (status) {
//             socket.emit('roomStatus', status);
//         }
//     });

//     // -------- CHAT --------

//     socket.on('sendMessage', (msg: string) => {
//         const match = getMatch(socket);
//         const player = socket.data.player;
//         if (!match || !player) return;

//         if (msg.startsWith('/')) {
//             socket.readCommand?.(msg);
//             return;
//         }

//         if (msg.length > 200) {
//             socket.emit('serverResponse', { type: 'error', text: 'Too long' });
//             return;
//         }

//         const message = new Message(msg, player, Date.now());
//         match.messages.add(message);
//         io.to(match.id).emit('newMessage', message);
//     });

//     // -------- VOICE (Proximity Chat) --------

//     socket.on('voice-ready', () => {
//         const match = getMatch(socket);
//         const player = socket.data.player;
//         if (!match || !player) return;

//         match.voiceUsers.set(player.id, {
//             socketId: socket.id,
//             playerId: player.id,
//             playerName: player.name
//         });

//         socket.to(match.id).emit('voice-user-connected', {
//             userId: player.id,
//             userName: player.name
//         });

//         const others = Array.from(match.voiceUsers.values())
//             .filter(u => u.playerId !== player.id);
//         socket.emit('voice-users-list', { users: others });
//     });

//     socket.on('voice-signal', (data) => {
//         const match = getMatch(socket);
//         if (!match) return;
//         const target = match.voiceUsers.get(data.to);
//         if (target) {
//             socket.to(target.socketId).emit('voice-signal', data);
//         }
//     });

//     socket.on('voice-speaking', (data) => {
//         const match = getMatch(socket);
//         if (!match) return;
//         const speaker = socket.data.player;
//         if (!speaker) return;

//         const distance = (p1: Player, p2: Player) => {
//             const dx = p1.pos.x - p2.pos.x;
//             const dy = p1.pos.y - p2.pos.y;
//             const dz = p1.pos.z - p2.pos.z;
//             return Math.sqrt(dx * dx + dy * dy + dz * dz);
//         };

//         for (const user of match.voiceUsers.values()) {
//             if (user.playerId === speaker.id) continue;
//             const listener = match.players.find(user.playerId);
//             if (!listener) continue;
//             if (distance(speaker, listener) <= 20) {
//                 socket.to(user.socketId).emit('voice-speaking', data);
//             }
//         }
//     });

//     // -------- RESPAWN --------

//     socket.on('requestRespawn', () => {
//         const match = getMatch(socket);
//         const player = socket.data.player;
//         if (!match || !player) return;

//         match.spawnManager.releaseSpawnPoint(player.id);
//         const spawn = match.spawnManager.getFreeSpawnPoint(player.id);
//         if (!spawn) return;

//         player.setPos(spawn.position);
//         player.setRotation(spawn.rotation);
//         io.to(match.id).emit('updatePlayer', player.clientFormat());
//     });

//     // Add an event to send spawn points to client
//     socket.on('requestSpawnPoints', () => {
//         const match = getMatch(socket);
//         if (!match) return;

//         const spawnPositions = match.spawnManager.getSpawnPositions();
//         socket.emit('spawnPoints', spawnPositions);
//     });

//     // -------- COMMANDS --------

//     socket.readCommand = function (str: string) {
//         const cmd = str.split(' ');
//         switch (cmd[0]) {
//             case '/help':
//                 socket.helpResponse?.();
//                 break;
//             case '/name':
//                 socket.changePlayerName?.(cmd[1]);
//                 break;
//             default:
//                 socket.emit('serverResponse', { type: 'error', text: 'Invalid command' });
//         }
//     };

//     socket.helpResponse = function () {
//         socket.emit('serverResponse', { type: 'success', text: 'Use /name <newName>' });
//     };

//     socket.changePlayerName = function (newName: string) {
//         const player = socket.data.player;
//         if (!player || !newName) return;
//         player.name = newName;
//         io.to(socket.data.matchId!).emit('updatePlayerName', player.clientFormat());
//     };

//     // -------- DISCONNECT --------

//     socket.on('disconnect', () => {
//         // ✅ FIX: Clean up lobby membership on disconnect
//         const lobbyId = socket.data.lobbyId;
//         if (lobbyId) {
//             const lobby = lobbyManager.removePlayerFromLobby(socket.id);
//             if (lobby) {
//                 if (lobby.isEmpty()) {
//                     // Remove the lobby entirely — no players left
//                     lobbyManager.removeLobby(lobbyId);
//                     io.to(lobbyId).emit('lobbyDisbanded');
//                 } else {
//                     io.to(lobbyId).emit('playerLeftLobby', {
//                         players: lobby.getPlayerList(),
//                         newHostId: lobby.hostId
//                     });
//                 }
//             }
//             socket.data.lobbyId = undefined;
//         }

//         // Existing match cleanup
//         const match = getMatch(socket);
//         if (!match) return;
//         const player = socket.data.player;
//         if (!player) return;

//         match.spawnManager.releaseSpawnPoint(player.id);
//         match.players.remove(player);
//         match.voiceUsers.delete(player.id);
//         io.to(match.id).emit('removePlayer', player.clientFormat());
//         if (match.players.getAll().length === 0) {
//             matchManager.removeMatch(match.id);
//         }
//     });
// });