// server/services/walletService.ts
import { Keypair, PublicKey, Connection, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { getOrCreateAssociatedTokenAccount, createMintToInstruction } from '@solana/spl-token';
import { Transaction } from '@solana/web3.js';
import crypto from 'crypto';
import UserWallet from '../models/UserWallet';
import dotenv from 'dotenv';
dotenv.config();

const SOLANA_RPC = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
const TOKEN_MINT = new PublicKey(process.env.TOKEN_MINT_ADDRESS || "FPSapuTED3YTN69KLwrLtPAkXE1cxXne1i8G2iGz653G");

// Generate a consistent encryption key from environment or create one
const ENCRYPTION_KEY = process.env.WALLET_ENCRYPTION_KEY 
    ? Buffer.from(process.env.WALLET_ENCRYPTION_KEY, 'hex')
    : crypto.randomBytes(32);

// Store the key in memory (in production, use a secure key management service)
// Make sure ENCRYPTION_KEY is 32 bytes for AES-256
const KEY = ENCRYPTION_KEY.length === 32 ? ENCRYPTION_KEY : crypto.createHash('sha256').update(ENCRYPTION_KEY).digest();

class WalletService {
    private connection: Connection;
    private gameKeypair: Keypair;

    constructor() {
        this.connection = new Connection(SOLANA_RPC, "confirmed");
        
        // Load game wallet from env
        const privateKeyBytes = Buffer.from(process.env.GAME_WALLET_PRIVATE_KEY!, 'base64');
        this.gameKeypair = Keypair.fromSecretKey(privateKeyBytes);
        console.log(`✅ WalletService initialized with game wallet: ${this.gameKeypair.publicKey.toString()}`);
    }

    // Encrypt private key before storing
    encryptPrivateKey(privateKey: Uint8Array): string {
        try {
            // Generate a random initialization vector
            const iv = crypto.randomBytes(16);
            
            // Create cipher with AES-256-GCM
            const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv);
            
            // Encrypt the data
            const encrypted = Buffer.concat([
                cipher.update(privateKey),
                cipher.final()
            ]);
            
            // Get the authentication tag
            const authTag = cipher.getAuthTag();
            
            // Combine IV, auth tag, and encrypted data
            const result = {
                iv: iv.toString('base64'),
                authTag: authTag.toString('base64'),
                encrypted: encrypted.toString('base64')
            };
            
            return JSON.stringify(result);
        } catch (error) {
            console.error('Encryption error:', error);
            throw new Error('Failed to encrypt private key');
        }
    }

    // Decrypt private key when needed
    decryptPrivateKey(encryptedData: string): Uint8Array {
        try {
            // Parse the encrypted data
            const { iv, authTag, encrypted } = JSON.parse(encryptedData);
            
            // Create decipher with AES-256-GCM
            const decipher = crypto.createDecipheriv(
                'aes-256-gcm',
                KEY,
                Buffer.from(iv, 'base64')
            );
            
            // Set the authentication tag
            decipher.setAuthTag(Buffer.from(authTag, 'base64'));
            
            // Decrypt the data
            const decrypted = Buffer.concat([
                decipher.update(Buffer.from(encrypted, 'base64')),
                decipher.final()
            ]);
            
            return new Uint8Array(decrypted);
        } catch (error) {
            console.error('Decryption error:', error);
            throw new Error('Failed to decrypt private key - data may be corrupted or encryption key changed');
        }
    }

    // Generate a new managed wallet for a user
    async createManagedWallet(userId: string, email: string, name: string): Promise<{ publicKey: string; keypair: Keypair }> {
        // Check if wallet already exists
        const existing = await UserWallet.findOne({ userId });
        if (existing) {
            try {
                const keypair = Keypair.fromSecretKey(this.decryptPrivateKey(existing.managedWallet.encryptedPrivateKey));
                return { publicKey: existing.managedWallet.publicKey, keypair };
            } catch (error) {
                console.error(`Failed to decrypt existing wallet for ${userId}, creating new one...`, error);
                // If decryption fails, we'll create a new wallet
                await UserWallet.deleteOne({ userId });
            }
        }

        // Generate new Solana keypair
        const keypair = Keypair.generate();
        const publicKey = keypair.publicKey.toString();
        
        // Encrypt private key for storage
        const encryptedPrivateKey = this.encryptPrivateKey(keypair.secretKey);
        
        // Save to database
        const userWallet = new UserWallet({
            userId,
            email,
            name,
            managedWallet: {
                publicKey,
                encryptedPrivateKey,
                createdAt: new Date()
            },
            gameBalance: 0,
            blockchainBalance: 0,
            totalEarned: 0,
            totalSpent: 0
        });
        
        await userWallet.save();
        
        console.log(`✅ Created managed wallet for ${userId}: ${publicKey}`);
        
        // Airdrop initial SOL for transaction fees (devnet)
        await this.airdropSol(publicKey);
        
        return { publicKey, keypair };
    }

    // Airdrop SOL for gas fees (devnet only)
    async airdropSol(walletAddress: string, amount: number = 0.1): Promise<boolean> {
        try {
            const pubkey = new PublicKey(walletAddress);
            const signature = await this.connection.requestAirdrop(
                pubkey,
                amount * LAMPORTS_PER_SOL
            );
            await this.connection.confirmTransaction(signature);
            console.log(`✅ Airdropped ${amount} SOL to ${walletAddress}`);
            return true;
        } catch (error) {
            console.error(`❌ Failed to airdrop SOL:`, error);
            return false;
        }
    }

    // Get user's managed wallet
    async getUserWallet(userId: string): Promise<{ publicKey: string; keypair: Keypair } | null> {
        const userWallet = await UserWallet.findOne({ userId });
        if (!userWallet) return null;
        
        try {
            const keypair = Keypair.fromSecretKey(this.decryptPrivateKey(userWallet.managedWallet.encryptedPrivateKey));
            return {
                publicKey: userWallet.managedWallet.publicKey,
                keypair
            };
        } catch (error) {
            console.error(`Failed to decrypt wallet for ${userId}:`, error);
            return null;
        }
    }

    // Mint JBKS tokens to user's managed wallet
    async mintTokensToUser(userId: string, amount: number): Promise<{ success: boolean; signature?: string; balance?: number }> {
        try {
            const userWallet = await this.getUserWallet(userId);
            if (!userWallet) {
                // Try to create a new wallet if it doesn't exist
                console.log(`No wallet found for ${userId}, creating one...`);
                await this.createManagedWallet(userId, '', '');
                const newWallet = await this.getUserWallet(userId);
                if (!newWallet) {
                    throw new Error('Failed to create user wallet');
                }
                return this.mintTokensToUser(userId, amount);
            }
            
            const userPubkey = new PublicKey(userWallet.publicKey);
            
            // Get or create associated token account
            const userTokenAccount = await getOrCreateAssociatedTokenAccount(
                this.connection,
                this.gameKeypair,
                TOKEN_MINT,
                userPubkey
            );
            
            // Create mint instruction
            const mintToIx = createMintToInstruction(
                TOKEN_MINT,
                userTokenAccount.address,
                this.gameKeypair.publicKey,
                amount * (10 ** 9), // 9 decimals
                []
            );
            
            const transaction = new Transaction().add(mintToIx);
            transaction.feePayer = this.gameKeypair.publicKey;
            
            const signature = await this.connection.sendTransaction(transaction, [this.gameKeypair]);
            await this.connection.confirmTransaction(signature, 'confirmed');
            
            // Update user's balance in DB
            await UserWallet.updateOne(
                { userId },
                { 
                    $inc: { 
                        gameBalance: amount,
                        blockchainBalance: amount,
                        totalEarned: amount
                    },
                    $set: { updatedAt: new Date() }
                }
            );
            
            console.log(`✅ Minted ${amount} JBKS to ${userId} (${userWallet.publicKey})`);
            
            const balance = await this.getUserBalance(userId);
            return {
                success: true,
                signature,
                balance: balance.gameBalance
            };
        } catch (error) {
            console.error('Failed to mint tokens:', error);
            return { success: false };
        }
    }

    // Deduct tokens from user's managed wallet (for purchases)
    async deductTokens(userId: string, amount: number): Promise<{ success: boolean; newBalance?: number; message?: string }> {
        try {
            const userWallet = await UserWallet.findOne({ userId });
            if (!userWallet) {
                return { success: false, message: 'User wallet not found' };
            }
            
            if (userWallet.gameBalance < amount) {
                return { success: false, message: `Insufficient balance. Need ${amount}, have ${userWallet.gameBalance}` };
            }
            
            // Update balance in DB only (no blockchain transaction for purchases)
            await UserWallet.updateOne(
                { userId },
                { 
                    $inc: { 
                        gameBalance: -amount,
                        totalSpent: amount
                    },
                    $set: { updatedAt: new Date() }
                }
            );
            
            const newBalance = userWallet.gameBalance - amount;
            console.log(`✅ Deducted ${amount} JBKS from ${userId}. New balance: ${newBalance}`);
            
            return {
                success: true,
                newBalance
            };
        } catch (error) {
            console.error('Failed to deduct tokens:', error);
            return { success: false, message: 'Transaction failed' };
        }
    }

    // Get user's balance (both game and blockchain)
    async getUserBalance(userId: string): Promise<{ gameBalance: number; blockchainBalance: number }> {
        const userWallet = await UserWallet.findOne({ userId });
        if (!userWallet) {
            return { gameBalance: 0, blockchainBalance: 0 };
        }
        
        // Sync blockchain balance if needed (every 5 minutes)
        if (Date.now() - userWallet.updatedAt.getTime() > 5 * 60 * 1000) {
            await this.syncBlockchainBalance(userId);
        }
        
        return {
            gameBalance: userWallet.gameBalance,
            blockchainBalance: userWallet.blockchainBalance
        };
    }

    // Sync actual on-chain balance
    async syncBlockchainBalance(userId: string): Promise<number> {
        try {
            const userWallet = await UserWallet.findOne({ userId });
            if (!userWallet) return 0;
            
            const pubkey = new PublicKey(userWallet.managedWallet.publicKey);
            const tokenAccounts = await this.connection.getParsedTokenAccountsByOwner(
                pubkey,
                { mint: TOKEN_MINT }
            );
            
            const blockchainBalance = tokenAccounts.value.length > 0 
                ? tokenAccounts.value[0].account.data.parsed.info.tokenAmount.uiAmount || 0
                : 0;
            
            await UserWallet.updateOne(
                { userId },
                { 
                    $set: { 
                        blockchainBalance,
                        updatedAt: new Date()
                    }
                }
            );
            
            return blockchainBalance;
        } catch (error) {
            console.error('Failed to sync blockchain balance:', error);
            return 0;
        }
    }

    // Transfer tokens between users (for future features like trading)
    async transferTokens(fromUserId: string, toUserId: string, amount: number): Promise<boolean> {
        // Deduct from sender
        const deductResult = await this.deductTokens(fromUserId, amount);
        if (!deductResult.success) return false;
        
        // Add to receiver
        await UserWallet.updateOne(
            { userId: toUserId },
            { 
                $inc: { 
                    gameBalance: amount,
                    totalEarned: amount
                }
            }
        );
        
        return true;
    }
}

export default new WalletService();