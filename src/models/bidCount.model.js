"use strict"

const { model, Schema } = require("mongoose");

const DOCUMENT_NAME = "BidCount";
const COLLECTION_NAME = "BidCounts";

const bidCountSchema = new Schema({
  _id: { type: String, required: true },
  auctionType: { type: Number, required: true },
  count: { type: Number, required: true },
  userList: { type: Array, default: [] }
}, {
  timestamp: true,
  collection: COLLECTION_NAME
});

module.exports = model(DOCUMENT_NAME, bidCountSchema);
