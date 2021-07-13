const welcome = require('../config/welcome.js');

function help(bot, message){
    bot.reply(message, welcome.helpCommand);
}

module.exports.help = help;