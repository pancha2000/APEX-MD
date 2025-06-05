// plugins/update_commands.js (Renamed)
const fs = require('fs');
const path = require('path');
// const config = require('../config'); // Not used
const { cmd } = require('../command'); // Removed 'commands'

cmd({
  pattern: "updatecmd",
  react: "🧞",
  desc: "Reloads all commands from the plugins directory.",
  category: "owner",
  filename: __filename
},
async (conn, mek, m, { isOwner, reply }) => {
  try {
    if (!isOwner) return reply("Only bot owners can use this command.");
    
    const pluginsDir = path.join(__dirname, '../plugins'); // Assuming plugins are one level up
    let reloadedCount = 0;
    let errorCount = 0;

    if (!fs.existsSync(pluginsDir)) {
        return reply("Plugins directory not found.");
    }

    const files = fs.readdirSync(pluginsDir);
    
    reply("🔄 Reloading commands, please wait...");

    for (const file of files) {
      if (file.endsWith('.js')) {
        const filePath = path.join(pluginsDir, file);
        try {
          // Clear the cache for the specific file
          delete require.cache[require.resolve(filePath)];
          // Re-require the file
          require(filePath);
          console.log(`Reloaded plugin: ${file}`);
          reloadedCount++;
        } catch (loadErr) {
          console.error(`Error reloading plugin ${file}:`, loadErr);
          errorCount++;
        }
      }
    }
    
    if (errorCount > 0) {
        reply(`✅ Commands partially reloaded.\nSuccessfully reloaded: ${reloadedCount}\nFailed to reload: ${errorCount}`);
    } else {
        reply(`✅ All ${reloadedCount} command plugins reloaded successfully.`);
    }

  } catch (e) {
    console.error("Error in updatecmd command:", e);
    reply(`Error updating commands: ${e.message}`);
  }
});