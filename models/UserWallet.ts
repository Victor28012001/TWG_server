// server/models/UserWallet.ts
import mongoose from 'mongoose';

const userWalletSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    email: { type: String },
    name: { type: String },
    
    managedWallet: {
        publicKey: { type: String, required: true },
        encryptedPrivateKey: { type: String, required: true },
        createdAt: { type: Date, default: Date.now }
    },
    
    civicWalletAddress: { type: String },
    gameBalance: { type: Number, default: 0 },
    blockchainBalance: { type: Number, default: 0 },
    walletSalt: { type: String },
    totalEarned: { type: Number, default: 0 },
    totalSpent: { type: Number, default: 0 },
    
    purchases: {
        type: [{
            itemId: { type: String },
            itemName: { type: String },
            price: { type: Number },
            timestamp: { type: Date, default: Date.now }
        }],
        default: []
    },
    
    // ✅ FIX: Properly define inventory as array of objects
    inventory: {
        type: [{
            itemId: { type: String },
            type: { type: String },
            name: { type: String },
            count: { type: Number },
            weaponName: { type: String },
            data: { type: mongoose.Schema.Types.Mixed }
        }],
        default: []
    },
    
    earnings: {
        type: [{
            amount: { type: Number },
            source: { type: String },
            signature: { type: String },
            timestamp: { type: Date, default: Date.now }
        }],
        default: []
    }
}, {
    timestamps: true
});

export default mongoose.model('UserWallet', userWalletSchema);