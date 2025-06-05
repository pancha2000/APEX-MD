// plugins/menu.js
const { readEnv } = require('../lib/database');
const { cmd, commands } = require('../command'); // Import 'commands' array

cmd({
    pattern: "menu",
    // ...
},
async (conn, mek, m, { pushname, from, reply }) => {
    try {
        const dbConfig = await readEnv();
        let menuText = `╭━━━━∙⋆⋅⋆∙━ ─┉─ • ─┉─⊷\n  Hello *${pushname}*\n  Welcome To Pancha-One-Bot Menu\n╰━━━━∙⋆⋅⋆∙━ ─┉─ • ─┉─⊷\n\n`;

        const categories = {};
        commands.forEach(command => {
            if (command.dontAddCommandList || !command.pattern) return; // Skip hidden or pattern-less commands
            if (!categories[command.category]) {
                categories[command.category] = [];
            }
            categories[command.category].push(command);
        });

        for (const categoryName in categories) {
            menuText += `*╭────❒⁠⁠⁠⁠* *${categoryName.toUpperCase()}-CMD* *❒⁠⁠⁠⁠*\n`;
            categories[categoryName].forEach(c => {
                menuText += `*┋* .${c.pattern} ${c.use ? c.use.replace('.', '') : ''}\n`; // Display pattern and usage
                 // menuText += `*┋* → ${c.desc || 'No description'}\n`; // Optionally add description
            });
            menuText += `*┕───────────────────❒*\n\n`;
        }
        
        menuText += `> *POWERED BY SHEHAN VIMUKTHI*\n╘✦•·········••••😈•••············•✦`;

        const aliveImgUrl = dbConfig.ALIVE_IMG;
        if (aliveImgUrl) {
            await conn.sendMessage(from, { image: { url: aliveImgUrl }, caption: menuText }, { quoted: mek });
        } else {
            await reply(menuText);
        }

    } catch (e) {
        console.error("Error in menu command:", e);
        reply("😥 An error occurred while generating the menu.");
    }
});