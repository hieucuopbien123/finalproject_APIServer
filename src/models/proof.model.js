"use strict"

const { model, Schema } = require("mongoose");

const DOCUMENT_NAME = "Proof";
const COLLECTION_NAME = "Proofs";

const proofSchema = new Schema({
  auctionAddress: { type: String, required: true },
  proof: { type: String, required: true },
  create2Address: { type: String, required: true }
}, {
  timestamp: true,
  collection: COLLECTION_NAME
});

module.exports = model(DOCUMENT_NAME, proofSchema);
