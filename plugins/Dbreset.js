// plugins/resetbotsettings.js

// අවශ්‍ය functions සහ defaultEnvVariables `lib/mongodb.js` වෙතින් import කරගන්න
const { updateEnv, readEnv, getBotSettings, defaultEnvVariables } = require('../lib/mongodb');
// Command එක register කරන්න `command.js` වෙතින් cmd function එක import කරගන්න
const { cmd } = require('../command');

// Command එක register කරනවා
cmd({ // info object එක මෙතනට
    pattern: 'resetdata', // Command එකේ නම (e.g., .resetbotsettings)
    desc: 'Resets bot settings (alive message, image, working mode, prefix) to default values.', // Command එකේ විස්තරය
    category: 'owner', // Command එක අයිති category එක (e.g., owner, admin, general)
    react: '🔄', // Command එක run වුනාම bot එක දාන reaction එක (optional)
    fromMe: true, // This command is fromMe (optional, if you want only the bot to respond to its own actions)
    // මෙතන function property එක අයින් කළා.
}, async (conn, mek, m, { isOwner, reply }) => { // function එක දෙවැනි argument එක විදියට දුන්නා
    // Owner Check
    if (!isOwner) {
        return reply("🚫 Sorry, you are not authorized to use this command.");
    }

    try {
        // defaultEnvVariables array එකේ තියෙන හැම setting එකක්ම DB එකේ update කරනවා
        for (const envVar of defaultEnvVariables) {
            await updateEnv(envVar.key, envVar.value);
        }

        // DB එක update කළාට පස්සේ, mongodb.js ඇතුලේ තියෙන _botSettings cache එකත් update වෙනවා.
        // index.js එකේ messages.upsert event එකේදී botSettings = getBotSettings() call කරන නිසා,
        // ඊළඟ message එක ලැබෙනකොට index.js එකේ botSettings cache එකත් අලුත් වෙනවා.
        reply("✅ Bot settings have been reset to default values!");
        console.log(`Bot settings reset by owner: ${m.sender}`);
    } catch (error) {
        console.error("Error resetting bot settings:", error);
        reply("❌ An error occurred while trying to reset bot settings.");
    }
});