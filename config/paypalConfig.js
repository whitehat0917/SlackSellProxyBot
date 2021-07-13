const paypal = require('paypal-rest-sdk');

paypal.configure({
    // 'mode': 'live', //sandbox or live
    'mode': 'sandbox',
    'client_id': '',
    // 'client_id': '',
    'client_secret': '',
    // 'client_secret': ''
});