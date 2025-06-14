const { cmd } = require("../command");
const yts = require("yt-search");
const axios = require("axios");

// RapidAPI Configuration - ඔබගේ API යතුර සහ සත්කාරක නාමය මෙහි දමන්න.
// හොඳම දේ මේවා පරිසර විචල්‍ය (environment variables) ලෙස තබා ගැනීමයි.
const RAPIDAPI_KEY = '96f0e6f138msh25b1ac478ce0873p199476jsn60280b14695f';
const RAPIDAPI_HOST = 'youtube-mp3-audio-video-downloader.p.rapidapi.com';

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

      const search = await yts(q);
      const data = search.videos[0]; // පළමු වීඩියෝ ප්‍රතිඵලය ලබා ගනී

      if (!data) return reply("❌ No song found for your query.");

      // yts ප්‍රතිඵලයෙන් කෙලින්ම videoId එක ලබා ගන්න.
      const videoId = data.videoId; 
      if (!videoId) {
        return reply("❌ YouTube search result එකෙන් video ID එක ලබාගත නොහැක.");
      }

      // ගීත තොරතුරු පණිවිඩය
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

      // --- නව downloadAudio FUNCTION (RapidAPI භාවිතා කරමින්) ---
      const downloadAudio = async (ytVideoId, quality = 'low') => {
        const options = {
          method: 'GET',
          url: `https://${RAPIDAPI_HOST}/download-mp3/${ytVideoId}`,
          params: { quality: quality }, // 'low' හෝ 'high' ලෙස වෙනස් කළ හැක
          headers: {
            'x-rapidapi-key': RAPIDAPI_KEY,
            'x-rapidapi-host': RAPIDAPI_HOST
          }
        };

        try {
          const response = await axios.request(options);
          const apiData = response.data; // RapidAPI වෙතින් ලැබෙන දත්ත

          // API response එකේ 'url' (download link) සහ 'title' තිබේදැයි පරීක්ෂා කරන්න
          if (apiData && apiData.url && apiData.title) {
            const audioUrl = apiData.url;
            const audioTitle = apiData.title;

            // සැබෑ audio file එක download කරන්න
            const audioBufferResponse = await axios.get(audioUrl, {
              responseType: "arraybuffer", // binary දත්ත ලබා ගැනීමට මෙය අත්‍යවශ්‍යයි
            });

            return { buffer: audioBufferResponse.data, title: audioTitle };
          } else {
            // අපේක්ෂා නොකළ API ප්‍රතිචාර ව්‍යුහය
            console.error("RapidAPI response structure unexpected:", apiData);
            throw new Error("RapidAPI වෙතින් download link හෝ title ලබාගත නොහැක. Response: " + JSON.stringify(apiData));
          }
        } catch (error) {
          console.error("RapidAPI audio download කිරීමේදී දෝෂයක්:", error.message);
          if (error.response) {
            console.error("RapidAPI Response Error Data:", error.response.data);
            console.error("RapidAPI Response Error Status:", error.response.status);
          }
          throw new Error("RapidAPI භාවිතා කර audio download කිරීමට අපොහොසත් විය. API යතුර පරීක්ෂා කරන්න, නැතහොත් පසුව නැවත උත්සාහ කරන්න.");
        }
      };
      // --- නව downloadAudio FUNCTION අවසන් ---

      reply("*⏳ ඔබේ ගීතය download වෙමින් පවතී... කරුණාකර රැඳී සිටින්න!*");

      // නව downloadAudio function එකට videoId එක යවන්න
      const audio = await downloadAudio(videoId);

      const cleanTitle = audio.title.replace(/[\\/:*?"<>|]/g, "");

      await conn.sendMessage(
        from,
        {
          audio: audio.buffer,
          mimetype: "audio/mpeg",
          fileName: `${cleanTitle}.mp3`,
          ptt: false // මෙය true නම් voice note එකක් ලෙස යවයි, false නම් mp3 file එකක් ලෙස යවයි
        },
        { quoted: mek }
      );

      await reply(`🎶 *${audio.title}*\n\nMADE BY APEX-MD`);

    } catch (error) {
      console.error(error);
      // පරිශීලක හිතකාමී දෝෂ පණිවිඩයක් ලබා දෙන්න
      if (error.message.includes("RapidAPI")) {
        reply("❌ Download සේවාව (RapidAPI) සමඟ ගැටලුවක් ඇති විය. " + error.message);
      } else {
        reply("❌ ගීතය download කිරීමේදී දෝෂයක්. කරුණාකර පසුව නැවත උත්සාහ කරන්න.");
      }
    }
  }
);