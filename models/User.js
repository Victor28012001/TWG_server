import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true }, // Civic user ID
    walletAddress: { type: String, required: true },
    name: { type: String },
    email: { type: String },
    
    // GAME BALANCE - This is what the store uses
    gameBalance: { type: Number, default: 0 },
    
    // BLOCKCHAIN BALANCE - Reference only, never modified by purchases
    blockchainBalance: { type: Number, default: 0 },
    
    // Last blockchain sync
    lastBlockchainSync: { type: Date, default: Date.now },
    
    // Purchase history
    purchases: [{
        itemId: String,
        itemName: String,
        price: Number,
        timestamp: { type: Date, default: Date.now }
    }],
    
    // Earnings from kills (minted tokens)
    earnings: [{
        amount: Number,
        source: String, // 'kill', 'daily_reward', etc.
        signature: String, // blockchain transaction signature
        timestamp: { type: Date, default: Date.now }
    }],
    
    // Inventory
    inventory: [{
        itemId: String,
        type: String,
        name: String,
        count: Number,
        weaponName: String,
        data: mongoose.Schema.Types.Mixed
    }],
    
    unlockedWeapons: [String],
    unlockedSkins: [String],
    activeBoosts: [{
        type: { type: String },
        multiplier: Number,
        expiresAt: Date
    }],
    
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// Update timestamp on save
userSchema.pre('save', function(next) {
    this.updatedAt = new Date();
    next();
});

export default mongoose.model('User', userSchema);