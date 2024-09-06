"use strict"

const { model, Schema } = require("mongoose");

const DOCUMENT_NAME = "NFTHeart";
const COLLECTION_NAME = "NFTHearts";

const nftHeartSchema = new Schema({
  heartAddresses: { type: Array, default: [] },
  id: { type: String, required: true },
  address: { type: String, required: true },
}, {
  timestamp: true,
  collection: COLLECTION_NAME
});

module.exports = model(DOCUMENT_NAME, nftHeartSchema);
