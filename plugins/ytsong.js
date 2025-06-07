const { cmd } = require("../command");
const yts = require("yt-search");
const axios = require("axios");

cmd(
  {
    pattern: "song", // Command pattern එක song ලෙස වෙනස් කර ඇත
    react: "🎶",     // React emoji එක 🎶 ලෙස වෙනස් කර ඇත
    desc: "Download YouTube Song/Audio", // Description එක වෙනස් කර ඇත
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
      if (!q) return reply("*Provide a song name or a YouTube link.* 🎶❤️"); // Prompt message එක වෙනස් කර ඇත

      const search = await yts(q);
      const data = search.videos[0]; // පළමු සෙවුම් ප්‍රතිඵලය ලබා ගනී
      const url = data.url;

      // ගීතය පිළිබඳ තොරතුරු සහිත පණිවිඩය
      let desc = `🎶 *APEX-MD SONG DOWNLOADER* 🎶

👻 *Title* : ${data.title}
👻 *Duration* : ${data.timestamp}
👻 *Views* : ${data.views}
👻 *Uploaded* : ${data.ago}
👻 *Channel* : ${data.author.name}
👻 *Link* : ${data.url}

MADE BY SHEHAN VIMUKYHI`;

      // Thumbnail එක සහ තොරතුරු පණිවිඩය යවයි
      await conn.sendMessage(
        from,
        { image: { url: data.thumbnail }, caption: desc },
        { quoted: mek }
      );

      // ගීතය බාගත කිරීමේ කාර්යය
      const downloadAudio = async (url) => {
        // MP3 format එක ඉල්ලීම සඳහා apiUrl එක සකස් කරයි
        const apiUrl = `https://p.oceansaver.in/ajax/download.php?format=mp3&url=${encodeURIComponent(
          url
        )}&api=dfcb6d76f2f6a9894gjkege8a4ab232222`; // API key එක නොවෙනස්ව තබා ඇත

        const response = await axios.get(apiUrl);

        if (response.data && response.data.success) {
          const { id, title } = response.data;
          const progressUrl = `https://p.oceansaver.in/ajax/progress.php?id=${id}`;

          // බාගත කිරීමේ ප්‍රගතිය පරීක්ෂා කිරීම සඳහා loop එකක්
          while (true) {
            const progress = await axios.get(progressUrl);
            if (progress.data.success && progress.data.progress === 1000) {
              // සම්පූර්ණ වූ පසු audio buffer එක ලබා ගනී
              const audioBuffer = await axios.get(
                progress.data.download_url,
                {
                  responseType: "arraybuffer",
                }
              );
              return { buffer: audioBuffer.data, title };
            }
            // බාගත කිරීම අවසන් වන තෙක් තත්පර 5ක් රැඳී සිටියි
            await new Promise((resolve) => setTimeout(resolve, 2000));
          }
        } else {
          throw new Error("Failed to fetch audio details or API error.");
        }
      };

      reply("*Downloading your song... Please wait a moment!* 🎶⏳"); // බාගත කිරීම ආරම්භ වන බවට පණිවිඩයක්

      const audio = await downloadAudio(url); // ගීතය බාගත කරයි

      // බාගත කළ ගීතය යවයි
      await conn.sendMessage(
        from,
        {
          audio: audio.buffer,
          mimetype: "audio/mpeg", // ශ්‍රව්‍ය ගොනු සඳහා නිවැරදි MIME වර්ගය
          fileName: `${audio.title}.mp3`, // ගොනුවට මාතෘකාව සමඟ නමක් ලබා දෙයි
          caption: `🎶 *${audio.title}*\n\nMADE BY APEX-MD`, // Caption එක වෙනස් කර ඇත
        },
        { quoted: mek }
      );

      
    }
  }
);