const {readEnv} = require('../lib/database')
const {cmd , commands} = require('../command')

cmd({

    pattern: "menu",

    react: "🛸",

    alias: ["panel","commands"],

    desc: "Get bot\'s command list.",

    category: "main",

    use: '.menu',

    filename: __filename

},

async(conn, mek, m,{from, l, quoted, body, isCmd, umarmd, args, q, isGroup, sender, senderNumber, botNumber2, botNumber, pushname, isMe, isOwner, groupMetadata, groupName, participants, groupAdmins, isBotAdmins, isAdmins, reply}) => {

try{
const config = await readEnv();
let madeMenu = 
`╭━━━━∙⋆⋅⋆∙━ ─┉─ • ─┉─⊷

  𝑯𝒆𝒍𝒍𝒐𝒘 *${pushname}*

*♥︎ 𝐖𝐞𝐥𝐜𝐨𝐦𝐞 𝐓𝐨 𝐏𝐚𝐧𝐜𝐡𝐚-𝐎𝐧𝐞-𝐁𝐨𝐭 𝐀𝐥𝐥 𝐌𝐞𝐧𝐮♥︎ ≧◉◡◉≦*

 
╰━━━━∙⋆⋅⋆∙━ ─┉─ • ─┉─⊷


╒✦•··············•••••••••··············•··•✦
🧬◦ *ɴᴀᴍᴇ ʙᴏᴛ* : 𝑷𝒂𝒏𝒄𝒉𝒂 𝑂𝑛𝑒 𝐵𝑜𝑡
🧬◦ *ᴄʀᴇᴀᴛᴏʀ* : 𝑆ℎ𝑒ℎ𝑎𝑛 𝑉𝑖𝑚𝑢𝑘𝑡ℎ𝑖 
🧬◦ *ᴠᴇʀsɪᴏɴs* : ᴠ.2.0.0🐱
🧬◦ *ᴍᴇɴᴜ ᴄᴍᴅ* : .𝚖𝚎𝚗𝚞
🧬◦ *ꜱᴜʙꜱᴄʀɪʙᴇ ᴍʏ ʏᴛ ᴄʜᴀɴɴᴇʟ* :  https://youtube.com/@rp_tech_official?si=DOQLSrikDYueKNWf
🧬◦ *ᴊᴏɪɴ ᴍʏ ᴄʜᴀɴɴᴇʟ* : https://whatsapp.com/channel/0029Vb33F7lCBtx99QQttN1t
🧬◦ *ᴄᴏɴᴛᴀᴄᴛ ᴡɪᴛʜ sɪʟᴇɴᴛ-ᴋɪʟʟᴇʀ*: https://wa.me/+94701391585?text=Hi_Bot_help
╘✦•·············•••••••••··················•✦

*╭────❒⁠⁠⁠⁠* *📥 DOWNLOADER-CMD 📥* *❒⁠⁠⁠⁠* 
*┋*
*┋* coming soon 
*┋* 
*┕───────────────────❒*

*╭────❒⁠⁠⁠⁠* *🔎 SEARCH-CMD 🔍* *❒⁠⁠⁠⁠* 
*┋* 
*┋* 
*┋* coming soon
*┋* 
*┕───────────────────❒*

*╭────❒⁠⁠⁠⁠* *🧠 AI-CMD 🧠* *❒⁠⁠⁠⁠* 
*┋* *.ᴀɪ <ᴛᴇxᴛ>*
*┋* 
*┕───────────────────❒*

*╭────❒⁠⁠⁠⁠* *👨‍💻 OWNER-CMD 👨‍💻* *❒⁠⁠⁠⁠* 
*┋* 
*┋* *.update*
*┋* *.ʀᴇꜱᴛᴀʀᴛ*
*┕───────────────────❒*

*╭────❒⁠⁠⁠⁠* *👥 GROUP-CMD 👥* *❒⁠⁠⁠⁠* 
*┋* coming soon
*┕───────────────────❒*

*╭────❒⁠⁠⁠⁠* *📃 INFO-CMD 📃* *❒⁠⁠⁠⁠* 
*┋* *.ᴍᴇɴᴜ*
*┋* *.ᴀʟɪᴠᴇ*
*┋* *.ᴘɪɴɢ*
*┋* *.ꜱʏꜱᴛᴇᴍ*
*┕───────────────────❒*

*╭────❒⁠⁠⁠⁠* *🎡 CONVERTER-CMD 🎡* *❒⁠⁠⁠⁠* 
*┋* coming soon
*┕───────────────────❒*



*❒⁠⁠⁠⁠▭▬▭▬▭▬▭👀▭▬▭▬▭▬▭❒*⁠⁠⁠⁠

> *POWERED BY SHEHAN VIMUKTHI*
╘✦•·········••••😈•••············•✦ 
`

await conn.sendMessage(from,{image:{url:config.ALIVE_IMG},caption:madeMenu},{quoted:mek})

}catch(e){
console.log(e)
reply(`${e}`)
}
})
