// lib/database.js
const mongoose = require('mongoose');
const config = require('../config'); // Assuming config.js is in the parent directory
const EnvVar = require('./mongodbenv'); // Assuming mongodbenv.js is in the same directory and defines the Mongoose model

// Internal variable to hold current bot settings
// These are initial defaults, they will be overwritten by DB values on readEnv
let _botSettings = {
    PREFIX: ".",
    MODE: "public", // Default in index.js and good starting point
    ALIVE_IMG: "https://telegra.ph/file/6d91fd79aab5663032b97.jpg",
    ALIVE_MSG: "Hello , I am alive now!!",
};

// Default environment variables to be created if not found in DB
const defaultEnvVariables = [
    { key: 'ALIVE_IMG', value: 'https://telegra.ph/file/6d91fd79aab5663032b97.jpg' },
    { key: 'ALIVE_MSG', value: 'Hello , I am alive now!!' },
    { key: 'PREFIX', value: '.' },
    { key: 'MODE', value: 'public' }, // Aligning with index.js default to avoid confusion
];

// MongoDB connection function
const connectDB = async () => {
    if (!config.MONGODB) {
        console.error('MongoDB URL is not defined in config. Please check your MONGODB environment variable.');
        process.exit(1); // Exit if MongoDB URL is missing
    }
    try {
        await mongoose.connect(config.MONGODB);
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
                console.error(`Error processing default env var ${envVar.key}:`, dbOpError.message);
            }
        }
    } catch (err) {
        console.error('MongoDB connection error:', err.message);
        console.error("Bot will not be able to use database-stored settings. Please ensure MongoDB is running and accessible.");
        // The bot will continue, but settings might not load from DB if this fails.
    }
};

// Function to read environment settings from DB and populate _botSettings
const readEnv = async () => {
    try {
        const envVars = await EnvVar.find({});
        // Populate _botSettings from DB values
        envVars.forEach(doc => {
            _botSettings[doc.key] = doc.value;
        });
    } catch (error) {
        console.error("Error reading environment from DB for _botSettings update:", error.message);
    }
    // No explicit return here, as getBotSettings will return the current state
};

// Function to update an environment setting in DB and _botSettings
const updateEnv = async (key, value) => {
    try {
        const updatedDoc = await EnvVar.findOneAndUpdate(
            { key: key },
            { value: value },
            { upsert: true, new: true } // Create if not exists, return new document
        );
        _botSettings[key] = updatedDoc.value; // Update internal cache
        console.log(`Successfully updated ${key} to ${value} in DB and cache.`);
        return updatedDoc;
    } catch (error) {
        console.error(`Error updating ${key} in DB:`, error.message);
        throw error;
    }
};

// Function to get current bot settings (returns a copy to prevent external modification)
const getBotSettings = () => {
    return { ..._botSettings };
};

module.exports = {
    connectDB,
    readEnv,
    updateEnv,
    getBotSettings,
};