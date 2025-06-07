const { cmd } = require("../command");
const yts = require("yt-search");
const axios = require("axios");



cmd(
    {
        pattern: "video",
        react: "🎥",
        desc: "Download YouTube Video",
        category: "download",
        filename: __filename,
    },
    async (
        conn,
        mek,
        m,
        { from, quoted, body, isCmd, command, args, q, isGroup, sender, reply }
    ) => {
        try {
            if (!q) return reply("Please provide a video name or a YouTube link. 🎥❤️");

            let data;
            let videoUrl;

            // Check if the query is a direct YouTube URL
            if (ytdl.validateURL(q)) {
                videoUrl = q;
                const info = await ytdl.getInfo(videoUrl);
                data = {
                    title: info.videoDetails.title,
                    timestamp: new Date(parseInt(info.videoDetails.lengthSeconds) * 1000).toISOString().substr(11, 8), // Format duration
                    views: info.videoDetails.viewCount,
                    ago: info.videoDetails.uploadDate, // Or info.videoDetails.publishDate
                    author: { name: info.videoDetails.author.name },
                    url: videoUrl,
                    thumbnail: info.videoDetails.thumbnails[info.videoDetails.thumbnails.length - 1].url
                };
            } else {
                // If not a URL, perform a search
                const search = await yts(q);
                if (!search || !search.videos || search.videos.length === 0) {
                    return reply("No videos found for your query. 😔");
                }
                data = search.videos[0]; // Take the first result
                videoUrl = data.url;
            }

            let desc = `🎥 *APEX-MD VIDEO DOWNLOADER* 🎥\n\n`;
            desc += `👻 Title : ${data.title}\n`;
            desc += `👻 Duration : ${data.timestamp}\n`;
            desc += `👻 Views : ${data.views.toLocaleString()}\n`; // Format views with commas
            desc += `👻 Uploaded : ${data.ago}\n`;
            desc += `👻 Channel : ${data.author.name}\n`;
            desc += `👻 Link : ${data.url}\n\n`;
            desc += `MADE BY SHEHAN VIMUKYHI`;

            await conn.sendMessage(
                from,
                { image: { url: data.thumbnail }, caption: desc },
                { quoted: mek }
            );

            // Function to download video using the external API
            const downloadVideo = async (url, quality) => {
                const apiUrl = `https://p.oceansaver.in/ajax/download.php?format=${quality}&url=${encodeURIComponent(
                    url
                )}&api=dfcb6d76f2f6a9894gjkege8a4ab232222`; // Consider moving API key to environment variables

                const response = await axios.get(apiUrl);

                if (response.data && response.data.success) {
                    const { id, title } = response.data;
                    const progressUrl = `https://p.oceansaver.in/ajax/progress.php?id=${id}`;

                    // Poll for download progress
                    while (true) {
                        const progress = await axios.get(progressUrl);
                        if (progress.data.success && progress.data.progress === 1000) {
                            // Once 100% complete, download the video buffer
                            const videoBufferResponse = await axios.get(progress.data.download_url, {
                                responseType: "arraybuffer",
                            });
                            return { buffer: videoBufferResponse.data, title };
                        }
                        await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait 2 seconds before polling again
                    }
                } else {
                    throw new Error(response.data?.message || "Failed to fetch video details from API.");
                }
            };

            const quality = "360"; // Default quality, could be made configurable
            await reply(`Downloading video in ${quality}p quality. Please wait...`);
            const video = await downloadVideo(videoUrl, quality);

            await conn.sendMessage(
                from,
                {
                    video: video.buffer,
                    caption: `🎥 *${video.title}*\n\nMADE BY APEX-MD`,
                },
                { quoted: mek }
            );

            reply("*Thanks for using my bot!* 🎥❤️");

        } catch (e) {
            console.error("Error in video command:", e);
            reply(`❌ Error: ${e.message || "An unexpected error occurred."}`);
            // More specific error handling based on 'e.message' could be added here
        }
    }
);