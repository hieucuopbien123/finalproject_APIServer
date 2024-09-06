"use strict"

const { model, Schema } = require("mongoose");

const DOCUMENT_NAME = "NFT";
const COLLECTION_NAME = "NFTs";

const nftSchema = new Schema({
  amount: { type: String, default: "0" },
  token_id: { type: String, required: true },
  token_address: { type: String, required: true },
  contract_type: { type: String, required: true },
  owner_of: { type: String },
  last_metadata_sync: { type: String },
  last_token_uri_sync: { type: String },
  metadata: { type: String },
  block_number: { type: String },
  block_number_minted: { type: String },
  name: { type: String },
  symbol: { type: String },
  token_hash: { type: String },
  token_uri: { type: String },
  minter_address: { type: String },
  verified_collection: { type: Boolean },
  possible_spam: { type: Boolean },
  normalized_metadata: {
    name: { type: String },
    description: { type: String },  
    animation_url: { type: String },  
    external_link: { type: String },  
    image: { type: String },  
    attributes: { type: Array, default: [] }
  },
  collection_logo: { type: String },  
  collection_banner_image: { type: String },  
}, {
  timestamp: true,
  collection: COLLECTION_NAME
});

module.exports = model(DOCUMENT_NAME, nftSchema);
