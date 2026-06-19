import mongoose, { Document, Schema } from 'mongoose';

// ==================== Interfaces ====================

export interface IPurchase {
    itemId: string;
    itemName: string;
    price: number;
    timestamp: Date;
}

export interface IEarning {
    amount: number;
    source: string;
    signature: string;
    timestamp: Date;
}

export interface IInventoryItem {
    itemId: string;
    type: string;
    name: string;
    count: number;
    weaponName: string;
    data: any;
}

export interface IActiveBoost {
    type: string;
    multiplier: number;
    expiresAt: Date;
}

export interface IUser extends Document {
    userId: string;
    walletAddress: string;
    name?: string;
    email?: string;
    gameBalance: number;
    blockchainBalance: number;
    lastBlockchainSync: Date;
    purchases: IPurchase[];
    earnings: IEarning[];
    inventory: IInventoryItem[];
    unlockedWeapons: string[];
    unlockedSkins: string[];
    activeBoosts: IActiveBoost[];
    createdAt: Date;
    updatedAt: Date;
}

// ==================== Schema ====================

const userSchema = new mongoose.Schema<IUser>({
    userId: { type: String, required: true, unique: true },
    walletAddress: { type: String, required: true },
    name: { type: String },
    email: { type: String },
    gameBalance: { type: Number, default: 0 },
    blockchainBalance: { type: Number, default: 0 },
    lastBlockchainSync: { type: Date, default: Date.now },
    
    purchases: [{
        itemId: { type: String },
        itemName: { type: String },
        price: { type: Number },
        timestamp: { type: Date, default: Date.now }
    }],
    
    earnings: [{
        amount: { type: Number },
        source: { type: String },
        signature: { type: String },
        timestamp: { type: Date, default: Date.now }
    }],
    
    inventory: [{
        itemId: { type: String },
        type: { type: String },
        name: { type: String },
        count: { type: Number },
        weaponName: { type: String },
        data: { type: Schema.Types.Mixed }
    }],
    
    unlockedWeapons: [{ type: String }],
    unlockedSkins: [{ type: String }],
    activeBoosts: [{
        type: { type: String },
        multiplier: { type: Number },
        expiresAt: { type: Date }
    }]
}, {
    timestamps: true // ✅ Handles createdAt and updatedAt automatically
});

// ==================== Model ====================

const User = mongoose.model<IUser>('User', userSchema);
export default User;