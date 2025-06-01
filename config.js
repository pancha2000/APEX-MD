const fs = require('fs');
if (fs.existsSync('config.env')) require('dotenv').config({ path: './config.env' });

function convertToBool(text, fault = 'true') {
    return text === fault ? true : false;
}
module.exports = {
SESSION_ID: process.env.SESSION_ID = "7NsUERBT#2EKn99NqkNzmZOFzQqm_UIqZ3GQ4igpQ56eduKCmoBg",
ALIVE_IMG: process.env.ALIVE_IMG || "https://github.com/pancha2000/Pancha-one-bot/blob/main/Img/Bobcat-643-Operation-Maintenance-Manual-1.png",
ALIVE_MSG: process.env.ALIVE_MSG || "IM ALIVE",
};
