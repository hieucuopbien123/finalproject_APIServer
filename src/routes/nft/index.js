"use strict"

const express = require("express");
const { asyncHandler } = require("../../helpers/auth.helper");
const { Moralis } = require("../../moralis");
const { EvmChain } = require("@moralisweb3/common-evm-utils");
const router = express.Router();
const { request, gql } = require('graphql-request');
const { checkMoralis, readFile } = require("../../restartserver");
const { myCache, myLongCach } = require("../../cache");
const collectionModel = require("../../models/collection.model");
const nftModel = require("../../models/nft.model");
const userModel = require("../../models/user.model");
const rateLimit = require("express-rate-limit");
const nftHeartModel = require("../../models/nftHeart.model");

router.get("/collectionlist", asyncHandler(async (req, res) => {
  try{
    const requestData = {
      first: req.query?.first ?? 50,
      skip: req.query?.skip ?? 0
    }
    const query = gql`{
      collections(first: ${requestData.first}, skip: ${requestData.skip}) {
        id
      }
    }`;
    const response = await request(process.env.GRAPH_URL, query);    
    if(!response) {
      throw new Error("Graph return null");
    }
    if((response.collections?.length ?? 0) > 0){
      let collectionList = []
      for(let i = 0; i < response.collections.length; i++) {
        collectionList = collectionList.concat(response.collections.map(c => c.id));
      }
      collectionList = [...new Set(collectionList.map(c => c.toLowerCase()))];
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
        let response2 = savedCList;
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
          response2 = response2.concat(responseX);
        }
        returnVal = [];
        for(let i = 0; i < collectionList.length; i++) {
          let result = response2.find(item => item.token_address == collectionList[i]);
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
      if(returnVal.length > 0){
        let entityAddressIn = "";
        entityAddressIn = `entityAddress_in: [${returnVal.map(r => `"${r.token_address}"`).join(",")}]`;
        const query2 = gql`{
          stats(where: {statType: "0", ${entityAddressIn}}) {
            auctionType
            entityAddress
            auctionCount
            statType
            volume {
              amount
              paymentToken
            }
          }
        }`;
        const response3 = (await request(process.env.GRAPH_URL, query2)).stats;    
        if(!response3) {
          throw new Error("Graph return null");
        }
        const grouped = response3.reduce((acc, obj) => {
          const property = obj["entityAddress"];
          acc[property] = acc[property] || [];
          acc[property].push(obj);
          return acc;
        }, {});
        for(let i = 0; i < returnVal.length; i++) {
          if(grouped[returnVal[i].token_address]){
            returnVal[i].auctionStat = grouped[returnVal[i].token_address];
          }
        }
      }
      res.json(returnVal);
    } else {
      res.json([]);
    }
  } catch(e){
    console.log("Error query graph");
    res.status(500);
    res.json({ error: e.message });
  }
}));

router.get("/collectiondetail", asyncHandler(async (req, res) => {
  try{
    if(!req.query.address) {
      throw new Error("Invalid params");
    }
    let collectionList = [req.query.address];
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
      let response2 = savedCList;
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
        response2 = response2.concat(responseX);
      }
      returnVal = [];
      for(let i = 0; i < collectionList.length; i++) {
        let result = response2.find(item => item.token_address == collectionList[i]);
        if (result) {
          returnVal.push(result)
        } else {
          returnVal.push({
            token_address: collectionList[i]
          })
        }
      }
      const responseY = await Moralis.EvmApi.nft.getNFTCollectionStats({
        "chain": "0xaa36a7",
        "address": collectionList[0]
      });
      returnVal[0].total_tokens = responseY.raw?.total_tokens;
      returnVal[0].owners = responseY.raw?.owners?.current;
      returnVal[0].transfers = responseY.raw?.transfers?.total;
    } catch(e){
      console.log("Error fetch moralis");
      console.log(e);
    }
    if(returnVal.length > 0){
      let entityAddressIn = "";
      entityAddressIn = `entityAddress_in: [${returnVal.map(r => `"${r.token_address}"`).join(",")}]`;
      const query2 = gql`{
        stats(where: {statType: "0", ${entityAddressIn}}) {
          auctionType
          entityAddress
          auctionCount
          statType
          volume {
            amount
            paymentToken
          }
        }
      }`;
      const response3 = (await request(process.env.GRAPH_URL, query2)).stats;    
      if(!response3) {
        throw new Error("Graph return null");
      }
      const grouped = response3.reduce((acc, obj) => {
        const property = obj["entityAddress"];
        acc[property] = acc[property] || [];
        acc[property].push(obj);
        return acc;
      }, {});
      for(let i = 0; i < returnVal.length; i++) {
        if(grouped[returnVal[i].token_address]){
          returnVal[i].auctionStat = grouped[returnVal[i].token_address];
        }
      }
    }
    res.json(returnVal);
  } catch(e){
    console.log("Error query graph");
    res.status(500);
    res.json({ error: e.message });
  }
}));

router.get("/getnftbycollection", asyncHandler(async (req, res) => {
  try{
    let request = {
      chain: EvmChain.SEPOLIA._chainlistData.chainId,
      format: "decimal",
      normalizeMetadata: true,
      address: req.query.collectionAddress
    };
    if(!!req.query.limit){
      request.limit = req.query.limit;
    }
    if(!!req.query.cursor){
      request.cursor = req.query.cursor;
    }
    const response = await checkMoralis(() => Moralis.EvmApi.nft.getContractNFTs(request));
    res.status(200).json({ data: response.raw });
  } catch(e){
    console.log("Error query graph");
    res.status(500);
    res.json({ error: e.message });
  }
}));

router.get("/getnftdetail", asyncHandler(async (req, res) => {
  try{
    if(!req.query.nftaddress || !req.query.nftId) {
      throw new Error("Invalid params");
    }
    let result = {};
    const response2 = await checkMoralis(() => Moralis.EvmApi.nft.getNFTTokenStats({
      "chain": "0xaa36a7",
      "address": req.query.nftaddress,
      "tokenId": req.query.nftId
    }));

    result = response2.raw;

    let nftDB = [];
    // nftDB = await nftModel.find({
    //   $and: [
    //     { token_id: req.query.nftId }, 
    //     { token_address: req.query.nftaddress } 
    //   ]
    // }).lean();
    if(nftDB.length < 1) {
      const response3 = await Moralis.EvmApi.nft.getNFTMetadata({
        "chain": "0xaa36a7",
        "format": "decimal",
        "normalizeMetadata": true,
        "address": req.query.nftaddress,
        "tokenId": req.query.nftId
      });
      // await nftModel.create({...response3.raw, token_address: response3.raw.token_address.toLowerCase()});
      result = {
        ...result,
        ...response3.raw
      }
    } else {
      result = {
        ...result,
        ...nftDB[0]
      }
    }
    const document = await nftHeartModel.findOne({
      address: req.query.nftaddress.trim().toLowerCase(), id: req.query.nftId?.trim().toLowerCase()
    });
    res.status(200).json({ data: {...result, heartNum: document?.heartAddresses?.length ?? 0 }});
  } catch(e){
    console.log("Error query graph");
    res.status(500);
    res.json({ error: e.message });
  }
}));

router.get("/getnftauctionhistory", asyncHandler(async (req, res) => {
  try{
    if(!req.query.nftaddress || !req.query.nftId) {
      throw new Error("Invalid params");
    }
    const requestData = {
      nftaddress: req.query.nftaddress,
      nftId: req.query.nftId,
      first: req.query.first ?? 10,
      skip: req.query.skip ?? 0
    }
    const query = gql`{
      nft(id: "${requestData.nftaddress}_${requestData.nftId}") {
        auctionDetail(orderBy: timestamp, orderDirection: desc, skip: ${requestData.skip}, first: ${requestData.first}) {
          id
          timestamp
        }
      }
    }`;
    const response = (await request(process.env.GRAPH_URL, query))?.nft?.auctionDetail;
    if(response == null) {
      res.status(200).json({ data: []});
    } else {
      res.status(200).json({ data: response});
    }
  } catch(e){
    console.log("Error query graph");
    res.status(500);
    res.json({ error: e.message });
  }
}));

router.get("/getnftdetailowners", asyncHandler(async (req, res) => {
  try{
    let request = {
      chain: EvmChain.SEPOLIA._chainlistData.chainId,
      format: "decimal",
      address: req.query.collectionAddress,
      "tokenId": req.query.nftId,
      normalizeMetadata: false,
      "mediaItems": false,
    }
    if(!!req.query.limit){
      request.limit = req.query.limit;
    }
    if(!!req.query.cursor){
      request.cursor = req.query.cursor;
    }
    const response = (await checkMoralis(() => Moralis.EvmApi.nft.getNFTTokenIdOwners(request)))?.raw;
    if(response) {
      const listOwner = response.result.map(r => ({
        id: r.owner_of.toLowerCase(),
        amount: r.amount
      }));
      let result = {};
      for(let i = 0; i < listOwner.length; i++){
        result[listOwner[i].id] = {
          _id: listOwner[i].id,
          amount: listOwner[i].amount
        }
      }
      const data = await userModel.find({ _id: { $in: listOwner.map(l => l.id) } });
      for(let i = 0; i < data.length; i++){
        result[data[i]._id] = data[i];
      }
      res.json({
        data: result,
        cursor: response.cursor
      });
    } else {
      res.json([]);
    }
  } catch (e) {
    throw new Error(e.message);
  }
}));

router.get("/getnftdetailtransfer", asyncHandler(async (req, res) => {
  try{
    if(!req.query.nftaddress || !req.query.nftId) {
      throw new Error("Invalid params");
    }
    const requestData = {
      "chain": "0xaa36a7",
      "format": "decimal",
      "order": "DESC",
      "address": req.query.nftaddress,
      "tokenId": req.query.nftId,
      "limit": req.query.limit ?? 10,
    };
    if(req.query.cursor) requestData.cursor = req.query.cursor;
    const response = await checkMoralis(() => Moralis.EvmApi.nft.getNFTTransfers(requestData));
    const result = response.raw;
    res.status(200).json({ data: result});
  } catch(e){
    console.log("Error query graph");
    res.status(500);
    res.json({ error: e.message });
  }
}));

router.get("/getnftdetailtrade", asyncHandler(async (req, res) => {
  try{
    if(!req.query?.collectionAddress || !req.query?.nftId) {
      throw new Error("Wrong input query");
    }
    const requestData = {
      first: req.query?.first ?? 50,
      skip: req.query?.skip ?? 0,
    };
    const query = gql`{
      trades(
        where: {auctionDetail_: {collectionAddress_contains: ["${req.query.collectionAddress}"], nftIds_contains: ["${req.query.nftId}"]}}
        skip: ${requestData.skip}
        first: ${requestData.first}
        orderBy: timestamp
        orderDirection: desc
      ) {
        price
        timestamp
        type
        hash
        bidder {
          id
        }
        auctioneer {
          id
        }
        auctionDetail {
          status
          paymentToken
          id
        }
      }
    }`;
    const response = (await request(process.env.GRAPH_URL, query))?.trades;
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

const mergeArrays = (arr1, arr2) => {
  const map = new Map();
  const mergeObjects = (obj1, obj2) => ({ ...obj1, ...obj2 });
  arr1.forEach(obj => {
    const key = obj.id.toLowerCase();
    map.set(key, obj);
  });
  arr2.forEach(obj => {
    const key = obj.id.toLowerCase();
    if (map.has(key)) {
      map.set(key, mergeObjects(map.get(key), obj));
    } else {
      map.set(key, obj);
    }
  });
  return Array.from(map.values());
};

router.get("/search", asyncHandler(async (req, res) => {
  try{
    if(!req.query?.search?.trim()) {
      res.json([]);
      return;
    }
    let searchTerms = req.query?.search?.trim();
    const regex = /^[a-fxA-FX0-9]+$/;
    const isValid = regex.test(searchTerms);
    if(!isValid) {
      let result = {};
      const userList = await userModel.find({
        $or: [
          { _id: { $regex: searchTerms, $options: 'i' } },
          { username: { $regex: searchTerms, $options: 'i' } }
        ]
      }).lean();
      for(let i = 0; i < userList.length; i++) {
        userList[i].id = userList[i]._id;
      }
      result.user = userList;
      res.json(result);
      return;
    }
    if(searchTerms.length % 2 == 1) {
      searchTerms = searchTerms.slice(0, -1);
    }
    if(!searchTerms) {
      res.json([]);
      return;
    }
    let result = {};

    // Tìm auction
    const auctionGraphQuery = gql`{
      auctionDetails(
        where: {
          or: [
            {id_contains: "${searchTerms}"}
            {collectionAddress_contains_nocase: [
              "${searchTerms}"
            ]}
          ]
        }
        skip: 0
        first: 3
        orderBy: timestamp
        orderDirection: desc
      ) {
        id
        timestamp
        status
        nftCount
        collectionAddress
        auctionType
        nftIds
      }
    }`;
    const response = (await request(process.env.GRAPH_URL, auctionGraphQuery))?.auctionDetails;
    result.auction = response;

    // Tìm user
    const userGraphQuery = gql`{
      users(first: 3, skip: 0, where: {id_contains: "${searchTerms}"}) {
        biddedCollectionCount
        id
        ownedCollectionCount
      }
    }`;
    const response2 = (await request(process.env.GRAPH_URL, userGraphQuery))?.users;
    const userList = await userModel.find({
      $or: [
        { _id: { $regex: searchTerms, $options: 'i' } },
        { usernamea: { $regex: searchTerms, $options: 'i' } }
      ]
    }).lean();
    for(let i = 0; i < userList.length; i++) {
      userList[i].id = userList[i]._id;
    }
    result.user = userList;
    if(response2) {
      const resultUser = mergeArrays(userList, response2);
      result.user = resultUser;
    }

    // Tìm collection
    const collectionGraphQuery = gql`{
      collections(first: 3, skip: 0, where: {id_contains: "${searchTerms}"}) {
        id
      }
    }`;
    const response3 = (await request(process.env.GRAPH_URL, collectionGraphQuery))?.collections;
    if(response3) {
      let MORALIS_API_KEY = process.env.MORALIS_API_KEY;
      {
        const x = readFile("moralis.txt")
        if(x == "2") {
          MORALIS_API_KEY = process.env.MORALIS_API_KEY2;
        } else if(x == "3") {
          MORALIS_API_KEY = process.env.MORALIS_API_KEY3;
        }
      }
      let x = [];
      const presponse3 = response3.map(r => r.id);
      const chunk = 25;
      for (let i = 0; i < presponse3.length; i += chunk) {
        let requestChunk = presponse3.slice(i, i + chunk);
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
        x = x.concat(responseX);
      }
      result.collection = x;
    }

    res.json(result);
  } catch(e){
    console.log("Error query graph")
    res.status(500);
    res.json({ error: e.message });
  }
}));

router.post("/resyncmetadata", asyncHandler(async (req, res) => {
  try{
    if(!req.body?.address?.trim()) {
      res.json([]);
      return;
    }
    const key = `resyncmetadata_${req.body?.address?.trim()}`;
    const cachedData = myLongCach.get(key);
    if(cachedData) {
      res.json(cachedData);
    } else {
      const response = await checkMoralis(() => Moralis.EvmApi.nft.syncNFTContract({
        chain: EvmChain.SEPOLIA._chainlistData.chainId,
        "address": req.body?.address
      }));
      myLongCach.set(key, response);
      res.json(response);
    }
  } catch(e){
    console.log("Error query graph")
    res.status(500);
    res.json({ error: e.message });
  }
}));

const heartRateLimiter = rateLimit({
  windowMs: 10 * 1000, // 1 minute window
  max: 5, // limit each IP to 5 requests per windowMs
  message: "Too many requests, please try again later."
});

router.post("/heart", heartRateLimiter, asyncHandler(async (req, res) => {
  try{
    if(!req.body?.collectionAddress?.trim() || !req.body?.nftId?.trim() || !req.body?.userAddress?.trim()) {
      res.json({});
      return;
    }
    const heart = req.body?.heart ?? true;
    if(heart == true) {
      const result = await nftHeartModel.updateOne(
        { id: req.body.nftId.trim()?.toLowerCase(), address: req.body.collectionAddress?.trim()?.toLowerCase() },
        { $addToSet: { heartAddresses: req.body.userAddress.trim()?.toLowerCase() } },
        { upsert: true }
      );
      res.json({result});
    } else {
      const result = await nftHeartModel.updateOne(
        { id: req.body.nftId.trim()?.toLowerCase(), address: req.body.collectionAddress?.trim()?.toLowerCase() },
        { $pull: { heartAddresses: req.body.userAddress.trim()?.toLowerCase() } }
      );
      res.json({result});
    }
  } catch(e){
    console.log("Error query graph")
    res.status(500);
    res.json({ error: e.message });
  }
}));

router.get("/heart", asyncHandler(async (req, res) => {
  try{
    if(!req.query?.collectionAddress?.trim() || !req.query?.nftId?.trim() || !req.query?.userAddress?.trim()) {
      res.json({});
      return;
    } 
    const document = await nftHeartModel.findOne({
      id: req.query.nftId.trim()?.toLowerCase(), 
      address: req.query.collectionAddress.trim()?.toLowerCase(),
      heartAddresses: req.query.userAddress.trim()?.toLowerCase()
    });
    if(document) {
      res.json({result: true});
    } else {
      res.json({result: false});
    }
  } catch(e){
    console.log("Error query graph")
    res.status(500);
    res.json({ error: e.message });
  }
}));

router.get("/heartNum", asyncHandler(async (req, res) => {
  try{
    if(!req.query?.collectionAddress?.trim() || !req.query?.nftId?.trim()) {
      res.json({});
    } else {
      const document = await nftHeartModel.findOne({
        id: req.query.nftId.trim()?.toLowerCase(), address: req.query.collectionAddress.trim()?.toLowerCase()
      });
      res.json({result: document?.heartAddresses?.length ?? 0});
    }
  } catch(e){
    console.log("Error query graph")
    res.status(500);
    res.json({ error: e.message });
  }
}));

module.exports = router;
