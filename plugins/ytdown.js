const ytdl = require('ytdl-core');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');
const fsExtra = require('fs-extra');

// Import cmd and commands from your command.js
const { cmd, commands } = require('../command'); // Make sure this path is correct based on your file structure
const { fetchJson } = require('../lib/functions'); // If you need fetchJson for anything, but not for core ytdl-core logic

// Temporary directory for downloads
const TEMP_DIR = path.join(__dirname, '..', 'tmp_downloads');
fsExtra.ensureDirSync(TEMP_DIR);

const yourName = "*APEX-MD*"; // Customize your bot's name if needed


// --- YouTube Video Downloader (!ytmp4) ---
cmd({
    pattern: "ytmp4",
    alias: ["ytv"],
    desc: "Downloads YouTube videos.",
    category: "download",
    react: "📩",
    filename: __filename
},
async(conn, mek, m, { from, quoted, body, isCmd, command, args, q, isGroup, sender, senderNumber, botNumber2, botNumber, pushname, isMe, isOwner, groupMetadata, groupName, participants, groupAdmins, isBotAdmins, isAdmins, reply }) => {
    try {
        if (!q || !q.startsWith("https://")) {
            return reply("Please provide a YouTube video URL.\n\nExample: `!ytmp4 https://www.youtube.com/watch?v=dQw4w9WgXcQ`");
        }

        const youtubeUrl = q; // 'q' contains the query string from the command handler

        if (!ytdl.validateURL(youtubeUrl)) {
            return reply('Invalid YouTube URL provided.');
        }

        const info = await ytdl.getInfo(youtubeUrl);
        const title = info.videoDetails.title.replace(/[^a-zA-Z0-9 ]/g, ''); // Sanitize title for filename
        const videoId = info.videoDetails.videoId;

        reply(`⌛ Processing "${title}"...\nPlease wait, this may take a moment.`);

        const videoFilePath = path.join(TEMP_DIR, `${title}_${videoId}.mp4`);

        const videoStream = ytdl(youtubeUrl, {
            quality: 'highestvideo',
            filter: 'videoonly'
        });

        const audioStream = ytdl(youtubeUrl, {
            quality: 'highestaudio',
            filter: 'audioonly'
        });

        await new Promise((resolve, reject) => {
            ffmpeg()
                .input(videoStream)
                .videoCodec('copy')
                .input(audioStream)
                .audioCodec('copy')
                .save(videoFilePath)
                .on('end', () => resolve())
                .on('error', (err) => reject(err));
        });

        if (fs.existsSync(videoFilePath)) {
            await conn.sendMessage(
                from, {
                    video: { url: videoFilePath },
                    mimetype: 'video/mp4',
                    caption: `✅ Successfully downloaded: *${title}*\n\n${yourName}`
                }, { quoted: mek }
            );
            fsExtra.removeSync(videoFilePath); // Clean up the temporary file
        } else {
            reply('❌ Failed to download video.');
        }

    } catch (error) {
        console.error('YouTube Video Downloader Error:', error);
        if (error.message.includes('No video formats found')) {
            reply('❌ Could not find downloadable formats for this video. It might be age-restricted or private.');
        } else if (error.message.includes('status code: 403')) {
            reply('❌ YouTube download failed due to a server error (e.g., rate limit, geo-restriction). Please try again later.');
        } else {
            reply(`❌ An error occurred while downloading: ${error.message}`);
        }
        fsExtra.emptyDirSync(TEMP_DIR); // Clean up temp dir on error
    }
});


// --- YouTube Song Downloader (!ytmp3) ---
cmd({
    pattern: "ytmp3",
    alias: ["yta"],
    desc: "Downloads YouTube songs (audio).",
    category: "download",
    react: "📩",
    filename: __filename
},
async(conn, mek, m, { from, quoted, body, isCmd, command, args, q, isGroup, sender, senderNumber, botNumber2, botNumber, pushname, isMe, isOwner, groupMetadata, groupName, participants, groupAdmins, isBotAdmins, isAdmins, reply }) => {
    try {
        if (!q || !q.startsWith("https://")) {
            return reply("Please provide a YouTube video URL.\n\nExample: `!ytmp3 https://www.youtube.com/watch?v=dQw4w9WgXcQ`");
        }

        const youtubeUrl = q;

        if (!ytdl.validateURL(youtubeUrl)) {
            return reply('Invalid YouTube URL provided.');
        }

        const info = await ytdl.getInfo(youtubeUrl);
        const title = info.videoDetails.title.replace(/[^a-zA-Z0-9 ]/g, ''); // Sanitize title for filename
        const videoId = info.videoDetails.videoId;

        reply(`⌛ Processing "${title}"...\nPlease wait, this may take a moment.`);

        const audioFilePath = path.join(TEMP_DIR, `${title}_${videoId}.mp3`);

        await new Promise((resolve, reject) => {
            ffmpeg(ytdl(youtubeUrl, {
                    filter: 'audioonly',
                    quality: 'highestaudio'
                }))
                .audioBitrate(128)
                .save(audioFilePath)
                .on('end', () => resolve())
                .on('error', (err) => reject(err));
        });

        if (fs.existsSync(audioFilePath)) {
            await conn.sendMessage(
                from, {
                    audio: { url: audioFilePath },
                    mimetype: 'audio/mpeg',
                    fileName: `${title}.mp3`,
                    caption: `✅ Successfully downloaded: *${title}*\n\n${yourName}`
                }, { quoted: mek }
            );
            fsExtra.removeSync(audioFilePath); // Clean up the temporary file
        } else {
            reply('❌ Failed to download audio.');
        }

    } catch (error) {
        console.error('YouTube Audio Downloader Error:', error);
        if (error.message.includes('No video formats found')) {
            reply('❌ Could not find downloadable formats for this video. It might be age-restricted or private.');
        } else if (error.message.includes('status code: 403')) {
            reply('❌ YouTube download failed due to a server error (e.g., rate limit, geo-restriction). Please try again later.');
        } else {
            reply(`❌ An error occurred while downloading: ${error.message}`);
        }
        fsExtra.emptyDirSync(TEMP_DIR); // Clean up temp dir on error
    }
});