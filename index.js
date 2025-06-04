const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    jidNormalizedUser,
    getContentType,
    fetchLatestBaileysVersion,
    Browsers
} = require('@whiskeysockets/baileys');
const { readEnv, updateEnv } = require('./lib/database'); // Ensure this is at the top
const { getBuffer, getGroupAdmins, getRandom, h2k, isUrl, Json, runtime, sleep, fetchJson } = require('./lib/functions');
const fs = require('fs');
const P = require('pino');
const config = require('./config'); // Static config for session ID etc.
const qrcode = require('qrcode-terminal');
const util = require('util');
const { sms, downloadMediaMessage } = require('./lib/msg');
const axios = require('axios');
const { File } = require('megajs');
const mongoose = require('mongoose');

const ownerNumber = ['94701391585'];

//===================SESSION-AUTH============================
if (!fs.existsSync(__dirname + '/auth_info_baileys/creds.json')) {
    if (!config.SESSION_ID) {
        console.log('Please add your session to SESSION_ID env !!');
    } else {
        const sessdata = config.SESSION_ID;
        console.log("Attempting to download session from Mega...");
        try {
            const filer = File.fromURL(`https://mega.nz/file/${sessdata}`);
            filer.download((err, data) => {
                if (err) {
                    console.error("Mega session download error:", err);
                    return;
                }
                fs.writeFile(__dirname + '/auth_info_baileys/creds.json', data, (writeErr) => {
                    if (writeErr) {
                        console.error("Error writing session file:", writeErr);
                        return;
                    }
                    console.log("Session downloaded ✅");
                    // It's generally better to ensure connectToWA is called after this completes.
                    // See the logic at the bottom of the file.
                });
            });
        } catch (megaError) {
            console.error("Error initializing Mega download:", megaError);
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
    try {
        await connectDB(); 
    } catch (dbErr) {
        console.error("MongoDB connection failed in connectToWA:", dbErr);
        process.exit(1); 
    }
    //==================================

    let initialConfigForStartup;
    try {
        initialConfigForStartup = await readEnv();
    } catch (e) {
        console.error("Error reading initial config for startup (connectToWA):", e);
        initialConfigForStartup = { PREFIX: '.', MODE: 'public (DB error)' }; 
    }
    const initialPrefixForLog = initialConfigForStartup.PREFIX || "."; 
    //=================================
    console.log(`Connecting wa bot 🧬... Initial Prefix (for log): ${initialPrefixForLog}`);
    const { state, saveCreds } = await useMultiFileAuthState(__dirname + '/auth_info_baileys/');
    var { version } = await fetchLatestBaileysVersion();

    const conn = makeWASocket({
        logger: P({ level: 'silent' }),
        printQRInTerminal: false, 
        browser: Browsers.macOS("Firefox"), 
        syncFullHistory: true,
        auth: state,
        version
    });

    conn.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            if (statusCode !== DisconnectReason.loggedOut) {
                console.log('Connection closed, reconnecting...', lastDisconnect?.error);
                connectToWA();
            } else {
                console.log('Connection closed: Logged out. Please delete session and restart.');
                process.exit(1); 
            }
        } else if (connection === 'open') {
            console.log('😼 Installing plugins... ');
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

            let currentDbConfigForStartup;
            try {
                currentDbConfigForStartup = await readEnv();
            } catch (e) {
                console.error("Error reading DB config for startup message (connection.open):", e);
                currentDbConfigForStartup = { PREFIX: initialPrefixForLog, MODE: 'public (DB read error)' };
            }
            const startupPrefix = currentDbConfigForStartup.PREFIX || ".";
            const startupMode = currentDbConfigForStartup.MODE || "public";

            let upMsg = `✅ Wa-BOT connected successfully!\n\nPREFIX: ${startupPrefix}\nMODE: ${startupMode}`;
            if (ownerNumber[0]) { 
                 conn.sendMessage(ownerNumber[0] + "@s.whatsapp.net", { image: { url: `https://telegra.ph/file/900435c6d3157c98c3c88.jpg` }, caption: upMsg });
            }
        }
    });

    conn.ev.on('creds.update', saveCreds);

    conn.ev.on('messages.upsert', async (mekInfo) => { 
        const mek = mekInfo.messages[0]; 
        if (!mek || !mek.key) { 
            console.log("DEBUG: Received an invalid or empty message structure in upsert.");
            return;
        }

        // ===================== DEBUG: LOG FULL mek OBJECT FOR GROUP MESSAGES =====================
        if (mek.key.remoteJid && mek.key.remoteJid.endsWith('@g.us')) { 
            console.log("DEBUG: Full mek object for group message:", JSON.stringify(mek, null, 2)); 
        } // <<<<<<<<<---------------------- මෙන්න නිවැරදි කළ තැන (closing brace)
        // ========================================================================================
        
        // ===================== DEBUG LOG 1: RAW MESSAGE (already exists, keep it) =====================
        console.log(`DEBUG: Raw message received in upsert. From: ${mek.key.remoteJid}, Type: ${getContentType(mek.message)}, ID: ${mek.key.id}`);
        // ============================================================================================
// ===================== HANDLE/IGNORE STUB MESSAGES =====================
    // messageStubType එකක් තියෙනවා නම්, ඒක log කරලා return වෙන්න
    if (mek.messageStubType) {
        console.log(`DEBUG: Ignoring stub message. Type: ${mek.messageStubType}, Parameters: ${mek.messageStubParameters?.join(', ')}`);
        return; // Stub message ignore කරනවා
    }
    // =======================================================================


        // ============ REAL-TIME CONFIG & MODE SETUP ================
        let dbConfig;
        try {
            dbConfig = await readEnv();
        } catch (error) {
            console.error("messages.upsert: Failed to read env from DB, using defaults:", error);
            dbConfig = {
                PREFIX: process.env.PREFIX || ".",
                MODE: process.env.MODE || "public",
            };
        }
        const prefix = dbConfig.PREFIX || ".";
        const currentMode = (dbConfig.MODE || 'public').toLowerCase();

        // ===================== DEBUG LOG 2: BOT'S CURRENT MODE =====================
        console.log(`DEBUG: Bot is thinking MODE is: ${currentMode}, PREFIX is: "${prefix}"`);
        // ========================================================================
        // ============================================================

        if (!mek.message) { 
            console.log("DEBUG: No message content in mek.message object. (mek.message is null or undefined)");
            return;
        }
        mek.message = (getContentType(mek.message) === 'ephemeralMessage') ? mek.message.ephemeralMessage.message : mek.message;
        if (mek.key && mek.key.remoteJid === 'status@broadcast') {
            console.log("DEBUG: Ignoring status update.");
            return;
        }

        const m = sms(conn, mek); 
        const type = getContentType(mek.message);
        if(!type){ 
            console.log("DEBUG: Message type is undefined. Message content:", JSON.stringify(mek.message));
            return;
        }

        const body = (type === 'conversation') ? mek.message.conversation :
                     (type === 'extendedTextMessage') ? mek.message.extendedTextMessage.text :
                     (type === 'imageMessage' && mek.message.imageMessage?.caption) ? mek.message.imageMessage.caption :
                     (type === 'videoMessage' && mek.message.videoMessage?.caption) ? mek.message.videoMessage.caption : '';

        const from = mek.key.remoteJid;
        const isGroup = from.endsWith('@g.us');

        // ===================== DEBUG LOG 3: IS IT A GROUP MESSAGE? =====================
        console.log(`DEBUG: Is this a group message? ${isGroup}. From JID: ${from}`);
        // ============================================================================

        const sender = mek.key.fromMe ? (conn.user.id.split(':')[0] + '@s.whatsapp.net' || conn.user.id) : (mek.key.participant || mek.key.remoteJid);
        const senderNumber = sender.split('@')[0];
        const botNumber = conn.user?.id?.split(':')[0]; 
        const pushname = mek.pushName || 'Sin Nombre';
        const isMe = botNumber && botNumber.includes(senderNumber); 
        const isOwner = ownerNumber.includes(senderNumber) || isMe;

        // ===================== DEBUG LOG 4: BEFORE MODE CHECK LOGIC =====================
        console.log(`DEBUG: Before mode check - Mode: ${currentMode}, isGroup: ${isGroup}, isOwner: ${isOwner}, Sender: ${sender}`);
        // =============================================================================

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
            }
            if (blockUser) {
                // ===================== DEBUG LOG 5: IF USER IS BLOCKED =====================
                console.log(`DEBUG: User is being blocked! Mode: ${currentMode}, isGroup: ${isGroup}, Sender: ${sender}`);
                // ========================================================================
                return;
            }
        }
        // ==============================================================

        const isCmd = typeof body === 'string' && body.startsWith(prefix); 

        if (isCmd) {
            console.log(`DEBUG: Command detected: "${body.slice(prefix.length).trim().split(' ').shift().toLowerCase()}" from ${sender} in ${from}`);
        } else {
            console.log(`DEBUG: Not a command. Body (first 50 chars): "${typeof body === 'string' ? body.slice(0, 50) : 'Non-string body'}" from ${sender} in ${from}`);
        }
        
        const command = isCmd ? body.slice(prefix.length).trim().split(' ').shift().toLowerCase() : '';
        const args = typeof body === 'string' ? body.trim().split(/ +/).slice(1) : [];
        const q = args.join(' ');
        const quoted = type === 'extendedTextMessage' && mek.message.extendedTextMessage.contextInfo != null ? mek.message.extendedTextMessage.contextInfo.quotedMessage || [] : [];
        
        const botNumber2 = conn.user?.id ? await jidNormalizedUser(conn.user.id) : ''; 
        const groupMetadata = isGroup ? await conn.groupMetadata(from).catch(e => { console.error("Error fetching group metadata:", e); return null; }) : null;
        const groupName = isGroup && groupMetadata ? groupMetadata.subject : '';
        const participants = isGroup && groupMetadata ? groupMetadata.participants : [];
        const groupAdmins = isGroup ? getGroupAdmins(participants) : []; 
        const isBotAdmins = isGroup && botNumber2 ? groupAdmins.includes(botNumber2) : false;
        const isAdmins = isGroup ? groupAdmins.includes(sender) : false;
        
        const reply = (teks) => {
            conn.sendMessage(from, { text: teks }, { quoted: mek });
        };

        conn.sendFileUrl = async (jid, url, caption, quotedMsg, options = {}) => { 
            try {
                let mime = '';
                const res = await axios.head(url);
                mime = res.headers['content-type'];
                if (!mime) throw new Error("Could not determine MIME type");

                const buffer = await getBuffer(url); 

                if (mime.split("/")[1] === "gif") {
                    return conn.sendMessage(jid, { video: buffer, caption: caption, gifPlayback: true, ...options }, { quoted: quotedMsg, ...options });
                }
                if (mime === "application/pdf") {
                    return conn.sendMessage(jid, { document: buffer, mimetype: 'application/pdf',fileName: "file.pdf", caption: caption, ...options }, { quoted: quotedMsg, ...options });
                }
                if (mime.startsWith("image/")) {
                    return conn.sendMessage(jid, { image: buffer, caption: caption, ...options }, { quoted: quotedMsg, ...options });
                }
                if (mime.startsWith("video/")) {
                    return conn.sendMessage(jid, { video: buffer, caption: caption, mimetype: 'video/mp4', ...options }, { quoted: quotedMsg, ...options });
                }
                if (mime.startsWith("audio/")) {
                    return conn.sendMessage(jid, { audio: buffer, mimetype: 'audio/mpeg', ...options }, { quoted: quotedMsg, ...options }); 
                }
                console.warn(`Unsupported MIME type for sendFileUrl: ${mime}`);
            } catch (e) {
                console.error("Error in sendFileUrl:", e);
                reply("Error sending file from URL: " + e.message);
            }
        };

        const events = require('./command'); 

        if (isCmd && command) { 
            const cmd = events.commands.find((c) => c.pattern === command) || events.commands.find((c) => c.alias && c.alias.includes(command));
            if (cmd) {
                if (cmd.react) conn.sendMessage(from, { react: { text: cmd.react, key: mek.key } });
                try {
                    await cmd.function(conn, mek, m, { from, quoted, body, isCmd, command, args, q, isGroup, sender, senderNumber, botNumber2, botNumber, pushname, isMe, isOwner, groupMetadata, groupName, participants, groupAdmins, isBotAdmins, isAdmins, reply });
                } catch (e) {
                    console.error(`[PLUGIN CMD ERROR - ${command}] ` + e);
                    reply("⚠️ Error executing command: " + e.message);
                }
            }
        } else {
            events.commands.forEach(async (eventCmd) => {
                try {
                    const commonArgs = {from, quoted, body, isCmd: false, command: null, args, q, isGroup, sender, senderNumber, botNumber2, botNumber, pushname, isMe, isOwner, groupMetadata, groupName, participants, groupAdmins, isBotAdmins, isAdmins, reply};
                    // Removed 'l' from commonArgs as it's not defined.
                    if (body && eventCmd.on === "body") { 
                        await eventCmd.function(conn, mek, m, commonArgs);
                    } else if (type === 'conversation' && eventCmd.on === "text") { 
                        await eventCmd.function(conn, mek, m, commonArgs);
                    } else if ((eventCmd.on === "image" || eventCmd.on === "photo") && type === "imageMessage") {
                        await eventCmd.function(conn, mek, m, commonArgs);
                    } else if (eventCmd.on === "sticker" && type === "stickerMessage") {
                        await eventCmd.function(conn, mek, m, commonArgs);
                    }
                } catch (e) {
                    console.error(`[PLUGIN EVENT ERROR - ${eventCmd.on || eventCmd.pattern}]: ` + e);
                }
            });
        }
    }); // messages.upsert closing brace
} // connectToWA function's closing bracket

app.get("/", (req, res) => {
    res.send("Bot server is running! ✅");
});

app.listen(port, () => console.log(`Server listening on port http://localhost:${port}`));

// --- connectToWA Call Logic ---
function initializeBot() {
    if (fs.existsSync(__dirname + '/auth_info_baileys/creds.json')) {
        console.log("Existing session found. Starting bot...");
        connectToWA();
    } else if (config.SESSION_ID) {
        console.log("No existing session, SESSION_ID found. Waiting for session download logic at the top to complete...");
        // The download logic at the top is callback-based.
        // To reliably start *after* download, connectToWA should be called in its writeFile callback.
        // For simplicity here, we'll use a longer timeout, but this isn't ideal.
        // A better approach would be to promisify the download or use an event emitter.
        setTimeout(() => {
            if (fs.existsSync(__dirname + '/auth_info_baileys/creds.json')) {
                console.log("Session file now exists after delay. Starting bot...");
                connectToWA();
            } else {
                console.error("Session file still not found after delay. Please check session download or provide SESSION_ID.");
                // process.exit(1); // Consider exiting
            }
        }, 15000); // Increased timeout to 15 seconds for Mega download
    } else {
        console.log("No session ID and no existing session file. Bot cannot start without a session. Please provide SESSION_ID or scan QR code.");
        // If you want QR scanning, set printQRInTerminal to true and call connectToWA()
        // connectToWA(); // This would trigger QR scan if printQRInTerminal is true and no session
    }
}

initializeBot(); // Call the function to start the bot initialization process