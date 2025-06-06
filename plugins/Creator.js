const {readEnv} = require('../lib/database')
const {cmd , commands} = require('../command')

cmd({
    pattern: "owner",
    react: "👑",
    alias: ["king","bot"],
    desc: "get owner number",
    category: "main",
    filename: __filename
},
async(conn, mek, m,{from, quoted, body, isCmd, command, args, q, isGroup, sender, senderNumber, botNumber2, botNumber, pushname, isMe, isOwner, groupMetadata, groupName, participants, groupAdmins, isBotAdmins, isAdmins, reply}) => {
try{
const config = await readEnv();
let madeMenu = `❁ ════ ❃•◯•❃ ════ ❁

*⇆ Hello  *${pushname}* ⇆*

     

❁ ════ ❃•◯•❃ ════ ❁

*ʙᴏᴛ ᴏᴡɴᴇʀ ɪɴғᴏ*

⇩━━━━━━━━❁━━━━━━━━⇩
┝ *ɴᴀᴍᴇ:* *Shehan Vimukthi*
┝ *ᴘᴜʙʟɪᴄ ɴᴀᴍᴇ:* *Real Pancha*
┝ *ɴɪᴄᴋ ɴᴀᴍᴇ:* *Vimu*
┝ *ᴀɢᴇ:* *19*
┝ *ᴄᴏɴᴛᴀᴄᴛ* *+94701391585*
┝ About 
I am not an expert in coding. As far as I know, this bot is built according to my knowledge. I am actually a hydraulic machine technician😅.
❁ ════ ❃•⇆•❃ ════ ❁

> *ᴘᴏᴡᴇʀᴇᴅ ʙʏ APEX-MD*

╰━❁ ═══ ❃•⇆•❃ ═══ ❁━╯
`

await conn.sendMessage(from,{image:{url:config.ALIVE_IMG},caption:madeMenu},{quoted:mek})

}catch(e){
console.log(e)
reply(`${e}`)
}
})
