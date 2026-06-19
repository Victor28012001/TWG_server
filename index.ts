// //server/index.ts
// import os from 'os';
// import express, { Request, Response, NextFunction } from 'express';
// import http from 'http';
// import { Server, Socket } from 'socket.io';
// import { CookieStorage, CivicAuth } from "@civic/auth/server";
// import cookieParser from "cookie-parser";
// import cors from 'cors';
// import dotenv from 'dotenv';
// import {
//     Connection,
//     PublicKey,
//     Transaction,
//     LAMPORTS_PER_SOL,
//     SystemProgram,
//     Keypair
// } from '@solana/web3.js';
// import {
//     getAssociatedTokenAddress,
//     createMintToInstruction,
//     getOrCreateAssociatedTokenAccount,
//     createTransferInstruction,
//     TOKEN_PROGRAM_ID
// } from '@solana/spl-token';
// import connectDB from './config/database.js';
// import balanceService from './services/balanceService.js';

// dotenv.config();

// import "dotenv/config";
// import { getWallets } from "@civic/auth-web3/server";
// import { UserDetails } from "./node_modules/@civic/auth-web3/dist/types.js";
// import { BaseUser } from "./node_modules/@civic/auth/dist/types.js";

// // Extend Express Request to include storage and civicAuth used in middleware
// declare global {
//     namespace Express {
//         interface Request {
//             storage: ExpressCookieStorage;
//             civicAuth: CivicAuth;
//         }
//     }
// }

// // Imports
// import Player from './shared/Player';
// import PlayerList from './shared/PlayerList';
// import Message from './shared/Message';
// import MessageList from './shared/MessageList';
// import RoomManager from './shared/RoomManager';
// import { ROOM_DEFINITIONS } from './shared/RoomDefinitions';
// import SpawnManager from './shared/SpawnManager';
// import LeaderboardManager from './shared/LeaderboardManager';
// import StoreManager from './shared/StoreManager';
// import walletService from './services/walletService.js';
// import UserWallet from './models/UserWallet.js';

// // -------------------- SOLANA SETUP --------------------
// const SOLANA_RPC = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
// const connection = new Connection(SOLANA_RPC, "confirmed");

// // Token mint address (JUKEBUCKS)
// const TOKEN_MINT = new PublicKey("FPSapuTED3YTN69KLwrLtPAkXE1cxXne1i8G2iGz653G");

// // Game wallet (for sending rewards)
// const GAME_WALLET_PRIVATE_KEY = process.env.GAME_WALLET_PRIVATE_KEY;
// let gameKeypair: Keypair | null = null;

// if (GAME_WALLET_PRIVATE_KEY) {
//     // Remove quotes if they exist (dotenv handles this automatically)
//     const privateKeyBytes = Buffer.from(GAME_WALLET_PRIVATE_KEY, 'base64');
//     gameKeypair = Keypair.fromSecretKey(privateKeyBytes);
//     console.log(`✅ Game wallet loaded: ${gameKeypair.publicKey.toString()}`);
// }

// // Track processed kills to prevent duplicate minting
// const processedKills = new Set<string>();

// // Clean old kill records periodically
// setInterval(() => {
//     if (processedKills.size > 10000) {
//         const toDelete = Array.from(processedKills).slice(0, 5000);
//         toDelete.forEach(id => processedKills.delete(id));
//     }
// }, 3600000); // Clean every hour

// // -------------------- HELPER FUNCTIONS --------------------

// // Mint JUKEBUCKS tokens to a user
// async function mintTokensToUser(userWalletAddress: string, amount: number): Promise<string> {
//     if (!gameKeypair) {
//         throw new Error("Game wallet not configured");
//     }

//     const userPubkey = new PublicKey(userWalletAddress);

//     // Get or create associated token account for user
//     const userTokenAccount = await getOrCreateAssociatedTokenAccount(
//         connection,
//         gameKeypair,
//         TOKEN_MINT,
//         userPubkey
//     );

//     // Create mint transaction
//     const mintToIx = createMintToInstruction(
//         TOKEN_MINT,
//         userTokenAccount.address,
//         gameKeypair.publicKey,
//         amount * (10 ** 9), // Assuming 9 decimals for JUKEBUCKS
//         []
//     );

//     const transaction = new Transaction().add(mintToIx);
//     transaction.feePayer = gameKeypair.publicKey;

//     // Send transaction
//     const signature = await connection.sendTransaction(transaction, [gameKeypair]);
//     await connection.confirmTransaction(signature, 'confirmed');

//     return signature;
// }

// async function applyPurchasedItem(player: Player, item: any, quantity: number) {
//     switch (item.category) {
//         case 'weapon':
//             if (!player.unlockedWeapons.includes(item.itemData.weaponName)) {
//                 player.unlockedWeapons.push(item.itemData.weaponName);
//             }
//             break;

//         case 'consumable':
//             const itemId = `${item.id}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
//             let itemType: 'vaccine' | 'ammo' | 'health' | 'grenade' | 'consumable' = 'consumable';
//             if (item.itemData.type === 'health') itemType = 'health';
//             else if (item.itemData.type === 'grenade') itemType = 'grenade';
//             else if (item.itemData.type === 'vaccine') itemType = 'vaccine';
//             else if (item.itemData.type === 'ammo') itemType = 'ammo';

//             player.inventory.push({
//                 id: itemId,
//                 type: itemType,
//                 name: item.name,
//                 count: item.itemData.amount || quantity,
//                 data: item.itemData
//             });
//             break;

//         case 'cosmetic':
//             if (!player.unlockedSkins.includes(item.id)) {
//                 player.unlockedSkins.push(item.id);
//             }
//             break;

//         case 'boost':
//             player.activeBoosts.push({
//                 type: item.itemData.type,
//                 multiplier: item.itemData.multiplier,
//                 expiresAt: Date.now() + (item.itemData.duration * 1000)
//             });
//             break;
//     }
// }

// // Send SOL to a user
// async function sendSolToUser(userWalletAddress: string, amountInSol: number): Promise<string> {
//     if (!gameKeypair) {
//         throw new Error("Game wallet not configured");
//     }

//     const userPubkey = new PublicKey(userWalletAddress);
//     const transaction = new Transaction().add(
//         SystemProgram.transfer({
//             fromPubkey: gameKeypair.publicKey,
//             toPubkey: userPubkey,
//             lamports: amountInSol * LAMPORTS_PER_SOL,
//         })
//     );
//     transaction.feePayer = gameKeypair.publicKey;

//     const signature = await connection.sendTransaction(transaction, [gameKeypair]);
//     await connection.confirmTransaction(signature, 'confirmed');

//     return signature;
// }

// async function syncPlayerTokenBalance(player: Player, walletAddress: string) {
//     try {
//         const balance = await getUserTokenBalance(walletAddress);
//         player.tokenBalance = balance;
//         console.log(`💰 Synced balance for ${player.name}: ${balance} $JBKS`);
//         return balance;
//     } catch (error) {
//         console.error(`Failed to sync balance for ${player.name}:`, error);
//         return player.tokenBalance;
//     }
// }

// // Get user's token balance
// async function getUserTokenBalance(walletAddress: string): Promise<number> {
//     if (!walletAddress) {
//         console.log("No wallet address provided to getUserTokenBalance");
//         return 0;
//     }

//     try {
//         const pubkey = new PublicKey(walletAddress);
//         const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
//             pubkey,
//             { mint: TOKEN_MINT }
//         );

//         if (tokenAccounts.value.length === 0) return 0;
//         return tokenAccounts.value[0].account.data.parsed.info.tokenAmount.uiAmount || 0;
//     } catch (error) {
//         console.error("Error getting token balance:", error);
//         return 0;
//     }
// }

// async function createTransferTransaction(
//     userWalletAddress: string,
//     amount: number
// ): Promise<{ transaction: string; userTokenAccount: string; gameTokenAccount: string }> {
//     if (!gameKeypair) {
//         throw new Error("Game wallet not configured");
//     }

//     const userPubkey = new PublicKey(userWalletAddress);
//     const gamePubkey = gameKeypair.publicKey;

//     // Get or create token accounts
//     const userTokenAccount = await getAssociatedTokenAddress(
//         TOKEN_MINT,
//         userPubkey
//     );

//     const gameTokenAccount = await getAssociatedTokenAddress(
//         TOKEN_MINT,
//         gamePubkey
//     );

//     // Create transfer instruction
//     const transferIx = createTransferInstruction(
//         userTokenAccount,
//         gameTokenAccount,
//         userPubkey,
//         BigInt(amount * (10 ** 9)) // Convert to smallest unit (9 decimals)
//     );

//     // Get recent blockhash
//     const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();

//     // Create transaction
//     const transaction = new Transaction();
//     transaction.add(transferIx);
//     transaction.recentBlockhash = blockhash;
//     transaction.feePayer = userPubkey;
//     transaction.lastValidBlockHeight = lastValidBlockHeight;

//     // Serialize transaction
//     const serializedTransaction = transaction.serialize({
//         requireAllSignatures: false,
//         verifySignatures: false
//     });

//     return {
//         transaction: serializedTransaction.toString('base64'),
//         userTokenAccount: userTokenAccount.toString(),
//         gameTokenAccount: gameTokenAccount.toString()
//     };
// }

// // Record kill and mint tokens
// async function recordKillAndReward(
//     killerWallet: string,
//     victimWallet: string,
//     weaponName: string,
//     isHeadshot: boolean
// ): Promise<{ success: boolean; reward: number; signature?: string }> {
//     // Create unique kill ID
//     const killId = `${killerWallet}_${victimWallet}_${Date.now()}`;

//     // Check if already processed
//     if (processedKills.has(killId)) {
//         console.log("Duplicate kill prevented:", killId);
//         return { success: false, reward: 0 };
//     }
//     processedKills.add(killId);

//     // Calculate reward (headshot gives more)
//     const baseReward = isHeadshot ? 5 : 2; // 5 or 2 JUKEBUCKS per kill

//     try {
//         // Mint tokens to killer
//         const signature = await mintTokensToUser(killerWallet, baseReward);

//         console.log(`✅ Rewarded ${baseReward} JUKEBUCKS to ${killerWallet} for killing ${victimWallet}`);

//         return {
//             success: true,
//             reward: baseReward,
//             signature
//         };
//     } catch (error) {
//         console.error("Failed to mint reward:", error);
//         return { success: false, reward: 0 };
//     }
// }

// async function getWalletsWithRetry(userDetails: any, maxRetries = 3, delay = 2000): Promise<any[]> {
//     for (let i = 0; i < maxRetries; i++) {
//         try {
//             console.log(`🔄 getWallets attempt ${i + 1}/${maxRetries}...`);
//             const wallets = await getWallets(userDetails);
//             return wallets;
//         } catch (error) {
//             console.log(`⚠️ getWallets attempt ${i + 1} failed:`, error.message);
//             if (i === maxRetries - 1) throw error;
//             await new Promise(resolve => setTimeout(resolve, delay));
//         }
//     }
//     throw new Error('Failed to get wallets after retries');
// }


// async function syncPlayerInventory(player: Player, userId: string) {
//     try {
//         const userWallet = await UserWallet.findOne({ userId });
//         if (userWallet && userWallet.inventory) {
//             // Convert database format to client format
//             const inventoryForClient = userWallet.inventory.map((dbItem: any) => ({
//                 id: dbItem.itemId,
//                 itemId: dbItem.itemId,
//                 type: dbItem.type,
//                 name: dbItem.name,
//                 count: dbItem.count || 1,
//                 weaponName: dbItem.weaponName || '',
//                 data: dbItem.data || {}
//             }));
//             player.inventory = inventoryForClient;
//             return inventoryForClient;
//         }
//         return player.inventory;
//     } catch (error) {
//         console.error('Failed to sync inventory:', error);
//         return player.inventory;
//     }
// }

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

// const TICK_RATE = 20; // 20 updates/sec
// const TICK_INTERVAL = 1000 / TICK_RATE;

// const VIEW_DISTANCE = 120; // adjust based on your map scale

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
//         walletAddress?: string;
//         pendingWallet?: string;
//         userId?: string;
//         pendingUserId?: string;
//     };
//     readCommand?: (message: string) => void;
//     helpResponse?: () => void;
//     changePlayerName?: (newName: string) => void;
// }

// // ---------------- SERVER ----------------

// const app = express();
// const PORT = app.get('port') || 5000;

// app.use(
//     cors({
//         origin: (origin, callback) => {
//             const allowed = [
//                 "http://localhost:5173",
//                 "http://localhost:5174",
//                 "https://eloquence-overlay-kisser.ngrok-free.dev",
//                 "capacitor://localhost",
//             ];
//             if (!origin || allowed.includes(origin)) {
//                 callback(null, true);
//             } else {
//                 callback(new Error(`CORS blocked: ${origin}`));
//             }
//         },
//         credentials: true,
//         methods: ["GET", "POST", "OPTIONS"],
//         allowedHeaders: ["Content-Type", "Authorization", "Cookie", "ngrok-skip-browser-warning"],
//         exposedHeaders: ["Set-Cookie"],
//     }),
// );

// app.use((req: Request, res: Response, next: NextFunction) => {
//     res.setHeader("ngrok-skip-browser-warning", "true");
//     next();
// });

// app.use(cookieParser());
// app.use(express.json());
// app.use(express.urlencoded({ extended: true }));

// const config = {
//     clientId: "b4cc6576-d5d0-46e9-ba55-e36944b4a7f9",
//     oauthServer: process.env.AUTH_SERVER || 'https://auth.civic.com/oauth',
//     redirectUrl: process.env.REDIRECT_URL || `https://eloquence-overlay-kisser.ngrok-free.dev/auth/callback`,
//     postLogoutRedirectUrl: process.env.POST_LOGOUT_URL || `https://eloquence-overlay-kisser.ngrok-free.dev/`,
// };

// class ExpressCookieStorage extends CookieStorage {
//     private isDev: boolean;

//     constructor(
//         private req: Request,
//         private res: Response
//     ) {
//         const isDev = process.env.NODE_ENV !== 'production';
//         super({
//             secure: !isDev,        // false on localhost (HTTP), true on ngrok (HTTPS)
//             sameSite: isDev ? "lax" : "none",  // lax works on localhost, none needed cross-origin
//             httpOnly: false,       // must be false for Civic SDK to read it client-side
//             path: "/",
//         });
//         this.isDev = isDev;
//     }

//     async get(key: string): Promise<string | null> {
//         const value = this.req.cookies?.[key] ?? null;
//         console.log(`🍪 Cookie GET "${key}":`, value ? "found" : "NOT FOUND");
//         return value;
//     }

//     async set(key: string, value: string): Promise<void> {
//         console.log(`🍪 Cookie SET "${key}"`);
//         this.res.cookie(key, value, {
//             secure: !this.isDev,
//             sameSite: this.isDev ? "lax" : "none",
//             httpOnly: false,
//             path: "/",
//             // Don't set domain — let browser use the current domain automatically
//         });
//     }

//     async clear(): Promise<void> {
//         for (const key in this.req.cookies) {
//             this.res.clearCookie(key, {
//                 path: "/",
//                 sameSite: this.isDev ? "lax" : "none",
//                 secure: !this.isDev,
//             });
//         }
//     }

//     async delete(key: string): Promise<void> {
//         this.res.clearCookie(key, {
//             path: "/",
//             sameSite: this.isDev ? "lax" : "none",
//             secure: !this.isDev,
//         });
//     }
// }

// app.use((req: Request, res: Response, next: NextFunction) => {
//     req.storage = new ExpressCookieStorage(req, res);
//     // Create and attach the civicAuth instance
//     req.civicAuth = new CivicAuth(req.storage, config);
//     next();
// });

// app.get('/auth/login-url', async (req: Request, res: Response) => {
//     console.log('📡 /auth/login-url called');
//     try {
//         // Make sure scopes are correct - no typos
//         const url = await req.civicAuth.buildLoginUrl({
//             scopes: ['openid', 'profile', 'email']
//         });
//         console.log('✅ Login URL built:', url.toString());
//         res.json({ loginUrl: url.toString() });
//     } catch (error) {
//         console.error('❌ Error building login URL:', error);
//         res.status(500).json({ error: 'Failed to build login URL', details: error.message });
//     }
// });

// // Auth callback route
// app.get("/auth/callback", async (req: Request, res: Response) => {
//     const { code, state } = req.query as { code: string; state: string };
//     const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

//     try {
//         await req.civicAuth.resolveOAuthAccessCode(code, state);
//         res.redirect(`${FRONTEND_URL}/oauth-done.html?success=true`);
//     } catch (error) {
//         console.error("Error during authentication:", error);
//         const msg = encodeURIComponent(error.message || "Authentication failed");
//         res.redirect(`${FRONTEND_URL}/oauth-done.html?error=${msg}`);
//     }
// });

// // THEN your root route
// app.get('/', (req: Request, res: Response) => {
//     res.json({
//         status: 'online',
//         message: 'The Winnowing Games Server',
//         version: '1.0.0',
//         timestamp: Date.now()
//     });
// });

// const authMiddleware = async (
//     req: Request,
//     res: Response,
//     next: NextFunction
// ) => {
//     if (!req.civicAuth.isLoggedIn()) {
//         // Check if this is an API route
//         if (req.path.startsWith('/api/')) {
//             return res.status(401).json({ error: 'Unauthorized', authenticated: false });
//         }
//         return res.status(401).send("Unauthorized");
//     }
//     next();
// };

// app.use("/admin", authMiddleware);

// app.get("/admin/dashboard", async (req: Request, res: Response) => {
//     const user = await req.civicAuth.getUser();
//     const tokens = await req.civicAuth.getTokens();
//     const userDetails = {
//         ...user as BaseUser & UserDetails & { idToken: string },
//         idToken: tokens?.idToken || "",
//     };

//     if (!user) return res.status(401).send("Unauthorized");

//     console.log("Getting wallets for authenticated user...", userDetails);
//     const wallets = await getWallets(userDetails);

//     const solanaWallet = wallets.find(w => w.type === 'solana');
//     const ethereumWallet = wallets.find(w => w.type === 'ethereum');

//     console.log("Wallet creation completed successfully");
//     console.log("Solana wallet:", solanaWallet?.walletAddress);
//     console.log("Ethereum wallet:", ethereumWallet?.walletAddress);

//     res.setHeader("Content-Type", "text/html");
//     res.send(`
//     <html>
//       <head>
//         <title>Civic Auth + Wallet Dashboard</title>
//         <style>
//           body { font-family: Arial, sans-serif; margin: 40px; }
//           .container { max-width: 600px; margin: 0 auto; }
//           .success { color: #28a745; }
//           .info { color: #17a2b8; }
//           button { padding: 10px 20px; margin: 10px 0; cursor: pointer; }
//         </style>
//       </head>
//       <body>
//         <div class="container">
//           <h1>🎉 Welcome, ${user?.name}!</h1>
//           <div class="success">
//             <p>✅ Authentication successful</p>
//             <p>✅ Wallet created/verified on backend</p>
//             <p>✅ Solana Wallet: ${solanaWallet?.walletAddress || 'Not available'}</p>
//             <p>✅ Ethereum Wallet: ${ethereumWallet?.walletAddress || 'Not available'}</p>
//           </div>
//           <div class="info">
//             <h3>User Details:</h3>
//             <p><strong>Name:</strong> ${user?.name}</p>
//             <p><strong>Email:</strong> ${user?.email || 'Not provided'}</p>
//           </div>
//           <p>Your Solana wallet is ready to receive JUKEBUCKS tokens!</p>
//           <button onclick="window.location.href='/auth/logout'">Logout</button>
//         </div>
//       </body>
//     </html>
//   `);
// });

// app.get("/auth/logout", async (req: Request, res: Response) => {
//     const url = await req.civicAuth.buildLogoutRedirectUrl();
//     res.redirect(url.toString());
// });

// app.get("/auth/logoutcallback", async (req: Request, res: Response) => {
//     const { state } = req.query as { state: string };
//     console.log(`Logout-callback: state=${state}`);
//     await req.storage.clear();
//     res.redirect("/");
// });



// // -------------------- SOLANA API ENDPOINTS --------------------

// // Get current authenticated user's wallet and balance
// app.get('/api/wallet', authMiddleware, async (req: Request, res: Response) => {
//     try {
//         const user = await req.civicAuth.getUser();
//         if (!user) {
//             return res.status(401).json({ error: 'Not authenticated' });
//         }

//         // Get or create managed wallet
//         const userWallet = await balanceService.getOrCreateUser(
//             user.id,
//             user.email,
//             user.name
//         );

//         const balance = await walletService.getUserBalance(user.id);

//         res.json({
//             authenticated: true,
//             user: {
//                 id: user.id,
//                 name: user.name,
//                 email: user.email,
//             },
//             wallet: userWallet.managedWallet.publicKey,
//             tokenBalance: balance.gameBalance,
//             totalEarned: userWallet.totalEarned,
//             totalSpent: userWallet.totalSpent
//         });
//     } catch (error) {
//         console.error('Error getting wallet:', error);
//         res.status(500).json({ error: 'Failed to get wallet' });
//     }
// });

// app.get('/api/auth/profile', authMiddleware, async (req: Request, res: Response) => {
//     try {
//         const user = await req.civicAuth.getUser();
//         const tokens = await req.civicAuth.getTokens();

//         if (!user) {
//             return res.status(401).json({ error: 'Not authenticated' });
//         }

//         const userDetails = {
//             ...user as BaseUser & UserDetails & { idToken: string },
//             idToken: tokens?.idToken || "",
//         };

//         const wallets = await getWalletsWithRetry(userDetails, 3, 2000);
//         const solanaWallet = wallets.find(w => w.type === 'solana');

//         res.json({
//             authenticated: true,
//             user: {
//                 id: user.id,
//                 name: user.name,
//                 email: user.email,
//             },
//             wallet: solanaWallet?.walletAddress || null,
//         });
//     } catch (error) {
//         console.error('Error getting user profile:', error);
//         res.status(500).json({ error: 'Failed to get profile' });
//     }
// });

// // Check if user is authenticated
// app.get('/api/auth/status', async (req: Request, res: Response) => {
//     const isLoggedIn = req.civicAuth.isLoggedIn();
//     res.json({ authenticated: isLoggedIn });
// });

// // Logout endpoint
// app.get('/api/auth/logout', async (req: Request, res: Response) => {
//     const url = await req.civicAuth.buildLogoutRedirectUrl();
//     res.json({ logoutUrl: url.toString() });
// });

// // Get user's JUKEBUCKS balance
// app.get('/api/token/balance', authMiddleware, async (req: Request, res: Response) => {
//     try {
//         const user = await req.civicAuth.getUser();
//         const tokens = await req.civicAuth.getTokens();

//         if (!user) {
//             return res.status(401).json({ error: 'Not authenticated' });
//         }

//         const userDetails = {
//             ...user as BaseUser & UserDetails & { idToken: string },
//             idToken: tokens?.idToken || "",
//         };

//         // const wallets = await getWallets(userDetails);

//         // ✅ WITH THIS:
//         const wallets = await getWalletsWithRetry(userDetails, 5, 2000);
//         const solanaWallet = wallets.find(w => w.type === 'solana');
//         const walletAddress = solanaWallet?.walletAddress;

//         if (!walletAddress) {
//             return res.json({ balance: 0, message: 'No Solana wallet found' });
//         }

//         const balance = await getUserTokenBalance(walletAddress);
//         res.json({ balance });
//     } catch (error) {
//         console.error('Error getting balance:', error);
//         res.status(500).json({ error: 'Failed to get balance' });
//     }
// });

// // Add a simple in-memory store for user data (replace with database in production)
// const userDailyClaims = new Map<string, number>();

// // Clean up old entries periodically (keep last 7 days)
// setInterval(() => {
//     const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
//     for (const [userId, timestamp] of userDailyClaims.entries()) {
//         if (timestamp < oneWeekAgo) {
//             userDailyClaims.delete(userId);
//         }
//     }
// }, 24 * 60 * 60 * 1000); // Clean once per day

// // Claim daily reward
// app.post('/api/token/claim-daily', authMiddleware, async (req: Request, res: Response) => {
//     try {
//         const user = await req.civicAuth.getUser();
//         if (!user) {
//             return res.status(401).json({ error: 'Not authenticated' });
//         }

//         // Get or create user with managed wallet
//         const userWallet = await balanceService.getOrCreateUser(
//             user.id,
//             user.email || '',
//             user.name || ''
//         );

//         // Check if already claimed today
//         const lastClaim = userDailyClaims.get(user.id) || 0;
//         const now = Date.now();
//         const oneDay = 24 * 60 * 60 * 1000;

//         if (now - lastClaim < oneDay) {
//             const hoursLeft = Math.ceil((oneDay - (now - lastClaim)) / (60 * 60 * 1000));
//             return res.status(429).json({
//                 success: false,
//                 error: `Already claimed! Next claim in ${hoursLeft} hours`,
//                 nextClaimIn: oneDay - (now - lastClaim)
//             });
//         }

//         // ✅ Mint to the managed wallet using walletService
//         const result = await walletService.mintTokensToUser(user.id, 100);

//         if (result.success) {
//             userDailyClaims.set(user.id, now);

//             // Record in database
//             await UserWallet.updateOne(
//                 { userId: user.id },
//                 {
//                     $push: {
//                         earnings: {
//                             amount: 100,
//                             source: 'daily_reward',
//                             signature: result.signature,
//                             timestamp: new Date()
//                         }
//                     }
//                 }
//             );
//         }

//         const balance = await walletService.getUserBalance(user.id);

//         res.json({
//             success: true,
//             reward: 100,
//             signature: result.signature,
//             newBalance: balance.gameBalance,
//             wallet: userWallet.managedWallet.publicKey
//         });
//     } catch (error) {
//         console.error('Error claiming daily reward:', error);
//         res.status(500).json({ error: 'Failed to claim reward' });
//     }
// });

// app.post('/api/store/purchase', authMiddleware, async (req: Request, res: Response) => {
//     try {
//         const { itemId, quantity = 1 } = req.body;
//         const user = await req.civicAuth.getUser();
//         const tokens = await req.civicAuth.getTokens();

//         if (!user) return res.status(401).json({ error: 'Not authenticated' });

//         const userDetails = {
//             ...user as BaseUser & UserDetails & { idToken: string },
//             idToken: tokens?.idToken || "",
//         };

//         const wallets = await getWalletsWithRetry(userDetails, 3, 2000);
//         const solanaWallet = wallets.find(w => w.type === 'solana');
//         const walletAddress = solanaWallet?.walletAddress;

//         if (!walletAddress) {
//             return res.status(404).json({ error: 'No Solana wallet found' });
//         }

//         // Get or create user in database
//         await balanceService.getOrCreateUser(
//             user.id,
//             walletAddress,
//             user.name || '',
//             user.email || ''
//         );

//         // Get item from store
//         const item = storeManager.getItem(itemId);
//         if (!item) {
//             return res.status(404).json({ error: 'Item not found' });
//         }

//         // Calculate price
//         const finalPrice = item.discount
//             ? Math.floor(item.price * (1 - item.discount / 100))
//             : item.price;
//         const totalCost = finalPrice * quantity;

//         // Process purchase using game balance (database, no blockchain transaction)
//         const result = await balanceService.purchaseItem(
//             user.id,
//             itemId,
//             item.name,
//             totalCost
//         );

//         if (!result.success) {
//             return res.status(400).json({
//                 error: result.message,
//                 gameBalance: await balanceService.getGameBalance(user.id)
//             });
//         }

//         // Add item to inventory
//         await balanceService.addToInventory(user.id, item);

//         res.json({
//             success: true,
//             message: `Purchased ${item.name}!`,
//             newBalance: result.newBalance,
//             blockchainBalance: result.blockchainBalance,
//             item: {
//                 id: item.id,
//                 name: item.name,
//                 price: finalPrice,
//                 category: item.category
//             }
//         });

//     } catch (error) {
//         console.error('Purchase error:', error);
//         res.status(500).json({ error: 'Purchase failed' });
//     }
// });

// // -------------------- SOCKET.IO SERVER --------------------

// const server = http.createServer(app);

// // Initialize database connection
// connectDB();

// const leaderboardManager = new LeaderboardManager();
// const storeManager = new StoreManager();

// // ========== MODIFIED: Configure CORS for mobile ==========
// const io = new Server(server, {
//     cors: {
//         origin: [
//             "http://localhost:5173",        // ← Add Vite's port
//             "http://localhost:5000",           // Local server
//             "http://localhost:3000",           // Local web development
//             "https://eloquence-overlay-kisser.ngrok-free.dev",       // ← Add HTTPS localhost
//             "capacitor://localhost",           // Capacitor iOS/Android
//             "http://localhost",                // Generic localhost
//             "http://10.0.2.2:3000",            // Android emulator
//             "http://10.0.2.2:5000",            // Android emulator server
//             "http://192.168.*.*",              // Local network (wildcard - you may need specific IPs)
//             "*"                                 // For development only - remove in production
//         ],
//         methods: ["GET", "POST", "OPTIONS"],
//         optionsSuccessStatus: 200,
//         exposedHeaders: ["Set-Cookie"],
//         credentials: true,
//         allowedHeaders: ["Content-Type", "Authorization", "Cookie"]
//     },
//     transports: ['websocket', 'polling'],      // Allow both transport methods
//     allowEIO3: true,                           // Allow Engine.IO v3 clients
//     pingTimeout: 60000,                        // Longer timeout for mobile networks
//     pingInterval: 25000                        // Ping interval for mobile
// });

// storeManager.setBroadcastFunction((event, data) => io.emit(event, data));
// leaderboardManager.setBroadcastFunction((event: string, data: any) => { io.emit(event, data); });

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

// app.set('port', process.env.PORT || 5000);

// app.use(express.json());
// app.use(express.urlencoded({ extended: true }));

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
// // const PORT = app.get('port');
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


// function getPlayerCountForMap(mapKey: string): number {
//     let count = 0;
//     for (const match of matchManager.getAllMatches()) {
//         if (match.mapKey === mapKey) {
//             count += match.players.getAll().length;
//         }
//     }
//     return count;
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
//             // Only set up room cycle for maps that have rooms
//             if (mapKey === 'shooting_range') {
//                 setupRoomActivationForMatch(match);
//                 match.roomManager._activationSetup = true;
//             } else {
//                 match.roomManager._activationSetup = true; // mark as setup, no-op
//             }
//         }

//         socket.join(match.id);
//         socket.data.matchId = match.id;

//         socket.emit("matchJoined", { matchId: match.id, mapKey });
//     });

//     // -------- SESSION --------

//     socket.on('checkSession', () => {
//         socket.emit('checkSessionCallback', {});
//     });

//     socket.on('initNewSession', (name: string) => {
//         const match = getMatch(socket);
//         if (!match) return;

//         const spawn = match.spawnManager.getFreeSpawnPoint(socket.id);
//         if (!spawn) return;

//         const player = new Player(socket.id, name, generatePlayerColor(), spawn.position);
//         player.setRotation(spawn.rotation);
//         player.setWeaponIndex(0);
//         player.setAnimation("idle");
//         player.health = 100;
//         player.maxHealth = 100;

//         // Check for pending wallet from before player was created
//         if (socket.data.pendingWallet) {
//             player.setWalletAddress(socket.data.pendingWallet);
//             socket.data.walletAddress = socket.data.pendingWallet;
//             console.log(`✅ Applied pending wallet to player ${name}: ${player.walletAddress}`);
//             delete socket.data.pendingWallet;
//         }

//         // ✅ Check for pending userId and create managed wallet
//         if (socket.data.pendingUserId) {
//             console.log(`✅ Creating managed wallet for pending user ${socket.data.pendingUserId}`);
//             // Create the managed wallet for this user
//             balanceService.getOrCreateUser(
//                 socket.data.pendingUserId,
//                 '',
//                 name
//             ).then(async (userWallet) => {
//                 const managedWalletAddress = userWallet.managedWallet.publicKey;
//                 player.setWalletAddress(managedWalletAddress);
//                 socket.data.walletAddress = managedWalletAddress;
//                 socket.data.userId = socket.data.pendingUserId;

//                 const balance = await walletService.getUserBalance(socket.data.pendingUserId);
//                 player.tokenBalance = balance.gameBalance;

//                 console.log(`✅ Managed wallet created for ${name}: ${managedWalletAddress}`);
//                 socket.emit('tokenBalanceUpdate', { balance: balance.gameBalance });
//             }).catch(err => {
//                 console.error('Failed to create managed wallet:', err);
//             });

//             delete socket.data.pendingUserId;
//         }

//         match.players.add(player);
//         socket.data.player = player;

//         leaderboardManager.updatePlayer(player.id, player.name, {
//             kills: 0, deaths: 0, level: 1, headshots: 0, highestKillstreak: 0, score: 0, tokenBalance: player.tokenBalance || 0
//         });

//         // Instead of emitting showLoadout, emit initSelf directly
//         // The loadout will be set when client emits confirmLoadout
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

//         // Broadcast new player
//         // socket.to(match.id).emit('newPlayer', {
//         //     ...player.clientFormat(),
//         //     mapKey: match.mapKey
//         // });
//     });

//     socket.on('confirmLoadout', (data: { weapons: string[] }) => {
//         const match = getMatch(socket);
//         const player = socket.data.player;
//         if (!match || !player) return;

//         player.setLoadout(data.weapons);

//         // ✅ Broadcast new player NOW (after loadout is set)
//         socket.to(match.id).emit('newPlayer', {
//             ...player.clientFormat(),
//             mapKey: match.mapKey
//         });

//         // Don't emit initSelf again - player already initialized
//         // Just notify others about the loadout
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

//     socket.on('fireWeapon', async (data) => {
//         const match = getMatch(socket);
//         const shooter = socket.data.player;
//         if (!match || !shooter) return;

//         if (!data.targetId) return;

//         const hitTime = Date.now() - (data.clientPing || 0);
//         const target = match.players.find(data.targetId);
//         if (!target) return;

//         // ✅ Don't process damage if target is already dead
//         if (target.isDead) {
//             return;
//         }

//         // ✅ CHECK IF TARGET IS IN SPAWN BOX (invincible)
//         if (data.targetInSpawnBox) {
//             return;
//         }

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

//         const damage = data.damage;
//         const isHeadshot = data.isHeadshot || false;

//         const died = target.takeDamage(damage);

//         io.to(match.id).emit('playerHit', {
//             shooterId: shooter.id,
//             targetId: target.id,
//             weaponIndex: data.weaponIndex,
//             weaponName: data.weaponName,
//             damage: damage,
//             health: target.health,
//             maxHealth: target.maxHealth,
//             isHeadshot: isHeadshot
//         });

//         if (died) {
//             const killRewards = shooter.progression.addKill(isHeadshot);
//             target.progression.addDeath();

//             // Update leaderboard
//             leaderboardManager.updatePlayer(shooter.id, shooter.name, {
//                 kills: shooter.progression.data.kills, deaths: shooter.progression.data.deaths,
//                 level: shooter.progression.data.level, headshots: shooter.progression.data.headshots,
//                 highestKillstreak: shooter.progression.data.highestKillstreak,
//                 score: shooter.progression.data.kills * 100 + shooter.progression.data.headshots * 50
//             });
//             leaderboardManager.updatePlayer(target.id, target.name, {
//                 kills: target.progression.data.kills, deaths: target.progression.data.deaths,
//                 level: target.progression.data.level, headshots: target.progression.data.headshots,
//                 highestKillstreak: target.progression.data.highestKillstreak,
//                 score: target.progression.data.kills * 100 + target.progression.data.headshots * 50
//             });

//             // Try multiple ways to get wallet
//             let killerWallet = shooter.walletAddress;
//             if (!killerWallet && socket.data.walletAddress) {
//                 killerWallet = socket.data.walletAddress;
//             }
//             if (!killerWallet && socket.data.pendingWallet) {
//                 killerWallet = socket.data.pendingWallet;
//             }

//             // ✅ ADD MINTING LOGIC HERE
//             console.log(`💀 Player died - killer wallet: ${shooter.walletAddress || 'NONE'}, victim: ${target.walletAddress || target.id}`);

//             if (shooter && shooter.walletAddress) {
//                 console.log(`🪙 Attempting to mint tokens to ${shooter.walletAddress}...`);
//                 try {
//                     const reward = await recordKillAndReward(
//                         shooter.walletAddress,
//                         target.walletAddress || target.id,
//                         data.weaponName,
//                         isHeadshot
//                     );
//                     console.log(`🪙 Mint result:`, reward);

//                     if (reward.success) {
//                         // Emit kill reward directly to the killer
//                         socket.emit('killReward', {
//                             amount: reward.reward,
//                             signature: reward.signature,
//                             weapon: data.weaponName,
//                             isHeadshot: isHeadshot
//                         });

//                         // Update player's token balance
//                         const newBalance = await walletService.getUserBalance(shooter.id);
//                         shooter.tokenBalance = newBalance.gameBalance;
//                         console.log(`✅ killReward emitted to killer ${shooter.id}`);
//                     }
//                 } catch (err) {
//                     console.error('❌ Kill reward failed:', err);
//                 }
//             }

//             io.to(match.id).emit('playerDied', {
//                 playerId: target.id, playerName: target.name, killerId: shooter.id,
//                 weaponName: data.weaponName, isHeadshot: isHeadshot,
//                 killerProgression: shooter.getProgressionData(),
//                 killRewards: killRewards
//             });

//             socket.emit('progressionUpdate', {
//                 progression: shooter.getProgressionData(),
//                 killRewards: killRewards
//             });
//         }
//     });

//     socket.on('requestLeaderboard', (data?: { sortBy?: string }) => {
//         const sortBy = data?.sortBy || 'score';
//         socket.emit('leaderboardData', {
//             ...leaderboardManager.getLeaderboardData(sortBy),
//             playerRank: leaderboardManager.getPlayerRank(socket.id),
//             playerStats: leaderboardManager.getPlayerStats(socket.id)
//         });
//     });

//     // socket.on('walletConnected', async (data: { wallet: string, userId?: string }) => {
//     //     const player = socket.data.player;
//     //     console.log(`🔐 walletConnected received - socket ID: ${socket.id}, player exists: ${!!player}`);
//     //     if (player) {
//     //         player.setWalletAddress(data.wallet);
//     //         socket.data.walletAddress = data.wallet;

//     //         // ✅ Store userId
//     //         if (data.userId) {
//     //             socket.data.userId = data.userId;
//     //             player.id = data.userId;
//     //         }

//     //         // ✅ SYNC TOKEN BALANCE FROM BLOCKCHAIN
//     //         const balance = await syncPlayerTokenBalance(player, data.wallet);

//     //         console.log(`✅ Wallet set for player ${player.name} (${player.id}): ${player.walletAddress}, Balance: ${balance} $JBKS`);

//     //         // Update leaderboard with wallet address
//     //         leaderboardManager.updatePlayer(player.id, player.name, {
//     //             kills: player.kills,
//     //             deaths: player.deaths,
//     //             level: player.progression.data.level,
//     //             headshots: player.progression.data.headshots,
//     //             highestKillstreak: player.progression.data.highestKillstreak,
//     //             score: player.kills * 100 + player.progression.data.headshots * 50,
//     //             wallet: data.wallet,
//     //             tokenBalance: balance
//     //         });

//     //         // Send balance update to client
//     //         socket.emit('tokenBalanceUpdate', { balance });
//     //     } else {
//     //         console.log(`⚠️ No player found for socket ${socket.id}, storing pending wallet`);
//     //         socket.data.pendingWallet = data.wallet;  // Now TypeScript knows this exists
//     //     }
//     // });

//     socket.on('walletConnected', async (data: { wallet: string, userId?: string }) => {
//         const player = socket.data.player;
//         console.log(`🔐 walletConnected received - socket ID: ${socket.id}, userId: ${data.userId}`);

//         if (data.userId && player) {
//             // Get or create the managed wallet for this user
//             const userWallet = await balanceService.getOrCreateUser(
//                 data.userId,
//                 '', // email will be added later
//                 player.name || ''
//             );

//             // Use the MANAGED wallet address, not the Civic wallet
//             const managedWalletAddress = userWallet.managedWallet.publicKey;
//             player.setWalletAddress(managedWalletAddress);
//             socket.data.walletAddress = managedWalletAddress;
//             socket.data.userId = data.userId;

//             // Sync balance from the managed wallet
//             const balance = await walletService.getUserBalance(data.userId);
//             player.tokenBalance = balance.gameBalance;

//             console.log(`✅ Managed wallet set for player ${player.name}: ${managedWalletAddress}`);

//             // Update leaderboard
//             leaderboardManager.updatePlayer(player.id, player.name, {
//                 kills: player.kills,
//                 deaths: player.deaths,
//                 level: player.progression.data.level,
//                 headshots: player.progression.data.headshots,
//                 highestKillstreak: player.progression.data.highestKillstreak,
//                 score: player.kills * 100 + player.progression.data.headshots * 50,
//                 wallet: managedWalletAddress,
//                 tokenBalance: balance.gameBalance
//             });

//             socket.emit('tokenBalanceUpdate', { balance: balance.gameBalance });
//         } else if (data.userId) {
//             console.log(`⚠️ No player found, storing userId for later`);
//             socket.data.pendingUserId = data.userId;
//         } else {
//             console.log(`⚠️ No userId provided in walletConnected`);
//         }
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

//     socket.on('openBox', async (data: {
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

//                 // Add ammo pack to inventory instead of auto-applying
//                 const itemId = 'ammo_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
//                 player.inventory.push({
//                     id: itemId,
//                     type: 'ammo',
//                     name: `${data.weaponName} Ammo Pack`,
//                     count: 1,
//                     weaponName: data.weaponName
//                 });

//                 // ✅ Also give 1 grenade when opening ammo box
//                 if (player.grenadeCount < player.maxGrenades) {
//                     player.addGrenade(1);
//                     socket.emit('grenadeRefill', {
//                         count: player.grenadeCount,
//                         max: player.maxGrenades
//                     });

//                     // Optional: notify player
//                     socket.emit('serverResponse', {
//                         type: 'success',
//                         text: '+1 Grenade!'
//                     });
//                 }

//                 socket.emit('ammoCollected', {
//                     weaponName: data.weaponName,
//                     inventory: player.inventory
//                 });

//                 // After adding to inventory, sync with database
//                 const userId = player.id || socket.data.userId;
//                 if (userId) {
//                     const syncedInventory = await syncPlayerInventory(player, userId);
//                     socket.emit('inventoryUpdate', { inventory: syncedInventory });
//                 } else {
//                     socket.emit('inventoryUpdate', { inventory: player.inventory });
//                 }

//             } else if (data.boxType === 'vaccine') {
//                 player.collectedVaccineThisRoom = true;

//                 // Add vaccine to inventory
//                 const itemId = 'vaccine_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
//                 player.inventory.push({
//                     id: itemId,
//                     type: 'vaccine',
//                     name: 'Vaccine',
//                     count: 1
//                 });

//                 socket.emit('vaccineCollected', {
//                     inventory: player.inventory
//                 });

//                 // After adding to inventory, sync with database
//                 const userId = player.id || socket.data.userId;
//                 if (userId) {
//                     const syncedInventory = await syncPlayerInventory(player, userId);
//                     socket.emit('inventoryUpdate', { inventory: syncedInventory });
//                 } else {
//                     socket.emit('inventoryUpdate', { inventory: player.inventory });
//                 }
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
//         } else {
//             socket.emit('boxError', { message: result.message });
//         }
//     });

//     socket.on('store-getItems', (data: { category?: string }, callback) => {
//         let items;
//         if (data?.category) {
//             items = storeManager.getItemsByCategory(data.category);
//         } else {
//             items = storeManager.getAllItems();
//         }

//         callback({
//             success: true,
//             items: items,
//             rotatingItems: storeManager.getRotatingItems(),
//             nextRefresh: storeManager.getNextRefreshTime()
//         });
//     });

//     socket.on('store-purchase', async (data: {
//         itemId: string;
//         quantity: number;
//         signature?: string;
//         free?: boolean;
//     }, callback) => {
//         console.log("🛒 store-purchase received:", JSON.stringify(data, null, 2));

//         const player = socket.data.player;
//         if (!player) {
//             console.log("❌ No player found");
//             callback({ success: false, message: 'Not authenticated' });
//             return;
//         }

//         if (!player.walletAddress) {
//             console.log(`❌ Player ${player.name} has no wallet address`);
//             callback({ success: false, message: 'Wallet not connected. Please sign in first.' });
//             return;
//         }

//         const item = storeManager.getItem(data.itemId);
//         if (!item) {
//             console.log(`❌ Item not found: ${data.itemId}`);
//             callback({ success: false, message: 'Item not found' });
//             return;
//         }

//         const finalPrice = item.discount
//             ? Math.floor(item.price * (1 - item.discount / 100))
//             : item.price;
//         const totalCost = finalPrice * (data.quantity || 1);

//         console.log(`💰 Purchase request - Player: ${player.name}, Item: ${item.name}, Cost: ${totalCost} JBKS`);

//         // If this is a free purchase (from ad)
//         if (data.free) {
//             console.log("🎁 Processing free purchase from ad");

//             // Add item to player's inventory directly
//             await applyPurchasedItem(player, item, data.quantity);

//             // ✅ Update database inventory with the item
//             const userId = player.id || socket.data.userId;
//             if (userId) {
//                 await balanceService.addToInventory(userId, item);

//                 // ✅ Fetch fresh inventory from database and emit
//                 const syncedInventory = await syncPlayerInventory(player, userId);
//                 console.log(`📤 Emitting inventoryUpdate with:`, JSON.stringify(syncedInventory, null, 2));
//                 socket.emit('inventoryUpdate', { inventory: syncedInventory });
//             } else {
//                 socket.emit('inventoryUpdate', { inventory: player.inventory });
//             }

//             callback({
//                 success: true,
//                 message: `Claimed ${item.name}!`,
//                 item: item
//             });
//             return;
//         }

//         // Process paid purchase using database balance
//         try {
//             const userId = player.id || socket.data.userId;
//             if (!userId) {
//                 callback({ success: false, message: 'User ID not found. Please re-login.' });
//                 return;
//             }

//             // Process the purchase (deducts balance)
//             const result = await balanceService.purchaseItem(
//                 userId,
//                 data.itemId,
//                 item.name,
//                 totalCost
//             );

//             if (!result.success) {
//                 callback({ success: false, message: result.message });
//                 return;
//             }

//             // ✅ Apply item to player's in-memory inventory
//             await applyPurchasedItem(player, item, data.quantity);

//             // ✅ Add to database inventory
//             await balanceService.addToInventory(userId, item);

//             // ✅ Fetch fresh inventory from database and emit
//             const syncedInventory = await syncPlayerInventory(player, userId);
//             console.log(`📤 Emitting inventoryUpdate with:`, JSON.stringify(syncedInventory, null, 2));
//             socket.emit('inventoryUpdate', { inventory: syncedInventory });

//             // Update player's token balance
//             player.tokenBalance = result.newBalance;

//             callback({
//                 success: true,
//                 message: `Purchased ${item.name}!`,
//                 newBalance: result.newBalance,
//                 blockchainBalance: result.blockchainBalance,
//                 item: item
//             });

//             // Announce big purchases
//             if (totalCost >= 1000) {
//                 io.to(socket.data.matchId!).emit('serverResponse', {
//                     type: 'announcement',
//                     text: `${player.name} just bought ${item.name} from the store!`
//                 });
//             }

//         } catch (error) {
//             console.error('Purchase error:', error);
//             callback({ success: false, message: 'Purchase failed: ' + error.message });
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

//         if (!player.isDead) {
//             console.log(`Player ${player.name} is already alive, ignoring respawn request`);
//             return;
//         }

//         // Release old spawn point
//         match.spawnManager.releaseSpawnPoint(player.id);

//         // ✅ Get RANDOM spawn point (not necessarily free)
//         const spawn = match.spawnManager.getRandomSpawnPoint();
//         if (!spawn) return;

//         // Reset player state
//         player.resetHealth();
//         player.isDead = false;
//         player.setPos(spawn.position);
//         player.setRotation(spawn.rotation);
//         player.lastSpawnTime = Date.now();

//         // Reset ammo reserves
//         if (player.loadout) {
//             player.loadout.forEach(weaponName => {
//                 player.weaponReserves[weaponName] = 1;
//             });
//         }

//         player.resetRoomCollections();

//         // Broadcast to other players
//         socket.to(match.id).emit('playerRespawned', {
//             playerId: player.id,
//             playerName: player.name,
//             color: player.color,
//             position: spawn.position,
//             rotation: spawn.rotation,
//             health: player.health,
//             maxHealth: player.maxHealth,
//             loadout: player.loadout
//         });

//         socket.to(match.id).emit('playerLoadout', {
//             id: player.id,
//             weapons: player.loadout || []
//         });

//         // Send confirmation to the respawning player
//         socket.emit('respawnConfirmed', {
//             position: spawn.position,
//             rotation: spawn.rotation,
//             health: player.health,
//             maxHealth: player.maxHealth,
//             spawnShieldDuration: 5000,
//             grenadeCount: player.grenadeCount,  // ✅ Send grenade count
//             maxGrenades: player.maxGrenades
//         });

//         console.log(`✅ Player ${player.name} respawned at random spawn point`);
//     });

//     // Add an event to send spawn points to client
//     socket.on('requestSpawnPoints', () => {
//         const match = getMatch(socket);
//         if (!match) return;

//         const spawnPositions = match.spawnManager.getSpawnPositions();
//         socket.emit('spawnPoints', spawnPositions);
//     });

//     socket.on('requestMapPlayerCounts', () => {
//         // Send current player counts for each map
//         const mapCounts = {
//             shooting_range: getPlayerCountForMap('shooting_range'),
//             greeble_map: getPlayerCountForMap('greeble_map'),
//             lowpoly_environment: getPlayerCountForMap('lowpoly_environment')
//         };
//         console.log('📊 Map player counts:', mapCounts);
//         socket.emit('mapPlayerCounts', mapCounts);
//     });


//     // -------- GRENADE SYSTEM --------

//     socket.on('grenadeThrown', (data: {
//         position: { x: number, y: number, z: number },
//         direction: { x: number, y: number, z: number },
//         throwPower: number,
//         grenadeCount?: number
//     }) => {
//         const match = getMatch(socket);
//         const player = socket.data.player;
//         if (!match || !player) return;

//         // ✅ Server-side validation: Check if player has grenades
//         if (!player.hasGrenades()) {
//             socket.emit('serverResponse', {
//                 type: 'warning',
//                 text: 'No grenades left!'
//             });
//             return;
//         }

//         // ✅ Use one grenade on server
//         player.useGrenade();

//         console.log(`💣 ${player.name} threw a grenade. ${player.grenadeCount}/${player.maxGrenades} left`);

//         // Broadcast grenade throw to all OTHER players in the match
//         socket.to(match.id).emit('remoteGrenadeThrown', {
//             playerId: player.id,
//             position: data.position,
//             direction: data.direction,
//             throwPower: data.throwPower
//         });

//         // Send updated grenade count back to the client
//         socket.emit('grenadeCountUpdate', {
//             count: player.grenadeCount,
//             max: player.maxGrenades
//         });
//     });

//     socket.on('grenadeExploded', (data: {
//         position: { x: number, y: number, z: number },
//         damage: number,
//         radius: number,
//         throwerId: string
//     }) => {
//         const match = getMatch(socket);
//         const shooter = socket.data.player;
//         if (!match || !shooter) return;

//         console.log(`💥 Grenade exploded at (${data.position.x}, ${data.position.y}, ${data.position.z}) with radius ${data.radius}`);

//         // Broadcast explosion to all players in the match for visual effect
//         io.to(match.id).emit('remoteGrenadeExploded', {
//             position: data.position,
//             throwerId: data.throwerId,
//             damage: data.damage,
//             radius: data.radius
//         });

//         // Apply damage to ALL nearby players (including thrower)
//         match.players.getAll().forEach(target => {
//             // Skip if target is dead (can't damage dead players)
//             if (target.isDead) return;

//             // Calculate distance from explosion center
//             const dx = target.pos.x - data.position.x;
//             const dy = target.pos.y - data.position.y;
//             const dz = target.pos.z - data.position.z;
//             const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

//             console.log(`Checking ${target.name} - distance: ${dist.toFixed(2)}`);

//             // Check if within explosion radius
//             if (dist < data.radius) {
//                 // Calculate damage based on distance (closer = more damage)
//                 // Damage falls off linearly from 100% at center to 0% at radius edge
//                 let damageAmount = Math.floor(data.damage * (1 - dist / data.radius));

//                 // Minimum damage of 10
//                 damageAmount = Math.max(10, damageAmount);

//                 console.log(`${target.name} took ${damageAmount} damage from grenade!`);

//                 // Apply damage to target
//                 const died = target.takeDamage(damageAmount);

//                 // Notify all players about the hit
//                 io.to(match.id).emit('playerHit', {
//                     shooterId: shooter.id,
//                     targetId: target.id,
//                     weaponName: 'Grenade',
//                     damage: damageAmount,
//                     health: target.health,
//                     maxHealth: target.maxHealth,
//                     isHeadshot: false
//                 });

//                 // If target died from the explosion
//                 if (died) {
//                     console.log(`${target.name} was killed by ${shooter.name}'s grenade!`);

//                     // Add kill to shooter (even if it's themselves)
//                     const killRewards = shooter.progression.addKill(false);
//                     target.progression.addDeath();

//                     // Update leaderboard
//                     leaderboardManager.updatePlayer(shooter.id, shooter.name, {
//                         kills: shooter.progression.data.kills,
//                         deaths: shooter.progression.data.deaths,
//                         level: shooter.progression.data.level,
//                         headshots: shooter.progression.data.headshots,
//                         highestKillstreak: shooter.progression.data.highestKillstreak,
//                         score: shooter.progression.data.kills * 100 + shooter.progression.data.headshots * 50
//                     });
//                     leaderboardManager.updatePlayer(target.id, target.name, {
//                         kills: target.progression.data.kills,
//                         deaths: target.progression.data.deaths,
//                         level: target.progression.data.level,
//                         headshots: target.progression.data.headshots,
//                         highestKillstreak: target.progression.data.highestKillstreak,
//                         score: target.progression.data.kills * 100 + target.progression.data.headshots * 50
//                     });

//                     // ✅ ADD MINTING LOGIC HERE
//                     console.log(`💀 Player died - killer wallet: ${shooter.walletAddress || 'NONE'}, victim: ${target.walletAddress || target.id}`);

//                     const weaponName = 'Grenade';
//                     const isHeadshot = false;

//                     if (shooter && shooter.walletAddress) {
//                         console.log(`🪙 Attempting to mint tokens to ${shooter.walletAddress}...`);
//                         recordKillAndReward(
//                             shooter.walletAddress,
//                             target.walletAddress || target.id,
//                             weaponName,
//                             isHeadshot
//                         ).then(async (reward) => {
//                             console.log(`🪙 Mint result:`, reward);

//                             if (reward.success) {
//                                 // Emit kill reward directly to the killer
//                                 socket.emit('killReward', {
//                                     amount: reward.reward,
//                                     signature: reward.signature,
//                                     weapon: weaponName,
//                                     isHeadshot: isHeadshot
//                                 });

//                                 // ✅ This updates the player's balance from the managed wallet
//                                 const newBalance = await walletService.getUserBalance(shooter.id);
//                                 shooter.tokenBalance = newBalance.gameBalance;
//                                 console.log(`✅ killReward emitted to killer ${shooter.id}`);
//                             }
//                         }).catch(err => {
//                             console.error('❌ Kill reward failed:', err);
//                         });
//                     }

//                     // Notify everyone about the death
//                     io.to(match.id).emit('playerDied', {
//                         playerId: target.id,
//                         playerName: target.name,
//                         killerId: shooter.id,
//                         weaponName: weaponName,
//                         isHeadshot: isHeadshot,
//                         killerProgression: shooter.getProgressionData(),
//                         killRewards: killRewards
//                     });

//                     // Update shooter's progression
//                     socket.emit('progressionUpdate', {
//                         progression: shooter.getProgressionData(),
//                         killRewards: killRewards
//                     });
//                 }
//             }
//         });
//     });

//     // -------- MUZZLE FLASH --------

//     socket.on('muzzleFlash', (data: {
//         position: { x: number, y: number, z: number }
//     }) => {
//         const match = getMatch(socket);
//         const player = socket.data.player;
//         if (!match || !player) return;

//         // Broadcast muzzle flash to other players
//         socket.to(match.id).emit('remoteMuzzleFlash', {
//             playerId: player.id,
//             position: data.position
//         });
//     });

//     // -------- INVENTORY SYSTEM --------

//     socket.on('useItem', async (data: { itemId: string }) => {
//         const match = getMatch(socket);
//         const player = socket.data.player;
//         if (!match || !player) return;

//         const itemIndex = player.inventory.findIndex(item => item.id === data.itemId);
//         if (itemIndex === -1) {
//             socket.emit('serverResponse', { type: 'error', text: 'Item not found' });
//             return;
//         }

//         const item = player.inventory[itemIndex];

//         if (item.type === 'vaccine') {
//             // Remove one vaccine from inventory
//             item.count--;
//             if (item.count <= 0) {
//                 player.inventory.splice(itemIndex, 1);
//             }

//             // Activate vaccine protection (60 seconds)
//             player.vaccineActive = true;
//             player.vaccineExpiryTime = Date.now() + 60000;

//             socket.emit('itemUsed', {
//                 itemId: data.itemId,
//                 effect: 'vaccine_activated',
//                 expiresAt: player.vaccineExpiryTime,
//                 inventory: player.inventory
//             });

//             io.to(match.id).emit('playerVaccineActive', {
//                 playerId: player.id,
//                 expiresAt: player.vaccineExpiryTime
//             });

//             // After using item, sync with database
//             const userId = player.id || socket.data.userId;
//             if (userId) {
//                 // You might want to update the database here too
//                 const syncedInventory = await syncPlayerInventory(player, userId);
//                 socket.emit('inventoryUpdate', { inventory: syncedInventory });
//             } else {
//                 socket.emit('inventoryUpdate', { inventory: player.inventory });
//             }
//         }
//         else if (item.type === 'ammo' && item.weaponName) {
//             // Add ammo to reserves
//             player.weaponReserves[item.weaponName] = (player.weaponReserves[item.weaponName] || 0) + 1;

//             // Remove one ammo pack
//             item.count--;
//             if (item.count <= 0) {
//                 player.inventory.splice(itemIndex, 1);
//             }

//             socket.emit('itemUsed', {
//                 itemId: data.itemId,
//                 effect: 'ammo_added',
//                 weaponName: item.weaponName,
//                 reserves: player.weaponReserves[item.weaponName],
//                 inventory: player.inventory
//             });

//             // After using item, sync with database
//             const userId = player.id || socket.data.userId;
//             if (userId) {
//                 const syncedInventory = await syncPlayerInventory(player, userId);
//                 socket.emit('inventoryUpdate', { inventory: syncedInventory });
//             } else {
//                 socket.emit('inventoryUpdate', { inventory: player.inventory });
//             }
//         }
//     });

//     // socket.on('requestInventory', () => {
//     //     const player = socket.data.player;
//     //     if (!player) return;
//     //     socket.emit('inventoryUpdate', { inventory: player.inventory });
//     // });

//     socket.on('requestInventory', async () => {
//         const player = socket.data.player;
//         if (!player) {
//             console.log('❌ requestInventory: No player found');
//             return;
//         }

//         // ✅ Fetch fresh inventory from database
//         const userId = player.id || socket.data.userId;
//         if (userId) {
//             const syncedInventory = await syncPlayerInventory(player, userId);
//             console.log(`📦 Sending inventory for ${player.name}:`, JSON.stringify(syncedInventory, null, 2));
//             socket.emit('inventoryUpdate', { inventory: syncedInventory });
//         } else {
//             socket.emit('inventoryUpdate', { inventory: player.inventory });
//         }
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
//         leaderboardManager.removePlayer(socket.id);
//     });
// });

//server/index.ts
import os from 'os';
import express, { Request, Response, NextFunction } from 'express';
import http from 'http';
import { Server, Socket } from 'socket.io';
import { CookieStorage, CivicAuth } from "@civic/auth/server";
import cookieParser from "cookie-parser";
import cors from 'cors';
import dotenv from 'dotenv';
import {
    Connection,
    PublicKey,
    Transaction,
    LAMPORTS_PER_SOL,
    SystemProgram,
    Keypair
} from '@solana/web3.js';
import {
    getAssociatedTokenAddress,
    createMintToInstruction,
    getOrCreateAssociatedTokenAccount,
    createTransferInstruction,
    TOKEN_PROGRAM_ID
} from '@solana/spl-token';
import connectDB from './config/database.js';
import balanceService from './services/balanceService.js';

dotenv.config();

import "dotenv/config";
import { getWallets } from "@civic/auth-web3/server";
import { UserDetails } from "./node_modules/@civic/auth-web3/dist/types.js";
import { BaseUser } from "./node_modules/@civic/auth/dist/types.js";

// Extend Express Request to include storage and civicAuth used in middleware
declare global {
    namespace Express {
        interface Request {
            storage: ExpressCookieStorage;
            civicAuth: CivicAuth;
        }
    }
}

// Imports
import Player from './shared/Player.js';
import PlayerList from './shared/PlayerList.js';
import Message from './shared/Message.js';
import MessageList from './shared/MessageList.js';
import RoomManager from './shared/RoomManager.js';
import { ROOM_DEFINITIONS } from './shared/RoomDefinitions.js';
import SpawnManager from './shared/SpawnManager.js';
import LeaderboardManager from './shared/LeaderboardManager.js';
import StoreManager from './shared/StoreManager.js';
import walletService from './services/walletService.js';
import UserWallet from './models/UserWallet.js';

// -------------------- HELPER: Safe Civic Call with Timeout --------------------
async function safeCivicCall<T>(
    fn: () => Promise<T>,
    fallback: T,
    timeoutMs: number = 5000
): Promise<T> {
    try {
        return await Promise.race([
            fn(),
            new Promise<T>((resolve) => {
                setTimeout(() => {
                    console.warn(`⚠️ Civic call timeout after ${timeoutMs}ms`);
                    resolve(fallback);
                }, timeoutMs);
            })
        ]);
    } catch (error) {
        console.error('❌ Civic call failed:', error);
        return fallback;
    }
}

// -------------------- SOLANA SETUP --------------------
const SOLANA_RPC = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
const connection = new Connection(SOLANA_RPC, "confirmed");

// Token mint address (JUKEBUCKS)
const TOKEN_MINT = new PublicKey("FPSapuTED3YTN69KLwrLtPAkXE1cxXne1i8G2iGz653G");

// Game wallet (for sending rewards)
const GAME_WALLET_PRIVATE_KEY = process.env.GAME_WALLET_PRIVATE_KEY;
let gameKeypair: Keypair | null = null;

if (GAME_WALLET_PRIVATE_KEY) {
    // Remove quotes if they exist (dotenv handles this automatically)
    const privateKeyBytes = Buffer.from(GAME_WALLET_PRIVATE_KEY, 'base64');
    gameKeypair = Keypair.fromSecretKey(privateKeyBytes);
    console.log(`✅ Game wallet loaded: ${gameKeypair.publicKey.toString()}`);
}

// Track processed kills to prevent duplicate minting
const processedKills = new Set<string>();

// Clean old kill records periodically
setInterval(() => {
    if (processedKills.size > 10000) {
        const toDelete = Array.from(processedKills).slice(0, 5000);
        toDelete.forEach(id => processedKills.delete(id));
    }
}, 3600000); // Clean every hour

// -------------------- HELPER FUNCTIONS --------------------

// Mint JUKEBUCKS tokens to a user
async function mintTokensToUser(userWalletAddress: string, amount: number): Promise<string> {
    if (!gameKeypair) {
        throw new Error("Game wallet not configured");
    }

    const userPubkey = new PublicKey(userWalletAddress);

    // Get or create associated token account for user
    const userTokenAccount = await getOrCreateAssociatedTokenAccount(
        connection,
        gameKeypair,
        TOKEN_MINT,
        userPubkey
    );

    // Create mint transaction
    const mintToIx = createMintToInstruction(
        TOKEN_MINT,
        userTokenAccount.address,
        gameKeypair.publicKey,
        amount * (10 ** 9), // Assuming 9 decimals for JUKEBUCKS
        []
    );

    const transaction = new Transaction().add(mintToIx);
    transaction.feePayer = gameKeypair.publicKey;

    // Send transaction
    const signature = await connection.sendTransaction(transaction, [gameKeypair]);
    await connection.confirmTransaction(signature, 'confirmed');

    return signature;
}

async function applyPurchasedItem(player: Player, item: any, quantity: number) {
    switch (item.category) {
        case 'weapon':
            if (!player.unlockedWeapons.includes(item.itemData.weaponName)) {
                player.unlockedWeapons.push(item.itemData.weaponName);
            }
            break;

        case 'consumable':
            const itemId = `${item.id}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
            let itemType: 'vaccine' | 'ammo' | 'health' | 'grenade' | 'consumable' = 'consumable';
            if (item.itemData.type === 'health') itemType = 'health';
            else if (item.itemData.type === 'grenade') itemType = 'grenade';
            else if (item.itemData.type === 'vaccine') itemType = 'vaccine';
            else if (item.itemData.type === 'ammo') itemType = 'ammo';

            player.inventory.push({
                id: itemId,
                type: itemType,
                name: item.name,
                count: item.itemData.amount || quantity,
                data: item.itemData
            });
            break;

        case 'cosmetic':
            if (!player.unlockedSkins.includes(item.id)) {
                player.unlockedSkins.push(item.id);
            }
            break;

        case 'boost':
            player.activeBoosts.push({
                type: item.itemData.type,
                multiplier: item.itemData.multiplier,
                expiresAt: Date.now() + (item.itemData.duration * 1000)
            });
            break;
    }
}

// Send SOL to a user
async function sendSolToUser(userWalletAddress: string, amountInSol: number): Promise<string> {
    if (!gameKeypair) {
        throw new Error("Game wallet not configured");
    }

    const userPubkey = new PublicKey(userWalletAddress);
    const transaction = new Transaction().add(
        SystemProgram.transfer({
            fromPubkey: gameKeypair.publicKey,
            toPubkey: userPubkey,
            lamports: amountInSol * LAMPORTS_PER_SOL,
        })
    );
    transaction.feePayer = gameKeypair.publicKey;

    const signature = await connection.sendTransaction(transaction, [gameKeypair]);
    await connection.confirmTransaction(signature, 'confirmed');

    return signature;
}

async function syncPlayerTokenBalance(player: Player, walletAddress: string) {
    try {
        const balance = await getUserTokenBalance(walletAddress);
        player.tokenBalance = balance;
        console.log(`💰 Synced balance for ${player.name}: ${balance} $JBKS`);
        return balance;
    } catch (error) {
        console.error(`Failed to sync balance for ${player.name}:`, error);
        return player.tokenBalance;
    }
}

// Get user's token balance
async function getUserTokenBalance(walletAddress: string): Promise<number> {
    if (!walletAddress) {
        console.log("No wallet address provided to getUserTokenBalance");
        return 0;
    }

    try {
        const pubkey = new PublicKey(walletAddress);
        const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
            pubkey,
            { mint: TOKEN_MINT }
        );

        if (tokenAccounts.value.length === 0) return 0;
        return tokenAccounts.value[0].account.data.parsed.info.tokenAmount.uiAmount || 0;
    } catch (error) {
        console.error("Error getting token balance:", error);
        return 0;
    }
}

async function createTransferTransaction(
    userWalletAddress: string,
    amount: number
): Promise<{ transaction: string; userTokenAccount: string; gameTokenAccount: string }> {
    if (!gameKeypair) {
        throw new Error("Game wallet not configured");
    }

    const userPubkey = new PublicKey(userWalletAddress);
    const gamePubkey = gameKeypair.publicKey;

    // Get or create token accounts
    const userTokenAccount = await getAssociatedTokenAddress(
        TOKEN_MINT,
        userPubkey
    );

    const gameTokenAccount = await getAssociatedTokenAddress(
        TOKEN_MINT,
        gamePubkey
    );

    // Create transfer instruction
    const transferIx = createTransferInstruction(
        userTokenAccount,
        gameTokenAccount,
        userPubkey,
        BigInt(amount * (10 ** 9)) // Convert to smallest unit (9 decimals)
    );

    // Get recent blockhash
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();

    // Create transaction
    const transaction = new Transaction();
    transaction.add(transferIx);
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = userPubkey;
    transaction.lastValidBlockHeight = lastValidBlockHeight;

    // Serialize transaction
    const serializedTransaction = transaction.serialize({
        requireAllSignatures: false,
        verifySignatures: false
    });

    return {
        transaction: serializedTransaction.toString('base64'),
        userTokenAccount: userTokenAccount.toString(),
        gameTokenAccount: gameTokenAccount.toString()
    };
}

// Record kill and mint tokens
async function recordKillAndReward(
    killerWallet: string,
    victimWallet: string,
    weaponName: string,
    isHeadshot: boolean
): Promise<{ success: boolean; reward: number; signature?: string }> {
    // Create unique kill ID
    const killId = `${killerWallet}_${victimWallet}_${Date.now()}`;

    // Check if already processed
    if (processedKills.has(killId)) {
        console.log("Duplicate kill prevented:", killId);
        return { success: false, reward: 0 };
    }
    processedKills.add(killId);

    // Calculate reward (headshot gives more)
    const baseReward = isHeadshot ? 5 : 2; // 5 or 2 JUKEBUCKS per kill

    try {
        // Mint tokens to killer
        const signature = await mintTokensToUser(killerWallet, baseReward);

        console.log(`✅ Rewarded ${baseReward} JUKEBUCKS to ${killerWallet} for killing ${victimWallet}`);

        return {
            success: true,
            reward: baseReward,
            signature
        };
    } catch (error) {
        console.error("Failed to mint reward:", error);
        return { success: false, reward: 0 };
    }
}

async function getWalletsWithRetry(userDetails: any, maxRetries = 3, delay = 2000): Promise<any[]> {
    for (let i = 0; i < maxRetries; i++) {
        try {
            console.log(`🔄 getWallets attempt ${i + 1}/${maxRetries}...`);
            const wallets = await getWallets(userDetails);
            return wallets;
        } catch (error) {
            console.log(`⚠️ getWallets attempt ${i + 1} failed:`, error.message);
            if (i === maxRetries - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    throw new Error('Failed to get wallets after retries');
}


async function syncPlayerInventory(player: Player, userId: string) {
    try {
        console.log(`🔍 syncPlayerInventory - userId: ${userId}`);
        const userWallet = await UserWallet.findOne({ userId });
        console.log(`🔍 UserWallet found:`, userWallet ? 'YES' : 'NO');

        if (userWallet && userWallet.inventory) {
            console.log(`📦 Database inventory count: ${userWallet.inventory.length}`);
            // Convert database format to client format
            const inventoryForClient = userWallet.inventory.map((dbItem: any) => ({
                id: dbItem.itemId,
                itemId: dbItem.itemId,
                type: dbItem.type,
                name: dbItem.name,
                count: dbItem.count || 1,
                weaponName: dbItem.weaponName || '',
                data: dbItem.data || {}
            }));
            player.inventory = inventoryForClient;
            console.log(`📦 Converted inventory:`, JSON.stringify(inventoryForClient, null, 2));
            return inventoryForClient;
        } else {
            console.log(`⚠️ No inventory found for userId: ${userId}`);
        }
        return player.inventory || [];
    } catch (error) {
        console.error('Failed to sync inventory:', error);
        return player.inventory || [];
    }
}

async function safeGetBalance(userId: string): Promise<{ gameBalance: number; blockchainBalance: number }> {
    try {
        return await Promise.race([
            walletService.getUserBalance(userId),
            new Promise<{ gameBalance: number; blockchainBalance: number }>((resolve) => {
                setTimeout(() => {
                    console.warn('⚠️ Balance fetch timeout for user:', userId);
                    resolve({ gameBalance: 0, blockchainBalance: 0 });
                }, 5000);
            })
        ]);
    } catch (error) {
        console.error('❌ Balance fetch error:', error);
        return { gameBalance: 0, blockchainBalance: 0 };
    }
}

// ---------------- MATCH SYSTEM ----------------

interface Match {
    id: string;
    mapKey: string;
    players: PlayerList;
    messages: MessageList;
    roomManager: RoomManager;
    spawnManager: SpawnManager;
    voiceUsers: Map<string, any>;
}

const TICK_RATE = 20; // 20 updates/sec
const TICK_INTERVAL = 1000 / TICK_RATE;

const VIEW_DISTANCE = 120; // adjust based on your map scale

class MatchManager {
    private matches = new Map<string, Match>();

    createMatch(mapKey: string = 'shooting_range'): Match {
        const id = 'match_' + Math.random().toString(36).substr(2, 9);

        // Create spawn manager with 40 spawn points at Y=150
        const spawnManager = new SpawnManager(40, 150, 1800);

        const match: Match = {
            id,
            mapKey,
            players: new PlayerList(),
            messages: new MessageList(),
            roomManager: new RoomManager(),
            spawnManager: spawnManager,
            voiceUsers: new Map()
        };

        this.matches.set(id, match);
        return match;
    }

    findMatch(mapKey: string = 'shooting_range', maxPlayers = 10): Match {
        for (const match of this.matches.values()) {
            if (match.mapKey === mapKey && match.players.getAll().length < maxPlayers) {
                return match;
            }
        }
        return this.createMatch(mapKey);
    }

    getMatch(id: string) {
        return this.matches.get(id);
    }

    removeMatch(id: string) {
        this.matches.delete(id);
    }

    getAllMatches() {
        return this.matches.values();
    }
}

const matchManager = new MatchManager();

// ---------------- SOCKET TYPE ----------------

interface CustomSocket extends Socket {
    data: {
        player?: Player;
        matchId?: string;
        walletAddress?: string;
        pendingWallet?: string;
        userId?: string;
        pendingUserId?: string;
    };
    readCommand?: (message: string) => void;
    helpResponse?: () => void;
    changePlayerName?: (newName: string) => void;
}

// ---------------- SERVER ----------------

const app = express();
const PORT = app.get('port') || 5000;

app.use(
    cors({
        origin: (origin, callback) => {
            const allowed = [
                "http://localhost:5173",
                "http://localhost:5174",
                "https://eloquence-overlay-kisser.ngrok-free.dev",
                "capacitor://localhost",
            ];
            if (!origin || allowed.includes(origin)) {
                callback(null, true);
            } else {
                callback(new Error(`CORS blocked: ${origin}`));
            }
        },
        credentials: true,
        methods: ["GET", "POST", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization", "Cookie", "ngrok-skip-browser-warning"],
        exposedHeaders: ["Set-Cookie"],
    }),
);

app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader("ngrok-skip-browser-warning", "true");
    next();
});

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const config = {
    clientId: "b4cc6576-d5d0-46e9-ba55-e36944b4a7f9",
    oauthServer: process.env.AUTH_SERVER || 'https://auth.civic.com/oauth',
    redirectUrl: process.env.REDIRECT_URL || `https://eloquence-overlay-kisser.ngrok-free.dev/auth/callback`,
    postLogoutRedirectUrl: process.env.POST_LOGOUT_URL || `https://eloquence-overlay-kisser.ngrok-free.dev/`,
};

class ExpressCookieStorage extends CookieStorage {
    private isDev: boolean;

    constructor(
        private req: Request,
        private res: Response
    ) {
        const isDev = process.env.NODE_ENV !== 'production';
        super({
            secure: !isDev,
            sameSite: isDev ? "lax" : "none",
            httpOnly: false,
            path: "/",
        });
        this.isDev = isDev;
    }

    async get(key: string): Promise<string | null> {
        const value = this.req.cookies?.[key] ?? null;
        console.log(`🍪 Cookie GET "${key}":`, value ? "found" : "NOT FOUND");
        return value;
    }

    async set(key: string, value: string): Promise<void> {
        console.log(`🍪 Cookie SET "${key}"`);
        this.res.cookie(key, value, {
            secure: !this.isDev,
            sameSite: this.isDev ? "lax" : "none",
            httpOnly: false,
            path: "/",
        });
    }

    async clear(): Promise<void> {
        for (const key in this.req.cookies) {
            this.res.clearCookie(key, {
                path: "/",
                sameSite: this.isDev ? "lax" : "none",
                secure: !this.isDev,
            });
        }
    }

    async delete(key: string): Promise<void> {
        this.res.clearCookie(key, {
            path: "/",
            sameSite: this.isDev ? "lax" : "none",
            secure: !this.isDev,
        });
    }
}

app.use((req: Request, res: Response, next: NextFunction) => {
    req.storage = new ExpressCookieStorage(req, res);
    req.civicAuth = new CivicAuth(req.storage, config);
    next();
});

app.get('/auth/login-url', async (req: Request, res: Response) => {
    console.log('📡 /auth/login-url called');
    try {
        const url = await req.civicAuth.buildLoginUrl({
            scopes: ['openid', 'profile', 'email']
        });
        console.log('✅ Login URL built:', url.toString());
        res.json({ loginUrl: url.toString() });
    } catch (error) {
        console.error('❌ Error building login URL:', error);
        res.status(500).json({ error: 'Failed to build login URL', details: error.message });
    }
});

// Auth callback route
app.get("/auth/callback", async (req: Request, res: Response) => {
    const { code, state } = req.query as { code: string; state: string };
    const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

    try {
        await req.civicAuth.resolveOAuthAccessCode(code, state);
        res.redirect(`${FRONTEND_URL}/oauth-done.html?success=true`);
    } catch (error) {
        console.error("Error during authentication:", error);
        const msg = encodeURIComponent(error.message || "Authentication failed");
        res.redirect(`${FRONTEND_URL}/oauth-done.html?error=${msg}`);
    }
});

// THEN your root route
app.get('/', (req: Request, res: Response) => {
    res.json({
        status: 'online',
        message: 'The Winnowing Games Server',
        version: '1.0.0',
        timestamp: Date.now()
    });
});

// ========== UPDATED: Auth Middleware with Error Handling ==========
const authMiddleware = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        // Skip auth in development if enabled
        if (process.env.SKIP_AUTH === 'true') {
            (req as any).user = {
                id: 'dev-user-123',
                name: 'Dev User',
                email: 'dev@test.com'
            };
            return next();
        }

        let isLoggedIn = false;
        try {
            isLoggedIn = await safeCivicCall(
                () => req.civicAuth.isLoggedIn(),
                false,
                5000
            );
        } catch (authError) {
            console.error('❌ Civic auth error:', authError);
            isLoggedIn = false;
        }

        if (!isLoggedIn) {
            if (req.path.startsWith('/api/')) {
                return res.status(401).json({ error: 'Unauthorized', authenticated: false });
            }
            return res.status(401).send("Unauthorized");
        }
        next();
    } catch (error) {
        console.error('❌ Auth middleware error:', error);
        if (req.path.startsWith('/api/')) {
            return res.status(401).json({ error: 'Authentication error', authenticated: false });
        }
        return res.status(401).send("Authentication error");
    }
};

app.use("/admin", authMiddleware);

app.get("/admin/dashboard", async (req: Request, res: Response) => {
    try {
        const user = await safeCivicCall(
            () => req.civicAuth.getUser(),
            null,
            5000
        );
        if (!user) {
            return res.status(401).send("Unauthorized or timeout");
        }

        const tokens = await safeCivicCall(
            () => req.civicAuth.getTokens(),
            null,
            5000
        );
        const userDetails = {
            ...user as BaseUser & UserDetails & { idToken: string },
            idToken: tokens?.idToken || "",
        };

        console.log("Getting wallets for authenticated user...", userDetails);
        const wallets = await getWallets(userDetails);

        const solanaWallet = wallets.find(w => w.type === 'solana');
        const ethereumWallet = wallets.find(w => w.type === 'ethereum');

        console.log("Wallet creation completed successfully");
        console.log("Solana wallet:", solanaWallet?.walletAddress);
        console.log("Ethereum wallet:", ethereumWallet?.walletAddress);

        res.setHeader("Content-Type", "text/html");
        res.send(`
        <html>
          <head>
            <title>Civic Auth + Wallet Dashboard</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 40px; }
              .container { max-width: 600px; margin: 0 auto; }
              .success { color: #28a745; }
              .info { color: #17a2b8; }
              button { padding: 10px 20px; margin: 10px 0; cursor: pointer; }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>🎉 Welcome, ${user?.name}!</h1>
              <div class="success">
                <p>✅ Authentication successful</p>
                <p>✅ Wallet created/verified on backend</p>
                <p>✅ Solana Wallet: ${solanaWallet?.walletAddress || 'Not available'}</p>
                <p>✅ Ethereum Wallet: ${ethereumWallet?.walletAddress || 'Not available'}</p>
              </div>
              <div class="info">
                <h3>User Details:</h3>
                <p><strong>Name:</strong> ${user?.name}</p>
                <p><strong>Email:</strong> ${user?.email || 'Not provided'}</p>
              </div>
              <p>Your Solana wallet is ready to receive JUKEBUCKS tokens!</p>
              <button onclick="window.location.href='/auth/logout'">Logout</button>
            </div>
          </body>
        </html>
      `);
    } catch (error) {
        console.error('Dashboard error:', error);
        res.status(500).send("Internal server error");
    }
});

app.get("/auth/logout", async (req: Request, res: Response) => {
    try {
        const url = await req.civicAuth.buildLogoutRedirectUrl();
        res.redirect(url.toString());
    } catch (error) {
        console.error('Logout error:', error);
        res.redirect("/");
    }
});

app.get("/auth/logoutcallback", async (req: Request, res: Response) => {
    const { state } = req.query as { state: string };
    console.log(`Logout-callback: state=${state}`);
    await req.storage.clear();
    res.redirect("/");
});

// -------------------- SOLANA API ENDPOINTS --------------------

// Get current authenticated user's wallet and balance
app.get('/api/wallet', authMiddleware, async (req: Request, res: Response) => {
    try {
        const user = await safeCivicCall(
            () => req.civicAuth.getUser(),
            null,
            5000
        );
        if (!user) {
            return res.status(401).json({ error: 'Not authenticated or timeout' });
        }

        // Get or create managed wallet
        const userWallet = await balanceService.getOrCreateUser(
            user.id,
            user.email,
            user.name
        );

        const balance = await walletService.getUserBalance(user.id);

        res.json({
            authenticated: true,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
            },
            wallet: userWallet.managedWallet.publicKey,
            tokenBalance: balance.gameBalance,
            totalEarned: userWallet.totalEarned,
            totalSpent: userWallet.totalSpent
        });
    } catch (error) {
        console.error('Error getting wallet:', error);
        res.status(500).json({ error: 'Failed to get wallet' });
    }
});

app.get('/api/auth/profile', authMiddleware, async (req: Request, res: Response) => {
    try {
        const user = await safeCivicCall(
            () => req.civicAuth.getUser(),
            null,
            5000
        );
        if (!user) {
            return res.status(401).json({ error: 'Not authenticated or timeout' });
        }

        const tokens = await safeCivicCall(
            () => req.civicAuth.getTokens(),
            null,
            5000
        );
        const userDetails = {
            ...user as BaseUser & UserDetails & { idToken: string },
            idToken: tokens?.idToken || "",
        };

        const wallets = await getWalletsWithRetry(userDetails, 3, 2000);
        const solanaWallet = wallets.find(w => w.type === 'solana');

        res.json({
            authenticated: true,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
            },
            wallet: solanaWallet?.walletAddress || null,
        });
    } catch (error) {
        console.error('Error getting user profile:', error);
        res.status(500).json({ error: 'Failed to get profile' });
    }
});

// Check if user is authenticated
app.get('/api/auth/status', async (req: Request, res: Response) => {
    try {
        const isLoggedIn = await safeCivicCall(
            () => req.civicAuth.isLoggedIn(),
            false,
            3000
        );
        res.json({ authenticated: isLoggedIn });
    } catch (error) {
        console.error('Auth status error:', error);
        res.json({ authenticated: false });
    }
});

// Logout endpoint
app.get('/api/auth/logout', async (req: Request, res: Response) => {
    try {
        const url = await req.civicAuth.buildLogoutRedirectUrl();
        res.json({ logoutUrl: url.toString() });
    } catch (error) {
        console.error('Logout error:', error);
        res.json({ logoutUrl: '/' });
    }
});

// Get user's JUKEBUCKS balance
app.get('/api/token/balance', authMiddleware, async (req: Request, res: Response) => {
    try {
        const user = await safeCivicCall(
            () => req.civicAuth.getUser(),
            null,
            5000
        );
        if (!user) {
            return res.status(401).json({ error: 'Not authenticated or timeout' });
        }

        const tokens = await safeCivicCall(
            () => req.civicAuth.getTokens(),
            null,
            5000
        );
        const userDetails = {
            ...user as BaseUser & UserDetails & { idToken: string },
            idToken: tokens?.idToken || "",
        };

        const wallets = await getWalletsWithRetry(userDetails, 5, 2000);
        const solanaWallet = wallets.find(w => w.type === 'solana');
        const walletAddress = solanaWallet?.walletAddress;

        if (!walletAddress) {
            return res.json({ balance: 0, message: 'No Solana wallet found' });
        }

        const balance = await getUserTokenBalance(walletAddress);
        res.json({ balance });
    } catch (error) {
        console.error('Error getting balance:', error);
        res.status(500).json({ error: 'Failed to get balance' });
    }
});

// Add a simple in-memory store for user data (replace with database in production)
const userDailyClaims = new Map<string, number>();

// Clean up old entries periodically (keep last 7 days)
setInterval(() => {
    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    for (const [userId, timestamp] of userDailyClaims.entries()) {
        if (timestamp < oneWeekAgo) {
            userDailyClaims.delete(userId);
        }
    }
}, 24 * 60 * 60 * 1000); // Clean once per day

// Claim daily reward
app.post('/api/token/claim-daily', authMiddleware, async (req: Request, res: Response) => {
    try {
        const user = await safeCivicCall(
            () => req.civicAuth.getUser(),
            null,
            5000
        );
        if (!user) {
            return res.status(401).json({ error: 'Not authenticated or timeout' });
        }

        // Get or create user with managed wallet
        const userWallet = await balanceService.getOrCreateUser(
            user.id,
            user.email || '',
            user.name || ''
        );

        // Check if already claimed today
        const lastClaim = userDailyClaims.get(user.id) || 0;
        const now = Date.now();
        const oneDay = 24 * 60 * 60 * 1000;

        if (now - lastClaim < oneDay) {
            const hoursLeft = Math.ceil((oneDay - (now - lastClaim)) / (60 * 60 * 1000));
            return res.status(429).json({
                success: false,
                error: `Already claimed! Next claim in ${hoursLeft} hours`,
                nextClaimIn: oneDay - (now - lastClaim)
            });
        }

        // ✅ Mint to the managed wallet using walletService
        const result = await walletService.mintTokensToUser(user.id, 100);

        if (result.success) {
            userDailyClaims.set(user.id, now);

            // Record in database
            await UserWallet.updateOne(
                { userId: user.id },
                {
                    $push: {
                        earnings: {
                            amount: 100,
                            source: 'daily_reward',
                            signature: result.signature,
                            timestamp: new Date()
                        }
                    }
                }
            );
        }

        const balance = await walletService.getUserBalance(user.id);

        res.json({
            success: true,
            reward: 100,
            signature: result.signature,
            newBalance: balance.gameBalance,
            wallet: userWallet.managedWallet.publicKey
        });
    } catch (error) {
        console.error('Error claiming daily reward:', error);
        res.status(500).json({ error: 'Failed to claim reward' });
    }
});

app.post('/api/store/purchase', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { itemId, quantity = 1 } = req.body;
        const user = await safeCivicCall(
            () => req.civicAuth.getUser(),
            null,
            5000
        );
        if (!user) {
            return res.status(401).json({ error: 'Not authenticated or timeout' });
        }

        const tokens = await safeCivicCall(
            () => req.civicAuth.getTokens(),
            null,
            5000
        );
        const userDetails = {
            ...user as BaseUser & UserDetails & { idToken: string },
            idToken: tokens?.idToken || "",
        };

        const wallets = await getWalletsWithRetry(userDetails, 3, 2000);
        const solanaWallet = wallets.find(w => w.type === 'solana');
        const walletAddress = solanaWallet?.walletAddress;

        if (!walletAddress) {
            return res.status(404).json({ error: 'No Solana wallet found' });
        }

        // Get or create user in database
        await balanceService.getOrCreateUser(
            user.id,
            user.name || '',
            user.email || ''
        );

        // Get item from store
        const item = storeManager.getItem(itemId);
        if (!item) {
            return res.status(404).json({ error: 'Item not found' });
        }

        // Calculate price
        const finalPrice = item.discount
            ? Math.floor(item.price * (1 - item.discount / 100))
            : item.price;
        const totalCost = finalPrice * quantity;

        // Process purchase using game balance (database, no blockchain transaction)
        const result = await balanceService.purchaseItem(
            user.id,
            itemId,
            item.name,
            totalCost
        );

        if (!result.success) {
            return res.status(400).json({
                error: result.message,
                gameBalance: await balanceService.getGameBalance(user.id)
            });
        }

        // Add item to inventory
        await balanceService.addToInventory(user.id, item);

        res.json({
            success: true,
            message: `Purchased ${item.name}!`,
            newBalance: result.newBalance,
            blockchainBalance: result.blockchainBalance,
            item: {
                id: item.id,
                name: item.name,
                price: finalPrice,
                category: item.category
            }
        });

    } catch (error) {
        console.error('Purchase error:', error);
        res.status(500).json({ error: 'Purchase failed' });
    }
});

// -------------------- SOCKET.IO SERVER --------------------

const server = http.createServer(app);

// Initialize database connection
connectDB();

const leaderboardManager = new LeaderboardManager();
const storeManager = new StoreManager();

// ========== MODIFIED: Configure CORS for mobile ==========
const io = new Server(server, {
    cors: {
        origin: [
            "http://localhost:5173",
            "http://localhost:5000",
            "http://localhost:3000",
            "https://eloquence-overlay-kisser.ngrok-free.dev",
            "capacitor://localhost",
            "http://localhost",
            "http://10.0.2.2:3000",
            "http://10.0.2.2:5000",
            "http://192.168.*.*",
            "*"
        ],
        methods: ["GET", "POST", "OPTIONS"],
        optionsSuccessStatus: 200,
        exposedHeaders: ["Set-Cookie"],
        credentials: true,
        allowedHeaders: ["Content-Type", "Authorization", "Cookie"]
    },
    transports: ['websocket', 'polling'],
    allowEIO3: true,
    pingTimeout: 60000,
    pingInterval: 25000
});

storeManager.setBroadcastFunction((event, data) => io.emit(event, data));
leaderboardManager.setBroadcastFunction((event: string, data: any) => { io.emit(event, data); });

// ========== NEW: Health check and info endpoints ==========
app.get('/api/health', (req: Request, res: Response) => {
    res.json({
        status: 'ok',
        timestamp: Date.now(),
        uptime: process.uptime()
    });
});

app.get('/api/info', (req: Request, res: Response) => {
    res.json({
        version: '1.0.0',
        platform: 'multiplayer',
        websocket: true,
        features: {
            voiceChat: true,
            rooms: true,
            spawnPoints: 40
        }
    });
});

// Get local IP address for mobile connections
app.get('/api/server-ip', (req: Request, res: Response) => {
    const os = require('os');
    const interfaces = os.networkInterfaces();
    const addresses = [];

    for (const name of Object.keys(interfaces)) {
        for (const net of interfaces[name]) {
            if (net.family === 'IPv4' && !net.internal) {
                addresses.push(net.address);
            }
        }
    }

    res.json({
        ips: addresses,
        port: app.get('port')
    });
});

app.set('port', process.env.PORT || 5000);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', (req: Request, res: Response) => {
    res.json({
        status: 'online',
        message: 'The Winnowing Games Server',
        version: '1.0.0',
        timestamp: Date.now()
    });
});

// Health check endpoint
app.get('/api/health', (req: Request, res: Response) => {
    res.json({
        status: 'ok',
        timestamp: Date.now(),
        uptime: process.uptime()
    });
});

// Listen on all network interfaces (0.0.0.0) to allow mobile connections
server.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Server running on:`);
    console.log(`   - Local: http://localhost:${PORT}`);
    console.log(`   - Network: http://172.28.224.49:${PORT}`);

    const interfaces = os.networkInterfaces();
    console.log(`\n📱 Connect mobile devices using these IPs:`);
    for (const name of Object.keys(interfaces)) {
        for (const net of interfaces[name]) {
            if (net.family === 'IPv4' && !net.internal) {
                console.log(`   - http://${net.address}:${PORT}`);
            }
        }
    }
});

// ---------------- HELPERS ----------------

function getMatch(socket: CustomSocket): Match | undefined {
    return matchManager.getMatch(socket.data.matchId!);
}

const usedColors = new Set();

function generatePlayerColor(): number {
    const colors = [
        0xff0000, 0x00ff00, 0x0000ff,
        0xffff00, 0xff00ff, 0x00ffff
    ];
    const color = colors[usedColors.size % colors.length];
    usedColors.add(color);
    return color;
}


function getPlayerCountForMap(mapKey: string): number {
    let count = 0;
    for (const match of matchManager.getAllMatches()) {
        if (match.mapKey === mapKey) {
            count += match.players.getAll().length;
        }
    }
    return count;
}

// ---------------- GLOBAL ROOM TICK ----------------
function setupRoomActivationForMatch(match: Match) {
    const roomManager = match.roomManager;
    const originalActivate = roomManager.activateRandomRoom.bind(roomManager);

    roomManager.activateRandomRoom = function () {
        const room = originalActivate();
        if (room && room.id) {
            match.players.getAll().forEach(p => p.resetRoomCollections());

            io.to(match.id).emit("roomActivated", {
                roomId: room.id,
                buildingId: room.buildingId,
                name: room.name,
                position: room.position,
                ammoBoxPosition: room.ammoBoxPosition,
                vaccineBoxPosition: room.vaccineBoxPosition,
                ammoBoxOpen: room.ammoBox.isOpen,
                vaccineBoxOpen: room.vaccineBox.isOpen,
                expiresAt: room.activeUntil
            });
        }
        return room;
    };
    roomManager.startRoomCycle();
}

// Setup room status interval for each match
setInterval(() => {
    for (const match of matchManager.getAllMatches()) {
        const activeRoom = match.roomManager.getActiveRoom();
        if (!activeRoom) continue;

        const status = match.roomManager.getRoomStatus(activeRoom.id);
        if (!status) continue;

        io.to(match.id).emit('roomStatus', {
            roomId: activeRoom.id,
            timeRemaining: status.timeRemaining,
            ammoBoxOpen: status.ammoBox.isOpen,
            ammoCollectedCount: status.ammoBox.collectedCount,
            vaccineBoxOpen: status.vaccineBox.isOpen,
            vaccineCollectedCount: status.vaccineBox.collectedCount
        });
    }
}, 1000);

// ---------------- GLOBAL ERROR HANDLERS ----------------

// Global Express error handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    console.error('❌ Unhandled Express error:', err);
    if (res.headersSent) {
        return next(err);
    }
    res.status(err.status || 500).json({
        error: err.message || 'Internal server error',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
});

// Process-level uncaught exception handler
process.on('uncaughtException', (err) => {
    console.error('❌ Uncaught Exception:', err);
    // Log but don't exit - keep server running
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection:', reason);
    // Log but don't exit - keep server running
});

// ---------------- SOCKET ----------------

io.on('connection', (socket: CustomSocket) => {

    console.log('Client connected:', socket.id, 'from:', socket.handshake.address);

    // -------- MATCHMAKING --------

    socket.on("findMatch", (data?: { mapKey?: string }) => {
        const mapKey = data?.mapKey || 'shooting_range';
        const match = matchManager.findMatch(mapKey);

        if (!match.roomManager._activationSetup) {
            if (mapKey === 'shooting_range') {
                setupRoomActivationForMatch(match);
                match.roomManager._activationSetup = true;
            } else {
                match.roomManager._activationSetup = true;
            }
        }

        socket.join(match.id);
        socket.data.matchId = match.id;

        socket.emit("matchJoined", { matchId: match.id, mapKey });
    });

    // -------- SESSION --------

    socket.on('checkSession', () => {
        socket.emit('checkSessionCallback', {});
    });

    socket.on('initNewSession', (name: string) => {
        const match = getMatch(socket);
        if (!match) return;

        const spawn = match.spawnManager.getFreeSpawnPoint(socket.id);
        if (!spawn) return;

        const player = new Player(socket.id, name, generatePlayerColor(), spawn.position);
        player.setRotation(spawn.rotation);
        player.setWeaponIndex(0);
        player.setAnimation("idle");
        player.health = 100;
        player.maxHealth = 100;

        match.players.add(player);
        socket.data.player = player;

        // ✅ If userId already known (walletConnected fired before initNewSession)
        if (socket.data.userId) {
            player.id = socket.data.userId;
            console.log(`✅ Player ID set from existing userId: ${player.id}`);

            // Sync wallet and inventory in background
            balanceService.getOrCreateUser(socket.data.userId, '', name)
                .then(async (userWallet) => {
                    player.setWalletAddress(userWallet.managedWallet.publicKey);
                    socket.data.walletAddress = userWallet.managedWallet.publicKey;
                    const balance = await safeGetBalance(socket.data.userId!);
                    player.tokenBalance = balance.gameBalance;
                    socket.emit('tokenBalanceUpdate', { balance: balance.gameBalance });
                    const inv = await syncPlayerInventory(player, socket.data.userId!);
                    socket.emit('inventoryUpdate', { inventory: inv });
                })
                .catch(err => console.error('Init wallet error:', err));
        }

        if (socket.data.pendingWallet) {
            player.setWalletAddress(socket.data.pendingWallet);
            socket.data.walletAddress = socket.data.pendingWallet;
            console.log(`✅ Applied pending wallet to player ${name}: ${player.walletAddress}`);
            delete socket.data.pendingWallet;
        }

        if (socket.data.pendingUserId) {
            console.log(`✅ Creating managed wallet for pending user ${socket.data.pendingUserId}`);
            balanceService.getOrCreateUser(
                socket.data.pendingUserId,
                '',
                name
            ).then(async (userWallet) => {
                const managedWalletAddress = userWallet.managedWallet.publicKey;
                player.setWalletAddress(managedWalletAddress);
                socket.data.walletAddress = managedWalletAddress;
                socket.data.userId = socket.data.pendingUserId;

                const balance = await walletService.getUserBalance(socket.data.pendingUserId);
                player.tokenBalance = balance.gameBalance;

                console.log(`✅ Managed wallet created for ${name}: ${managedWalletAddress}`);
                socket.emit('tokenBalanceUpdate', { balance: balance.gameBalance });
            }).catch(err => {
                console.error('Failed to create managed wallet:', err);
            });

            delete socket.data.pendingUserId;
        }

        match.players.add(player);
        socket.data.player = player;

        leaderboardManager.updatePlayer(player.id, player.name, {
            kills: 0, deaths: 0, level: 1, headshots: 0, highestKillstreak: 0, score: 0, tokenBalance: player.tokenBalance || 0
        });

        socket.emit('initSelf', player.clientFormat());

        if (match.mapKey === 'shooting_range') {
            socket.emit('initRooms', ROOM_DEFINITIONS);
            const spawnPositions = match.spawnManager.getSpawnPositions();
            socket.emit('spawnPoints', spawnPositions);
        }

        const activeRoom = match.roomManager.getActiveRoom();
        if (activeRoom && match.mapKey === 'shooting_range') {
            socket.emit('roomActivated', {
                roomId: activeRoom.id,
                buildingId: activeRoom.buildingId,
                name: activeRoom.name,
                position: activeRoom.position,
                ammoBoxPosition: activeRoom.ammoBoxPosition,
                vaccineBoxPosition: activeRoom.vaccineBoxPosition,
                ammoBoxOpen: activeRoom.ammoBox.isOpen,
                vaccineBoxOpen: activeRoom.vaccineBox.isOpen,
                expiresAt: activeRoom.activeUntil
            });
        }
    });

    socket.on('confirmLoadout', (data: { weapons: string[] }) => {
        const match = getMatch(socket);
        const player = socket.data.player;
        if (!match || !player) return;

        player.setLoadout(data.weapons);

        socket.to(match.id).emit('newPlayer', {
            ...player.clientFormat(),
            mapKey: match.mapKey
        });

        socket.to(match.id).emit('playerLoadout', {
            id: player.id,
            weapons: data.weapons
        });
    });

    // -------- PLAYER UPDATE (Server Reconciliation) --------

    socket.on('updatePlayer', (data) => {
        const match = getMatch(socket);
        if (!match) return;
        const player = match.players.find(data.id);
        if (!player) return;

        if (data.pos) {
            player.setPos(data.pos);
            if (!player.posHistory) player.posHistory = [];
            player.posHistory.push({ time: Date.now(), pos: { ...data.pos } });
            player.posHistory = player.posHistory.filter(p => Date.now() - p.time <= 200);
        }
        if (data.rotation) player.setRotation(data.rotation);
        if (data.weaponIndex !== undefined) player.setWeaponIndex(data.weaponIndex);
        if (data.animation !== undefined) player.setAnimation(data.animation);
        if (data.loadout !== undefined) player.setLoadout(data.loadout);

        const { roomId } = match.roomManager.checkPlayerInRoom(data.pos);
        if (roomId) socket.emit('enteredRoom', { roomId });

        socket.to(match.id).emit('updatePlayer', {
            ...player.clientFormat(),
            mapKey: match.mapKey
        });
    });

    // -------- FIRE WEAPON (Lag Compensation / Hit Rewind) --------

    socket.on('fireWeapon', async (data) => {
        const match = getMatch(socket);
        const shooter = socket.data.player;
        if (!match || !shooter) return;

        if (!data.targetId) return;

        const hitTime = Date.now() - (data.clientPing || 0);
        const target = match.players.find(data.targetId);
        if (!target) return;

        if (target.isDead) {
            return;
        }

        if (data.targetInSpawnBox) {
            return;
        }

        let rewindPos = target.pos;
        if (target.posHistory && target.posHistory.length > 0) {
            const closest = target.posHistory.reduce((prev, curr) =>
                Math.abs(curr.time - hitTime) < Math.abs(prev.time - hitTime) ? curr : prev
            );
            rewindPos = closest.pos;
        }

        const MAX_RANGE = 2000;
        const dx = shooter.pos.x - rewindPos.x;
        const dy = shooter.pos.y - rewindPos.y;
        const dz = shooter.pos.z - rewindPos.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dist > MAX_RANGE) return;

        if (data.direction && data.position) {
            const toTarget = {
                x: rewindPos.x - data.position.x,
                y: rewindPos.y - data.position.y,
                z: rewindPos.z - data.position.z,
            };
            const toTargetLen = Math.sqrt(toTarget.x ** 2 + toTarget.y ** 2 + toTarget.z ** 2);
            const dot = (toTarget.x / toTargetLen) * data.direction.x +
                (toTarget.y / toTargetLen) * data.direction.y +
                (toTarget.z / toTargetLen) * data.direction.z;
            if (dot < 0.7) return;
        }

        const damage = data.damage;
        const isHeadshot = data.isHeadshot || false;

        const died = target.takeDamage(damage);

        io.to(match.id).emit('playerHit', {
            shooterId: shooter.id,
            targetId: target.id,
            weaponIndex: data.weaponIndex,
            weaponName: data.weaponName,
            damage: damage,
            health: target.health,
            maxHealth: target.maxHealth,
            isHeadshot: isHeadshot
        });

        if (died) {
            const killRewards = shooter.progression.addKill(isHeadshot);
            target.progression.addDeath();

            leaderboardManager.updatePlayer(shooter.id, shooter.name, {
                kills: shooter.progression.data.kills, deaths: shooter.progression.data.deaths,
                level: shooter.progression.data.level, headshots: shooter.progression.data.headshots,
                highestKillstreak: shooter.progression.data.highestKillstreak,
                score: shooter.progression.data.kills * 100 + shooter.progression.data.headshots * 50
            });
            leaderboardManager.updatePlayer(target.id, target.name, {
                kills: target.progression.data.kills, deaths: target.progression.data.deaths,
                level: target.progression.data.level, headshots: target.progression.data.headshots,
                highestKillstreak: target.progression.data.highestKillstreak,
                score: target.progression.data.kills * 100 + target.progression.data.headshots * 50
            });

            let killerWallet = shooter.walletAddress;
            if (!killerWallet && socket.data.walletAddress) {
                killerWallet = socket.data.walletAddress;
            }
            if (!killerWallet && socket.data.pendingWallet) {
                killerWallet = socket.data.pendingWallet;
            }

            console.log(`💀 Player died - killer wallet: ${shooter.walletAddress || 'NONE'}, victim: ${target.walletAddress || target.id}`);

            if (shooter && shooter.walletAddress) {
                console.log(`🪙 Attempting to mint tokens to ${shooter.walletAddress}...`);
                try {
                    const reward = await recordKillAndReward(
                        shooter.walletAddress,
                        target.walletAddress || target.id,
                        data.weaponName,
                        isHeadshot
                    );
                    console.log(`🪙 Mint result:`, reward);

                    if (reward.success) {
                        socket.emit('killReward', {
                            amount: reward.reward,
                            signature: reward.signature,
                            weapon: data.weaponName,
                            isHeadshot: isHeadshot
                        });

                        const newBalance = await walletService.getUserBalance(shooter.id);
                        shooter.tokenBalance = newBalance.gameBalance;
                        console.log(`✅ killReward emitted to killer ${shooter.id}`);
                    }
                } catch (err) {
                    console.error('❌ Kill reward failed:', err);
                }
            }

            io.to(match.id).emit('playerDied', {
                playerId: target.id, playerName: target.name, killerId: shooter.id,
                weaponName: data.weaponName, isHeadshot: isHeadshot,
                killerProgression: shooter.getProgressionData(),
                killRewards: killRewards
            });

            socket.emit('progressionUpdate', {
                progression: shooter.getProgressionData(),
                killRewards: killRewards
            });
        }
    });

    socket.on('requestLeaderboard', (data?: { sortBy?: string }) => {
        const sortBy = data?.sortBy || 'score';
        socket.emit('leaderboardData', {
            ...leaderboardManager.getLeaderboardData(sortBy),
            playerRank: leaderboardManager.getPlayerRank(socket.id),
            playerStats: leaderboardManager.getPlayerStats(socket.id)
        });
    });

    // socket.on('walletConnected', async (data: { wallet: string, userId?: string }) => {
    //     const player = socket.data.player;
    //     console.log(`🔐 walletConnected received - socket ID: ${socket.id}, userId: ${data.userId}`);

    //     if (!data.userId) {
    //         console.log(`⚠️ No userId provided, storing wallet: ${data.wallet}`);
    //         if (player) {
    //             player.setWalletAddress(data.wallet);
    //             socket.data.walletAddress = data.wallet;
    //         } else {
    //             socket.data.pendingWallet = data.wallet;
    //         }
    //         return;
    //     }

    //     // ✅ Store the userId on the socket
    //     socket.data.userId = data.userId;

    //     if (player) {
    //         try {
    //             const userWallet = await Promise.race([
    //                 balanceService.getOrCreateUser(
    //                     data.userId,
    //                     '',
    //                     player.name || ''
    //                 ),
    //                 new Promise<null>((resolve) => {
    //                     setTimeout(() => {
    //                         console.warn('⚠️ Wallet creation timeout - using fallback');
    //                         resolve(null);
    //                     }, 10000);
    //                 })
    //             ]);

    //             if (!userWallet) {
    //                 player.setWalletAddress(data.wallet);
    //                 socket.data.walletAddress = data.wallet;
    //                 console.log(`⚠️ Using fallback wallet for ${player.name}`);
    //                 return;
    //             }

    //             const managedWalletAddress = userWallet.managedWallet.publicKey;
    //             player.setWalletAddress(managedWalletAddress);
    //             socket.data.walletAddress = managedWalletAddress;

    //             // ✅ Set player.id to the Civic userId
    //             player.id = data.userId;

    //             console.log(`✅ Managed wallet set for player ${player.name}: ${managedWalletAddress}`);
    //             console.log(`✅ Player ID set to: ${player.id}, socket userId: ${socket.data.userId}`);

    //             // ✅ Use safeGetBalance (now defined)
    //             const balance = await safeGetBalance(data.userId);
    //             player.tokenBalance = balance.gameBalance;
    //             socket.emit('tokenBalanceUpdate', { balance: balance.gameBalance });

    //         } catch (error) {
    //             console.error('❌ Wallet connection error:', error);
    //             player.setWalletAddress(data.wallet);
    //             socket.data.walletAddress = data.wallet;
    //         }
    //     } else {
    //         socket.data.pendingUserId = data.userId;
    //     }
    // });

    socket.on('walletConnected', async (data: { wallet: string, userId?: string }) => {
        const player = socket.data.player;
        console.log(`🔐 walletConnected - userId: ${data.userId}, wallet: ${data.wallet}`);

        // ✅ Store userId IMMEDIATELY — synchronously, before any async
        if (data.userId) {
            socket.data.userId = data.userId;
            if (player) {
                player.id = data.userId; // ✅ Also update player ID immediately
            }
        }

        if (player) {
            try {
                const userWallet = await balanceService.getOrCreateUser(
                    data.userId || socket.id,
                    '',
                    player.name || ''
                );

                const managedWalletAddress = userWallet.managedWallet.publicKey;
                player.setWalletAddress(managedWalletAddress);
                socket.data.walletAddress = managedWalletAddress;

                const balance = await safeGetBalance(data.userId || socket.id);
                player.tokenBalance = balance.gameBalance;
                socket.emit('tokenBalanceUpdate', { balance: balance.gameBalance });

                // ✅ Sync inventory from database
                if (data.userId) {
                    const syncedInventory = await syncPlayerInventory(player, data.userId);
                    socket.emit('inventoryUpdate', { inventory: syncedInventory });
                }

                console.log(`✅ Wallet set for ${player.name}: ${managedWalletAddress}, userId: ${socket.data.userId}`);
            } catch (error) {
                console.error('❌ Wallet connection error:', error);
                player.setWalletAddress(data.wallet);
                socket.data.walletAddress = data.wallet;
            }
        } else {
            socket.data.pendingWallet = data.wallet;
            if (data.userId) socket.data.pendingUserId = data.userId;
        }
    });

    socket.on('playerWeaponSwitch', (data) => {
        const match = getMatch(socket);
        const player = socket.data.player;
        if (!match || !player) return;

        player.setWeaponIndex(data.weaponIndex);
        socket.to(match.id).emit('playerWeaponSwitch', {
            id: player.id,
            weaponIndex: player.weaponIndex
        });
    });

    socket.on('playerReload', () => {
        const match = getMatch(socket);
        const player = socket.data.player;
        if (!match || !player) return;
        socket.to(match.id).emit('playerReload', { id: player.id });
    });

    socket.on('initOthers', () => {
        const match = getMatch(socket);
        if (!match) return;
        const list = match.players.getAll()
            .filter(p => p.id !== socket.id)
            .map(p => ({ ...p.clientFormat(), mapKey: match.mapKey }));
        socket.emit('initOthersCallback', list);
    });

    // -------- ROOM SYSTEM --------

    socket.on("requestActiveRoom", () => {
        const match = getMatch(socket);
        if (!match) return;

        const activeRoom = match.roomManager.getActiveRoom();
        if (activeRoom) {
            socket.emit("roomActivated", {
                roomId: activeRoom.id,
                buildingId: activeRoom.buildingId,
                name: activeRoom.name,
                position: activeRoom.position,
                ammoBoxPosition: activeRoom.ammoBoxPosition,
                vaccineBoxPosition: activeRoom.vaccineBoxPosition,
                ammoBoxOpen: activeRoom.ammoBox.isOpen,
                vaccineBoxOpen: activeRoom.vaccineBox.isOpen,
                expiresAt: activeRoom.activeUntil
            });
        }
    });

    socket.on('openBox', async (data: {
        roomId: string;
        boxType: 'ammo' | 'vaccine';
        weaponName?: string;
    }) => {
        const match = getMatch(socket);
        const player = socket.data.player;
        if (!match || !player) return;

        const result = match.roomManager.openBox(
            data.roomId,
            data.boxType,
            player.id,
            player.name,
            data.weaponName
        );

        if (result.success) {
            if (data.boxType === 'ammo' && data.weaponName) {
                player.recordAmmoCollection(data.weaponName);

                const itemId = 'ammo_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
                player.inventory.push({
                    id: itemId,
                    type: 'ammo',
                    name: `${data.weaponName} Ammo Pack`,
                    count: 1,
                    weaponName: data.weaponName
                });

                if (player.grenadeCount < player.maxGrenades) {
                    player.addGrenade(1);
                    socket.emit('grenadeRefill', {
                        count: player.grenadeCount,
                        max: player.maxGrenades
                    });

                    socket.emit('serverResponse', {
                        type: 'success',
                        text: '+1 Grenade!'
                    });
                }

                socket.emit('ammoCollected', {
                    weaponName: data.weaponName,
                    inventory: player.inventory
                });

                const userId = player.id || socket.data.userId;
                if (userId) {
                    const syncedInventory = await syncPlayerInventory(player, userId);
                    socket.emit('inventoryUpdate', { inventory: syncedInventory });
                } else {
                    socket.emit('inventoryUpdate', { inventory: player.inventory });
                }

            } else if (data.boxType === 'vaccine') {
                player.collectedVaccineThisRoom = true;

                const itemId = 'vaccine_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
                player.inventory.push({
                    id: itemId,
                    type: 'vaccine',
                    name: 'Vaccine',
                    count: 1
                });

                socket.emit('vaccineCollected', {
                    inventory: player.inventory
                });

                const userId = player.id || socket.data.userId;
                if (userId) {
                    const syncedInventory = await syncPlayerInventory(player, userId);
                    socket.emit('inventoryUpdate', { inventory: syncedInventory });
                } else {
                    socket.emit('inventoryUpdate', { inventory: player.inventory });
                }
            }

            io.to(match.id).emit('boxOpened', {
                roomId: data.roomId,
                boxType: data.boxType,
                weaponName: data.weaponName,
                playerId: player.id,
                playerName: player.name,
                isFirstOpener: result.isFirstOpener,
                collectionCount: result.collectionCount
            });
        } else {
            socket.emit('boxError', { message: result.message });
        }
    });

    socket.on('store-getItems', (data: { category?: string }, callback) => {
        let items;
        if (data?.category) {
            items = storeManager.getItemsByCategory(data.category);
        } else {
            items = storeManager.getAllItems();
        }

        callback({
            success: true,
            items: items,
            rotatingItems: storeManager.getRotatingItems(),
            nextRefresh: storeManager.getNextRefreshTime()
        });
    });

    socket.on('store-purchase', async (data: {
        itemId: string;
        quantity: number;
        signature?: string;
        free?: boolean;
    }, callback) => {
        console.log("🛒 store-purchase received:", JSON.stringify(data, null, 2));

        const player = socket.data.player;
        if (!player) {
            console.log("❌ No player found");
            callback({ success: false, message: 'Not authenticated' });
            return;
        }

        if (!player.walletAddress) {
            console.log(`❌ Player ${player.name} has no wallet address`);
            callback({ success: false, message: 'Wallet not connected. Please sign in first.' });
            return;
        }

        const item = storeManager.getItem(data.itemId);
        if (!item) {
            console.log(`❌ Item not found: ${data.itemId}`);
            callback({ success: false, message: 'Item not found' });
            return;
        }

        const finalPrice = item.discount
            ? Math.floor(item.price * (1 - item.discount / 100))
            : item.price;
        const totalCost = finalPrice * (data.quantity || 1);

        console.log(`💰 Purchase request - Player: ${player.name}, Item: ${item.name}, Cost: ${totalCost} JBKS`);

        // If this is a free purchase (from ad)
        if (data.free) {
            console.log("🎁 Processing free purchase from ad");

            await applyPurchasedItem(player, item, data.quantity);

            const userId = player.id || socket.data.userId;
            if (userId) {
                await balanceService.addToInventory(userId, item);
                const syncedInventory = await syncPlayerInventory(player, userId);
                console.log(`📤 Emitting inventoryUpdate with:`, JSON.stringify(syncedInventory, null, 2));
                socket.emit('inventoryUpdate', { inventory: syncedInventory });
            } else {
                socket.emit('inventoryUpdate', { inventory: player.inventory });
            }

            callback({
                success: true,
                message: `Claimed ${item.name}!`,
                item: item
            });
            return;
        }

        // Process paid purchase using database balance
        try {
            const userId = player.id || socket.data.userId;
            if (!userId) {
                callback({ success: false, message: 'User ID not found. Please re-login.' });
                return;
            }

            const result = await balanceService.purchaseItem(
                userId,
                data.itemId,
                item.name,
                totalCost
            );

            if (!result.success) {
                callback({ success: false, message: result.message });
                return;
            }

            await applyPurchasedItem(player, item, data.quantity);
            await balanceService.addToInventory(userId, item);

            const syncedInventory = await syncPlayerInventory(player, userId);
            console.log(`📤 Emitting inventoryUpdate with:`, JSON.stringify(syncedInventory, null, 2));
            socket.emit('inventoryUpdate', { inventory: syncedInventory });

            player.tokenBalance = result.newBalance;

            callback({
                success: true,
                message: `Purchased ${item.name}!`,
                newBalance: result.newBalance,
                blockchainBalance: result.blockchainBalance,
                item: item
            });

            if (totalCost >= 1000) {
                io.to(socket.data.matchId!).emit('serverResponse', {
                    type: 'announcement',
                    text: `${player.name} just bought ${item.name} from the store!`
                });
            }

        } catch (error) {
            console.error('Purchase error:', error);
            callback({ success: false, message: 'Purchase failed: ' + error.message });
        }
    });

    socket.on('requestRoomStatus', (data) => {
        const match = getMatch(socket);
        if (!match) return;
        const status = match.roomManager.getRoomStatus(data.roomId);
        if (status) {
            socket.emit('roomStatus', status);
        }
    });

    // -------- CHAT --------

    socket.on('sendMessage', (msg: string) => {
        const match = getMatch(socket);
        const player = socket.data.player;
        if (!match || !player) return;

        if (msg.startsWith('/')) {
            socket.readCommand?.(msg);
            return;
        }

        if (msg.length > 200) {
            socket.emit('serverResponse', { type: 'error', text: 'Too long' });
            return;
        }

        const message = new Message(msg, player, Date.now());
        match.messages.add(message);
        io.to(match.id).emit('newMessage', message);
    });

    // -------- VOICE (Proximity Chat) --------

    socket.on('voice-ready', () => {
        const match = getMatch(socket);
        const player = socket.data.player;
        if (!match || !player) return;

        match.voiceUsers.set(player.id, {
            socketId: socket.id,
            playerId: player.id,
            playerName: player.name
        });

        socket.to(match.id).emit('voice-user-connected', {
            userId: player.id,
            userName: player.name
        });

        const others = Array.from(match.voiceUsers.values())
            .filter(u => u.playerId !== player.id);
        socket.emit('voice-users-list', { users: others });
    });

    socket.on('voice-signal', (data) => {
        const match = getMatch(socket);
        if (!match) return;
        const target = match.voiceUsers.get(data.to);
        if (target) {
            socket.to(target.socketId).emit('voice-signal', data);
        }
    });

    socket.on('voice-speaking', (data) => {
        const match = getMatch(socket);
        if (!match) return;
        const speaker = socket.data.player;
        if (!speaker) return;

        const distance = (p1: Player, p2: Player) => {
            const dx = p1.pos.x - p2.pos.x;
            const dy = p1.pos.y - p2.pos.y;
            const dz = p1.pos.z - p2.pos.z;
            return Math.sqrt(dx * dx + dy * dy + dz * dz);
        };

        for (const user of match.voiceUsers.values()) {
            if (user.playerId === speaker.id) continue;
            const listener = match.players.find(user.playerId);
            if (!listener) continue;
            if (distance(speaker, listener) <= 20) {
                socket.to(user.socketId).emit('voice-speaking', data);
            }
        }
    });

    // -------- RESPAWN --------

    socket.on('requestRespawn', () => {
        const match = getMatch(socket);
        const player = socket.data.player;
        if (!match || !player) return;

        if (!player.isDead) {
            console.log(`Player ${player.name} is already alive, ignoring respawn request`);
            return;
        }

        match.spawnManager.releaseSpawnPoint(player.id);

        const spawn = match.spawnManager.getRandomSpawnPoint();
        if (!spawn) return;

        player.resetHealth();
        player.isDead = false;
        player.setPos(spawn.position);
        player.setRotation(spawn.rotation);
        player.lastSpawnTime = Date.now();

        if (player.loadout) {
            player.loadout.forEach(weaponName => {
                player.weaponReserves[weaponName] = 1;
            });
        }

        player.resetRoomCollections();

        socket.to(match.id).emit('playerRespawned', {
            playerId: player.id,
            playerName: player.name,
            color: player.color,
            position: spawn.position,
            rotation: spawn.rotation,
            health: player.health,
            maxHealth: player.maxHealth,
            loadout: player.loadout
        });

        socket.to(match.id).emit('playerLoadout', {
            id: player.id,
            weapons: player.loadout || []
        });

        socket.emit('respawnConfirmed', {
            position: spawn.position,
            rotation: spawn.rotation,
            health: player.health,
            maxHealth: player.maxHealth,
            spawnShieldDuration: 5000,
            grenadeCount: player.grenadeCount,
            maxGrenades: player.maxGrenades
        });

        console.log(`✅ Player ${player.name} respawned at random spawn point`);
    });

    socket.on('requestSpawnPoints', () => {
        const match = getMatch(socket);
        if (!match) return;

        const spawnPositions = match.spawnManager.getSpawnPositions();
        socket.emit('spawnPoints', spawnPositions);
    });

    socket.on('requestMapPlayerCounts', () => {
        const mapCounts = {
            shooting_range: getPlayerCountForMap('shooting_range'),
            greeble_map: getPlayerCountForMap('greeble_map'),
            lowpoly_environment: getPlayerCountForMap('lowpoly_environment')
        };
        console.log('📊 Map player counts:', mapCounts);
        socket.emit('mapPlayerCounts', mapCounts);
    });

    // -------- GRENADE SYSTEM --------

    socket.on('grenadeThrown', (data: {
        position: { x: number, y: number, z: number },
        direction: { x: number, y: number, z: number },
        throwPower: number,
        grenadeCount?: number
    }) => {
        const match = getMatch(socket);
        const player = socket.data.player;
        if (!match || !player) return;

        if (!player.hasGrenades()) {
            socket.emit('serverResponse', {
                type: 'warning',
                text: 'No grenades left!'
            });
            return;
        }

        player.useGrenade();

        console.log(`💣 ${player.name} threw a grenade. ${player.grenadeCount}/${player.maxGrenades} left`);

        socket.to(match.id).emit('remoteGrenadeThrown', {
            playerId: player.id,
            position: data.position,
            direction: data.direction,
            throwPower: data.throwPower
        });

        socket.emit('grenadeCountUpdate', {
            count: player.grenadeCount,
            max: player.maxGrenades
        });
    });

    socket.on('grenadeExploded', (data: {
        position: { x: number, y: number, z: number },
        damage: number,
        radius: number,
        throwerId: string
    }) => {
        const match = getMatch(socket);
        const shooter = socket.data.player;
        if (!match || !shooter) return;

        console.log(`💥 Grenade exploded at (${data.position.x}, ${data.position.y}, ${data.position.z}) with radius ${data.radius}`);

        io.to(match.id).emit('remoteGrenadeExploded', {
            position: data.position,
            throwerId: data.throwerId,
            damage: data.damage,
            radius: data.radius
        });

        match.players.getAll().forEach(target => {
            if (target.isDead) return;

            const dx = target.pos.x - data.position.x;
            const dy = target.pos.y - data.position.y;
            const dz = target.pos.z - data.position.z;
            const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

            console.log(`Checking ${target.name} - distance: ${dist.toFixed(2)}`);

            if (dist < data.radius) {
                let damageAmount = Math.floor(data.damage * (1 - dist / data.radius));
                damageAmount = Math.max(10, damageAmount);

                console.log(`${target.name} took ${damageAmount} damage from grenade!`);

                const died = target.takeDamage(damageAmount);

                io.to(match.id).emit('playerHit', {
                    shooterId: shooter.id,
                    targetId: target.id,
                    weaponName: 'Grenade',
                    damage: damageAmount,
                    health: target.health,
                    maxHealth: target.maxHealth,
                    isHeadshot: false
                });

                if (died) {
                    console.log(`${target.name} was killed by ${shooter.name}'s grenade!`);

                    const killRewards = shooter.progression.addKill(false);
                    target.progression.addDeath();

                    leaderboardManager.updatePlayer(shooter.id, shooter.name, {
                        kills: shooter.progression.data.kills,
                        deaths: shooter.progression.data.deaths,
                        level: shooter.progression.data.level,
                        headshots: shooter.progression.data.headshots,
                        highestKillstreak: shooter.progression.data.highestKillstreak,
                        score: shooter.progression.data.kills * 100 + shooter.progression.data.headshots * 50
                    });
                    leaderboardManager.updatePlayer(target.id, target.name, {
                        kills: target.progression.data.kills,
                        deaths: target.progression.data.deaths,
                        level: target.progression.data.level,
                        headshots: target.progression.data.headshots,
                        highestKillstreak: target.progression.data.highestKillstreak,
                        score: target.progression.data.kills * 100 + target.progression.data.headshots * 50
                    });

                    console.log(`💀 Player died - killer wallet: ${shooter.walletAddress || 'NONE'}, victim: ${target.walletAddress || target.id}`);

                    const weaponName = 'Grenade';
                    const isHeadshot = false;

                    if (shooter && shooter.walletAddress) {
                        console.log(`🪙 Attempting to mint tokens to ${shooter.walletAddress}...`);
                        recordKillAndReward(
                            shooter.walletAddress,
                            target.walletAddress || target.id,
                            weaponName,
                            isHeadshot
                        ).then(async (reward) => {
                            console.log(`🪙 Mint result:`, reward);

                            if (reward.success) {
                                socket.emit('killReward', {
                                    amount: reward.reward,
                                    signature: reward.signature,
                                    weapon: weaponName,
                                    isHeadshot: isHeadshot
                                });

                                const newBalance = await walletService.getUserBalance(shooter.id);
                                shooter.tokenBalance = newBalance.gameBalance;
                                console.log(`✅ killReward emitted to killer ${shooter.id}`);
                            }
                        }).catch(err => {
                            console.error('❌ Kill reward failed:', err);
                        });
                    }

                    io.to(match.id).emit('playerDied', {
                        playerId: target.id,
                        playerName: target.name,
                        killerId: shooter.id,
                        weaponName: weaponName,
                        isHeadshot: isHeadshot,
                        killerProgression: shooter.getProgressionData(),
                        killRewards: killRewards
                    });

                    socket.emit('progressionUpdate', {
                        progression: shooter.getProgressionData(),
                        killRewards: killRewards
                    });
                }
            }
        });
    });

    // -------- MUZZLE FLASH --------

    socket.on('muzzleFlash', (data: {
        position: { x: number, y: number, z: number }
    }) => {
        const match = getMatch(socket);
        const player = socket.data.player;
        if (!match || !player) return;

        socket.to(match.id).emit('remoteMuzzleFlash', {
            playerId: player.id,
            position: data.position
        });
    });

    // -------- INVENTORY SYSTEM --------

    socket.on('useItem', async (data: { itemId: string }) => {
        const match = getMatch(socket);
        const player = socket.data.player;
        if (!match || !player) return;

        const itemIndex = player.inventory.findIndex(item => item.id === data.itemId);
        if (itemIndex === -1) {
            socket.emit('serverResponse', { type: 'error', text: 'Item not found' });
            return;
        }

        const item = player.inventory[itemIndex];

        if (item.type === 'vaccine') {
            item.count--;
            if (item.count <= 0) {
                player.inventory.splice(itemIndex, 1);
            }

            player.vaccineActive = true;
            player.vaccineExpiryTime = Date.now() + 60000;

            socket.emit('itemUsed', {
                itemId: data.itemId,
                effect: 'vaccine_activated',
                expiresAt: player.vaccineExpiryTime,
                inventory: player.inventory
            });

            io.to(match.id).emit('playerVaccineActive', {
                playerId: player.id,
                expiresAt: player.vaccineExpiryTime
            });

            const userId = player.id || socket.data.userId;
            if (userId) {
                const syncedInventory = await syncPlayerInventory(player, userId);
                socket.emit('inventoryUpdate', { inventory: syncedInventory });
            } else {
                socket.emit('inventoryUpdate', { inventory: player.inventory });
            }
        }
        else if (item.type === 'ammo' && item.weaponName) {
            player.weaponReserves[item.weaponName] = (player.weaponReserves[item.weaponName] || 0) + 1;

            item.count--;
            if (item.count <= 0) {
                player.inventory.splice(itemIndex, 1);
            }

            socket.emit('itemUsed', {
                itemId: data.itemId,
                effect: 'ammo_added',
                weaponName: item.weaponName,
                reserves: player.weaponReserves[item.weaponName],
                inventory: player.inventory
            });

            const userId = player.id || socket.data.userId;
            if (userId) {
                const syncedInventory = await syncPlayerInventory(player, userId);
                socket.emit('inventoryUpdate', { inventory: syncedInventory });
            } else {
                socket.emit('inventoryUpdate', { inventory: player.inventory });
            }
        }
    });

    socket.on('requestInventory', async () => {
        const player = socket.data.player;
        if (!player) {
            socket.emit('inventoryUpdate', { inventory: [] });
            return;
        }

        // ✅ Always use Civic userId, never socket ID
        const userId = socket.data.userId;

        if (!userId) {
            console.log(`⚠️ requestInventory: No Civic userId yet for ${player.name}`);
            // Return empty but don't error — wallet may not be connected yet
            socket.emit('inventoryUpdate', { inventory: [] });
            return;
        }

        console.log(`📦 requestInventory - userId: ${userId}`);
        const syncedInventory = await syncPlayerInventory(player, userId);
        socket.emit('inventoryUpdate', { inventory: syncedInventory });
    });

    // -------- COMMANDS --------

    socket.readCommand = function (str: string) {
        const cmd = str.split(' ');
        switch (cmd[0]) {
            case '/help':
                socket.helpResponse?.();
                break;
            case '/name':
                socket.changePlayerName?.(cmd[1]);
                break;
            default:
                socket.emit('serverResponse', { type: 'error', text: 'Invalid command' });
        }
    };

    socket.helpResponse = function () {
        socket.emit('serverResponse', { type: 'success', text: 'Use /name <newName>' });
    };

    socket.changePlayerName = function (newName: string) {
        const player = socket.data.player;
        if (!player || !newName) return;
        player.name = newName;
        io.to(socket.data.matchId!).emit('updatePlayerName', player.clientFormat());
    };

    // -------- DISCONNECT --------

    socket.on('disconnect', () => {
        const match = getMatch(socket);
        if (!match) return;
        const player = socket.data.player;
        if (!player) return;

        match.spawnManager.releaseSpawnPoint(player.id);
        match.players.remove(player);
        match.voiceUsers.delete(player.id);
        io.to(match.id).emit('removePlayer', player.clientFormat());
        if (match.players.getAll().length === 0) {
            matchManager.removeMatch(match.id);
        }
        leaderboardManager.removePlayer(socket.id);
    });
});