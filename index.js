const {
default: makeWASocket,
useMultiFileAuthState,
DisconnectReason,
jidNormalizedUser,
getContentType,
fetchLatestBaileysVersion,
Browsers
} = require('@whiskeysockets/baileys')
const { readEnv, updateEnv } = require('./lib/database');
const { getBuffer, getGroupAdmins, getRandom, h2k, isUrl, Json, runtime, sleep, fetchJson } = require('./lib/functions')
const fs = require('fs')
const P = require('pino')
const config = require('./config')
const qrcode = require('qrcode-terminal')
const util = require('util')
const { sms,downloadMediaMessage } = require('./lib/msg')
const axios = require('axios')
const { File } = require('megajs')
const mongoose = require('mongoose')


const ownerNumber = ['94701391585']

//===================SESSION-AUTH============================
if (!fs.existsSync(__dirname + '/auth_info_baileys/creds.json')) {
if(!config.SESSION_ID) return console.log('Please add your session to SESSION_ID env !!')
const sessdata = config.SESSION_ID
const filer = File.fromURL(`https://mega.nz/file/${sessdata}`)
filer.download((err, data) => {
if(err) throw err
fs.writeFile(__dirname + '/auth_info_baileys/creds.json', data, () => {
console.log("Session downloaded ✅")
})})}

const express = require("express");
const app = express();
const port = process.env.PORT || 8000;

//=============================================

async function connectToWA() {
  //===================connect mongodb===================
const connectDB = require('./lib/mongodb')
connectDB();
//==================================

let initialConfigForStartup;
try {
    initialConfigForStartup = await readEnv();
} catch (e) {
    console.error("Error reading initial config for startup:", e);
    initialConfigForStartup = { PREFIX: './config.js or .', MODE: 'public (DB error)' };
}
const initialPrefix = initialConfigForStartup.PREFIX || ".";
//=================================
console.log("Connecting wa bot 🧬...");
const { state, saveCreds } = await useMultiFileAuthState(__dirname + '/auth_info_baileys/')
var { version } = await fetchLatestBaileysVersion()

const conn = makeWASocket({
        logger: P({ level: 'silent' }),
        printQRInTerminal: false,
        browser: Browsers.macOS("Firefox"),
        syncFullHistory: true,
        auth: state,
        version
        })
    
conn.ev.on('connection.update', async (update) => {
const { connection, lastDisconnect } = update
if (connection === 'close') {
if (lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut) {
connectToWA()
}
} else if (connection === 'open') {
console.log('😼 Installing... ')
const path = require('path');
fs.readdirSync("./plugins/").forEach((plugin) => {
if (path.extname(plugin).toLowerCase() == ".js") {
require("./plugins/" + plugin);
}
});
console.log('Plugins installed successful ✅')
console.log('Bot connected to whatsapp ✅')

// ====================Bot start mas==================
let currentDbConfigForStartup;
try {
    currentDbConfigForStartup = await readEnv();
} catch (e) {
    console.error("Error reading DB config for startup message:", e);
    // initialPrefix එක උඩ define කරපු එකෙන් ගන්න, නැත්නම් default එකක් දෙන්න
    currentDbConfigForStartup = { PREFIX: initialPrefix || ".", MODE: 'public (DB read error)' };
}
const startupPrefix = currentDbConfigForStartup.PREFIX || ".";
const startupMode = currentDbConfigForStartup.MODE || "public";

let up = `Wa-BOT connected successful ✅\n\nPREFIX: ${startupPrefix}\nMODE: ${startupMode}`;
// ownerNumber යනු array එකක් නිසා ownerNumber[0] භාවිතා කරන්න.
conn.sendMessage(ownerNumber[0] + "@s.whatsapp.net", { image: { url: `https://telegra.ph/file/900435c6d3157c98c3c88.jpg` }, caption: up });

conn.sendMessage(ownerNumber + "@s.whatsapp.net", { image: { url: `https://telegra.ph/file/900435c6d3157c98c3c88.jpg` }, caption: up })
//===========================================
}
})
conn.ev.on('creds.update', saveCreds)  

conn.ev.on('messages.upsert', async(mek) => {
  // conn.ev.on('messages.upsert', async(mek) => {  <-- මේ පේළියට පස්සේ, ඊළඟ පේළියට කලින්
    // ============ REAL-TIME CONFIG & MODE SETUP ================
    let dbConfig;
    try {
        dbConfig = await readEnv(); // හැම message එකටම අලුත් config එක DB එකෙන් ගන්නවා
    } catch (error) {
        console.error("messages.upsert: Failed to read env from DB, using defaults:", error);
        dbConfig = { // Fallback to defaults if DB read fails
            PREFIX: process.env.PREFIX || ".",
            MODE: process.env.MODE || "public",
        };
    }
    const prefix = dbConfig.PREFIX || "."; // DB එකෙන් ආපු අලුත්ම prefix එක
    const currentMode = (dbConfig.MODE || 'public').toLowerCase(); // DB එකෙන් ආපු අලුත්ම mode එක
    // ============================================================
mek = mek.messages[0]
if (!mek.message) return	
mek.message = (getContentType(mek.message) === 'ephemeralMessage') ? mek.message.ephemeralMessage.message : mek.message
if (mek.key && mek.key.remoteJid === 'status@broadcast') return
const m = sms(conn, mek)
const type = getContentType(mek.message)
const content = JSON.stringify(mek.message)
const from = mek.key.remoteJid
const quoted = type == 'extendedTextMessage' && mek.message.extendedTextMessage.contextInfo != null ? mek.message.extendedTextMessage.contextInfo.quotedMessage || [] : []
const body = (type === 'conversation') ? mek.message.conversation : (type === 'extendedTextMessage') ? mek.message.extendedTextMessage.text : (type == 'imageMessage') && mek.message.imageMessage.caption ? mek.message.imageMessage.caption : (type == 'videoMessage') && mek.message.videoMessage.caption ? mek.message.videoMessage.caption : ''
const isCmd = body.startsWith(prefix)
const command = isCmd ? body.slice(prefix.length).trim().split(' ').shift().toLowerCase() : ''
const args = body.trim().split(/ +/).slice(1)
const q = args.join(' ')
const isGroup = from.endsWith('@g.us')
const sender = mek.key.fromMe ? (conn.user.id.split(':')[0]+'@s.whatsapp.net' || conn.user.id) : (mek.key.participant || mek.key.remoteJid)
const senderNumber = sender.split('@')[0]
const botNumber = conn.user.id.split(':')[0]
const pushname = mek.pushName || 'Sin Nombre'
const isMe = botNumber.includes(senderNumber)
const isOwner = ownerNumber.includes(senderNumber) || isMe

    // =================== MODE LOGIC (WORKTYPE) ===================
    if (!isOwner) {
        let blockUser = false;
        switch (currentMode) {
            case 'private':
                blockUser = true;
                break;
            case 'inbox':
                if (isGroup) blockUser = true;
                break;
            case 'groups':
                if (!isGroup) blockUser = true;
                break;
            // 'public' mode: blockUser remains false
        }
        if (blockUser) {
            // console.log(`[MODE: ${currentMode}] User ${sender} from ${from} blocked.`);
            return; 
        }
    }
    // ==============================================================

const botNumber2 = await jidNormalizedUser(conn.user.id);
const groupMetadata = isGroup ? await conn.groupMetadata(from).catch(e => {}) : ''
const groupName = isGroup ? groupMetadata.subject : ''
const participants = isGroup ? await groupMetadata.participants : ''
const groupAdmins = isGroup ? await getGroupAdmins(participants) : ''
const isBotAdmins = isGroup ? groupAdmins.includes(botNumber2) : false
const isAdmins = isGroup ? groupAdmins.includes(sender) : false
const reply = (teks) => {
conn.sendMessage(from, { text: teks }, { quoted: mek })
}

conn.sendFileUrl = async (jid, url, caption, quoted, options = {}) => {
              let mime = '';
              let res = await axios.head(url)
              mime = res.headers['content-type']
              if (mime.split("/")[1] === "gif") {
                return conn.sendMessage(jid, { video: await getBuffer(url), caption: caption, gifPlayback: true, ...options }, { quoted: quoted, ...options })
              }
              let type = mime.split("/")[0] + "Message"
              if (mime === "application/pdf") {
                return conn.sendMessage(jid, { document: await getBuffer(url), mimetype: 'application/pdf', caption: caption, ...options }, { quoted: quoted, ...options })
              }
              if (mime.split("/")[0] === "image") {
                return conn.sendMessage(jid, { image: await getBuffer(url), caption: caption, ...options }, { quoted: quoted, ...options })
              }
              if (mime.split("/")[0] === "video") {
                return conn.sendMessage(jid, { video: await getBuffer(url), caption: caption, mimetype: 'video/mp4', ...options }, { quoted: quoted, ...options })
              }
              if (mime.split("/")[0] === "audio") {
                return conn.sendMessage(jid, { audio: await getBuffer(url), caption: caption, mimetype: 'audio/mpeg', ...options }, { quoted: quoted, ...options })
              }
            }


const events = require('./command')
const cmdName = isCmd ? body.slice(1).trim().split(" ")[0].toLowerCase() : false;
if (isCmd) {
const cmd = events.commands.find((cmd) => cmd.pattern === (cmdName)) || events.commands.find((cmd) => cmd.alias && cmd.alias.includes(cmdName))
if (cmd) {
if (cmd.react) conn.sendMessage(from, { react: { text: cmd.react, key: mek.key }})

try {
cmd.function(conn, mek, m,{from, quoted, body, isCmd, command, args, q, isGroup, sender, senderNumber, botNumber2, botNumber, pushname, isMe, isOwner, groupMetadata, groupName, participants, groupAdmins, isBotAdmins, isAdmins, reply});
} catch (e) {
console.error("[PLUGIN ERROR] " + e);
}
}
}
events.commands.map(async(command) => {
if (body && command.on === "body") {
command.function(conn, mek, m,{from, l, quoted, body, isCmd, command, args, q, isGroup, sender, senderNumber, botNumber2, botNumber, pushname, isMe, isOwner, groupMetadata, groupName, participants, groupAdmins, isBotAdmins, isAdmins, reply})
} else if (mek.q && command.on === "text") {
command.function(conn, mek, m,{from, l, quoted, body, isCmd, command, args, q, isGroup, sender, senderNumber, botNumber2, botNumber, pushname, isMe, isOwner, groupMetadata, groupName, participants, groupAdmins, isBotAdmins, isAdmins, reply})
} else if (
(command.on === "image" || command.on === "photo") &&
mek.type === "imageMessage"
) {
command.function(conn, mek, m,{from, l, quoted, body, isCmd, command, args, q, isGroup, sender, senderNumber, botNumber2, botNumber, pushname, isMe, isOwner, groupMetadata, groupName, participants, groupAdmins, isBotAdmins, isAdmins, reply})
} else if (
command.on === "sticker" &&
mek.type === "stickerMessage"
) {
command.function(conn, mek, m,{from, l, quoted, body, isCmd, command, args, q, isGroup, sender, senderNumber, botNumber2, botNumber, pushname, isMe, isOwner, groupMetadata, groupName, participants, groupAdmins, isBotAdmins, isAdmins, reply})
}});
//============================================================================ 

})
}
app.get("/", (req, res) => {
res.send("hey, bot started✅");
});
app.listen(port, () => console.log(`Server listening on port http://localhost:${port}`));
setTimeout(() => {
connectToWA()
}, 4000);  
