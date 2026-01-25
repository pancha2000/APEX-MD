const mongoose = require('mongoose');
const config = require('../config');
// schema.js ෆයිල් එක තියෙන්නේ lib ෆෝල්ඩර් එකේම නම්:
const EnvVar = require('./schema'); 

// Default settings (Database එක වැඩ නැති වුනොත් මේවා ගන්නවා)
const defaultEnv = {
    PREFIX: '.',
    MODE: 'public',
    ALIVE_IMG: 'https://i.postimg.cc/BbjVss8k/file-00000000d88461f7be4a5cc1864c4be5-1.png',
    ALIVE_MSG: 'Hello , I am alive now!!',
    AUTO_READ_STATUS: 'false',
};

// Internal settings object
let _botSettings = { ...defaultEnv };

// 1. Database සම්බන්ධ කිරීමේ Function එක
const connectDB = async () => {
    try {
        // මෙතන dbName එක දීම මගින් 'Invalid namespace' දෝෂය විසඳේ
        await mongoose.connect(config.MONGODB, {
            dbName: 'apex_md_db', // <--- Database නම මෙතනින් දුන්නා
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('🛜 MongoDB Connected ✅');
    } catch (err) {
        console.error('MongoDB connection error:', err);
        // Connection error එකක් ආවත් බොට් නවතින්නේ නැතුව Default settings වලින් දුවන්න ඉඩ දීම
        console.log('Using default settings due to DB error.');
    }
};

// 2. Database එකෙන් Settings කියවීම
const readEnv = async () => {
    try {
        // Connection එක නැත්නම් හදාගන්නවා
        if (mongoose.connection.readyState !== 1) {
            await connectDB();
        }
        
        // දත්ත කියවීම
        const envVars = await EnvVar.find({});
        if (envVars && envVars.length > 0) {
            envVars.forEach(v => {
                _botSettings[v.key] = v.value;
            });
        }
    } catch (err) {
        // Error එකක් ආවට බොට් නවත්වන්න එපා (Log එකක් දාන්න)
        console.log('Error reading environment from DB (Using Defaults):', err.message);
    }
};

// 3. Settings ලබා ගැනීම
const getBotSettings = () => {
    return _botSettings;
};

// 4. Settings වෙනස් කිරීම (Update)
const updateEnv = async (key, value) => {
    try {
        if (mongoose.connection.readyState !== 1) {
            await connectDB();
        }
        
        await EnvVar.findOneAndUpdate(
            { key: key },
            { value: value },
            { upsert: true, new: true }
        );
        _botSettings[key] = value;
        return true;
    } catch (err) {
        console.error(`Error updating ${key}:`, err);
        return false;
    }
};

module.exports = { connectDB, readEnv, getBotSettings, updateEnv };
