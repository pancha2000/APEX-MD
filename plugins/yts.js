
const { cmd } = require("../command");
const yts = require("yt-search");
const axios = require("axios");

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
      const data = search.videos[0];

      if (!data) return reply("❌ No song found for your query.");

      const url = data.url;

      // Song info message
      let desc = `🎶 *APEX-MD SONG DOWNLOADER* 🎶

👻 *Title* : ${data.title}
👻 *Duration* : ${data.timestamp}
👻 *Views* : ${data.views}
👻 *Uploaded* : ${data.ago}
👻 *Channel* : ${data.author.name}
👻 *Link* : ${data.url}

MADE BY SHEHAN VIMUKYHI
.ytmp command එක වැඩ නැතිනම් අනෙක් download command උත්සහ කරන්න'
`;


      await conn.sendMessage(
        from,
        { image: { url: data.thumbnail }, caption: desc },
        { quoted: mek }
      );

      const downloadAudio = async (url) => {
        const apiUrl = `https://p.oceansaver.in/ajax/download.php?format=mp3&url=${encodeURIComponent(
          url
        )}&api=dfcb6d76f2f6a9894gjkege8a4ab232222`;

        const response = await axios.get(apiUrl);

        if (response.data && response.data.success) {
          const { id, title } = response.data;
          const progressUrl = `https://p.oceansaver.in/ajax/progress.php?id=${id}`;

          while (true) {
            const progress = await axios.get(progressUrl);
            if (progress.data.success && progress.data.progress === 1000) {
              const audioBuffer = await axios.get(
                progress.data.download_url,
                {
                  responseType: "arraybuffer",
                }
              );
              return { buffer: audioBuffer.data, title };
            }
            await new Promise((resolve) => setTimeout(resolve, 2000));
          }
        } else {
          throw new Error("Failed to fetch audio details or API error.");
        }
      };

      reply("*⏳ Downloading your song... Please wait!*");

      const audio = await downloadAudio(url);

      const cleanTitle = audio.title.replace(/[\\/:*?"<>|]/g, "");

      await conn.sendMessage(
        from,
        {
          audio: audio.buffer,
          mimetype: "audio/mpeg",
          fileName: `${cleanTitle}.mp3`,
        },
        { quoted: mek }
      );

      await reply(`🎶 *${audio.title}*\n\nMADE BY APEX-MD`);

    } catch (error) {
      console.error(error);
      reply("❌ Error downloading song. Please try again later.");
    }
  }
);