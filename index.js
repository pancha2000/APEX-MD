// ================================================================
// 🛑 ERROR HIDER & LOG CLEANER (වද දෙන Error හංගන කොටස)
// ================================================================
const originalConsoleError = console.error;
const originalConsoleLog = console.log;

// මේ වචන තියෙන මැසේජ් Console එකේ පෙන්නන්නේ නෑ
const hideList = [
    'Bad MAC', 
    'No session', 
    'decrypt', 
    'Closing session', 
    'Stream Errored', 
    'stream errored', 
    'conflict', 
    'Timed Out', 
    'Connection Closed',
    'Connection lost',
    'Reconnecting'
];

console.error = function (msg, ...args) {
    const str = String(msg || '');
    if (hideList.some(term => str.includes(term))) return;
    originalConsoleError.apply(console, [msg, ...args]);
};

console.log = function (msg, ...args) {
    const str = String(msg || '');
    if (hideList.some(term => str.includes(term))) return;
    originalConsoleLog.apply(console, [msg, ...args]);
};
// ================================================================

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

const ownerNumber = ['94701391585']; 
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
        // Warning එකක් විදිහට පෙන්නන්න, ඒත් Error Filter එකට අහුවෙනවා නම් පෙන්නන්නේ නෑ
        if (!error.message.includes('Timed Out')) {
            console.warn("Could not load settings from DB.", error.message);
        }
    }

    console.log("Connecting APEX-MD Wa-BOT 🧬...");

    const { state, saveCreds } = await useMultiFileAuthState(__dirname + '/auth_info_baileys/');
    const { version } = await fetchLatestBaileysVersion();

    const conn = makeWASocket({
        // 🤫 SILENT MODE: මේකෙන් අර දිග JSON logs ඔක්කොම නවතිනවා
        logger: P({ level: 'silent' }), 
        printQRInTerminal: true,
        browser: Browsers.ubuntu("Chrome"),
        syncFullHistory: false, 
        auth: state,
        version: version,
        generateHighQualityLinkPreview: true,
        connectTimeoutMs: 60000, 
        keepAliveIntervalMs: 10000, 
        retryRequestDelayMs: 2000 
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

            // Log එක filter කරලා යවනවා
            const errStr = String(lastDisconnect.error || '');
            if (!hideList.some(term => errStr.includes(term))) {
                console.log('Connection closed, reconnecting:', shouldReconnect);
            }

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
                }).catch(e => {
                    // Welcome Msg එකේ එන පොඩි පොඩි Error ගණන් ගන්නේ නෑ
                });
            }
        }
    });

    conn.ev.on('creds.update', saveCreds);

    conn.ev.on('messages.upsert', async (mekEvent) => {
        const mek = mekEvent.messages[0];
        if (!mek.message || mek.key.remoteJid === 'status@broadcast') return;
        
        // ⚠️ @lid මැසේජ් සහ Poll Updates බ්ලොක් කිරීම
        if (mek.key.remoteJid.includes('@lid') || mek.message.protocolMessage) return;

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
                    await cmdObj.function(conn, mek, m, { from, quoted, body, isCmd, command: cmdName, cmdObject: cmdObj, args, q, isGroup, sender, senderNumber, botNumber2, botNumber, pushname, isMe, isOwner, groupMetadata, groupName, participants, groupAdmins, isBotAdmins, isAdmins, reply });
                } catch (e) {
                    console.error(`[PLUGIN ERROR] ${cmdName}:`, e);
                    reply("❌ අම්මටසිරි පොඩි අවුලක් ගියා. මම මේක Owner ට දැන්ම කිව්වා.");

                    const errorReport = `
🚨 *APEX-MD ERROR REPORT* 🚨

🤖 *Command:* ${cmdName}
👤 *User:* ${pushname} (${senderNumber})
💬 *Chat:* ${isGroup ? groupName : 'Private Chat'}
📄 *Error:* \`\`\`${e.message}\`\`\`
stacks: \`\`\`${e.stack}\`\`\`
`;
                    await conn.sendMessage(ownerNumber[0] + "@s.whatsapp.net", { 
                        text: errorReport,
                        contextInfo: {
                            mentionedJid: [sender]
                        }
                    });
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
                         // Plugin වලින් එන පොඩි පොඩි එරර් එළියට නොදා ඉමු
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
        connectToWA().catch(err => { 
            // මෙතන Error එක Print නොකර ඉමු, මොකද උඩ Filter එකෙන් කොහොමත් අල්ලනවා
        });
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

process.on('uncaughtException', function (err) {
    // මේකෙන් අර අන්තිමටම එන ලොකු Error ටික console එකට යවන එක නවත්තනවා (filter එක හරහා යන නිසා)
    const errStr = String(err);
    if (!hideList.some(term => errStr.includes(term))) {
        console.log('Caught exception: ', err);
    }
});

process.on('unhandledRejection', (reason, promise) => {
    const errStr = String(reason);
    if (!hideList.some(term => errStr.includes(term))) {
        console.log('Unhandled Rejection at:', promise, 'reason:', reason);
    }
});

