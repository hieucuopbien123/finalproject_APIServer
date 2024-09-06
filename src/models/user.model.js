"use strict"

const { model, Schema } = require("mongoose");

const DOCUMENT_NAME = "User";
const COLLECTION_NAME = "Users";

const userSchema = new Schema({
  _id: { type: String, required: true },
  username: { type: String },
  imageurl: { type: String },
  description: { type: String },
  website: { type: String },
  discord: { type: String },
  tele: { type: String },
  insta: { type: String },
  twitter: { type: String },
  isKyced: { type: Boolean }
}, {
  timestamp: true,
  collection: COLLECTION_NAME
});

module.exports = model(DOCUMENT_NAME, userSchema);
