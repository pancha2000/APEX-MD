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
// This session download logic might be better inside an async IIFE or before connectToWA
// to ensure it completes before the bot tries to connect.
// For now, leaving as is, but be aware of potential race conditions.
if (!fs.existsSync(__dirname + '/auth_info_baileys/creds.json')) {
    if (!config.SESSION_ID) {
        console.log('Please add your session to SESSION_ID env !!');
        // process.exit(1); // Consider exiting if session is crucial and not found
    } else {
        const sessdata = config.SESSION_ID;
        console.log("Attempting to download session from Mega...");
        try {
            const filer = File.fromURL(`https://mega.nz/file/${sessdata}`);
            filer.download((err, data) => {
                if (err) {
                    console.error("Mega session download error:", err);
                    // process.exit(1); // Consider exiting on download error
                    return;
                }
                fs.writeFile(__dirname + '/auth_info_baileys/creds.json', data, (writeErr) => {
                    if (writeErr) {
                        console.error("Error writing session file:", writeErr);
                        // process.exit(1);
                        return;
                    }
                    console.log("Session downloaded ✅");
                    // connectToWA(); // Optionally call connectToWA only after session is ready
                });
            });
        } catch (megaError) {
            console.error("Error initializing Mega download:", megaError);
            // process.exit(1);
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
        await connectDB(); // Ensure DB is connected before proceeding
    } catch (dbErr) {
        console.error("MongoDB connection failed in connectToWA:", dbErr);
        process.exit(1); // Exit if DB connection fails, as readEnv depends on it
    }
    //==================================

    let initialConfigForStartup;
    try {
        initialConfigForStartup = await readEnv();
    } catch (e) {
        console.error("Error reading initial config for startup (connectToWA):", e);
        initialConfigForStartup = { PREFIX: '.', MODE: 'public (DB error)' }; // Fallback
    }
    const initialPrefixForLog = initialConfigForStartup.PREFIX || "."; // Used for initial log
    //=================================
    console.log(`Connecting wa bot 🧬... Initial Prefix (for log): ${initialPrefixForLog}`);
    const { state, saveCreds } = await useMultiFileAuthState(__dirname + '/auth_info_baileys/');
    var { version } = await fetchLatestBaileysVersion();

    const conn = makeWASocket({
        logger: P({ level: 'silent' }),
        printQRInTerminal: false, // Set to true if you need to scan QR in terminal
        browser: Browsers.macOS("Firefox"), // Or Browsers.appropriate("Firefox")
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
                // fs.rmSync(__dirname + '/auth_info_baileys', { recursive: true, force: true }); // Optionally remove session
                process.exit(1); // Exit if logged out
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

            // ====================Bot start message to owner==================
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
            if (ownerNumber[0]) { // Send only if ownerNumber is defined
                 conn.sendMessage(ownerNumber[0] + "@s.whatsapp.net", { image: { url: `https://telegra.ph/file/900435c6d3157c98c3c88.jpg` }, caption: upMsg });
            }
            //===========================================
        }
    });

    conn.ev.on('creds.update', saveCreds);

    conn.ev.on('messages.upsert', async (mekInfo) => { // Renamed mek to mekInfo for clarity
        // ===================== DEBUG LOG 1: RAW MESSAGE =====================
        const mek = mekInfo.messages[0]; // Get the first message
        if (!mek || !mek.key) { // Basic check for valid message structure
            console.log("DEBUG: Received an invalid or empty message structure in upsert.");
            return;
        }
        
        if (mek.key.remoteJid && mek.key.remoteJid.endsWith('@g.us')) { 
        console.log("DEBUG: Full mek object for group message:", JSON.stringify(mek, null, 2)); 
        
        console.log(`DEBUG: Raw message received in upsert. From: ${mek.key.remoteJid}, Type: ${getContentType(mek.message)}, ID: ${mek.key.id}`);
        // ===================================================================

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
            console.log("DEBUG: No message content in mek.message object.");
            return;
        }
        mek.message = (getContentType(mek.message) === 'ephemeralMessage') ? mek.message.ephemeralMessage.message : mek.message;
        if (mek.key && mek.key.remoteJid === 'status@broadcast') {
            console.log("DEBUG: Ignoring status update.");
            return;
        }

        const m = sms(conn, mek); // Ensure sms function is robust
        const type = getContentType(mek.message);
        if(!type){ // If type is undefined/null, it's problematic
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
        const botNumber = conn.user?.id?.split(':')[0]; // Added optional chaining for conn.user.id
        const pushname = mek.pushName || 'Sin Nombre';
        const isMe = botNumber && botNumber.includes(senderNumber); // Check if botNumber is defined
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
                // 'public' mode: blockUser remains false
            }
            if (blockUser) {
                // ===================== DEBUG LOG 5: IF USER IS BLOCKED =====================
                console.log(`DEBUG: User is being blocked! Mode: ${currentMode}, isGroup: ${isGroup}, Sender: ${sender}`);
                // ========================================================================
                return;
            }
        }
        // ==============================================================

        const isCmd = typeof body === 'string' && body.startsWith(prefix); // Ensure body is a string

        if (isCmd) {
            console.log(`DEBUG: Command detected: "${body.slice(prefix.length).trim().split(' ').shift().toLowerCase()}" from ${sender} in ${from}`);
        } else {
            console.log(`DEBUG: Not a command. Body (first 50 chars): "${typeof body === 'string' ? body.slice(0, 50) : 'Non-string body'}" from ${sender} in ${from}`);
        }
        
        const command = isCmd ? body.slice(prefix.length).trim().split(' ').shift().toLowerCase() : '';
        const args = typeof body === 'string' ? body.trim().split(/ +/).slice(1) : [];
        const q = args.join(' ');
        const quoted = type === 'extendedTextMessage' && mek.message.extendedTextMessage.contextInfo != null ? mek.message.extendedTextMessage.contextInfo.quotedMessage || [] : [];
        
        const botNumber2 = conn.user?.id ? await jidNormalizedUser(conn.user.id) : ''; // Optional chaining
        const groupMetadata = isGroup ? await conn.groupMetadata(from).catch(e => { console.error("Error fetching group metadata:", e); return null; }) : null;
        const groupName = isGroup && groupMetadata ? groupMetadata.subject : '';
        const participants = isGroup && groupMetadata ? groupMetadata.participants : [];
        const groupAdmins = isGroup ? getGroupAdmins(participants) : []; // Ensure getGroupAdmins handles empty/null participants
        const isBotAdmins = isGroup && botNumber2 ? groupAdmins.includes(botNumber2) : false;
        const isAdmins = isGroup ? groupAdmins.includes(sender) : false;
        
        const reply = (teks) => {
            conn.sendMessage(from, { text: teks }, { quoted: mek });
        };

        conn.sendFileUrl = async (jid, url, caption, quotedMsg, options = {}) => { // Renamed quoted to quotedMsg for clarity
            try {
                let mime = '';
                const res = await axios.head(url);
                mime = res.headers['content-type'];
                if (!mime) throw new Error("Could not determine MIME type");

                const buffer = await getBuffer(url); // Get buffer once

                if (mime.split("/")[1] === "gif") {
                    return conn.sendMessage(jid, { video: buffer, caption: caption, gifPlayback: true, ...options }, { quoted: quotedMsg, ...options });
                }
                // let type = mime.split("/")[0] + "Message" // This variable 'type' shadows the outer 'type'
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
                    return conn.sendMessage(jid, { audio: buffer, mimetype: 'audio/mpeg', ...options }, { quoted: quotedMsg, ...options }); // Removed caption for audio
                }
                console.warn(`Unsupported MIME type for sendFileUrl: ${mime}`);
            } catch (e) {
                console.error("Error in sendFileUrl:", e);
                reply("Error sending file from URL: " + e.message);
            }
        };

        const events = require('./command'); // Ensure this is the correct path for your command loader
        // const cmdName = command; // 'command' variable already holds this

        if (isCmd && command) { // Check if command is not empty
            const cmd = events.commands.find((c) => c.pattern === command) || events.commands.find((c) => c.alias && c.alias.includes(command));
            if (cmd) {
                if (cmd.react) conn.sendMessage(from, { react: { text: cmd.react, key: mek.key } });
                try {
                    await cmd.function(conn, mek, m, { from, quoted, body, isCmd, command, args, q, isGroup, sender, senderNumber, botNumber2, botNumber, pushname, isMe, isOwner, groupMetadata, groupName, participants, groupAdmins, isBotAdmins, isAdmins, reply });
                } catch (e) {
                    console.error(`[PLUGIN CMD ERROR - ${command}] ` + e);
                    reply("⚠️ Error executing command: " + e.message);
                }
            } else {
                // Optional: Command not found message
                // reply(`Command "${command}" not found. Type ${prefix}menu to see available commands.`);
            }
        } else {
            // Event-based plugins (non-commands)
            events.commands.forEach(async (eventCmd) => {
                try {
                    const commonArgs = {from, quoted, body, isCmd: false, command: null, args, q, isGroup, sender, senderNumber, botNumber2, botNumber, pushname, isMe, isOwner, groupMetadata, groupName, participants, groupAdmins, isBotAdmins, isAdmins, reply};
                    if (body && eventCmd.on === "body") { // 'l' was undefined here
                        await eventCmd.function(conn, mek, m, commonArgs);
                    } else if (type === 'conversation' && eventCmd.on === "text") { // mek.q is not standard, use type check
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
        //============================================================================
    });
} // connectToWA function's closing bracket

app.get("/", (req, res) => {
    res.send("Bot server is running! ✅");
});

app.listen(port, () => console.log(`Server listening on port http://localhost:${port}`));

// Ensure session is handled before calling connectToWA if session download is active
if (fs.existsSync(__dirname + '/auth_info_baileys/creds.json')) {
    setTimeout(() => { // Small delay to ensure other initializations if any
        connectToWA();
    }, 1000); // Reduced delay
} else if (!config.SESSION_ID) {
    console.log("No session ID and no existing session file. Bot cannot start without a session.");
    // process.exit(1); // Or handle QR generation if printQRInTerminal is true
} else {
    // If session ID is present and file doesn't exist, the download logic at the top will run.
    // We need a way to call connectToWA() *after* the download completes.
    // A simple way is to call it inside the writeFile callback of the download.
    // For now, the setTimeout below is a less robust way if download takes time.
    console.log("Waiting for session download to complete (if configured)...");
     setTimeout(() => {
        if (fs.existsSync(__dirname + '/auth_info_baileys/creds.json')) {
            connectToWA();
        } else {
            console.error("Session file still not found after delay. Please check session download or provide SESSION_ID.");
        }
    }, 10000); // Increased delay to allow for mega download
}