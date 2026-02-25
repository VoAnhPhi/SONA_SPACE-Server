var express = require('express');
var router = express.Router();
var path = require('path');

/* GET home page - login page */
router.get('/', function(req, res, next) {
  res.render('layouts/main', { title: 'Furniture - Login', layout: false });
});

/* GET chatbot test page */
router.get('/test-chatbot', function(req, res, next) {
  res.sendFile(path.join(__dirname, '../public/test-chatbot.html'));
});

/* GET gemini chatbot test page */
router.get('/test-gemini-chatbot', function(req, res, next) {
  res.sendFile(path.join(__dirname, '../public/test-gemini-chatbot.html'));
});

module.exports = router;
