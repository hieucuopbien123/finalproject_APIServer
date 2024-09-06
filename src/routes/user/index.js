"use strict"

const express = require("express");
const { asyncHandler } = require("../../helpers/auth.helper");
const { Moralis } = require("../../moralis");
const { EvmChain } = require("@moralisweb3/common-evm-utils");
const router = express.Router();
const { request, gql } = require('graphql-request');
const { checkMoralis, readFile } = require("../../restartserver");
const userModel = require("../../models/user.model");
const { myCache } = require("../../cache");
const collectionModel = require("../../models/collection.model");
const upload = require("../../helpers/multer");
const { recoverMessageAddress } = require("viem");

router.get("/", asyncHandler(async (req, res) => {
  let userInfo = {};
  try{
    userInfo = await userModel.findOne({ _id: req.query.address.toLowerCase() }).lean();
  } catch(e){
    console.log("Error fetch db");
  }    
  try{
    const key = `user_${req.query.address}`;
    const cachedData = myCache.get(key);
    let res = {};
    if(cachedData) {
      res = cachedData;
    } else {
      const response2 = await checkMoralis(() => Moralis.EvmApi.wallets.getWalletStats({
        "chain": EvmChain.SEPOLIA._chainlistData.chainId,
        "address": req.query.address
      }));
      res = {
        nfts: response2.raw.nfts ?? 0,
        collections: response2.raw.collections ?? 0,
      }
      myCache.set(key, res);
    }
    userInfo = {
      ...userInfo,
      ...res
    }
  } catch(e) {
    console.log("Error moralis");
  }
  try{
    const query = gql`{
      user(id: "${req.query.address}") {
        biddedCollectionCount
        ownedCollectionCount
        stats {
          auctionCount
          auctionType
          statType
          volume {
            amount
            id
            paymentToken
          }
        }
      }
    }`;
    const response3 = await request(process.env.GRAPH_URL, query);
    if(response3.user){
      userInfo = {
        ...userInfo,
        biddedCollectionCount: response3.user.biddedCollectionCount,
        ownedCollectionCount: response3.user.ownedCollectionCount,
        stats: response3.user.stats,
      }
    }
  } catch(e){
    console.log("Error query graph")
  }
  if (userInfo && Object.keys(userInfo).length >0) {
    res.status(200).json({data: userInfo});
  } else {
    throw new Error("Not found user");
  }
}));

router.get("/usernfts", asyncHandler(async (req, res) => {
  try{
    let request = {
      chain: EvmChain.SEPOLIA._chainlistData.chainId,
      address: req.query.address,
      excludeSpam: true,
      format: "decimal",
      normalizeMetadata: true,
    }
    if(!!req.query.collections) {
      request.tokenAddresses = [...new Set(req.query.collections.split(','))];
    }
    if(!!req.query.limit){
      request.limit = req.query.limit;
    }
    if(!!req.query.cursor){
      request.cursor = req.query.cursor;
    }
    const response = await checkMoralis(() => Moralis.EvmApi.nft.getWalletNFTs(request));
    res.status(200).json({ data: response.raw });
  } catch (e) {
    throw new Error(e.message);
  }
}));

router.get("/usercollections", asyncHandler(async (req, res) => {
  try{
    if(req.query.address == null) { 
      throw new Error("Wrong input query");
    }
    const key = `usercollections_${req.query.address}_${!!req.query.limit ? req.query.limit : "null"}_${!!req.query.cursor ? req.query.cursor : "null"}`;
    const cachedData = myCache.get(key);
    if(cachedData) {
      res.json(cachedData);
    } else {
      let MORALIS_API_KEY = process.env.MORALIS_API_KEY;
      {
        const x = readFile("moralis.txt")
        if(x == "2") {
          MORALIS_API_KEY = process.env.MORALIS_API_KEY2;
        } else if(x == "3") {
          MORALIS_API_KEY = process.env.MORALIS_API_KEY3;
        }
      }
      const options = {
        method: 'GET',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          'X-API-Key': MORALIS_API_KEY
        },
      };
      const responseX = await (await checkMoralis(() => fetch(`${process.env.MORALIS_HTTP_URL}/${req.query.address}/nft/collections?chain=sepolia${!!req.query.limit ? `&limit=${req.query.limit}` : ""}&exclude_spam=true${!!req.query.cursor ? `&cursor=${req.query.cursor}` : ""}`, options))).json();
      myCache.set(key, { data: responseX });
      res.status(200).json({ data: responseX });
    }
  } catch (e) {
    throw new Error(e.message);
  }
}));

router.get("/userownedauctioncollections", asyncHandler(async (req, res) => {
  try{
    if(!req.query?.userAddress) {
      throw new Error("Wrong input query");
    }
    const requestData = {
      first: req.query?.first ?? 50,
      skip: req.query?.skip ?? 0,
      orderBy: req.query?.orderBy ?? "id",
      orderDirection: req.query?.orderDirection ?? "desc",
      auctionCreator: req.query.userAddress ?? null
    };
    const query = gql`{
      user(id: "${requestData.auctionCreator}") {
        ownedCollection(
          first: ${requestData.first}, 
          orderBy: ${requestData.orderBy}, 
          orderDirection: ${requestData.orderDirection}, 
          skip: ${requestData.skip}
        ) {
          id
        }
      }
    }`;
    const response = (await request(process.env.GRAPH_URL, query)).user?.ownedCollection;
    if(!response) {
      res.json([]);
      return;
    }
    if(response.length > 0) {
      let collectionList = [...new Set(response.map(c => c.id.toLowerCase()))];
      let returnVal = collectionList.map(c => ({ address: c}));
      try{
        // const savedCList = await collectionModel.find({ 
        //   token_address: { $in: collectionList } 
        // }).lean();
        const savedCList = [];
        const notSavedCList = collectionList.filter(c => !savedCList.some(s => s.token_address.toLowerCase() == c.toLowerCase()));
        let MORALIS_API_KEY = process.env.MORALIS_API_KEY;
        {
          const x = readFile("moralis.txt")
          if(x == "2") {
            MORALIS_API_KEY = process.env.MORALIS_API_KEY2;
          } else if(x == "3") {
            MORALIS_API_KEY = process.env.MORALIS_API_KEY3;
          }
        }
        let chunk = 25;
        let response = savedCList;
        for (let i = 0; i < notSavedCList.length; i += chunk) {
          let requestChunk = notSavedCList.slice(i, i + chunk);
          const options = {
            method: 'POST',
            headers: {
              accept: 'application/json',
              'content-type': 'application/json',
              'X-API-Key': MORALIS_API_KEY
            },
            body: JSON.stringify({
              "addresses": requestChunk
            })
          };
          const responseX = await (await checkMoralis(() => fetch(`${process.env.MORALIS_HTTP_URL}/nft/metadata?chain=sepolia`, options))).json();
          // try{
          //   for(let j = 0; j < responseX.length; j++) {
          //     await collectionModel.create({...responseX[j], token_address: responseX[j].token_address.toLowerCase()});
          //   }
          // } catch(e) {
          //   console.log("Error update db::", e.message);
          // }
          response = response.concat(responseX);
        }
        returnVal = [];
        for(let i = 0; i < collectionList.length; i++) {
          let result = response.find(item => item.token_address == collectionList[i]);
          if (result) {
            returnVal.push(result)
          } else {
            returnVal.push({
              token_address: collectionList[i]
            })
          }
        }
      } catch(e){
        console.log("Error fetch moralis");
        console.log(e);
      }
      res.json(returnVal);
    } else {
      res.json(response);
    }
  } catch(e){
    console.log("Error query graph")
    res.status(500);
    res.json({ error: e.message });
  }
}));

router.get("/userbiddedauctioncollections", asyncHandler(async (req, res) => {
  try{
    if(!req.query?.userAddress) {
      throw new Error("Wrong input query");
    }
    const requestData = {
      first: req.query?.first ?? 50,
      skip: req.query?.skip ?? 0,
      orderBy: req.query?.orderBy ?? "id",
      orderDirection: req.query?.orderDirection ?? "desc",
      auctionCreator: req.query.userAddress ?? null
    };
    const query = gql`{
      user(id: "${req.query.userAddress}") {
        biddedCollection(
          first: ${requestData.first}, 
          orderBy: ${requestData.orderBy}, 
          orderDirection: ${requestData.orderDirection}, 
          skip: ${requestData.skip}
        ) {
          id
        }
      }
    }`;
    const response = (await request(process.env.GRAPH_URL, query)).user?.biddedCollection;
    if(!response) {
      res.json([]);
      return;
    }
    if(response.length > 0) {
      let collectionList = [...new Set(response.map(c => c?.id.toLowerCase()))];
      let returnVal = collectionList.map(c => ({ address: c}));
      try{
        // const savedCList = await collectionModel.find({ 
        //   token_address: { $in: collectionList } 
        // }).lean();
        const savedCList = [];
        const notSavedCList = collectionList.filter(c => !savedCList.some(s => s.token_address.toLowerCase() == c.toLowerCase()));
        let MORALIS_API_KEY = process.env.MORALIS_API_KEY;
        {
          const x = readFile("moralis.txt")
          if(x == "2") {
            MORALIS_API_KEY = process.env.MORALIS_API_KEY2;
          } else if(x == "3") {
            MORALIS_API_KEY = process.env.MORALIS_API_KEY3;
          }
        }
        let chunk = 25;
        let responseY = savedCList;
        for (let i = 0; i < notSavedCList.length; i += chunk) {
          let requestChunk = notSavedCList.slice(i, i + chunk);
          const options = {
            method: 'POST',
            headers: {
              accept: 'application/json',
              'content-type': 'application/json',
              'X-API-Key': MORALIS_API_KEY
            },
            body: JSON.stringify({
              "addresses": requestChunk
            })
          };
          const responseX = await (await checkMoralis(() => fetch(`${process.env.MORALIS_HTTP_URL}/nft/metadata?chain=sepolia`, options))).json();
          // try{
          //   for(let j = 0; j < responseX.length; j++) {
          //     await collectionModel.create({...responseX[j], token_address: responseX[j].token_address.toLowerCase()});
          //   }
          // } catch(e) {
          //   console.log("Error update db::", e.message);
          // }
          responseY = responseY.concat(responseX);
        }
        returnVal = [];
        for(let i = 0; i < collectionList.length; i++) {
          let result = responseY.find(item => item.token_address == collectionList[i]);
          if (result) {
            returnVal.push(result)
          } else {
            returnVal.push({
              token_address: collectionList[i]
            })
          }
        }
      } catch(e){
        console.log("Error fetch moralis");
        console.log(e);
      }
      res.json(returnVal);
    } else {
      res.json(response);
    }
  } catch(e){
    console.log("Error query graph")
    res.status(500);
    res.json({ error: e.message });
  }
}));

router.post("/", upload.single("image"), asyncHandler(async (req, res) => {
  try{
    if(!req.body.sig) {
      throw new Error("Invalid data");
    }
    const address = await recoverMessageAddress({ 
      message: 'Confirm edit user info',
      signature: req.body.sig,
    });
    let imageurl = null;
    if(req.file?.filename){
      imageurl = `users/${req.file.filename}`;
    }
    const { username, description, web: website, x: twitter, discord, tele, insta } = req.body;
    const updateData = Object.fromEntries(Object.entries({imageurl, username, description, website, twitter, discord, tele, insta}).filter(([_, v]) => v !== null && v !== 'null' && v !== "undefined"));
    const user = await userModel.findOneAndUpdate(
      { _id: address.toLowerCase() }, 
      { $set: {...updateData, isKyced: true} },
      { new: true, upsert: true }
    );
    res.json({user});
  } catch(e){
    res.status(500);
    res.json({ error: e.message });
  }
}));

router.get("/useractivities", asyncHandler(async (req, res) => {
  try{
    if(!req.query?.userAddress) {
      throw new Error("Wrong input query");
    }
    const requestData = {
      first: req.query?.first ?? 50,
      skip: req.query?.skip ?? 0,
    };
    const query = gql`{
      user(id: "${req.query.userAddress}") {
        trade(first: ${requestData.first}, skip: ${requestData.skip}, orderBy: timestamp, orderDirection: desc) {
          hash
          id
          price
          timestamp
          type
          bidder {
            id
          }
          auctioneer {
            id
          }
          auctionDetail {
            status
            id
            paymentToken
          }
        }
      }
    }`;
    const response = (await request(process.env.GRAPH_URL, query))?.user?.trade;
    if(!response) {
      res.json([]);
      return;
    }
    res.json(response);
  } catch(e){
    console.log("Error query graph")
    res.status(500);
    res.json({ error: e.message });
  }
}));


module.exports = router;
