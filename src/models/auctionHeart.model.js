"use strict"

const { model, Schema } = require("mongoose");

const DOCUMENT_NAME = "AuctionHeart";
const COLLECTION_NAME = "AuctionHearts";

const auctionHeartSchema = new Schema({
  heartAddresses: { type: Array, default: [] },
  address: { type: String, required: true },
}, {
  timestamp: true,
  collection: COLLECTION_NAME
});

module.exports = model(DOCUMENT_NAME, auctionHeartSchema);
