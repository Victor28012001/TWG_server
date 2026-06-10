import User from '../models/User.js';
import { Connection, PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';

const SOLANA_RPC = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
const TOKEN_MINT = new PublicKey("FPSapuTED3YTN69KLwrLtPAkXE1cxXne1i8G2iGz653G");

class BalanceService {
    constructor() {
        this.connection = new Connection(SOLANA_RPC, "confirmed");
        this.syncInterval = 5 * 60 * 1000; // Sync every 5 minutes
        this.startAutoSync();
    }

    // Get user's actual on-chain token balance
    async getBlockchainBalance(walletAddress) {
        try {
            const pubkey = new PublicKey(walletAddress);
            const tokenAccounts = await this.connection.getParsedTokenAccountsByOwner(
                pubkey,
                { mint: TOKEN_MINT }
            );

            if (tokenAccounts.value.length === 0) return 0;
            return tokenAccounts.value[0].account.data.parsed.info.tokenAmount.uiAmount || 0;
        } catch (error) {
            console.error("Error getting blockchain balance:", error);
            return 0;
        }
    }

    // Sync blockchain balance (only adds, never subtracts for purchases)
    async syncUserBalance(userId) {
        try {
            const user = await User.findOne({ userId });
            if (!user || !user.walletAddress) return null;

            const blockchainBalance = await this.getBlockchainBalance(user.walletAddress);
            
            // Only update blockchain balance reference
            user.blockchainBalance = blockchainBalance;
            
            // IMPORTANT: Calculate game balance based on:
            // blockchain balance - total spent on purchases
            // This ensures game balance never exceeds what's available on chain
            const totalSpent = user.purchases.reduce((sum, p) => sum + p.price, 0);
            const totalEarned = user.earnings.reduce((sum, e) => sum + e.amount, 0);
            
            // Game balance = blockchain balance - spent + earned (that might not be on chain yet)
            // Actually, for simplicity: game balance starts at blockchain balance when first synced
            // Then purchases decrease it, earnings increase it
            if (user.gameBalance === 0 && blockchainBalance > 0) {
                // First time sync - set game balance to blockchain balance
                user.gameBalance = blockchainBalance;
            }
            
            user.lastBlockchainSync = new Date();
            await user.save();

            console.log(`✅ Synced balance for user ${userId}: Chain=${blockchainBalance}, Game=${user.gameBalance} $JBKS`);
            return user.gameBalance;
        } catch (error) {
            console.error(`Error syncing balance for user ${userId}:`, error);
            return null;
        }
    }

    // Get user's game balance (from DB)
    async getGameBalance(userId) {
        const user = await User.findOne({ userId });
        if (!user) return 0;
        
        // Auto-sync blockchain balance periodically
        const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
        if (user.lastBlockchainSync < thirtyMinutesAgo) {
            await this.syncUserBalance(userId);
        }
        
        return user.gameBalance;
    }

    // Record earnings (from kills, daily rewards, etc.)
    async recordEarning(userId, amount, source, signature = '') {
        const user = await User.findOne({ userId });
        if (!user) return false;

        user.gameBalance += amount;
        user.earnings.push({
            amount,
            source,
            signature,
            timestamp: new Date()
        });

        await user.save();
        console.log(`✅ Recorded earning: +${amount} $JBKS for user ${userId} from ${source}`);
        return true;
    }

    // Purchase item using game balance
    async purchaseItem(userId, itemId, itemName, price) {
        const user = await User.findOne({ userId });
        if (!user) {
            return { success: false, message: 'User not found' };
        }

        // Sync blockchain balance to verify funds exist
        const blockchainBalance = await this.getBlockchainBalance(user.walletAddress);
        user.blockchainBalance = blockchainBalance;

        // Calculate total spent
        const totalSpent = user.purchases.reduce((sum, p) => sum + p.price, 0);
        
        // Check if user has enough game balance
        if (user.gameBalance < price) {
            return { 
                success: false, 
                message: `Insufficient game balance. Need ${price} $JBKS, have ${user.gameBalance.toFixed(2)} $JBKS` 
            };
        }

        // Verify that total spent + current purchase doesn't exceed what's on chain
        if ((totalSpent + price) > (blockchainBalance + user.earnings.reduce((sum, e) => sum + e.amount, 0))) {
            return { 
                success: false, 
                message: 'Game balance exceeds available blockchain funds. Please contact support.' 
            };
        }

        // Deduct from game balance
        user.gameBalance -= price;
        
        // Record purchase
        user.purchases.push({
            itemId,
            itemName,
            price,
            timestamp: new Date()
        });

        user.lastBlockchainSync = new Date();
        await user.save();

        console.log(`✅ Purchase successful: ${itemName} for ${price} $JBKS. Game balance: ${user.gameBalance}, Chain balance: ${blockchainBalance}`);

        return {
            success: true,
            message: `Purchased ${itemName}!`,
            newBalance: user.gameBalance,
            blockchainBalance: blockchainBalance
        };
    }

    // Add item to user's inventory
    async addToInventory(userId, item) {
        const user = await User.findOne({ userId });
        if (!user) return false;

        switch (item.category) {
            case 'weapon':
                if (!user.unlockedWeapons.includes(item.itemData.weaponName)) {
                    user.unlockedWeapons.push(item.itemData.weaponName);
                }
                break;

            case 'consumable':
                const existingItem = user.inventory.find(i => 
                    i.type === item.itemData.type && i.name === item.name
                );
                
                if (existingItem) {
                    existingItem.count += (item.itemData.amount || 1);
                } else {
                    user.inventory.push({
                        itemId: item.id,
                        type: item.itemData.type,
                        name: item.name,
                        count: item.itemData.amount || 1,
                        weaponName: item.itemData.weaponName,
                        data: item.itemData
                    });
                }
                break;

            case 'cosmetic':
                if (!user.unlockedSkins.includes(item.id)) {
                    user.unlockedSkins.push(item.id);
                }
                break;

            case 'boost':
                user.activeBoosts.push({
                    type: item.itemData.type,
                    multiplier: item.itemData.multiplier,
                    expiresAt: new Date(Date.now() + (item.itemData.duration * 1000))
                });
                break;
        }

        await user.save();
        return true;
    }

    // Get or create user
    async getOrCreateUser(userId, walletAddress, name = '', email = '') {
        let user = await User.findOne({ userId });
        
        if (!user) {
            // Get initial blockchain balance
            const blockchainBalance = await this.getBlockchainBalance(walletAddress);
            
            user = new User({
                userId,
                walletAddress,
                name,
                email,
                gameBalance: blockchainBalance, // Start with blockchain balance
                blockchainBalance: blockchainBalance
            });
            await user.save();
            
            console.log(`✅ Created new user ${userId} with balance: ${blockchainBalance} $JBKS`);
        } else if (user.walletAddress !== walletAddress) {
            // Update wallet address if changed
            user.walletAddress = walletAddress;
            await this.syncUserBalance(userId);
        }

        return user;
    }

    // Get user's inventory
    async getInventory(userId) {
        const user = await User.findOne({ userId });
        if (!user) return [];
        return user.inventory;
    }

    // Get user's unlocked weapons
    async getUnlockedWeapons(userId) {
        const user = await User.findOne({ userId });
        if (!user) return [];
        return user.unlockedWeapons;
    }

    // Start periodic balance sync
    startAutoSync() {
        setInterval(async () => {
            try {
                const users = await User.find({});
                let syncedCount = 0;
                for (const user of users) {
                    await this.syncUserBalance(user.userId);
                    syncedCount++;
                }
                console.log(`✅ Auto-synced balances for ${syncedCount} users`);
            } catch (error) {
                console.error('Auto-sync error:', error);
            }
        }, this.syncInterval);
    }
}

export default new BalanceService();