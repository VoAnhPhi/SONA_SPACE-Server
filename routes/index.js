var express = require('express');
var router = express.Router();

/* GET home page - login page */
router.get('/', function(req, res, next) {
  res.render('layouts/main', { title: 'Furniture - Login', layout: false });
});

module.exports = router;
