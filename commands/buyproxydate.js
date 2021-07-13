const Promise = require('promise');
const Sync = require('sync');
const request = require("request");
const paypal = require('paypal-rest-sdk');
require('../config/paypalConfig.js');

const config = require('../config/config.js');
const welcome = require('../config/welcome.js');
var UserSchema = require('../schema/user_schema');
var ServerSchema = require('../schema/server_schema');

function buyproxydate(bot, msg) {
	var args = msg.text.split(" ");
	var count = 0;
	var type = "monthly";
    var tag = "";
    var sdate = "";
	var serverList = [];
	if (args.length < 1) {
		count = 50;
	} else {
		count = args[0];
	}
    if (args.length < 2) {
        bot.reply(msg, welcome.wrongFormat);
        return true;
    } else {
        sdate = args[1].toLowerCase();
    }
    if (args.length == 3) {
        tag = args[2];
    }
    if (sdate.split("-").length != 2 || parseInt(sdate.split("-")[0]) > 31 || parseInt(sdate.split("-")[1]) > 12){
        bot.reply(msg, welcome.wrongDate);
        return true;
    }
    sdate = new Date().getFullYear()+"-"+sdate.split("-")[1]+"-"+sdate.split("-")[0];
    if (parseInt((new Date(sdate).getTime() - new Date().getTime()) / (1000*3600*24)) > 21){
        bot.reply(msg, welcome.wrongMaxDate);
        return true;
    }
    if (parseInt(count) <= 0){
        bot.reply(msg, welcome.wrongFormat);
        return true;
    }
	var price = config.daily;

	let promise = new Promise(function (resolve, reject) {
		servers = new ServerSchema();
		servers.find('all', function (err, rows) {
			if (!err) {
				serverList = rows;
				resolve(rows);
			} else {
				reject(err);
			}
		});
	});
	promise.then(function (result) {
		if (serverList.length == 0) {
			bot.reply(message, welcome.noServer);
			return true;
		}
		Sync(function () {
			let checkServer = false;
			let checkTag = false;
			let serverIndex = 0;
			for (let i = 0; i < serverList.length; i++) {
				if (tag == "" || tag == serverList[i].tag) {
					checkTag = true;
					if (getAvailableCount.sync(null, serverList[i].address, count) == true) {
						checkServer = true;
						serverIndex = i;
						const url = "http://" + serverList[serverIndex].address + ":8080/api/users/showAvailableProxies";
						request.post(url, (error, response, body) => {
							if (error != null) {
								bot.reply(message, welcome.tryAgain);
								return;
							}
							const data = JSON.parse(body).data;
							if (data.data.length < count) {
								bot.reply(message, welcome.notAvailableAmount);
								return true;
							} else {
								users = new UserSchema();
								new Promise(function (resolve, reject) {
									users.remove("user = '" + msg.user + "'", function (err, res) {
										resolve(res);
									});
								}).then(function (result){
								users = new UserSchema({
									user: msg.user,
									channel: msg.channel,
									amount: count,
									server_address: serverList[serverIndex].address,
									price: price,
                                    type: type,
                                    sdate: sdate,
									flag: "buyproxydate"
								});
								users.save();
								});

								bot.reply(msg, "```" + count + " " + type + " DC Proxy price €" + price + "/proxy\nTotal price: €" + count * price + ", agree?```", function (err, res) {
									bot.api.reactions.add({
										timestamp: res.ts,
										channel: res.channel,
										name: 'heavy_check_mark',
									}, function (err, res) {
										if (err) { console.log(err) }
									});
									bot.api.reactions.add({
										timestamp: res.ts,
										channel: res.channel,
										name: 'x',
									}, function (err, res) {
										if (err) { console.log(err) }
									});
								});
							}
						})
					}
				}
			}
		});
	});
}

function check(bot, msg, data) {
	Sync(function () {
		if (Object.entries(data).length == 0) {
			bot.sendEphemeral({
				channel: msg.item.channel,
				user: msg.user,
				text: welcome.notSendCommand
			});
		} else {
			(async () => {
				const create_payment_json = {
					"intent": "sale",
					"payer": {
						"payment_method": "paypal"
					},
					"redirect_urls": {
						"return_url": "https://payment.tokeproxies.io:2053/successdate",
						"cancel_url": "https://payment.tokeproxies.io:2053/cancel"
					},
					"transactions": [{
						"item_list": {
							"items": [{
								"name": "Toke-Proxy",
								"sku": "001",
								"price": "" + data.price * data.amount,
								"currency": "EUR",
								"quantity": 1
							}]
						},
						"amount": {
							"currency": "EUR",
							"total": "" + data.price * data.amount
						},
						"description": welcome.paymentDescription
					}]
				};
				console.log(create_payment_json)
				paypal.payment.create(create_payment_json, function (error, payment) {
					if (error) {
						console.log(error)
						bot.sendEphemeral({
							channel: msg.item.channel,
							user: msg.user,
							text: welcome.errorPayment
						});
						return;
					} else {
						console.log(payment);
						var orderId = payment.id;
						var paypal_url = "";
						for (let i = 0; i < payment.links.length; i++) {
							if (payment.links[i].rel === "approval_url") {
								paypal_url = payment.links[i].href;
								console.log("Created Successfully");
								users = new UserSchema();
								users.set("order_id", orderId);
								users.save("user = '" + msg.user + "'");
								bot.sendEphemeral({
									channel: msg.item.channel,
									user: msg.user,
									text: "```Payment Link\n" + paypal_url + "\n" + welcome.paymentLinkDescription + "```"
								});
							}
						}
					}
				});
			})();
		}
	});
}

function getAvailableCount(serverAddress, count, callback) {
	const url = "http://" + serverAddress + ":8080/api/users/showAvailableProxies";
	request.post(url, (error, response, body) => {
		if (error != null) {
			return callback(null, false);
		}
		if (JSON.parse(body).status == "No error") {
			if (JSON.parse(body).data.amount >= count) {
				return callback(null, true);
			} else {
				return callback(null, false);
			}
		}
	});
}

module.exports.buyproxydate = buyproxydate;
module.exports.check = check;
