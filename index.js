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
const { sms } = require('./lib/msg'); 
const axios = require('axios');
const { File } = require('megajs');
const path = require('path');
const { getBotSettings, readEnv, updateEnv, connectDB } = require('./lib/mongodb');
require('./keepAlive')(); // add this at the top

// --- mongodb.js import අවසානය ---

const ownerNumber = ['94701391585'];

const express = require("express");
const app = express();
const port = process.env.PORT || 8000;

// Global variable for bot settings, to be populated by readEnv
// ආරම්භක අගයන් mongodb.js හි ඇති getBotSettings() වෙතින් ලබා ගන්න
let botSettings = getBotSettings();
let prefix = botSettings.PREFIX;

async function connectToWA() {
    await connectDB(); // DB සම්බන්ධ කරන්න

    // Read environment settings from DB
    try {
        // DB එකෙන් settings load කර, global botSettings object එක update කරන්න
        await readEnv(); // මෙය _botSettings internal variable එක update කරයි
        botSettings = getBotSettings(); // update වූ _botSettings එකේ copy එකක් ගන්න
        prefix = botSettings.PREFIX || "."; // Update prefix based on new settings
        console.log("Bot settings loaded from DB. Prefix:", prefix, "Mode:", botSettings.MODE);
    } catch (error) {
        console.warn("Could not load settings from DB. Using default/hardcoded settings.", error.message);
    }

    console.log("Connecting APEX-MD Wa-BOT 🧬...");
    const { state, saveCreds } = await useMultiFileAuthState(__dirname + '/auth_info_baileys/');
    var { version } = await fetchLatestBaileysVersion();

    const conn = makeWASocket({
        logger: P({ level: 'silent' }),
        printQRInTerminal: true,
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
            const statusCode = lastDisconnect.error?.output?.statusCode;
            const shouldReconnect = (statusCode !== DisconnectReason.loggedOut &&
                                     statusCode !== DisconnectReason.connectionClosed && // if we closed it intentionally
                                     statusCode !== DisconnectReason.connectionLost && // if internet issue, baileys handles it
                                     statusCode !== DisconnectReason.timedOut); // baileys handles it

            console.log('Connection closed due to ', lastDisconnect.error, ', reconnecting ', shouldReconnect);
            
            if (statusCode === DisconnectReason.loggedOut) {
                console.log('Connection logged out, please delete auth_info_baileys and restart.');
                // Optionally: fs.rmSync(__dirname + '/auth_info_baileys', { recursive: true, force: true });
                // process.exit(1); // or trigger re-login flow
            } else if (shouldReconnect) {
                connectToWA();
            }
        } else if (connection === 'open') {
            console.log('⬇️ Installing APEX-MD Plugins... ');
            const pluginDir = "./plugins/";
            if (fs.existsSync(pluginDir)) {
                fs.readdirSync(pluginDir).forEach((pluginFile) => {
                    if (path.extname(pluginFile).toLowerCase() === ".js") {
                        try {
                            require(path.join(__dirname, pluginDir, pluginFile));
                        } catch (e) {
                            console.error(`Error loading plugin ${pluginFile}:`, e);
                        }
                    }
                });
                console.log('APEX-MD Plugins installed successful ✅');
            } else {
                console.warn("Plugins directory not found. No plugins loaded.");
            }
            
            console.log('APEX-MD connected to WhatsApp ✅');

            if (ownerNumber && ownerNumber.length > 0 && ownerNumber[0]) {
                let up = `APEX-MD connected successful ✅\n\nPREFIX: ${prefix}`;
                conn.sendMessage(ownerNumber[0] + "@s.whatsapp.net", {
                    image: { url: botSettings.ALIVE_IMG || `https://imgur.com/a/JVLUBdD` }, // Use ALIVE_IMG from settings
                    caption: up
                }).catch(e => console.error("Error sending welcome message to owner:", e));
            }
        }
    });

    conn.ev.on('creds.update', saveCreds);

    conn.ev.on('messages.upsert', async (mekEvent) => {
        const mek = mekEvent.messages[0];
        if (!mek.message || mek.key.remoteJid === 'status@broadcast') return;
        // Ephemeral and viewOnce messages are handled inside sms function

        const m = sms(conn, mek);
        if (!m || !m.type) {
            // 'm' හෝ 'm.type' වල ගැටලුවක් ඇත්නම් ලොග් කිරීම හොඳයි
            console.warn("අවවාදය: sms(conn, mek) මගින් වලංගු නොවන 'm' වස්තුවක් හෝ 'm.type' එකක් ලැබී ඇත. පණිවිඩය මඟ හරිනු ලැබේ.");
            return;
        }

        // --- `botSettings` සහ `prefix` අගයන් `messages.upsert` event එක ඇතුලේදීද යාවත්කාලීන කරගන්න ---
        // මෙය මඟින් command.js හි mode වෙනස් කළ පසු එම වෙනස්කම් ක්ෂණිකව බලපායි.
        botSettings = getBotSettings(); // සෑම පණිවිඩයකදීම නවතම settings ලබා ගන්න
        prefix = botSettings.PREFIX || "."; // prefix ද යාවත්කාලීන කරන්න
        // --- යාවත්කාලීන කිරීම අවසානය ---

        const body = m.body || ''; // Use m.body directly from sms function
        
        const isCmd = body && body.startsWith(prefix);
        const command = isCmd ? body.slice(prefix.length).trim().split(' ')[0].toLowerCase() : '';
        const args = body.trim().split(/ +/).slice(1);
        const q = args.join(' ');
        
        const from = m.chat; // Use from sms
        const quoted = m.quoted; // Use from sms
        const isGroup = m.isGroup; // Use from sms
        const sender = m.sender; // Use from sms

        // --- දෝෂය ඇතිවන ස්ථාන සඳහා නව පරීක්ෂා කිරීම් ආරම්භය ---
        if (!sender) {
            console.error(`[ERROR] m.sender හිස් හෝ අර්ථ දක්වා නැත. Chat: ${m.chat || 'N/A'}, Type: ${m.type || 'N/A'}. පණිවිඩය මඟ හරිනු ලැබේ.`);
            return; // ක්‍රෑෂ් වීම වැළැක්වීමට මෙම පණිවිඩය සැකසීම මඟ හරින්න
        }

        if (!conn.user || !conn.user.id) {
            console.error("[ERROR] conn.user.id හිස් හෝ අර්ථ දක්වා නැත. බොට් එක සම්පූර්ණයෙන් ලොග් වී නොතිබෙන්නට පුළුවන. පණිවිඩය මඟ හරිනු ලැබේ.");
            return; // මෙම පණිවිඩය සැකසීම මඟ හරින්න
        }
        // --- දෝෂය ඇතිවන ස්ථාන සඳහා නව පරීක්ෂා කිරීම් අවසානය ---

        const senderNumber = sender.split('@')[0];
        const botNumber = conn.user.id.split(':')[0];
        const pushname = mek.pushName || 'no name'; // mek.pushName is fine
        const isMe = senderNumber === botNumber; // More direct comparison
        const isOwner = ownerNumber.includes(senderNumber) || isMe;
        const botNumber2 = await jidNormalizedUser(conn.user.id);
        
        const groupMetadata = isGroup ? await conn.groupMetadata(from).catch(e => { console.error("කණ්ඩායම් තොරතුරු ලබාගැනීමේ දෝෂය:", e); return null; }) : null;
        const groupName = groupMetadata ? groupMetadata.subject : '';
        const participants = groupMetadata ? groupMetadata.participants : [];
        const groupAdmins = isGroup && participants.length > 0 ? getGroupAdmins(participants) : [];
        const isBotAdmins = isGroup && groupAdmins.length > 0 ? groupAdmins.includes(botNumber2) : false;
        const isAdmins = isGroup && groupAdmins.length > 0 ? groupAdmins.includes(sender) : false;
        
        const reply = (teks, chatId = from, options = {}) => m.reply(teks, chatId, options); // Use m.reply

        conn.sendFileUrl = async (jid, url, caption, quotedMsg, options = {}) => {
            let mime = '';
            try {
                const headRes = await axios.head(url, { timeout: 5000 }).catch(e => {
                    console.error(`Failed to get HEAD for ${url}: ${e.message}`);
                    throw new Error(`Could not fetch headers: ${e.message}`);
                });
                mime = headRes.headers['content-type'];

                if (!mime) throw new Error("Could not determine MIME type from headers.");

                const buffer = await getBuffer(url); // Uses updated getBuffer from functions.js
                if (!buffer) throw new Error("Failed to download file buffer.");

                const fileNameFromUrl = path.basename(new URL(url).pathname);

                if (mime.split("/")[0] === "image" && mime.split("/")[1] === "gif") {
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
                return conn.sendMessage(jid, { document: buffer, mimetype: mime, caption: caption, fileName: fileNameFromUrl || "file" + path.extname(url), ...options }, { quoted: quotedMsg });

            } catch (error) {
                console.error("Error in sendFileUrl:", error);
                reply(`Error sending file: ${error.message || String(error)}`, from); // Reply to the original chat
            }
        };

        const currentWorkMode = botSettings.MODE ? botSettings.MODE.toLowerCase() : 'public';
        if (currentWorkMode === 'private' && !isOwner) return;
        if (currentWorkMode === 'inbox' && !isOwner && isGroup) return;
        if (currentWorkMode === 'groups' && !isGroup && !isOwner) return;
        if (!['public', 'private', 'inbox', 'groups'].includes(currentWorkMode)) {
            console.log(`[WORKMODE] Unknown mode "${botSettings.MODE}". Defaulting to public behavior.`);
        }

        const events = require('./command');
        const cmdName = command;

        if (isCmd && cmdName) {
            const cmdObj = events.commands.find((cmd) => cmd.pattern === cmdName) || events.commands.find((cmd) => cmd.alias && cmd.alias.includes(cmdName));
            if (cmdObj) {
                if (cmdObj.react) conn.sendMessage(from, { react: { text: cmdObj.react, key: mek.key } });
                try {
                    cmdObj.function(conn, mek, m, { from, quoted, body, isCmd, command: cmdName, cmdObject: cmdObj, args, q, isGroup, sender, senderNumber, botNumber2, botNumber, pushname, isMe, isOwner, groupMetadata, groupName, participants, groupAdmins, isBotAdmins, isAdmins, reply });
                } catch (e) {
                    console.error(`[PLUGIN ERROR][${cmdName}]`, e);
                }
            }
        } else if (body) {
            events.commands.forEach(async (cmdObject) => {
                if (cmdObject.on) {
                    const commonParams = { from, quoted, body, isCmd: false, command: '', cmdObject, args, q, isGroup, sender, senderNumber, botNumber2, botNumber, pushname, isMe, isOwner, groupMetadata, groupName, participants, groupAdmins, isBotAdmins, isAdmins, reply };
                    try {
                        if (cmdObject.on === "body") {
                            cmdObject.function(conn, mek, m, commonParams);
                        } else if (cmdObject.on === "text" && q) {
                            cmdObject.function(conn, mek, m, commonParams);
                        } else if ((cmdObject.on === "image" || cmdObject.on === "photo") && m.type === "imageMessage") {
                            cmdObject.function(conn, mek, m, commonParams);
                        } else if (cmdObject.on === "sticker" && m.type === "stickerMessage") {
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

async function startBot() {
    // connectDB is now called inside connectToWA, so no need to call it again here
    const authPath = path.join(__dirname, 'auth_info_baileys', 'creds.json');
    const authDir = path.join(__dirname, 'auth_info_baileys');

    if (!fs.existsSync(authDir)) {
        try {
            fs.mkdirSync(authDir, { recursive: true });
        } catch (e) {
            console.error("Failed to create auth directory:", e);
            process.exit(1); // Critical error
        }
    }

    if (fs.existsSync(authPath)) {
        console.log("Session file found. Connecting to WhatsApp...");
        connectToWA().catch(err => {
            console.error("Failed to connect to WhatsApp with existing session:", err);
            // Optionally, try deleting creds and restarting if connection fails badly
            // fs.unlinkSync(authPath); startBot();
        });
    } else if (appConfig.SESSION_ID) {
        console.log("Session file not found, attempting to download using SESSION_ID...");
        const sessdata = appConfig.SESSION_ID.trim();
        if (!/^[a-zA-Z0-9#_-]+$/.test(sessdata)) { // Allow underscore and hyphen
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
                    console.log("Please check your SESSION_ID or network connection. Attempting QR scan.");
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
            console.error("Error initializing MegaJS File object or an issue with the URL:", e);
            console.log("This could be an invalid SESSION_ID format. Attempting QR scan.");
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
    startBot();
});