import mongoose, { ConnectOptions } from 'mongoose';

const connectDB = async (): Promise<typeof mongoose> => {
    try {
        const conn = await mongoose.connect(
            process.env.MONGODB_URI || 'mongodb://localhost:27017/winnowing-games'
        );
        console.log(`✅ MongoDB Atlas Connected: ${conn.connection.host}`);
        console.log(`📦 Database: ${conn.connection.name}`);
        
        // Create indexes
        const db = conn.connection.db;
        if (db) {
            await db.collection('users').createIndex({ userId: 1 }, { unique: true });
            await db.collection('users').createIndex({ walletAddress: 1 });
            console.log('✅ Database indexes created');
        }
        
        return conn;
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`❌ MongoDB Connection Error: ${errorMessage}`);
        process.exit(1);
    }
};

export default connectDB;