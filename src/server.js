const express = require("express");
var cors = require('cors')
var compression = require('compression')
var rateLimit = require("express-rate-limit");
const path = require('path');

const limiter = rateLimit({
  windowMs: 10 * 1000,
  max: 15, // max 15 requests in 10s
});

const app = express();

app.use(compression())
app.use(limiter)
app.use(express.json());
app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

module.exports = app;