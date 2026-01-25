const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    jidNormalizedUser,
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
const { getBotSettings, readEnv, connectDB } = require('./lib/mongodb');

const ownerNumber = ['94701391585']; // ඔයාගේ නම්බර් එක
const express = require("express");
const app = express();
const port = process.env.PORT || 8000;

let botSettings = getBotSettings();
let prefix = botSettings.PREFIX;

async function connectToWA() {
    await connectDB();

    try {
        await readEnv();
        botSettings = getBotSettings();
        prefix = botSettings.PREFIX || ".";
        console.log("Bot settings loaded. Prefix:", prefix, "Mode:", botSettings.MODE);
    } catch (error) {
        console.warn("Could not load settings from DB.", error.message);
    }

    console.log("Connecting APEX-MD Wa-BOT 🧬...");

    const { state, saveCreds } = await useMultiFileAuthState(__dirname + '/auth_info_baileys/');
    const { version } = await fetchLatestBaileysVersion();

    const conn = makeWASocket({
        logger: P({ level: 'silent' }),
        printQRInTerminal: true,
        browser: Browsers.ubuntu("Chrome"), // 405 Error වලක්වයි
        syncFullHistory: true,
        auth: state,
        version: version, 
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
                console.log('Logged out. Please delete Session and restart.');
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
            }
            console.log('APEX-MD connected to WhatsApp ✅');

            if (ownerNumber.length > 0) {
                let up = `APEX-MD connected successful ✅\n\nPREFIX: ${prefix}`;
                conn.sendMessage(ownerNumber[0] + "@s.whatsapp.net", {
                    image: { url: botSettings.ALIVE_IMG },
                    caption: up
                }).catch(e => console.error("Error sending welcome:", e));
            }
        }
    });

    conn.ev.on('creds.update', saveCreds);

    conn.ev.on('messages.upsert', async (mekEvent) => {
        const mek = mekEvent.messages[0];
        if (!mek.message || mek.key.remoteJid === 'status@broadcast') return;

        const m = sms(conn, mek);
        if (!m || !m.type) return;

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
    const authPath = path.join(__dirname, 'auth_info_baileys', 'creds.json');
    const authDir = path.join(__dirname, 'auth_info_baileys');

    if (!fs.existsSync(authDir)) {
        fs.mkdirSync(authDir, { recursive: true });
    }

    if (fs.existsSync(authPath)) {
        console.log("Session file found. Connecting...");
        connectToWA().catch(err => console.error("Connection Error:", err));
    } else if (appConfig.SESSION_ID) {
        console.log("Downloading session from SESSION_ID...");
        const sessdata = appConfig.SESSION_ID.trim();
        const sessionUrl = `https://mega.nz/file/${sessdata}`;
        
        try {
            const filer = File.fromURL(sessionUrl);
            filer.download((err, data) => {
                if (err) {
                    console.error("Session download failed. Starting QR Scan.");
                    connectToWA();
                    return;
                }
                fs.writeFile(authPath, data, () => {
                    console.log("Session downloaded ✅");
                    connectToWA();
                });
            });
        } catch (e) {
            console.error("MegaJS Error:", e);
            connectToWA();
        }
    } else {
        console.log("No Session ID. Starting QR Scan...");
        connectToWA();
    }
}

app.get("/", (req, res) => {
    res.send("APEX-MD Bot is Running ✅");
});

app.listen(port, () => {
    console.log(`Server listening on port http://localhost:${port}`);
    startBot();
});
