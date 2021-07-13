var mysqlModel = require('mysql-model');
var db = require('../config/database.js');

const connection = mysqlModel.createConnection({
    host: db.host,
    user: db.user,
    password: db.password,
    database: db.database
});

var users = connection.extend({
    tableName: "slack_users",
});
module.exports = users;