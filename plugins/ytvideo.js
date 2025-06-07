const { cmd } = require("../command");
const yts = require("yt-search");
const axios = require("axios");

cmd(
  {
    pattern: "video",
    react: "🎥",
    desc: "Download YouTube Video with quality selection by replying a number",
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
      // --- Debugging Start ---
      console.log("\n--- VIDEO COMMAND INITIATED ---");
      console.log("Message body:", body);
      console.log("Is reply (m.quoted):", !!m.quoted); // Check if it's a reply
      if (m.quoted) {
        console.log("Quoted sender:", m.quoted.sender, "Bot ID:", conn.user.id);
        // Log the full quoted message object to understand its structure
        // WARNING: This can be very verbose. Use JSON.stringify for cleaner output.
        // console.log("Full quoted message object:", JSON.stringify(m.quoted, null, 2));
      }
      // --- Debugging End ---

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
        m.quoted.sender === conn.user.id // Check if the quoted message is from the bot itself
      ) {
        // --- NEW Logic for extracting footer from quoted message ---
        let quotedMessageContent = m.quoted.message;
        let quotedFooterText = null;

        // Try to find the footer based on common message types
        if (quotedMessageContent.imageMessage && quotedMessageContent.imageMessage.footer) {
            quotedFooterText = quotedMessageContent.imageMessage.footer;
        } else if (quotedMessageContent.videoMessage && quotedMessageContent.videoMessage.footer) {
            quotedFooterText = quotedMessageContent.videoMessage.footer;
        } else if (quotedMessageContent.buttonsMessage && quotedMessageContent.buttonsMessage.footer) {
            // If it was a buttons message earlier, though we removed buttons
            quotedFooterText = quotedMessageContent.buttonsMessage.footer;
        } else if (quotedMessageContent.templateMessage && quotedMessageContent.templateMessage.footer) {
            // For template messages, often contain footers
            quotedFooterText = quotedMessageContent.templateMessage.footer;
        }
        // --- END NEW Logic ---

        console.log("Extracted quoted footer text:", quotedFooterText);

        // Check if the quoted message contains our specific quality prompt text (within the caption)
        // Also check if the footer contains our URL marker.
        if (quotedFooterText && quotedFooterText.includes("YTDL_URL_MARKER:")) {
          // Extract the selected quality from the user's message body
          const requestedQualityCode = body.trim(); // e.g., "1.1"
          selectedQuality = qualityMap[requestedQualityCode];

          if (!selectedQuality) {
            console.log("Invalid quality selection received:", requestedQualityCode);
            return reply("❌ Invalid quality selection. Please reply with a number like 1.1, 1.2, etc.");
          }

          // Extract the video URL from the footer of the quoted message
          // Split by newline to find the specific marker line
          const footerLines = quotedFooterText.split('\n');
          let foundUrlMarker = false;
          for (const line of footerLines) {
            if (line.startsWith("YTDL_URL_MARKER:")) {
              try {
                const encodedUrl = line.substring("YTDL_URL_MARKER:".length);
                videoUrl = Buffer.from(encodedUrl, 'base64').toString('utf-8');
                foundUrlMarker = true;
                console.log("Successfully extracted URL from footer.");
                break; // Found the URL, no need to check other parts
              } catch (decodeError) {
                console.error("Error decoding video URL from footer:", decodeError);
                return reply("❌ Failed to retrieve video link from previous message. Please try again with the full command.");
              }
            }
          }

          if (!foundUrlMarker || !videoUrl) {
              console.log("URL marker not found or URL empty in footer after extraction.");
              return reply("❌ Could not find video link in the quoted message footer. Please start a new download with !video.");
          }

        } else {
            console.log("Quoted message is from bot, but not the expected quality selection prompt or missing URL marker.");
            // If it's a bot message but not the expected prompt, it might be an old message or a different command.
            // Fall through to initial command processing if 'q' is provided.
            if (!q) return reply("Please provide a search query or a YouTube link to start a new download.");
        }
      }

      // --- Phase 1: Initial Command / Query ---
      // This block runs if it's NOT a valid reply, or if 'q' is provided for a new search.
      if (!videoUrl || !selectedQuality) {
        if (!q) {
            console.log("No query or valid reply found. Prompting user.");
            return reply("*Provide a name or a YouTube link.* 🎥❤️");
        }

        const search = await yts(q);
        if (!search.videos.length) {
            console.log("No videos found for query:", q);
            return reply("No videos found for your query.");
        }
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
        // Place the URL marker in the footer
        const footerWithUrl = `APEX-MD\nYTDL_URL_MARKER:${encodedUrl}\nPlease reply with a number to select quality.`; // Added prompt text to footer too for easier detection

        console.log("Sending initial prompt with URL in footer:", footerWithUrl);

        await conn.sendMessage(
          from,
          { image: { url: data.thumbnail }, caption: desc, footer: footerWithUrl },
          { quoted: mek }
        );
        return; // Exit here, waiting for user's reply
      }

      // --- If we reach here, it's a valid quality selection reply ---

      reply(`*Downloading video in ${selectedQuality} quality... Please wait!* 🎥⏳`);
      console.log(`Starting download for URL: ${videoUrl} at quality: ${selectedQuality}`);


      const downloadVideo = async (url, quality) => {
        // The API expects '720' not '720p', so remove 'p'
        const apiQuality = quality.replace('p', '');
        console.log(`API Quality requested: ${apiQuality}`);

        const apiUrl = `https://p.oceansaver.in/ajax/download.php?format=${apiQuality}&url=${encodeURIComponent(
          url
        )}&api=dfcb6d76f2f6a9894gjkege8a4ab232222`;

        const response = await axios.get(apiUrl);
        console.log("API initial response success:", response.data.success);

        if (response.data && response.data.success) {
          const { id, title } = response.data;
          const progressUrl = `https://p.oceansaver.in/ajax/progress.php?id=${id}`;
          console.log("Starting progress check for ID:", id);

          while (true) {
            const progress = await axios.get(progressUrl);
            console.log(`Progress check for ID ${id}: ${progress.data.progress || 0}%`); // Log progress
            if (progress.data.success && progress.data.progress === 1000) {
              console.log("Download complete, fetching video buffer from:", progress.data.download_url);
              const videoBuffer = await axios.get(progress.data.download_url, {
                responseType: "arraybuffer",
              });
              return { buffer: videoBuffer.data, title };
            }
            // Wait for 5 seconds before checking progress again
            await new Promise((resolve) => setTimeout(resolve, 5000));
          }
        } else {
            console.error("Failed to fetch video details from API:", response.data);
            throw new Error(`Failed to fetch video details for ${quality}. It might not be available in this quality.`);
        }
      };

      const video = await downloadVideo(videoUrl, selectedQuality);
      console.log("Video download completed. Sending to user.");

      await conn.sendMessage(
        from,
        {
          video: video.buffer,
          caption: `🎥 *${video.title}* (${selectedQuality})\n\nMADE BY APEX-MD`, // Added selected quality to caption
        },
        { quoted: mek }
      );

      reply("*Thanks for using my bot!* 🎥❤️");
      console.log("Video sent and final reply given.");

    } catch (e) {
      console.error("--- ERROR IN VIDEO COMMAND ---");
      console.error(e); // Log the full error for debugging
      if (e.message.includes("Failed to fetch video details") || e.message.includes("not available in this quality")) {
          reply(`❌ Error: ${e.message} Please try another quality.`);
      } else {
          reply(`❌ An unexpected error occurred: ${e.message}`);
      }
    }
  }
);