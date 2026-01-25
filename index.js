const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    jidNormalizedUser,
    getContentType,
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

const ownerNumber = ['94701391585']; // ඔයාගේ නම්බර් එක

const express = require("express");
const app = express();
const port = process.env.PORT || 8000;

// ආරම්භක අගයන්
let botSettings = getBotSettings();
let prefix = botSettings.PREFIX;

async function connectToWA() {
    await connectDB(); // DB සම්බන්ධ කරන්න

    try {
        await readEnv(); 
        botSettings = getBotSettings(); 
        prefix = botSettings.PREFIX || "."; 
        console.log("Bot settings loaded from DB. Prefix:", prefix, "Mode:", botSettings.MODE);
    } catch (error) {
        console.warn("Could not load settings from DB. Using default/hardcoded settings.", error.message);
    }

    console.log("Connecting APEX-MD Wa-BOT 🧬...");
    const { state, saveCreds } = await useMultiFileAuthState(__dirname + '/auth_info_baileys/');
    
    // ⚠️ වැදගත් වෙනස්කම: මෙතන තිබුන 'fetchLatestBaileysVersion' අයින් කළා.
    // එය තිබුනොත් Session එක කැඩෙනවා. දැන් ගන්නේ කෙලින්ම install කරපු version එකයි.

    const conn = makeWASocket({
        logger: P({ level: 'silent' }),
        printQRInTerminal: true,
        browser: Browsers.macOS("Firefox"),
        syncFullHistory: true,
        auth: state,
        // version: version <-- මෙය අයින් කරන ලදී
        generateHighQualityLinkPreview: true,
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
                                     statusCode !== DisconnectReason.connectionClosed && 
                                     statusCode !== DisconnectReason.connectionLost && 
                                     statusCode !== DisconnectReason.timedOut); 

            console.log('Connection closed due to ', lastDisconnect.error, ', reconnecting ', shouldReconnect);
            
            if (statusCode === DisconnectReason.loggedOut) {
                console.log('Connection logged out, please delete auth_info_baileys and restart.');
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
                    image: { url: botSettings.ALIVE_IMG || `https://imgur.com/a/JVLUBdD` }, 
                    caption: up
                }).catch(e => console.error("Error sending welcome message to owner:", e));
            }
        }
    });

    // ⚠️ අතිශය වැදගත්: Session එක Save වෙන්න මේ පේළිය අනිවාර්යයි
    conn.ev.on('creds.update', saveCreds);

    conn.ev.on('messages.upsert', async (mekEvent) => {
        const mek = mekEvent.messages[0];
        if (!mek.message || mek.key.remoteJid === 'status@broadcast') return;

        const m = sms(conn, mek);
        if (!m || !m.type) return;

        // සෑම මැසේජ් එකකදීම Settings අලුත් කරගැනීම
        botSettings = getBotSettings(); 
        prefix = botSettings.PREFIX || "."; 

        const body = m.body || ''; 
        
        const isCmd = body && body.startsWith(prefix);
        const command = isCmd ? body.slice(prefix.length).trim().split(' ')[0].toLowerCase() : '';
        const args = body.trim().split(/ +/).slice(1);
        const q = args.join(' ');
        
        const from = m.chat; 
        const quoted = m.quoted; 
        const isGroup = m.isGroup; 
        const sender = m.sender; 

        if (!sender) return;
        if (!conn.user || !conn.user.id) return;

        const senderNumber = sender.split('@')[0];
        const botNumber = conn.user.id.split(':')[0];
        const pushname = mek.pushName || 'no name'; 
        const isMe = senderNumber === botNumber; 
        const isOwner = ownerNumber.includes(senderNumber) || isMe;
        const botNumber2 = await jidNormalizedUser(conn.user.id);
        
        const groupMetadata = isGroup ? await conn.groupMetadata(from).catch(e => { return null; }) : null;
        const groupName = groupMetadata ? groupMetadata.subject : '';
        const participants = groupMetadata ? groupMetadata.participants : [];
        const groupAdmins = isGroup && participants.length > 0 ? getGroupAdmins(participants) : [];
        const isBotAdmins = isGroup && groupAdmins.length > 0 ? groupAdmins.includes(botNumber2) : false;
        const isAdmins = isGroup && groupAdmins.length > 0 ? groupAdmins.includes(sender) : false;
        
        const reply = (teks, chatId = from, options = {}) => m.reply(teks, chatId, options); 

        // File Sending Function
        conn.sendFileUrl = async (jid, url, caption, quotedMsg, options = {}) => {
            let mime = '';
            try {
                const headRes = await axios.head(url, { timeout: 5000 });
                mime = headRes.headers['content-type'];
                if (!mime) throw new Error("Could not determine MIME type");

                const buffer = await getBuffer(url); 
                if (!buffer) throw new Error("Failed to download file buffer");

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
                reply(`Error sending file: ${error.message}`, from); 
            }
        };

        const currentWorkMode = botSettings.MODE ? botSettings.MODE.toLowerCase() : 'public';
        if (currentWorkMode === 'private' && !isOwner) return;
        if (currentWorkMode === 'inbox' && !isOwner && isGroup) return;
        if (currentWorkMode === 'groups' && !isGroup && !isOwner) return;

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
    // Session File Handling
    const authPath = path.join(__dirname, 'auth_info_baileys', 'creds.json');
    const authDir = path.join(__dirname, 'auth_info_baileys');

    if (!fs.existsSync(authDir)) {
        try {
            fs.mkdirSync(authDir, { recursive: true });
        } catch (e) {
            console.error("Failed to create auth directory:", e);
            process.exit(1);
        }
    }

    if (fs.existsSync(authPath)) {
        console.log("Session file found. Connecting to WhatsApp...");
        connectToWA().catch(err => {
            console.error("Failed to connect to WhatsApp with existing session:", err);
        });
    } else if (appConfig.SESSION_ID) {
        console.log("Session file not found, attempting to download using SESSION_ID...");
        const sessdata = appConfig.SESSION_ID.trim();
        // Check for valid format
        const sessionUrl = `https://mega.nz/file/${sessdata}`;
        console.log(`Downloading session from: ${sessionUrl}`);
        try {
            const filer = File.fromURL(sessionUrl);
            filer.download((err, data) => {
                if (err) {
                    console.error("Error downloading session:", err);
                    connectToWA().catch(qrErr => console.error("Failed to connect for QR scan:", qrErr));
                    return;
                }
                fs.writeFile(authPath, data, (writeErr) => {
                    if (writeErr) {
                        console.error("Error writing session file:", writeErr);
                        connectToWA().catch(qrErr => console.error("Failed to connect for QR scan:", qrErr));
                        return;
                    }
                    console.log("Session downloaded and written successfully ✅");
                    connectToWA().catch(connErr => console.error("Failed to connect:", connErr));
                });
            });
        } catch (e) {
            console.error("MegaJS Error:", e);
            connectToWA().catch(err => console.error("Failed to connect for QR scan:", err));
        }
    } else {
        console.log("No Session ID. Connecting for QR Scan...");
        connectToWA().catch(err => console.error("Failed to connect:", err));
    }
}

app.get("/", (req, res) => {
    res.send("Hey, bot is starting or running ✅");
});

app.listen(port, () => {
    console.log(`Server listening on port http://localhost:${port}`);
    startBot();
});
