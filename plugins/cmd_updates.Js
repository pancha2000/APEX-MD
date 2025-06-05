// plugins/cmd_updates.js (Renamed)
const fs = require('fs');
const path = require('path');
const { cmd, commands, clearCommands } = require('../command'); // 'commands' සහ 'clearCommands' දෙකම import කරගන්න.

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

    reply("🔄 Reloading commands, please wait...");
    
    // commands array එක clear කරන්න.
    if (clearCommands) { // 'clearCommands' export වෙලා තියෙනවද බලනවා
        clearCommands();
        console.log("Commands array cleared before reloading.");
    } else {
        // If clearCommands is not exported, you might have to clear it manually
        // If 'commands' array itself is mutable and exported, you can do:
        // commands.length = 0;
        console.warn("clearCommands function not found. Commands array might not be fully cleared.");
    }


    const files = fs.readdirSync(pluginsDir);
    
    for (const file of files) {
      if (file.endsWith('.js')) {
        const filePath = path.join(pluginsDir, file);
        try {
          // Clear the cache for the specific file
          delete require.cache[require.resolve(filePath)];
          // Re-require the file (this will re-add commands to the now-cleared 'commands' array)
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