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
  async (conn, mek, m, { from, quoted, body, isCmd, command, args, q, isGroup, sender, reply }) => {
    try {
      if (!q) return reply("Provide a name or a YouTube link. 🎥❤️");

      const search = await yts(q);
      const data = search.videos[0];

      if (!data) return reply("No video results found for your query.");

      const url = data.url;

      let desc = `🎥 APEX-MD VIDEO DOWNLOADER 🎥

👻 Title : ${data.title}
👻 Duration : ${data.timestamp}
👻 Views : ${data.views}
👻 Uploaded : ${data.ago}
👻 Channel : ${data.author.name}
👻 Link : ${data.url}

Powered by APEX-MD

.ytmp command එක වැඩ නැතිනම් අනෙක් download command උත්සහ කරන්න';

      await conn.sendMessage(
        from,
        { image: { url: data.thumbnail }, caption: desc },
        { quoted: mek }
      );

      const downloadVideo = async (url, quality) => {
        const apiUrl = `https://p.oceansaver.in/ajax/download.php?format=${quality}&url=${encodeURIComponent(url)}&api=dfcb6d76f2f6a9894gjkege8a4ab232222`;

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
            await new Promise((resolve) => setTimeout(resolve, 5000));
          }
        } else {
          throw new Error("Failed to fetch video details.");
        }
      };

      const quality = "360";
      const video = await downloadVideo(url, quality);

      await conn.sendMessage(
        from,
        {
          video: video.buffer,
          caption: `🎥 *${video.title}*\n\nMADE BY APEX-MD`,
        },
        { quoted: mek }
      );
    } catch (error) {
      console.error(error);
      reply("❌ Error downloading video. Please try again later.");
    }
  }
);