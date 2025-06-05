// plugins/update_env.js
const { updateEnv, readEnv } = require('../lib/database');
const EnvVar = require('../lib/mongodbenv'); // Assuming this model is for checking existence
const { cmd } = require('../command');

cmd({
    pattern: "update",
    // ... (rest of your command definition)
},
async (conn, mek, m, { from, q, reply, isOwner }) => {
    if (!isOwner) return reply("This command is for the bot owner only.");

    if (!q) {
        return reply("🙇‍♂️ *Please provide the environment variable and its new value.* \n\nExample: `.update ALIVE_MSG:hello ` or `.update MODE:public`");
    }

    const delimiterIndex = q.indexOf(':') !== -1 ? q.indexOf(':') : q.indexOf(',');
    if (delimiterIndex === -1) {
        return reply("🫠 *Invalid format. Please use the format:* `.update KEY:VALUE`");
    }

    const keyToUpdate = q.substring(0, delimiterIndex).trim().toUpperCase(); // Standardize key to uppercase
    const valueToUpdate = q.substring(delimiterIndex + 1).trim();

    if (!keyToUpdate || valueToUpdate === '') { // Check if value is empty string after trim
        return reply("🫠 *Invalid format. Key or Value cannot be empty. Use:* `.update KEY:VALUE`");
    }

    const validModes = ['public', 'private', 'groups', 'inbox'];

    // Specific validations
    if (keyToUpdate === 'MODE' && !validModes.includes(valueToUpdate.toLowerCase())) {
        return reply(`😒 *Invalid mode. Valid modes are: ${validModes.join(', ')}*`);
    }
    if (keyToUpdate === 'ALIVE_IMG' && !valueToUpdate.startsWith('https://')) {
        return reply("😓 *Invalid URL format for ALIVE_IMG. Please provide a valid image URL.*");
    }
    if (keyToUpdate === 'PREFIX' && (valueToUpdate.length > 1 || /\s/.test(valueToUpdate))) {
        return reply("😓 *Invalid PREFIX. It should be a single character without spaces.*");
    }
    // Add more validations for other specific keys if needed

    try {
        // Check if the environment variable exists (optional, as updateEnv can upsert)
        const envVar = await EnvVar.findOne({ key: keyToUpdate });
        if (!envVar) {
            // Optional: List existing vars if key doesn't exist
            // const allEnvVars = await readEnv();
            // const envList = Object.entries(allEnvVars).map(([k, v]) => `${k}: ${v}`).join('\n');
            // return reply(`❌ *The environment variable ${keyToUpdate} does not exist in the current DB setup.*\n\n*Consider adding it or check spelling.\nExisting variables:\n${envList}`);
            console.log(`Env var ${keyToUpdate} does not exist, will be created by updateEnv.`);
        }

        // Update the environment variable using the function from database.js
        const success = await updateEnv(keyToUpdate, valueToUpdate); // updateEnv now handles upsert

        if (success) {
            reply(`✅ *Environment variable updated.*\n\n🗃️ *${keyToUpdate}* ➠ ${valueToUpdate}`);
            // Note: The bot might need a restart for some env changes (like PREFIX or MODE) to take full effect globally,
            // unless you re-read and apply them immediately after update.
            // For PREFIX and MODE, you might want to update the global `botSettings` and `prefix` variables in index.js.
        } else {
            reply(`🙇‍♂️ *Failed to update the environment variable ${keyToUpdate}. Please check logs.*`);
        }
        
    } catch (err) {
        console.error('Error in update command:', err); // Log the actual error
        reply("🙇‍♂️ *An unexpected error occurred. Please try again.*");
    }
});