// // server/services/balanceService.ts
// import UserWallet from '../models/UserWallet.js';
// import walletService from './walletService.js';

// class BalanceService {

//     // Get or create user with managed wallet
//     async getOrCreateUser(userId: string, email: string = '', name: string = '') {
//         let userWallet = await UserWallet.findOne({ userId });

//         if (!userWallet) {
//             // Create managed wallet for this user
//             const { publicKey, keypair } = await walletService.createManagedWallet(
//                 userId,
//                 email,
//                 name
//             );

//             // Initial airdrop of JBKS tokens (100 for new users)
//             await walletService.mintTokensToUser(userId, 100);

//             userWallet = await UserWallet.findOne({ userId });
//             console.log(`✅ Created new user ${userId} with wallet ${publicKey}`);
//         }

//         return userWallet;
//     }

//     // Get game balance
//     async getGameBalance(userId: string): Promise<number> {
//         const balance = await walletService.getUserBalance(userId);
//         return balance.gameBalance;
//     }

//     // Purchase item using game balance
//     async purchaseItem(userId: string, itemId: string, itemName: string, price: number) {
//         // Deduct tokens using wallet service
//         const result = await walletService.deductTokens(userId, price);

//         if (!result.success) {
//             return result;
//         }

//         // Record purchase in database
//         await UserWallet.updateOne(
//             { userId },
//             {
//                 $push: {
//                     purchases: {
//                         itemId,
//                         itemName,
//                         price,
//                         timestamp: new Date()
//                     }
//                 }
//             }
//         );

//         return {
//             success: true,
//             message: `Purchased ${itemName}!`,
//             newBalance: result.newBalance,
//             blockchainBalance: result.newBalance
//         };
//     }

//     // ✅ FIX: Properly add item to inventory
//     async addToInventory(userId: string, item: any) {
//         try {
//             // Check if item already exists in inventory
//             const userWallet = await UserWallet.findOne({ userId });
//             if (!userWallet) {
//                 console.error(`User ${userId} not found`);
//                 return false;
//             }

//             // For consumables, check if we should stack
//             if (item.category === 'consumable') {
//                 const existingItem = userWallet.inventory.find(
//                     (invItem: any) => invItem.itemId === item.id
//                 );

//                 if (existingItem) {
//                     // Stack the item
//                     existingItem.count += (item.itemData?.amount || 1);
//                     await userWallet.save();
//                     console.log(`✅ Stacked item ${item.name} for user ${userId}, new count: ${existingItem.count}`);
//                     return true;
//                 }
//             }

//             // Add new item to inventory
//             const inventoryItem = {
//                 itemId: item.id,
//                 type: item.category,
//                 name: item.name,
//                 count: item.itemData?.amount || 1,
//                 weaponName: item.itemData?.weaponName || '',
//                 data: item.itemData || {}
//             };

//             await UserWallet.updateOne(
//                 { userId },
//                 {
//                     $push: {
//                         inventory: inventoryItem
//                     }
//                 }
//             );

//             console.log(`✅ Added ${item.name} to inventory for user ${userId}`);
//             return true;
//         } catch (error) {
//             console.error('Failed to add item to inventory:', error);
//             return false;
//         }
//     }

//     // Record earning (from kills, daily rewards)
//     async recordEarning(userId: string, amount: number, source: string, signature: string = '') {
//         const result = await walletService.mintTokensToUser(userId, amount);

//         if (result.success) {
//             await UserWallet.updateOne(
//                 { userId },
//                 {
//                     $push: {
//                         earnings: {
//                             amount,
//                             source,
//                             signature,
//                             timestamp: new Date()
//                         }
//                     }
//                 }
//             );
//         }

//         return result;
//     }

//     // Get user's inventory
//     async getInventory(userId: string) {
//         const userWallet = await UserWallet.findOne({ userId });
//         if (!userWallet) return [];
//         return userWallet.inventory;
//     }
// }

// export default new BalanceService();

// server/services/balanceService.ts
import UserWallet from '../models/UserWallet';
import walletService from './walletService';

class BalanceService {

    // Get or create user with managed wallet
    async getOrCreateUser(userId: string, email: string = '', name: string = '') {
        let userWallet = await UserWallet.findOne({ userId });

        if (!userWallet) {
            // Create managed wallet for this user
            const { publicKey, keypair } = await walletService.createManagedWallet(
                userId,
                email,
                name
            );

            // Initial airdrop of JBKS tokens (100 for new users)
            await walletService.mintTokensToUser(userId, 100);

            userWallet = await UserWallet.findOne({ userId });
            console.log(`✅ Created new user ${userId} with wallet ${publicKey}`);
        }

        return userWallet;
    }

    // Get game balance
    async getGameBalance(userId: string): Promise<number> {
        const balance = await walletService.getUserBalance(userId);
        return balance.gameBalance;
    }

    // Purchase item using game balance
    async purchaseItem(userId: string, itemId: string, itemName: string, price: number): Promise<{
        success: boolean;
        message: string;
        newBalance: number;
        blockchainBalance: number;
    }> {
        // Deduct tokens using wallet service
        const result = await walletService.deductTokens(userId, price);

        if (!result.success) {
            return {
                success: false,
                message: result.message || 'Transaction failed',
                newBalance: 0,
                blockchainBalance: 0
            };
        }

        // Record purchase in database
        await UserWallet.updateOne(
            { userId },
            {
                $push: {
                    purchases: {
                        itemId,
                        itemName,
                        price,
                        timestamp: new Date()
                    }
                }
            }
        );

        // Get current blockchain balance
        const currentBalance = await walletService.getUserBalance(userId);

        return {
            success: true,
            message: `Purchased ${itemName}!`,
            newBalance: result.newBalance || 0,
            blockchainBalance: currentBalance.blockchainBalance || 0
        };
    }

    // ✅ FIXED: Add item to inventory with better structure handling
    async addToInventory(userId: string, item: any) {
        try {
            // Get the user's wallet
            const userWallet = await UserWallet.findOne({ userId });
            if (!userWallet) {
                console.error(`User ${userId} not found`);
                return false;
            }

            console.log(`📦 Adding to inventory:`, JSON.stringify(item, null, 2));

            // Normalize the item structure
            const inventoryItem = {
                itemId: item.id || item.itemId,
                type: item.category || item.type || 'consumable',
                name: item.name || 'Unknown Item',
                count: item.itemData?.amount || item.quantity || 1,
                weaponName: item.itemData?.weaponName || '',
                data: item.itemData || item.data || {}
            };

            // Check if item already exists in inventory (for stacking)
            const existingIndex = userWallet.inventory.findIndex(
                (invItem: any) => invItem.itemId === inventoryItem.itemId && invItem.type === inventoryItem.type
            );

            if (existingIndex !== -1 && inventoryItem.type === 'consumable') {
                // Stack the item
                userWallet.inventory[existingIndex].count += inventoryItem.count;
                await userWallet.save();
                console.log(`✅ Stacked ${inventoryItem.name} x${inventoryItem.count} for user ${userId}`);
                return true;
            }

            // Add new item to inventory
            await UserWallet.updateOne(
                { userId },
                {
                    $push: {
                        inventory: inventoryItem
                    }
                }
            );

            console.log(`✅ Added ${inventoryItem.name} x${inventoryItem.count} to inventory for user ${userId}`);
            return true;
        } catch (error) {
            console.error('Failed to add item to inventory:', error);
            return false;
        }
    }

    // Record earning (from kills, daily rewards)
    async recordEarning(userId: string, amount: number, source: string, signature: string = '') {
        const result = await walletService.mintTokensToUser(userId, amount);

        if (result.success) {
            await UserWallet.updateOne(
                { userId },
                {
                    $push: {
                        earnings: {
                            amount,
                            source,
                            signature,
                            timestamp: new Date()
                        }
                    }
                }
            );
        }

        return result;
    }

    // Get user's inventory
    async getInventory(userId: string) {
        const userWallet = await UserWallet.findOne({ userId });
        if (!userWallet) return [];
        return userWallet.inventory;
    }
}

export default new BalanceService();