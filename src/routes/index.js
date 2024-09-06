"use strict"

const express = require("express");
const router = express.Router();

router.use("/v1/user", require("./user"));
router.use("/v1/auction", require("./auction"));
router.use("/v1/nft", require("./nft"));

module.exports = router;
