"use strict"

const { model, Schema } = require("mongoose");

const DOCUMENT_NAME = "Collection";
const COLLECTION_NAME = "Collections";

const collectionSchema = new Schema({
  token_address: { type: String, required: true },
  name: { type: String },
  symbol: { type: String },
  contract_type: { type: String },
  synced_at: { type: String },
  possible_spam: { type: Boolean },
  verified_collection: { type: Boolean },
  collection_logo: { type: String },
  collection_banner_image: { type: String },
  collection_category: { type: String },
  project_url: { type: String },
  wiki_url: { type: String },
  discord_url: { type: String },
  telegram_url: { type: String },
  twitter_username: { type: String },
  instagram_username: { type: String },
  queryCount: { type: Number }
}, {
  timestamp: true,
  collection: COLLECTION_NAME
});

module.exports = model(DOCUMENT_NAME, collectionSchema);
