const axios = require("axios");
const fs = require("fs-extra");
const { getStreamFromURL } = global.utils;

module.exports = {
  config: {
    name: "sing",
    version: "1.14",
    aliases: ["song", "music", "play"],
    author: "Nabin",
    countDown: 5,
    role: 0,
    description: {
      en: "Download audio from YouTube"
    },
    category: "media",
    guide: {
      en: "{pn} [<song name>|<song link>]: Use this command to download audio from YouTube.\n   Example:\n{pn} chipi chipi chapa chapa"
    }
  },
  langs: {
    en: {
      error: "❌ An error occurred: %1",
      noResult: "⭕ No search results match the keyword %1. Please try again.",
      choose: "🎶 Select a song from the list below by replying with the number or type any text to cancel.\n\n%1",
      audio: "Audio: ",
      noAudio: "⭕ Sorry, no audio was found with a size less than 26MB.",
      playing: "🎧 Now playing: %1",
      selectSong: "Select a song by typing the number corresponding to it.",
      invalidChoice: "❌ Invalid choice. Please enter a number between 1 and 6."
    }
  },
  onStart: async function({ args, message, event, commandName, getLang }) {
    const checkurl = /^(?:https?:\/\/)?(?:m\.|www\.)?(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))((\w|-){11})(?:\S+)?$/;
    const urlYtb = checkurl.test(args[0]);
    if (urlYtb) {
      const infoVideo = await getVideoInfo(args[0]);
      handle({ infoVideo, message, downloadFile, getLang });
      return;
    }
    
    let keyWord = args.join(" ");
    keyWord = keyWord.includes("?feature=share") ? keyWord.replace("?feature=share", "") : keyWord;
    const maxResults = 6;
    let result;
    try {
      result = (await search(keyWord)).slice(0, maxResults);
    } catch (err) {
      return message.reply(getLang("error", err.message));
    }
    
    if (result.length === 0)
      return message.reply(getLang("noResult", keyWord));
    
    let msg = "";
    let i = 1;
    const thumbnails = [];
    for (const info of result) {
      thumbnails.push(getStreamFromURL(info.thumbnail));
      msg += `╭────────── ${i++} ──────────╮\n`;
      msg += `│ 🎵 Title: ${info.title}\n`;
      msg += `│ ⏱ Duration: ${info.time}\n`;
      msg += `│ 📺 Channel: ${info.channel.name}\n`;
      msg += `╰──────────────────────╯\n\n`;
    }
    
    message.reply({
      body: getLang("choose", msg),
      attachment: await Promise.all(thumbnails)
    }, (err, info) => {
      global.GoatBot.onReply.set(info.messageID, {
        commandName,
        messageID: info.messageID,
        author: event.senderID,
        result
      });
    });
  },
  
  onReply: async ({ event, api, Reply, message, getLang }) => {
    const { result } = Reply;
    const choice = parseInt(event.body);
    if (!isNaN(choice) && choice <= result.length && choice > 0) {
      const infoChoice = result[choice - 1];
      const idvideo = infoChoice.id;
      const videoUrl = `https://www.youtube.com/watch?v=${idvideo}`;
      const response = await axios.get(`https://xnilapi-glvi.onrender.com/xnil/ytmp3?url=${videoUrl}`);
      
      const title = response.data.data.info.title;
      const vid = response.data.data.media;
      await message.unsend(Reply.messageID);
      message.reply({
        body: getLang("playing", title),
        attachment: await global.utils.getStreamFromURL(vid)
      });
    } else {
      message.reply(getLang("invalidChoice"));
    }
  }
};

async function search(keyWord) {
  try {
    const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(keyWord)}`;
    const res = await axios.get(url);
    const getJson = JSON.parse(res.data.split("ytInitialData = ")[1].split(";</script>")[0]);
    const videos = getJson.contents.twoColumnSearchResultsRenderer.primaryContents.sectionListRenderer.contents[0].itemSectionRenderer.contents;
    const results = [];
    for (const video of videos) {
      if (video.videoRenderer?.lengthText?.simpleText) {
        results.push({
          id: video.videoRenderer.videoId,
          title: video.videoRenderer.title.runs[0].text,
          thumbnail: video.videoRenderer.thumbnail.thumbnails.pop().url,
          time: video.videoRenderer.lengthText.simpleText,
          channel: {
            name: video.videoRenderer.ownerText.runs[0].text
          },
          artist: video.videoRenderer.ownerText.runs[0].text,
          genre: "Not available"
        });
      }
    }
    return results;
  } catch (e) {
    const error = new Error("Cannot search video");
    error.code = "SEARCH_VIDEO_ERROR";
    throw error;
  }
}
