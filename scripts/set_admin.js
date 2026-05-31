import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("MongoDB Connected");
    } catch (err) {
        console.error("Connection Error:", err);
        process.exit(1);
    }
};

const makeAdmin = async () => {
    await connectDB();

    const username = 'tunarslnn';

    // Define schema inline to avoid module issues if server.js hasn't been fully refactored
    // We only need the role field basically
    const UserSchema = new mongoose.Schema({}, { strict: false });
    const User = mongoose.models.User || mongoose.model('User', UserSchema);

    try {
        const user = await User.findOne({ username: username });
        
        if (!user) {
            console.log(`User '${username}' not found!`);
            // Try lowercase just in case
            const userLower = await User.findOne({ username: username.toLowerCase() });
            if(userLower) {
                console.log(`Found user '${userLower.username}' (lowercase). Updating...`);
                userLower.role = 'admin';
                await userLower.save();
                console.log(`Successfully promoted '${userLower.username}' to admin.`);
            } else {
                console.log("Could not find user.");
            }
        } else {
            user.role = 'admin';
            await user.save();
            console.log(`Successfully promoted '${user.username}' to admin.`);
        }

    } catch (error) {
        console.error("Error updating user:", error);
    } finally {
        await mongoose.connection.close();
        process.exit();
    }
};

makeAdmin();
