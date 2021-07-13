const SlackBot = require('slackbots');
var Botkit = require('botkit');
const axios = require('axios');
const Promise = require('promise');
const fs = require('fs');
const https = require('https');
const express = require('express');
const request = require("request");
const paypal = require('paypal-rest-sdk');
require('../config/paypalConfig.js');
const fs = require('fs');
var os = require('os');
var Slack = require('node-slack-upload');

const config = require('./config/config.js');
const welcome = require('./config/welcome.js');
const buyproxy = require('./commands/buyproxy.js');
const buyproxydate = require('./commands/buyproxydate.js');
const help = require('./commands/help.js');
var UserSchema = require('./schema/user_schema');
var HistorySchema = require('./schema/history_schema');

var slack = new Slack(config.token);
const app = express();

var controller = Botkit.slackbot({
    debug: false
});

controller.spawn({
    token: config.token
}).startRTM();

controller.hears('', ['ambient', 'direct_mention', 'mention', 'direct_message'], function (bot, message) {
    var args = message.text.split(" ");
    switch (args[0]){
        case 'buyproxy':
            buyproxy.buyproxy(bot, message);
            break;
        case 'buyproxydate':
            buyproxydate.buyproxydate(bot, message);
            break;
        case 'help':
            help.help(bot, message);
            break;
        default:
            bot.reply(message, welcome.wrongCommand);
            break;
    }
});

controller.on('reaction_added',function(bot,message) {
    if (message.user == config.bot)
        return;
    if (message.event == "x"){
        bot.reply(message, welcome.notAgree);
    }else{
        let promise = new Promise(function (resolve, reject) {   
            users = new UserSchema();
            users.find('first', { where: "user = '" + message.user + "'" }, function (err, row) {
                if (!err) {
                    resolve(row);
                } else {
                    console.log(err);
                }
            });
        });
        promise.then(function (result) {
            if (result.flag == "buyproxy"){
                buyproxy.check(bot, message, result);
            }else{
                buyproxydate.check(bot, message, result);
            }
        });
    }
})

const bot = new SlackBot({
    token: 'xoxb-',
    name: 'ProxySlackBot'
});

// Start Handler
bot.on('start', () => {
});

//Error handler
bot.on('error', (err) => console.log(err));

//Message Handler
bot.on('message', (data) => {
    if (data.type !== 'message') {
        return;
    }
});

app.get('/cancel', (req, res) => res.send('Canceled'));

app.get('/success', (req, res) => {
    const payerId = req.query.PayerID;
    const paymentId = req.query.paymentId;

    var users = new UserSchema();
    users.find('first', { where: "order_id = '" + paymentId + "'" }, function(err, row) {
        if (err) {
            console.log(err);
            return;
        } else {
            paypal.payment.get(paymentId, function(error, payment) {
                if (error) {
                    console.log(error);
                    throw error;
                } else {
                    if (payment.state != 'approved') {
                        var price = row.price * row.amount;
                        const execute_payment_json = {
                            "payer_id": payerId,
                            "transactions": [{
                                "amount": {
                                    "currency": "EUR",
                                    "total": "" + price
                                }
                            }]
                        };

                        paypal.payment.execute(paymentId, execute_payment_json, function(error, payment) {
                            if (error) {
                                console.log(error.response);
                                throw error;
                            } else {
                                console.log(JSON.stringify(payment));
                                let days = 0;
                                switch (row.type) {
                                    case "daily":
                                        days = 1;
                                        break;
                                    case "weekly":
                                        days = 7;
                                        break;
                                    case "monthly":
                                        days = 30;
                                        break;
                                }
                                const options = {
                                    url: 'http://' + row.server_address + ':8080/api/users/randomProxies',
                                    json: true,
                                    body: {
                                        count: row.amount,
                                        days: days
                                    }
                                };
                                request.post(options, (error, response, body) => {
                                    if (error != null) {
                                        return;
                                    }
                                    if (body.status == "No error") {
                                        let reply = "";
                                        for (let i = 0; i < body.data.length; i++) {
                                            reply = reply + body.data[i] + os.EOL;
                                        }
                                        fs.writeFile('attachment/' + paymentId + '.txt', reply, function(err) {
                                            if (err) return console.log(err);
                                            let orderId = row.id.toString();
                                            while (orderId.length < 5){
                                                orderId = ["0", orderId].join("");
                                            }
                                            // bot.channels.get(row.userid).send(welcome.thanksOrder+""+orderId);
                                            slack.uploadFile({
                                                file: fs.createReadStream(path.join(__dirname, '..', 'README.md')),
                                                filetype: 'post',
                                                title: 'README',
                                                initialComment: 'Proxy file',
                                                channels: row.channel
                                            }, function(err, data) {
                                                if (err) {
                                                    console.error(err);
                                                }
                                                else {
                                                    console.log('Uploaded file details: ', data);
                                                }
                                            });
                                            // const data = {
                                            //     "description": row.username + " - " + row.amount + " - " + row.type + " - €" + price + " - " + payment.payer.payer_info.email + " - " + payment.payer.payer_info.first_name + " " + payment.payer.payer_info.last_name + " - ORDERID-#" + orderId+" - GROUP-"+row.group_name,
                                            //     "color": 54775,
                                            //     "timestamp": new Date(),
                                            //     "footer": {
                                            //         "icon_url": "https://cdn.discordapp.com/avatars/737756776446820363/909cfecad1edbc82a9ebfdd430bc3592.png?size=256",
                                            //         "text": "Toke-Proxies"
                                            //     }
                                            // };
                                            // bot.channels.get('749367608205377607').send({ embed: data });
                                            history = new HistorySchema({
                                                user: row.user,
                                                content: reply,
                                                type: row.type,
                                                amount: price
                                            });
                                            history.save();
                                        });
                                    } else {
                                        bot.sendEphemeral({
                                            channel: row.channel,
                                            user: row.user,
                                            text: welcome.tryAgain});
                                        return true;
                                    }
                                });
                                res.sendFile('views/success.html', { root: __dirname })
                            }
                        });
                    } else {
                        res.sendFile('views/success.html', { root: __dirname })
                    }
                }
            });
        }
    });
});
// const key = fs.readFileSync('./server.key');
// const cert = fs.readFileSync('./server.cert');
// set port, listen for requests
const PORT = process.env.PORT || 3000;
// https.createServer({ key: key, cert: cert }, app).listen(PORT, () => {
//     console.log(`Server is running on port ${PORT}.`);
// });
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}.`);
});