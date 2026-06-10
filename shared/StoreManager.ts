// server/shared/StoreManager.ts

export interface StoreItem {
    id: string;
    name: string;
    category: 'weapon' | 'consumable' | 'cosmetic' | 'boost';
    description: string;
    price: number; // in $JBKS
    icon: string;
    itemData: any; // Weapon config, skin data, etc.
    limitedStock?: number;
    soldCount?: number;
    discount?: number;
}

export default class StoreManager {
    private items: Map<string, StoreItem> = new Map();
    private rotatingItems: StoreItem[] = [];
    private lastRotation: number = Date.now();
    private rotationInterval: number = 24 * 60 * 60 * 1000; // 24 hours
    private pendingTransactions: Map<string, { itemId: string; quantity: number; timestamp: number }> = new Map();

    constructor() {
        this.initStore();
        this.startRotationTimer();
    }

    private initStore() {
        // Weapons
        const weapons = [
            { id: 'store_mp5', name: 'MP5', price: 50, category: 'weapon' as const, description: 'Reliable SMG with good accuracy' },
            { id: 'store_ak47', name: 'AK47', price: 80, category: 'weapon' as const, description: 'High damage assault rifle' },
            { id: 'store_m16', name: 'M16', price: 75, category: 'weapon' as const, description: 'Precision burst rifle' },
            { id: 'store_dragunov', name: 'Dragunov', price: 120, category: 'weapon' as const, description: 'Powerful sniper rifle' },
            { id: 'store_shotgun', name: 'Shotgun', price: 60, category: 'weapon' as const, description: 'Close-range devastation' },
            { id: 'store_desert_eagle', name: 'Desert Eagle', price: 40, category: 'weapon' as const, description: 'High-caliber pistol' },
            { id: 'store_glock', name: 'Glock', price: 20, category: 'weapon' as const, description: 'Reliable sidearm' },
            { id: 'store_kriss_vector', name: 'Kriss Vector', price: 90, category: 'weapon' as const, description: 'High fire rate SMG' },
        ];

        weapons.forEach(weapon => {
            this.items.set(weapon.id, {
                ...weapon,
                icon: `/assets/ui/weapons/${weapon.id.replace('store_', '')}.jpg`,
                itemData: { weaponName: weapon.name }
            });
        });

        // Consumables
        const consumables = [
            { id: 'grenade', name: 'Grenade Pack', price: 15, category: 'consumable' as const, description: '3 grenades', itemData: { type: 'grenade', amount: 3 } },
            { id: 'ammo', name: 'Ammo Pack', price: 10, category: 'consumable' as const, description: 'Full ammo refill', itemData: { type: 'ammo', amount: 'full' } },
            { id: 'health_pack', name: 'Health Pack', price: 15, category: 'consumable' as const, description: 'Restore 50 HP', itemData: { type: 'health', amount: 50 } },
            { id: 'vaccine', name: 'Vaccine', price: 20, category: 'consumable' as const, description: '60s damage protection', itemData: { type: 'vaccine', duration: 60 } },
        ];

        consumables.forEach(consumable => {
            this.items.set(consumable.id, {
                ...consumable,
                icon: `/assets/ui/store/${consumable.id}.jpeg`,
                itemData: consumable.itemData
            });
        });

        // Cosmetics (skins)
        const cosmetics = [
            { id: 'red_skin', name: 'Red Camo', price: 300, category: 'cosmetic' as const, description: 'Red weapon skin', itemData: { type: 'skin', color: '#ff0000', weaponSkin: true } },
            { id: 'blue_skin', name: 'Blue Camo', price: 300, category: 'cosmetic' as const, description: 'Blue weapon skin', itemData: { type: 'skin', color: '#0044ff', weaponSkin: true } },
            { id: 'gold_skin', name: 'Gold Camo', price: 1000, category: 'cosmetic' as const, description: 'Legendary gold skin', itemData: { type: 'skin', color: '#ffd700', weaponSkin: true } },
        ];

        cosmetics.forEach(cosmetic => {
            this.items.set(cosmetic.id, {
                ...cosmetic,
                icon: `/assets/ui/store/${cosmetic.id}.jpeg`,
                itemData: cosmetic.itemData
            });
        });

        // Boosts
        const boosts = [
            { id: 'xp_boost', name: 'XP Boost', price: 250, category: 'boost' as const, description: '2x XP for 30 minutes', itemData: { type: 'xp_boost', multiplier: 2, duration: 1800 } },
            { id: 'tokens', name: 'Token Boost', price: 300, category: 'boost' as const, description: '2x $JBKS for 30 minutes', itemData: { type: 'token_boost', multiplier: 2, duration: 1800 } },
        ];

        boosts.forEach(boost => {
            this.items.set(boost.id, {
                ...boost,
                icon: `/assets/ui/store/${boost.id}.jpeg`,
                itemData: boost.itemData
            });
        });

        // Set rotating items (daily deals)
        this.refreshRotatingItems();
    }

    private refreshRotatingItems() {
        const allItems = Array.from(this.items.values());
        const shuffled = [...allItems].sort(() => 0.5 - Math.random());
        this.rotatingItems = shuffled.slice(0, 5); // 5 daily deals

        // Apply discounts
        this.rotatingItems.forEach(item => {
            item.discount = Math.floor(Math.random() * 30) + 10; // 10-40% off
        });
    }

    private startRotationTimer() {
        setInterval(() => {
            this.refreshRotatingItems();
            this.lastRotation = Date.now();

            // Broadcast to all players that store has refreshed
            // (You'll need to add a broadcast function)
            if (this.broadcastFunction) {
                this.broadcastFunction('storeRefreshed', {
                    rotatingItems: this.getRotatingItems(),
                    nextRefresh: this.getNextRefreshTime()
                });
            }
        }, this.rotationInterval);
    }

    getItem(itemId: string): StoreItem | undefined {
        return this.items.get(itemId);
    }

    getAllItems(): StoreItem[] {
        return Array.from(this.items.values());
    }

    getItemsByCategory(category: string): StoreItem[] {
        return Array.from(this.items.values()).filter(item => item.category === category);
    }

    getRotatingItems(): StoreItem[] {
        return this.rotatingItems;
    }

    getNextRefreshTime(): number {
        return this.lastRotation + this.rotationInterval;
    }

    purchaseItem(player: any, itemId: string, quantity: number = 1): { success: boolean; message: string; item?: StoreItem } {
        const item = this.getItem(itemId);

        if (!item) {
            return { success: false, message: 'Item not found' };
        }

        // Check if limited stock available
        if (item.limitedStock !== undefined && item.soldCount !== undefined) {
            if (item.soldCount + quantity > item.limitedStock) {
                return { success: false, message: 'Item out of stock' };
            }
        }

        // Calculate price with discount
        const finalPrice = item.discount
            ? Math.floor(item.price * (1 - item.discount / 100))
            : item.price;

        const totalCost = finalPrice * quantity;

        // Check if player has enough tokens (you'll need to integrate with SolanaService)
        if (player.tokenBalance < totalCost) {
            return { success: false, message: `Insufficient funds. Need ${totalCost} $JBKS` };
        }

        // Deduct tokens (implement token transfer)
        player.tokenBalance -= totalCost;

        // Update sold count
        if (item.limitedStock !== undefined && item.soldCount !== undefined) {
            item.soldCount += quantity;
        }

        return { success: true, message: `Purchased ${item.name} x${quantity}`, item };
    }

    // Add method to record pending transaction
    recordPendingTransaction(signature: string, itemId: string, quantity: number) {
        this.pendingTransactions.set(signature, {
            itemId,
            quantity,
            timestamp: Date.now()
        });

        // Clean up old pending transactions after 10 minutes
        setTimeout(() => {
            this.pendingTransactions.delete(signature);
        }, 10 * 60 * 1000);
    }

    // Add method to complete pending transaction
    completePendingTransaction(signature: string): { itemId: string; quantity: number } | null {
        const pending = this.pendingTransactions.get(signature);
        if (pending) {
            this.pendingTransactions.delete(signature);
            return pending;
        }
        return null;
    }

    setBroadcastFunction(fn: (event: string, data: any) => void) {
        this.broadcastFunction = fn;
    }

    private broadcastFunction: ((event: string, data: any) => void) | null = null;
}