var mysqlModel = require('mysql-model');
var db = require('../config/database.js');

const connection = mysqlModel.createConnection({
    host: db.host,
    user: db.user,
    password: db.password,
    database: db.database
});

var history = connection.extend({
    tableName: "slack_history",
});
module.exports = history;