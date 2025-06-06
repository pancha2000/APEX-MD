const ytdl = require('ytdl-core');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');
const fsExtra = require('fs-extra'); // For easier file operations

// Temporary directory for downloads
const TEMP_DIR = path.join(__dirname, '..', 'tmp_downloads'); // '..' means parent folder

// Ensure the temporary directory exists
fsExtra.ensureDirSync(TEMP_DIR);

module.exports = {
    name: 'YouTube Downloader',
    description: 'Downloads YouTube videos and songs.',
    commands: ['ytmp4', 'ytmp3'], // Commands to trigger this plugin
    async handle(sock, m, cmd, args) {
        const query = args.join(' ').trim(); // Get the YouTube URL from arguments

        if (!query) {
            return m.reply('Please provide a YouTube video URL.\n\nExample: `!ytmp4 https://www.youtube.com/watch?v=dQw4w9WgXcQ`');
        }

        const youtubeUrl = query;

        if (!ytdl.validateURL(youtubeUrl)) {
            return m.reply('Invalid YouTube URL provided.');
        }

        try {
            const info = await ytdl.getInfo(youtubeUrl);
            const title = info.videoDetails.title.replace(/[^a-zA-Z0-9 ]/g, ''); // Sanitize title for filename
            const videoId = info.videoDetails.videoId;

            m.reply(`⌛ Processing "${title}"...\nPlease wait, this may take a moment.`);

            if (cmd === 'ytmp4') {
                // --- YouTube Video Download (!ytmp4) ---
                const videoFilePath = path.join(TEMP_DIR, `${title}_${videoId}.mp4`);

                const videoStream = ytdl(youtubeUrl, {
                    quality: 'highestvideo', // Get the highest quality video stream
                    filter: 'videoonly' // Get only video stream
                });

                const audioStream = ytdl(youtubeUrl, {
                    quality: 'highestaudio', // Get the highest quality audio stream
                    filter: 'audioonly' // Get only audio stream
                });

                await new Promise((resolve, reject) => {
                    ffmpeg()
                        .input(videoStream)
                        .videoCodec('copy') // Copy video codec directly
                        .input(audioStream)
                        .audioCodec('copy') // Copy audio codec directly
                        .save(videoFilePath)
                        .on('end', () => resolve())
                        .on('error', (err) => reject(err));
                });


                if (fs.existsSync(videoFilePath)) {
                    await sock.sendMessage(
                        m.from, {
                            video: {
                                url: videoFilePath
                            },
                            mimetype: 'video/mp4',
                            caption: `✅ Successfully downloaded: *${title}*`
                        }, {
                            quoted: m
                        }
                    );
                    fsExtra.removeSync(videoFilePath); // Clean up the temporary file
                } else {
                    m.reply('❌ Failed to download video.');
                }

            } else if (cmd === 'ytmp3') {
                // --- YouTube Song Download (!ytmp3) ---
                const audioFilePath = path.join(TEMP_DIR, `${title}_${videoId}.mp3`);

                await new Promise((resolve, reject) => {
                    ffmpeg(ytdl(youtubeUrl, {
                            filter: 'audioonly', // Get only audio stream
                            quality: 'highestaudio'
                        }))
                        .audioBitrate(128) // Set audio bitrate (adjust as needed)
                        .save(audioFilePath)
                        .on('end', () => resolve())
                        .on('error', (err) => reject(err));
                });

                if (fs.existsSync(audioFilePath)) {
                    await sock.sendMessage(
                        m.from, {
                            audio: {
                                url: audioFilePath
                            },
                            mimetype: 'audio/mpeg',
                            fileName: `${title}.mp3`
                        }, {
                            quoted: m
                        }
                    );
                    fsExtra.removeSync(audioFilePath); // Clean up the temporary file
                } else {
                    m.reply('❌ Failed to download audio.');
                }
            }
        } catch (error) {
            console.error('YouTube Downloader Error:', error);
            if (error.message.includes('No video formats found')) {
                m.reply('❌ Could not find downloadable formats for this video. It might be age-restricted or private.');
            } else if (error.message.includes('status code: 403')) {
                m.reply('❌ YouTube download failed due to a server error (e.g., rate limit, geo-restriction). Please try again later.');
            } else {
                m.reply(`❌ An error occurred while downloading: ${error.message}`);
            }
            // Ensure temporary files are cleaned up even on error
            fsExtra.emptyDirSync(TEMP_DIR);
        }
    }
};