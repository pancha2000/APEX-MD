const { cmd } = require("../command");
const yts = require("yt-search");
const axios = require("axios");

cmd(
  {
    pattern: "video",
    react: "🎥",
    desc: "Download YouTube Video with quality selection by replying a number", // Description updated
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
      let videoUrl = null;
      let selectedQuality = null;

      // Define quality mapping
      const qualityMap = {
        "1.1": "144p",
        "1.2": "240p",
        "1.3": "360p",
        "1.4": "480p",
        "1.5": "720p",
        "1.6": "1080p",
      };

      // Check if the message is a reply to the bot's previous message requesting quality
      if (
        m.quoted && // Check if there's a quoted message
        m.quoted.sender === conn.user.id && // Check if the quoted message is from the bot itself
        m.quoted.caption && // Check if the quoted message has a caption
        m.quoted.caption.includes("Please reply with a number to select quality") // Check if the quoted message is the quality prompt
      ) {
        // Extract the selected quality from the user's message body
        const requestedQualityCode = body.trim(); // e.g., "1.1"
        selectedQuality = qualityMap[requestedQualityCode];

        if (!selectedQuality) {
          return reply("❌ Invalid quality selection. Please reply with a number like 1.1, 1.2, etc.");
        }

        // Extract the video URL from the footer of the quoted message
        // We embedded the URL in the footer with a unique marker
        const footerText = m.quoted.footer;
        if (footerText && footerText.startsWith("YTDL_URL_MARKER:")) {
          try {
            const encodedUrl = footerText.substring("YTDL_URL_MARKER:".length);
            videoUrl = Buffer.from(encodedUrl, 'base64').toString('utf-8');
          } catch (decodeError) {
            console.error("Error decoding video URL from footer:", decodeError);
            return reply("❌ Failed to retrieve video link from previous message. Please try again with the full command.");
          }
        } else {
            return reply("❌ Could not find video link in the quoted message. Please start a new download with !video.");
        }

      } else {
        // --- Phase 1: Initial Command / Query ---
        if (!q) return reply("*Provide a name or a YouTube link.* 🎥❤️");

        const search = await yts(q);
        if (!search.videos.length) return reply("No videos found for your query.");
        const data = search.videos[0];
        videoUrl = data.url; // Store the video URL

        let desc = `🎥 *APEX-MD VIDEO DOWNLOADER* 🎥

👻 *Title* : ${data.title}
👻 *Duration* : ${data.timestamp}
👻 *Views* : ${data.views}
👻 *Uploaded* : ${data.ago}
👻 *Channel* : ${data.author.name}
👻 *Link* : ${data.url}

MADE BY SHEHAN VIMUKYHI

*Please reply with a number to select quality:*
1.1 = 144p
1.2 = 240p
1.3 = 360p
1.4 = 480p
1.5 = 720p
1.6 = 1080p`;

        // Encode the video URL in base64 to safely embed it in the footer
        const encodedUrl = Buffer.from(videoUrl).toString('base64');
        const footerWithUrl = `APEX-MD\nYTDL_URL_MARKER:${encodedUrl}`; // Unique marker for easy extraction

        // Send the message with video info and quality options
        await conn.sendMessage(
          from,
          { image: { url: data.thumbnail }, caption: desc, footer: footerWithUrl },
          { quoted: mek }
        );
        return; // Exit here, waiting for user's reply
      }

      // --- If we reach here, it's a valid quality selection reply ---

      reply(`*Downloading video in ${selectedQuality} quality... Please wait!* 🎥⏳`);

      const downloadVideo = async (url, quality) => {
        // The API expects '720' not '720p', so remove 'p'
        const apiQuality = quality.replace('p', '');

        const apiUrl = `https://p.oceansaver.in/ajax/download.php?format=${apiQuality}&url=${encodeURIComponent(
          url
        )}&api=dfcb6d76f2f6a9894gjkege8a4ab232222`;

        const response = await axios.get(apiUrl);

        if (response.data && response.data.success) {
          const { id, title } = response.data;
          const progressUrl = `https://p.oceansaver.in/ajax/progress.php?id=${id}`;

          while (true) {
            const progress = await axios.get(progressUrl);
            if (progress.data.success && progress.data.progress === 1000) {
              const videoBuffer = await axios.get(progress.data.download_url, {
                responseType: "arraybuffer",
              });
              return { buffer: videoBuffer.data, title };
            }
            // Wait for 5 seconds before checking progress again
            await new Promise((resolve) => setTimeout(resolve, 5000));
          }
        } else {
            // If the API call itself fails or returns success: false
            throw new Error(`Failed to fetch video details for ${quality}. It might not be available in this quality.`);
        }
      };

      const video = await downloadVideo(videoUrl, selectedQuality);

      await conn.sendMessage(
        from,
        {
          video: video.buffer,
          caption: `🎥 *${video.title}* (${selectedQuality})\n\nMADE BY APEX-MD`, // Added selected quality to caption
        },
        { quoted: mek }
      );

      reply("*Thanks for using my bot!* 🎥❤️");
    } catch (e) {
      console.error(e);
      // More specific error messages for quality-related issues
      if (e.message.includes("Failed to fetch video details") || e.message.includes("not available in this quality")) {
          reply(`❌ Error: ${e.message} Please try another quality.`);
      } else {
          reply(`❌ Error: ${e.message}`);
      }
    }
  }
);