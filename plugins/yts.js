const { cmd } = require("../command");
const yts = require("yt-search");
const axios = require("axios");

// ඔබේ Replit API Base URL එක මෙහි සඳහන් කරන්න
// ඔබගේ API එකේ URL එක වෙනස් වුවහොත් මෙය update කරන්න.
const MY_API_BASE_URL = "https://9e21112f-34b1-4091-9d80-f13e50bb380a-00-3a4vah9275xj5.sisko.replit.dev";

cmd(
  {
    pattern: "song", // Command trigger
    react: "🎶",
    desc: "Download YouTube Song/Audio",
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
      if (!q) return reply("*🎶 Provide a song name or a YouTube link.*");

      reply("⏳ *Searching for your song...*"); // Search status message

      const search = await yts(q);
      const data = search.videos[0]; // පළමු වීඩියෝ ප්‍රතිඵලය

      if (!data) return reply("❌ No song found for your query.");

      const youtubeUrl = data.url; // YouTube වීඩියෝවේ URL එක

      // Song info message
      let desc = `🎶 *APEX-MD SONG DOWNLOADER* 🎶

👻 *Title* : ${data.title}
👻 *Duration* : ${data.timestamp}
👻 *Views* : ${data.views}
👻 *Uploaded* : ${data.ago}
👻 *Channel* : ${data.author.name}
👻 *Link* : ${data.url}

MADE BY SHEHAN VIMUKYHI`;

      await conn.sendMessage(
        from,
        { image: { url: data.thumbnail }, caption: desc },
        { quoted: mek }
      );

      // ඔබේම API එකෙන් Audio URL එක ලබාගෙන එය Download කරන function එක
      const getAndDownloadAudio = async (url, title) => {
        const apiUrl = `${MY_API_BASE_URL}/audio?url=${encodeURIComponent(url)}`;

        try {
          const response = await axios.get(apiUrl);

          if (response.data && response.data.audio_url) {
            const directAudioUrl = response.data.audio_url;

            // Direct Audio URL එකෙන් Audio Buffer එක Download කරන්න
            const audioBufferResponse = await axios.get(directAudioUrl, {
              responseType: "arraybuffer", // Buffer එකක් ලෙස ලබා ගැනීමට
            });

            // Buffer එක සහ Title එක ආපසු දෙන්න
            return { buffer: audioBufferResponse.data, title };
          } else {
            // ඔබේ API එකෙන් error එකක් ආවොත් එය handle කරන්න
            throw new Error(response.data.error || "Failed to retrieve direct audio URL from your API. Check API logs for details.");
          }
        } catch (apiError) {
          // Axios request එකේ හෝ API response එකේ ගැටලුවක්
          console.error("Error calling your API or downloading audio from direct URL:", apiError.message);
          if (apiError.response && apiError.response.data && apiError.response.data.details) {
              throw new Error(`API Error: ${apiError.response.data.error || "Unknown"}. Details: ${apiError.response.data.details}`);
          }
          throw apiError; // නැවතත් error එක throw කරන්න
        }
      };

      reply("*⏳ Downloading your song... Please wait!*");

      // ඔබේ API එකෙන් audio URL එක ලබාගෙන download කරන්න
      // data.title යනු yts (yt-search) මගින් ලැබෙන title එකයි.
      const audio = await getAndDownloadAudio(youtubeUrl, data.title);

      const cleanTitle = audio.title.replace(/[\\/:*?"<>|]/g, "");

      await conn.sendMessage(
        from,
        {
          audio: audio.buffer,
          mimetype: "audio/mpeg", // MP3 සඳහා mimetype
          fileName: `${cleanTitle}.mp3`,
        },
        { quoted: mek }
      );

      await reply(`🎶 *${audio.title}*\n\nMADE BY APEX-MD`);

    } catch (error) {
      console.error("Error in song command:", error);
      reply(`❌ Error downloading song. Please try again later. Details: ${error.message}`);
    }
  }
);