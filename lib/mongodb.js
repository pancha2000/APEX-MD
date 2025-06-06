// lib/mongodb.js
const mongoose = require('mongoose');
const config = require('../config');
const EnvVar = require('./mongodbenv');

let _botSettings = {
    PREFIX: ".",
    MODE: "public",
    ALIVE_IMG: "https://i.postimg.cc/BbjVss8k/file-00000000d88461f7be4a5cc1864c4be5-1.png",
    ALIVE_MSG: "Hello , I am alive now!!",
};

const defaultEnvVariables = [
    { key: 'ALIVE_IMG', value: 'https://i.postimg.cc/BbjVss8k/file-00000000d88461f7be4a5cc1864c4be5-1.png' },
    { key: 'ALIVE_MSG', value: 'Hello , I am alive now!!' },
    { key: 'PREFIX', value: '.' },
    { key: 'MODE', value: 'public' },
];

const connectDB = async () => {
    if (!config.MONGODB) {
        console.error('MongoDB URL is not defined in config. Please check your MONGODB environment variable.');
        process.exit(1);
    }
    try {
        await mongoose.connect(config.MONGODB);
        console.log('🛜 MongoDB Connected ✅');

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
    }
};

const readEnv = async () => {
    try {
        const envVars = await EnvVar.find({});
        envVars.forEach(doc => {
            _botSettings[doc.key] = doc.value;
        });
    } catch (error) {
        console.error("Error reading environment from DB for _botSettings update:", error.message);
    }
};

const updateEnv = async (key, value) => {
    try {
        const updatedDoc = await EnvVar.findOneAndUpdate(
            { key: key },
            { value: value },
            { upsert: true, new: true }
        );
        _botSettings[key] = updatedDoc.value;
        console.log(`Successfully updated ${key} to ${value} in DB and cache.`);
        return updatedDoc;
    } catch (error) {
        console.error(`Error updating ${key} in DB:`, error.message);
        throw error;
    }
};

const getBotSettings = () => {
    return { ..._botSettings };
};

module.exports = {
    connectDB,
    readEnv,
    updateEnv,
    getBotSettings,
    defaultEnvVariables,
};