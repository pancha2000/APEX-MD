const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    jidNormalizedUser,
    getContentType,
    fetchLatestBaileysVersion,
    Browsers
} = require('@whiskeysockets/baileys');

const { getBuffer, getGroupAdmins, getRandom, h2k, isUrl, Json, runtime, sleep, fetchJson } = require('./lib/functions');
const fs = require('fs');
const P = require('pino');
const appConfig = require('./config'); // Renamed from 'config' to avoid conflict
const qrcode = require('qrcode-terminal');
const util = require('util'); // Not used in this snippet, but kept
const { sms, downloadMediaMessage } = require('./lib/msg'); // downloadMediaMessage not used here
const axios = require('axios');
const { File } = require('megajs');
const mongoose = require('mongoose'); // Not used directly here, assumed for connectDB

const ownerNumber = ['94701391585']; // Ensure this is your number as a string array

//===================SESSION-AUTH============================
if (!fs.existsSync(__dirname + '/auth_info_baileys/creds.json')) {
    if (!appConfig.SESSION_ID) { // Use appConfig here
        console.log('Please add your session to SESSION_ID env !!');
        // process.exit(1); // Optional: Exit if no session ID
    } else {
        const sessdata = appConfig.SESSION_ID; // Use appConfig here
        // Ensure the URL is correct and accessible
        const sessionUrl = `https://mega.nz/file/${sessdata}`; // Fixed template literal
        console.log(`Downloading session from: ${sessionUrl}`);
        try {
            const filer = File.fromURL(sessionUrl);
            filer.download((err, data) => {
                if (err) {
                    console.error("Error downloading session:", err);
                    throw err; // Or handle more gracefully
                }
                fs.writeFile(__dirname + '/auth_info_baileys/creds.json', data, (writeErr) => {
                    if (writeErr) {
                        console.error("Error writing session file:", writeErr);
                        throw writeErr; // Or handle
                    }
                    console.log("Session downloaded ✅");
                    // It might be better to start the bot *after* session is confirmed written
                });
            });
        } catch (e) {
            console.error("Error initializing MegaJS File object or an issue with the URL:", e);
            // process.exit(1); // Optional: Exit if session download setup fails
        }
    }
}

const express = require("express");
const app = express();
const port = process.env.PORT || 8000;

//=============================================

async function connectToWA() {
    //===================connect mongodb===================
    const connectDB = require('./lib/mongodb');
    connectDB(); // Assuming this function handles its own errors and setup
    //==================================
    const { readEnv } = require('./lib/database');
    const botSettings = await readEnv(); // Renamed from 'config'
    const prefix = botSettings.PREFIX || ".";
    //=================================
    console.log("Connecting wa bot 🧬...");
    const { state, saveCreds } = await useMultiFileAuthState(__dirname + '/auth_info_baileys/');
    var { version } = await fetchLatestBaileysVersion();

    const conn = makeWASocket({
        logger: P({ level: 'silent' }),
        printQRInTerminal: false, // Set to false as QR is handled below or via session
        browser: Browsers.macOS("Firefox"), // You can change this
        syncFullHistory: true,
        auth: state,
        version
    });

    conn.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr && !conn.authState.creds.registered) { // Display QR only if not registered (no valid session)
            console.log('Scan QR code to connect:');
            qrcode.generate(qr, { small: true });
        }
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut);
            console.log('Connection closed due to ', lastDisconnect.error, ', reconnecting ', shouldReconnect);
            if (shouldReconnect) {
                connectToWA();
            }
        } else if (connection === 'open') {
            console.log('😼 Installing... ');
            const path = require('path');
            fs.readdirSync("./plugins/").forEach((plugin) => {
                if (path.extname(plugin).toLowerCase() == ".js") {
                    try {
                        require("./plugins/" + plugin);
                    } catch (e) {
                        console.error(`Error loading plugin ${plugin}:`, e);
                    }
                }
            });
            console.log('Plugins installed successful ✅');
            console.log('Bot connected to whatsapp ✅');

            // Ensure ownerNumber[0] exists if you're sending a message
            if (ownerNumber && ownerNumber.length > 0 && ownerNumber[0]) {
                let up = `Wa-BOT connected successful ✅\n\nPREFIX: ${prefix}`; // Fixed string syntax
                conn.sendMessage(ownerNumber[0] + "@s.whatsapp.net", {
                    image: { url: `https://telegra.ph/file/900435c6d3157c98c3c88.jpg` },
                    caption: up
                }).catch(e => console.error("Error sending welcome message to owner:", e));
            }
        }
    });
    conn.ev.on('creds.update', saveCreds);

    conn.ev.on('messages.upsert', async (mekEvent) => { // Renamed mek to mekEvent to avoid confusion
        const mek = mekEvent.messages[0]; // 'mek' usually refers to the processed message object
        if (!mek.message) return;
        mek.message = (getContentType(mek.message) === 'ephemeralMessage') ? mek.message.ephemeralMessage.message : mek.message;
        if (mek.key && mek.key.remoteJid === 'status@broadcast') return;

        const m = sms(conn, mek); // Assuming 'sms' processes 'mek' and returns a more usable 'm' object
        const type = getContentType(mek.message);
        const content = JSON.stringify(mek.message); // Can be large, use sparingly
        const from = mek.key.remoteJid;
        const quoted = type == 'extendedTextMessage' && mek.message.extendedTextMessage.contextInfo != null ? mek.message.extendedTextMessage.contextInfo.quotedMessage || {} : {}; // Ensure quoted is an object
        
        // Body extraction - ensure 'm.body' or 'm.text' if 'sms' function provides it
        let body = '';
        if (type === 'conversation') {
            body = mek.message.conversation;
        } else if (type === 'extendedTextMessage') {
            body = mek.message.extendedTextMessage.text;
        } else if (type === 'imageMessage' && mek.message.imageMessage && mek.message.imageMessage.caption) {
            body = mek.message.imageMessage.caption;
        } else if (type === 'videoMessage' && mek.message.videoMessage && mek.message.videoMessage.caption) {
            body = mek.message.videoMessage.caption;
        }
        // It's common for `m` (from `sms` function) to have a normalized `m.body` or `m.text` property.
        // If so, prefer using that: const body = m.body || '';

        const isCmd = body.startsWith(prefix);
        const command = isCmd ? body.slice(prefix.length).trim().split(' ')[0].toLowerCase() : '';
        const args = body.trim().split(/ +/).slice(1);
        const q = args.join(' ');
        const isGroup = from.endsWith('@g.us');
        const sender = mek.key.fromMe ? (conn.user.id.split(':')[0] + '@s.whatsapp.net' || conn.user.id) : (mek.key.participant || mek.key.remoteJid);
        const senderNumber = sender.split('@')[0];
        const botNumber = conn.user.id.split(':')[0];
        const pushname = mek.pushName || 'Sin Nombre';
        const isMe = botNumber.includes(senderNumber);
        const isOwner = ownerNumber.includes(senderNumber) || isMe;
        const botNumber2 = await jidNormalizedUser(conn.user.id); // Normalized bot JID
        
        const groupMetadata = isGroup ? await conn.groupMetadata(from).catch(e => { console.error("Error fetching group metadata:", e); return null; }) : null;
        const groupName = isGroup && groupMetadata ? groupMetadata.subject : '';
        const participants = isGroup && groupMetadata ? groupMetadata.participants : [];
        const groupAdmins = isGroup ? getGroupAdmins(participants) : []; // Assuming getGroupAdmins is correct
        const isBotAdmins = isGroup ? groupAdmins.includes(botNumber2) : false;
        const isAdmins = isGroup ? groupAdmins.includes(sender) : false;
        
        const reply = (teks) => {
            conn.sendMessage(from, { text: teks }, { quoted: mek });
        };

        conn.sendFileUrl = async (jid, url, caption, quotedMsg, options = {}) => { // Renamed quoted to quotedMsg for clarity
            let mime = '';
            try {
                const res = await axios.head(url);
                mime = res.headers['content-type'];
                if (!mime) throw new Error("Could not determine MIME type");

                const buffer = await getBuffer(url);
                if (mime.split("/")[1] === "gif") {
                    return conn.sendMessage(jid, { video: buffer, caption: caption, gifPlayback: true, ...options }, { quoted: quotedMsg, ...options });
                }
                // let type = mime.split("/")[0] + "Message"; // This is not how Baileys expects types
                if (mime === "application/pdf") {
                    return conn.sendMessage(jid, { document: buffer, mimetype: 'application/pdf', fileName: caption || "document.pdf", caption: caption, ...options }, { quoted: quotedMsg, ...options });
                }
                if (mime.startsWith("image/")) {
                    return conn.sendMessage(jid, { image: buffer, caption: caption, ...options }, { quoted: quotedMsg, ...options });
                }
                if (mime.startsWith("video/")) {
                    return conn.sendMessage(jid, { video: buffer, caption: caption, mimetype: 'video/mp4', ...options }, { quoted: quotedMsg, ...options });
                }
                if (mime.startsWith("audio/")) {
                    return conn.sendMessage(jid, { audio: buffer, mimetype: 'audio/mpeg', ...options }, { quoted: quotedMsg, ...options }); // caption may not be supported by default on audio
                }
                // Fallback for unknown types, or send as document
                return conn.sendMessage(jid, { document: buffer, mimetype: mime, caption: caption, fileName: "file" + path.extname(url), ...options }, { quoted: quotedMsg, ...options });

            } catch (error) {
                console.error("Error in sendFileUrl:", error);
                reply(`Error sending file: ${error.message}`); // Inform user
            }
        };

        //=================================WORKTYPE===========================================
const workMode = botSettings.MODE ? botSettings.MODE.toLowerCase() : 'public'; // MODE එකක් සකසා නොමැති නම් 'public' ලෙස සලකන්න

if (workMode === 'private') {
    if (!isOwner) {
        // console.log(`WORKMODE: Private - Ignoring message from non-owner ${sender}`);
        return; // අයිතිකරු නොවේ නම්, මෙතනින් නවතින්න
    }
} else if (workMode === 'inbox') {
    // අයිතිකරුට ඕනෑම තැනක භාවිතා කළ හැකියි.
    // අනිත් අයට private chats වල විතරයි භාවිතා කළ හැක්කේ.
    if (!isOwner && isGroup) {
        // console.log(`WORKMODE: Inbox - Ignoring group message from non-owner ${sender}`);
        return; // අයිතිකරු නොවේ නම් සහ group පණිවිඩයක් නම්, මෙතනින් නවතින්න
    }
} else if (workMode === 'groups') {
    // මෙම "groups" mode එකේ අදහස:
    // - Bot එක group වල හැමෝටම වැඩ කරනවා.
    // - Bot එක අයිතිකරුට private chats වලත් වැඩ කරනවා.
    // - Bot එක අයිතිකරු නොවන අයට private chats වල වැඩ කරන්නේ නැහැ.
    if (!isGroup && !isOwner) { // Group එකක් නොවේ නම් සහ අයිතිකරුත් නොවේ නම්
        // console.log(`WORKMODE: Groups - Ignoring DM from non-owner ${sender}`);
        return; // මෙතනින් නවතින්න
    }
    // Group පණිවිඩයක් නම් (ඕනෑම කෙනෙකුගෙන්) හෝ අයිතිකරුගෙන් එන private chat පණිවිඩයක් නම්, ඉදිරියට යන්න.
} else if (workMode === 'public') {
    // කිසිම සීමාවක් නැහැ. Bot එක හැමෝටම, හැමතැනම වැඩ.
    // console.log(`WORKMODE: Public - Processing message from ${sender}`);
} else {
    // හඳුනා නොගත් MODE එකක් නම්, ආරක්ෂිත default එකකට යන්න (උදා: public හෝ private)
    console.log(`[WORKMODE] Unknown mode "${botSettings.MODE}". Defaulting to public behavior.`);
    // නැතිනම්, වඩාත් සීමාකාරී ලෙස:
    // if (!isOwner) return;
}
//======================================================
        //======================================================

        const events = require('./command'); // Assuming ./command.js exports { commands: [] }
        const cmdName = isCmd ? body.slice(prefix.length).trim().split(" ")[0].toLowerCase() : false;

        if (isCmd && cmdName) {
            const cmd = events.commands.find((cmd) => cmd.pattern === cmdName) || events.commands.find((cmd) => cmd.alias && cmd.alias.includes(cmdName));
            if (cmd) {
                if (cmd.react) conn.sendMessage(from, { react: { text: cmd.react, key: mek.key } });

                try {
                    // Passing 'command' as commandName string, and 'cmd' as the command object
                    cmd.function(conn, mek, m, { from, quoted, body, isCmd, command: cmdName, cmdObject: cmd, args, q, isGroup, sender, senderNumber, botNumber2, botNumber, pushname, isMe, isOwner, groupMetadata, groupName, participants, groupAdmins, isBotAdmins, isAdmins, reply });
                } catch (e) {
                    console.error(`[PLUGIN ERROR][${cmdName}] ` + e);
                    // reply(`Error executing command: ${e.message}`); // Optional: inform user
                }
            }
        }

        // Event-based handlers (non-prefixed commands)
        // Consider adding '!isCmd' to these conditions if they should only run for non-prefixed messages
        events.commands.map(async (cmdObject) => { // Renamed 'command' to 'cmdObject' to avoid conflict
            const commonParams = { from, quoted, body, isCmd, command: cmdName, cmdObject, args, q, isGroup, sender, senderNumber, botNumber2, botNumber, pushname, isMe, isOwner, groupMetadata, groupName, participants, groupAdmins, isBotAdmins, isAdmins, reply };
            try {
                if (body && cmdObject.on === "body") { // Potentially !isCmd && body
                    cmdObject.function(conn, mek, m, commonParams);
                } else if (q && cmdObject.on === "text") { // Changed mek.q to q. Consider if m.text or body is more appropriate. Potentially !isCmd && q
                    cmdObject.function(conn, mek, m, commonParams);
                } else if ((cmdObject.on === "image" || cmdObject.on === "photo") && type === "imageMessage") { // Potentially !isCmd && type === "imageMessage"
                    cmdObject.function(conn, mek, m, commonParams);
                } else if (cmdObject.on === "sticker" && type === "stickerMessage") { // Potentially !isCmd && type === "stickerMessage"
                    cmdObject.function(conn, mek, m, commonParams);
                }
            } catch (e) {
                 console.error(`[EVENT PLUGIN ERROR][on:${cmdObject.on}] ` + e);
            }
        });
        //============================================================================

    });
}

app.get("/", (req, res) => {
    res.send("hey, bot started✅");
});

app.listen(port, () => console.log(`Server listening on port http://localhost:${port}`)); // Fixed log message

// Delay connectToWA if session download might take time, or ensure it's called after download success
if (fs.existsSync(__dirname + '/auth_info_baileys/creds.json') || appConfig.SESSION_ID) {
    setTimeout(() => {
        connectToWA().catch(err => console.error("Failed to connect to WhatsApp:", err));
    }, 4000); // Delay might still be useful for other initializations
} else {
    console.log("Session file does not exist and no SESSION_ID provided. Bot will not start until session is available.");
    // You might want to set up a loop to check for the session file if it's downloaded asynchronously
    // and then call connectToWA(). For now, it will only start if the file exists at startup or SESSION_ID is provided.
}