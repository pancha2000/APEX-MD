const mongoose = require('mongoose');
const config = require('../config'); // Assuming config.js is in the parent directory
const EnvVar = require('./mongodbenv'); // Assuming mongodbenv.js is in the same directory

const defaultEnvVariables = [
    { key: 'ALIVE_IMG', value: 'https://telegra.ph/file/6d91fd79aab5663032b97.jpg' },
    { key: 'ALIVE_MSG', value: 'Hello , I am alive now!!' },
    { key: 'PREFIX', value: '.' },
    { key: 'MODE', value: 'groups' },
    // Add other essential default variables here if any
];

// MongoDB connection function
const connectDB = async () => {
    if (!config.MONGODB) {
        console.error('MongoDB URL is not defined in config. Please check your MONGODB environment variable.');
        process.exit(1); // Exit if MongoDB URL is missing
    }
    try {
        await mongoose.connect(config.MONGODB); // Removed deprecated options
        console.log('🛜 MongoDB Connected ✅');

        // Check and create default environment variables
        for (const envVar of defaultEnvVariables) {
            try {
                const existingVar = await EnvVar.findOne({ key: envVar.key });
                if (!existingVar) {
                    await EnvVar.create(envVar);
                    console.log(`➕ Created default env var: ${envVar.key} = ${envVar.value}`);
                }
            } catch (dbOpError) {
                // Log error for individual DB operation but don't exit,
                // as connection might be up but one operation failed.
                console.error(`Error processing default env var ${envVar.key}:`, dbOpError.message);
            }
        }

    } catch (err) {
        console.error('MongoDB connection error:', err.message);
        console.error("Bot will not be able to use database-stored settings. Please ensure MongoDB is running and accessible.");
        // Depending on how critical DB settings are, you might choose to exit or continue with hardcoded defaults.
        // For now, allowing the bot to continue, but it will log an error when trying to read settings.
        // process.exit(1); // Uncomment to exit if DB connection is critical for startup
    }
};

module.exports = connectDB;