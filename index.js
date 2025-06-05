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
const appConfig = require('./config');
const qrcode = require('qrcode-terminal');
// const util = require('util'); // Not used in this snippet, but kept as it was in original
const { sms, downloadMediaMessage } = require('./lib/msg'); // downloadMediaMessage not used directly in this snippet
const axios = require('axios');
const { File } = require('megajs');
const mongoose = require('mongoose'); // Assumed for connectDB
const path = require('path'); // Moved path import here as it's used globally

const ownerNumber = ['94701391585'];

const express = require("express");
const app = express();
const port = process.env.PORT || 8000;

async function connectToWA() {
    const connectDB = require('./lib/mongodb');
    connectDB();
    
    const { readEnv } = require('./lib/database');
    const botSettings = await readEnv();
    const prefix = botSettings.PREFIX || ".";
    
    console.log("Connecting wa bot 🧬...");
    const { state, saveCreds } = await useMultiFileAuthState(__dirname + '/auth_info_baileys/');
    var { version } = await fetchLatestBaileysVersion();

    const conn = makeWASocket({
        logger: P({ level: 'silent' }),
        printQRInTerminal: true, // Set to true to allow QR scan if no session
        browser: Browsers.macOS("Firefox"),
        syncFullHistory: true,
        auth: state,
        version
    });

    conn.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr && !conn.authState.creds.registered) {
            console.log('Scan QR code to connect:');
            qrcode.generate(qr, { small: true });
        }
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut);
            console.log('Connection closed due to ', lastDisconnect.error, ', reconnecting ', shouldReconnect);
            if (shouldReconnect) {
                connectToWA();
            } else {
                console.log('Connection closed due to logout. Please delete auth_info_baileys and restart.');
                // Optionally, you could try to delete the auth_info_baileys directory here
                // and then call startBot() again to re-trigger the session download/QR scan.
                // fs.rmSync(__dirname + '/auth_info_baileys', { recursive: true, force: true });
                // startBot(); // This would re-initiate the process.
            }
        } else if (connection === 'open') {
            console.log('😼 Installing Plugins... ');
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
            console.log('Bot connected to WhatsApp ✅');

            if (ownerNumber && ownerNumber.length > 0 && ownerNumber[0]) {
                let up = `Wa-BOT connected successful ✅\n\nPREFIX: ${prefix}`;
                conn.sendMessage(ownerNumber[0] + "@s.whatsapp.net", {
                    image: { url: `https://telegra.ph/file/900435c6d3157c98c3c88.jpg` },
                    caption: up
                }).catch(e => console.error("Error sending welcome message to owner:", e));
            }
        }
    });

    conn.ev.on('creds.update', saveCreds);

    conn.ev.on('messages.upsert', async (mekEvent) => {
        const mek = mekEvent.messages[0];
        if (!mek.message) return;
        mek.message = (getContentType(mek.message) === 'ephemeralMessage') ? mek.message.ephemeralMessage.message : mek.message;
        if (mek.key && mek.key.remoteJid === 'status@broadcast') return;

        const m = sms(conn, mek); // Assuming 'sms' processes 'mek'
        const type = getContentType(mek.message);
        // const content = JSON.stringify(mek.message); // Use sparingly
        const from = mek.key.remoteJid;
        const quoted = type === 'extendedTextMessage' && mek.message.extendedTextMessage.contextInfo != null ? mek.message.extendedTextMessage.contextInfo.quotedMessage || {} : {};
        
        // Body extraction: Prefer m.body or m.text if available from the 'sms' function
        // For now, using the explicit extraction method:
        let body = '';
        if (type === 'conversation') {
            body = mek.message.conversation;
        } else if (type === 'extendedTextMessage' && mek.message.extendedTextMessage) {
            body = mek.message.extendedTextMessage.text;
        } else if (type === 'imageMessage' && mek.message.imageMessage && mek.message.imageMessage.caption) {
            body = mek.message.imageMessage.caption;
        } else if (type === 'videoMessage' && mek.message.videoMessage && mek.message.videoMessage.caption) {
            body = mek.message.videoMessage.caption;
        }
        // If your 'sms(conn, mek)' function populates m.body, use:
        // const body = m.body || ''; 

        const isCmd = body && body.startsWith(prefix); // Ensure body is not null/undefined
        const command = isCmd ? body.slice(prefix.length).trim().split(' ')[0].toLowerCase() : '';
        const args = body && typeof body.trim === 'function' ? body.trim().split(/ +/).slice(1) : [];
        const q = args.join(' ');
        const isGroup = from.endsWith('@g.us');
        const sender = mek.key.fromMe ? (conn.user.id.split(':')[0] + '@s.whatsapp.net' || conn.user.id) : (mek.key.participant || mek.key.remoteJid);
        const senderNumber = sender.split('@')[0];
        const botNumber = conn.user.id.split(':')[0];
        const pushname = mek.pushName || 'Sin Nombre';
        const isMe = botNumber.includes(senderNumber);
        const isOwner = ownerNumber.includes(senderNumber) || isMe;
        const botNumber2 = await jidNormalizedUser(conn.user.id);
        
        const groupMetadata = isGroup ? await conn.groupMetadata(from).catch(e => { console.error("Error fetching group metadata:", e); return null; }) : null;
        const groupName = isGroup && groupMetadata ? groupMetadata.subject : '';
        const participants = isGroup && groupMetadata ? groupMetadata.participants : [];
        const groupAdmins = isGroup && participants.length > 0 ? getGroupAdmins(participants) : [];
        const isBotAdmins = isGroup && groupAdmins.length > 0 ? groupAdmins.includes(botNumber2) : false;
        const isAdmins = isGroup && groupAdmins.length > 0 ? groupAdmins.includes(sender) : false;
        
        const reply = (teks) => {
            conn.sendMessage(from, { text: teks }, { quoted: mek });
        };

        conn.sendFileUrl = async (jid, url, caption, quotedMsg, options = {}) => {
            let mime = '';
            try {
                const res = await axios.head(url);
                mime = res.headers['content-type'];
                if (!mime) throw new Error("Could not determine MIME type");

                const buffer = await getBuffer(url);
                const fileNameFromUrl = path.basename(new URL(url).pathname);


                if (mime.split("/")[0] === "image" && mime.split("/")[1] === "gif") { // More specific GIF check
                    return conn.sendMessage(jid, { video: buffer, caption: caption, gifPlayback: true, ...options }, { quoted: quotedMsg });
                }
                if (mime === "application/pdf") {
                    return conn.sendMessage(jid, { document: buffer, mimetype: 'application/pdf', fileName: caption || fileNameFromUrl || "document.pdf", caption: caption, ...options }, { quoted: quotedMsg });
                }
                if (mime.startsWith("image/")) {
                    return conn.sendMessage(jid, { image: buffer, caption: caption, ...options }, { quoted: quotedMsg });
                }
                if (mime.startsWith("video/")) {
                    return conn.sendMessage(jid, { video: buffer, caption: caption, mimetype: mime, ...options }, { quoted: quotedMsg });
                }
                if (mime.startsWith("audio/")) {
                    return conn.sendMessage(jid, { audio: buffer, mimetype: mime, ...options }, { quoted: quotedMsg });
                }
                return conn.sendMessage(jid, { document: buffer, mimetype: mime, caption: caption, fileName: fileNameFromUrl || "file" + path.extname(url) , ...options }, { quoted: quotedMsg });

            } catch (error) {
                console.error("Error in sendFileUrl:", error);
                reply(`Error sending file: ${error.message || String(error)}`);
            }
        };

        const workMode = botSettings.MODE ? botSettings.MODE.toLowerCase() : 'public';
        if (workMode === 'private' && !isOwner) return;
        if (workMode === 'inbox' && !isOwner && isGroup) return;
        if (workMode === 'groups' && !isGroup && !isOwner) return;
        // No explicit 'public' return, as it processes all.
        // Handle unknown modes by defaulting to public or a more restrictive behavior if desired.
        if (!['public', 'private', 'inbox', 'groups'].includes(workMode)) {
            console.log(`[WORKMODE] Unknown mode "${botSettings.MODE}". Defaulting to public behavior.`);
        }

        const events = require('./command');
        
        const cmdName = command; // Use 'command' which is already extracted

        if (isCmd && cmdName) {
            const cmdObj = events.commands.find((cmd) => cmd.pattern === cmdName) || events.commands.find((cmd) => cmd.alias && cmd.alias.includes(cmdName));
            if (cmdObj) {
                if (cmdObj.react) conn.sendMessage(from, { react: { text: cmdObj.react, key: mek.key } });

                try {
                    cmdObj.function(conn, mek, m, { from, quoted, body, isCmd, command: cmdName, cmdObject: cmdObj, args, q, isGroup, sender, senderNumber, botNumber2, botNumber, pushname, isMe, isOwner, groupMetadata, groupName, participants, groupAdmins, isBotAdmins, isAdmins, reply });
                } catch (e) {
                    console.error(`[PLUGIN ERROR][${cmdName}]`, e);
                    // reply(`Error executing command: ${e.message}`);
                }
            }
        } else if (body) { // Only process event handlers if it's not a command AND body exists
            events.commands.forEach(async (cmdObject) => { // Changed to forEach as map's return value isn't used
                if (cmdObject.on) { // Check if the command object is an event listener
                    const commonParams = { from, quoted, body, isCmd: false, command: '', cmdObject, args, q, isGroup, sender, senderNumber, botNumber2, botNumber, pushname, isMe, isOwner, groupMetadata, groupName, participants, groupAdmins, isBotAdmins, isAdmins, reply };
                    try {
                        if (cmdObject.on === "body") { 
                            cmdObject.function(conn, mek, m, commonParams);
                        } else if (cmdObject.on === "text" && q) { 
                            cmdObject.function(conn, mek, m, commonParams);
                        } else if ((cmdObject.on === "image" || cmdObject.on === "photo") && type === "imageMessage") {
                            cmdObject.function(conn, mek, m, commonParams);
                        } else if (cmdObject.on === "sticker" && type === "stickerMessage") {
                            cmdObject.function(conn, mek, m, commonParams);
                        }
                    } catch (e) {
                         console.error(`[EVENT PLUGIN ERROR][on:${cmdObject.on}]`, e);
                    }
                }
            });
        }
    });
}

// Function to start the bot, handling session logic
async function startBot() {
    const authPath = __dirname + '/auth_info_baileys/creds.json';
    const authDir = __dirname + '/auth_info_baileys';

    if (!fs.existsSync(authDir)) {
        fs.mkdirSync(authDir, { recursive: true });
    }
    
    if (fs.existsSync(authPath)) {
        console.log("Session file found. Connecting to WhatsApp...");
        connectToWA().catch(err => console.error("Failed to connect to WhatsApp with existing session:", err));
    } else if (appConfig.SESSION_ID) {
        console.log("Session file not found, attempting to download using SESSION_ID...");
        const sessdata = appConfig.SESSION_ID;
        // Basic validation for Mega URL structure (can be improved)
        if (!/^[a-zA-Z0-9#\-_]+$/.test(sessdata)) {
            console.error("Invalid SESSION_ID format. It should be the part after 'mega.nz/file/'.");
            console.log("Attempting to connect for QR scan instead.");
            connectToWA().catch(err => console.error("Failed to connect for QR scan:", err));
            return;
        }
        const sessionUrl = `https://mega.nz/file/${sessdata}`;
        console.log(`Downloading session from: ${sessionUrl}`);
        try {
            const filer = File.fromURL(sessionUrl);
            filer.download((err, data) => {
                if (err) {
                    console.error("Error downloading session:", err);
                    console.log("Please check your SESSION_ID or network connection.");
                    console.log("Attempting to connect for QR scan instead.");
                    connectToWA().catch(qrErr => console.error("Failed to connect for QR scan after download error:", qrErr));
                    return;
                }
                fs.writeFile(authPath, data, (writeErr) => {
                    if (writeErr) {
                        console.error("Error writing session file:", writeErr);
                        console.log("Attempting to connect for QR scan instead.");
                        connectToWA().catch(qrErr => console.error("Failed to connect for QR scan after write error:", qrErr));
                        return;
                    }
                    console.log("Session downloaded and written successfully ✅");
                    connectToWA().catch(connErr => console.error("Failed to connect to WhatsApp after session download:", connErr));
                });
            });
        } catch (e) {
            console.error("Error initializing MegaJS File object or an issue with the URL. This could be an invalid SESSION_ID format.", e);
            console.log("Attempting to connect for QR scan instead.");
            connectToWA().catch(err => console.error("Failed to connect for QR scan after MegaJS init error:", err));
        }
    } else {
        console.log("Session file does not exist and no SESSION_ID provided.");
        console.log("Attempting to connect to WhatsApp to scan QR code...");
        connectToWA().catch(err => console.error("Failed to connect to WhatsApp for QR scan:", err));
    }
}


app.get("/", (req, res) => {
    res.send("Hey, bot is starting or running ✅");
});

app.listen(port, () => {
    console.log(`Server listening on port http://localhost:${port}`);
    startBot(); // Start the bot after the server has started listening
});