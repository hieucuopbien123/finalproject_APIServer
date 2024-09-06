"use strict"

const express = require("express");
const { asyncHandler } = require("../../helpers/auth.helper");
const router = express.Router();
const { request, gql } = require('graphql-request');
const { checkMoralis, readFile } = require("../../restartserver");
const nftModel = require("../../models/nft.model");
const collectionModel = require("../../models/collection.model");
const bidCountModel = require("../../models/bidCount.model");
const userModel = require("../../models/user.model");
const { recoverMessageAddress, keccak256 } = require("viem");
const { toUtf8Bytes, ethers } = require("ethers");
const proofModel = require("../../models/proof.model");
const { default: rateLimit } = require("express-rate-limit");
const auctionHeartModel = require("../../models/auctionHeart.model");

router.get("/stats", asyncHandler(async (req, res) => {
  if(req.query.auctionType == null) { 
    throw new Error("Wrong input query");
  }
  try{
    let returnVal = {
      auctionCount: 0,
      collectionCount: 0,
      creatorCount: 0,
      volume: []
    };
    const query = gql`{
      auctionCommons(where: 
        {id_in: ["${req.query.auctionType}"]}
      ) {
        id
        auctionCount
        collectionCount
        creatorCount
        volume {
          amount
          paymentToken
        }
      }
    }`;
    const response = await request(process.env.GRAPH_URL, query);
    if(!!response && response.auctionCommons.length > 0) {
      response.auctionCommons.map(a => {
        returnVal.auctionCount += a.auctionCount;
        returnVal.collectionCount += a.collectionCount;
        returnVal.creatorCount += a.creatorCount;
        for(let i = 0; i < a.volume.length; i++){
          const foundToken = returnVal.volume.find(element => element.paymentToken == a.volume[i].paymentToken);
          if(!!foundToken){
            foundToken.amount += a.volume[i].amount;
          } else {
            returnVal.volume.push({
              paymentToken: a.volume[i].paymentToken,
              amount: a.volume[i].amount
            })
          }
        }
      })
    }
    res.json(returnVal);
  } catch(e){
    console.log("Error query graph")
    res.status(500);
    res.json({ error: e.message });
  }
}));

router.get("/auctioncollection", asyncHandler(async (req, res) => {
  try{
    const requestData = {
      first: req.query?.first ?? 50,
      skip: req.query?.skip ?? 0
    }
    let auctionTypeFilter = "";
    if(req.query.auctionType != null) {
      auctionTypeFilter = `id_in: ["${req.query.auctionType}"]`;
      auctionTypeFilter = `(where: {${auctionTypeFilter}})`;
    }
    const query = gql`{
      auctionCommons${auctionTypeFilter} {
        collectionList(first: ${requestData.first}, orderBy: id, skip: ${requestData.skip}) {
          id
        }
      }
    }`;
    const response = (await request(process.env.GRAPH_URL, query)).auctionCommons;
    if(!response) {
      throw new Error("Graph return null");
    }
    if(response.length > 0) {
      let collectionList = []
      for(let i = 0; i < response.length; i++) {
        collectionList = collectionList.concat(response[i].collectionList.map(c => c.id));
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

router.get("/auctioncreator", asyncHandler(async (req, res) => {
  try{    
    const requestData = {
      first: req.query?.first ?? 50,
      skip: req.query?.skip ?? 0
    }
    let auctionTypeFilter = "";
    if(req.query.auctionType != null) {
      auctionTypeFilter = `id_in: ["${req.query.auctionType}"]`;
      auctionTypeFilter = `(where: {${auctionTypeFilter}})`;
    }
    const query = gql`{
      auctionCommons${auctionTypeFilter}{
        creatorList(first: ${requestData.first}, orderBy: id, skip: ${requestData.skip}) {
          id
        }
      }
    }`;
    const response = (await request(process.env.GRAPH_URL, query)).auctionCommons;
    if(!response) {
      throw new Error("Graph return null");
    }
    if(response.length > 0) {
      let creatorList = [];
      for(let i = 0; i < response.length; i++) {
        creatorList = creatorList.concat(response[i].creatorList[0].id);
      }
      creatorList = [...new Set(creatorList.map(c => c.toLowerCase()))];
      const userInfo = await userModel.find({ 
        _id: { $in: creatorList } 
      }).lean();
      const nonSavedUsers = creatorList.filter(c => !userInfo.some(s => s._id == c.toLowerCase()));
      let returnVals = userInfo.map(u => ({
        address: u._id,
        imageurl: u.imageurl,
        username: u.username,
        isKyced: u.isKyced
      }))
      returnVals.push(...nonSavedUsers.map(u => ({
        address: u
      })));
      res.json(returnVals);
    } else {
      res.json(response);
    }
  } catch(e){
    console.log("Error query graph")
    res.status(500);
    res.json({ error: e.message });
  }
}));

router.post("/bidauction", asyncHandler(async (req, res) => {
  try{
    if(!req.body.userAddress && !req.body.auctionAddress && !req.body.sig) {
      throw new Error("Invalid data");
    }
    const sig = req.body.sig;
    const address = await recoverMessageAddress({ 
      message: 'Verify bidded user',
      signature: sig,
    });
    setTimeout(async () => {
      try{
        const url = `https://api-sepolia.etherscan.io/api?module=account&action=txlist&address=${address}&page=1&offset=1&sort=desc&apikey=${process.env.ETHERSCAN_API_KEY}`;
        const response = await (await fetch(url)).json();
        if(Math.floor((new Date()).getTime() / 1000) > parseInt(response?.result?.[0]?.timeStamp) + 60){
          throw new Error("Fail to update data");
        }
        const resFromDB = await bidCountModel.findOne({
          _id: req.body.auctionAddress.toLowerCase(),
        }).lean();
        if(resFromDB == null){
          const res2 = await bidCountModel.create({
            _id: req.body.auctionAddress.toLowerCase(),
            auctionType: req.body.auctionType,
            count: 1,
            userList: [req.body.userAddress.toLowerCase()]
          });
        } else {
          if(!resFromDB.userList.includes(req.body.userAddress.toLowerCase())) {
            const res2 = await bidCountModel.findOneAndUpdate(
              {
                _id: req.body.auctionAddress.toLowerCase(),
              },
              {
                $addToSet: { userList: req.body.userAddress.toLowerCase() },
                $inc: { count: 1 }
              },
              { new: false }
            ).lean();
          }
        }
      } catch(e){
        console.log("Error query server");
      }
    }, [12000]);
    res.json({});
  } catch(e){
    console.log("Error query server")
    res.status(500);
    res.json({ error: e.message });
  }
}));

router.get("/oneauction", asyncHandler(async (req, res) => {
  try{
    if(!req.query?.auctionAddress) {
      throw new Error("Invalid data");
    }
    const query = gql`{
      auctionDetail(id: "${req.query?.auctionAddress}") 
      {
        bidStep
        collectionAddress
        currentBid
        currentBidder
        endTime
        id
        minimumPrice
        nftCount
        nftIds
        paymentToken
        revealBlockNum
        status
        revealStep
        sndBid
        startTime
        startingPrice
        stepDuration
        auctionType
        timestamp
        auctionCreator {
          id
        }
      }
    }`;
    const response = (await request(process.env.GRAPH_URL, query)).auctionDetail;
    if(!response) {
      throw new Error("Graph return null");
    }
    const result2 = {};
    const bidCountInfo = await bidCountModel.findOne({ 
      _id: response.id
    })
    if(bidCountInfo) {
      result2[bidCountInfo.id] = bidCountInfo;
    }
    let nftInfos = {};
    let metaRequest = [];
    let nftDB = [];
    if(response.collectionAddress.length < response.nftIds.length) {
      const pairs = response.nftIds.map((e, index) => [response.collectionAddress[0].toLowerCase(), e]);
      // nftDB = await nftModel.find({
      //   $or: pairs.map(p => ({
      //     $and: [
      //       { token_id: p[1] }, 
      //       { token_address: p[0] } 
      //     ]
      //   }))
      // }).lean();
      const foundPairsSet = new Set(nftDB.map(doc => `${doc.token_address}-${doc.token_id}`));
      let notFoundPairs = pairs.filter(
        p => !foundPairsSet.has(`${p[0]}-${p[1]}`)
      );
      for(let j = 0; j < notFoundPairs.length; j++) {
        metaRequest.push({
          token_address: notFoundPairs[j][0],
          token_id: notFoundPairs[j][1],
        });
      }
    } else if(response.collectionAddress.length == response.nftIds.length){
      const pairs = response.collectionAddress.map((e, index) => [e.toLowerCase(), response.nftIds[index]]);
      // nftDB = await nftModel.find({
      //   $or: pairs.map(p => ({
      //     $and: [
      //       { token_id: p[1] }, 
      //       { token_address: p[0] } 
      //     ]
      //   }))
      // }).lean();
      const foundPairsSet = new Set(nftDB.map(doc => `${doc.token_address}-${doc.token_id}`));
      let notFoundPairs = pairs.filter(
        p => !foundPairsSet.has(`${p[0]}-${p[1]}`)
      );
      for(let j = 0; j < notFoundPairs.length; j++) {
        metaRequest.push({
          token_address: notFoundPairs[j][0],
          token_id: notFoundPairs[j][1],
        });
      }
    }
    for(let j = 0; j < nftDB.length; j++) {
      if(!nftInfos[nftDB[j].token_address]) {
        nftInfos[nftDB[j].token_address] = {};
      }
      nftInfos[nftDB[j].token_address][nftDB[j].token_id] = {
        name: nftDB[j].name,
        symbol: nftDB[j].symbol,
        contractType: nftDB[j].contract_type,
        image: nftDB[j].normalized_metadata.image,
        tokenAddress: nftDB[j].token_address,
        tokenId: nftDB[j].token_id,
      }
    }
    response.bidCount = result2?.[response.id];
    let chunk = 25;
    let MORALIS_API_KEY = process.env.MORALIS_API_KEY;
    {
      const x = readFile("moralis.txt")
      if(x == "2") {
        MORALIS_API_KEY = process.env.MORALIS_API_KEY2;
      } else if(x == "3") {
        MORALIS_API_KEY = process.env.MORALIS_API_KEY3;
      }
    }
    for (let i = 0; i < metaRequest.length; i += chunk) {
      let requestChunk = metaRequest.slice(i, i + chunk);
      const options = {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          'X-API-Key': MORALIS_API_KEY,
          "Authorization": `Bearer ${MORALIS_API_KEY}`
        },
        body: JSON.stringify({
          normalizeMetadata: true,
          media_items: false,
          "tokens": requestChunk,
        })
      };
      const response1 = await (await checkMoralis(
        () => fetch(`${process.env.MORALIS_HTTP_URL}/nft/getMultipleNFTs?chain=sepolia`, options)
      )).json();
      // try{
      //   for(let j = 0; j < response1.length; j++) {
      //     await nftModel.create({...response1[j], token_address: response1[j].token_address.toLowerCase()});
      //   }
      // } catch(e) {
      //   console.log("Error update db::", e.message);
      // }
      response1.map(r => {
        if(!nftInfos[r.token_address]) {
          nftInfos[r.token_address] = {};
        }
        nftInfos[r.token_address][r.token_id] = {
          name: r.name,
          symbol: r.symbol,
          contractType: r.contract_type,
          image: r.normalized_metadata.image,
          tokenAddress: r.token_address,
          tokenId: r.token_id,
        }
      });
    }
    response.nftInfo = [];
    if(response.collectionAddress.length < response.nftIds.length) {
      for(let j = 0; j < response.nftIds.length; j++) {
        if(nftInfos?.[response.collectionAddress[0]]?.[response.nftIds[j]]) {
          response.nftInfo[j] = nftInfos[response.collectionAddress[0]][response.nftIds[j]];
          response.nftInfo[j].nftCount = response.nftCount?.[j] ?? 1;
        } else {
          response.nftInfo[j] = null;
        }
      }
    } else if(response.collectionAddress.length == response.nftIds.length){
      for(let j = 0; j < response.nftIds.length; j++) {
        if(nftInfos?.[response.collectionAddress[j]]?.[response.nftIds[j]]) {
          response.nftInfo[j] = nftInfos[response.collectionAddress[j]][response.nftIds[j]];
          response.nftInfo[j].nftCount = response.nftCount?.[j] ?? 1;
        } else {
          response.nftInfo[j] = null;
        }
      }
    }

    const document = await auctionHeartModel.findOne({
      address: req.query?.auctionAddress
    });

    res.json({...response, heartNum: document?.heartAddresses?.length ?? 0 });
  } catch(e){
    console.log("Error query graph")
    res.status(500);
    res.json({ error: e.message });
  }
}));

router.get("/oneauctiontrade", asyncHandler(async (req, res) => {
  try{
    if(!req.query?.auctionAddress) {
      throw new Error("Invalid data");
    }
    const query = gql`{
      auctionDetail(id: "${req.query.auctionAddress}") {
        trade(first: ${req.query?.first ?? 10}, skip: ${req.query?.skip ?? 0}, orderBy: timestamp, orderDirection: desc) {
          hash
          id
          price
          timestamp
          type
          auctionDetail {
            status
            paymentToken
          }
          bidder {
            id
          }
          auctioneer {
            id
          }
        }
      }
    }`;
    const response = (await request(process.env.GRAPH_URL, query))?.auctionDetail?.trade;
    if(!response) {
      throw new Error("Graph return null");
    }
    res.json(response);
  } catch(e){
    console.log("Error query graph")
    res.status(500);
    res.json({ error: e.message });
  }
}));

router.get("/ongoing", asyncHandler(async (req, res) => {
  try{
    const requestData = {
      first: req.query?.first ?? 50,
      skip: req.query?.skip ?? 0,
      orderBy: req.query?.orderBy ?? "timestamp",
      orderDirection: req.query?.orderDirection ?? "desc",
      auctionType: req.query.auctionType ?? null,
      auctionCreator: req.query.userAddress ?? null,
      collectionAddresses: req.query.collectionAddresses ?? null,
      searchTerms: req.query.searchTerms,
      status: req.query.status ?? "0"
    }
    let auctionCreatorFilter = "";
    if(requestData.auctionCreator != null) {
      auctionCreatorFilter = `{
        auctionCreator_in: [${requestData.auctionCreator.map(e => `"${e}"`).join(",")}]
      }`;
    }
    let auctionTypeFilter = "";
    if(requestData.auctionType != null) {
      auctionTypeFilter = `{
        auctionType_in: [${requestData.auctionType.map(a => [a]).flat().map(e => `"${e}"`).join(",")}]
      }`;
    }
    let auctionCollectionFilter = "";
    if(requestData.collectionAddresses != null) {
      auctionCollectionFilter = `{
        or: [
          ${requestData.collectionAddresses.map(e => `{collectionAddress_contains_nocase: ["${e}"]}`).join(",")}
        ]
      }`;
    }
    let auctionSearchTerms = "";
    if(requestData.searchTerms.length > 1) {
      let searchTerms = requestData.searchTerms;
      if(searchTerms.length % 2 == 1) {
        searchTerms = searchTerms.slice(0, -1);
      }
      auctionSearchTerms = `{
        or: [
          {currentBidder_contains: "${searchTerms}"},
          {id_contains: "${searchTerms}"}
        ]
      }`;
    }
    let statusQuery = `{status:${requestData.status}}`;
    const query = gql`{
      auctionDetails(
        where: {
          and: [
            ${statusQuery}
            ${auctionTypeFilter}
            ${auctionCreatorFilter}
            ${auctionCollectionFilter}
            ${auctionSearchTerms}
          ]
        }
        first: ${requestData.first}
        skip: ${requestData.skip}
        orderBy: ${requestData.orderBy}
        orderDirection: ${requestData.orderDirection}
      ) {
        bidStep
        collectionAddress
        currentBid
        currentBidder
        endTime
        id
        minimumPrice
        nftCount
        nftIds
        paymentToken
        revealBlockNum
        status
        revealStep
        sndBid
        startTime
        startingPrice
        stepDuration
        auctionType
        timestamp
        auctionCreator {
          id
        }
      }
    }`;
    const response = (await request(process.env.GRAPH_URL, query)).auctionDetails;
    if(!response) {
      throw new Error("Graph return null");
    }
    if(response.length > 0) {
      let result2 = {};
      const bidCountInfo = await bidCountModel.find({ 
        _id: { $in: response.map(r => r.id.toLowerCase()) } 
      });
      bidCountInfo.map(r => {
        result2[r.id] = r;
      });
      let nftInfos = {};
      let metaRequest = [];
      for(let i = 0; i < response.length; i++){
        let nftDB = [];
        if(response[i].collectionAddress.length < response[i].nftIds.length) {
          const pairs = response[i].nftIds.map((e, index) => [response[i].collectionAddress[0].toLowerCase(), e]);
          // nftDB = await nftModel.find({
          //   $or: pairs.map(p => ({
          //     $and: [
          //       { token_id: p[1] }, 
          //       { token_address: p[0] } 
          //     ]
          //   }))
          // }).lean();
          const foundPairsSet = new Set(nftDB.map(doc => `${doc.token_address}-${doc.token_id}`));
          let notFoundPairs = pairs.filter(
            p => !foundPairsSet.has(`${p[0]}-${p[1]}`)
          );
          for(let j = 0; j < notFoundPairs.length; j++) {
            metaRequest.push({
              token_address: notFoundPairs[j][0],
              token_id: notFoundPairs[j][1],
            });
          }
        } else if(response[i].collectionAddress.length == response[i].nftIds.length){
          const pairs = response[i].collectionAddress.map((e, index) => [e.toLowerCase(), response[i].nftIds[index]]);
          // nftDB = await nftModel.find({
          //   $or: pairs.map(p => ({
          //     $and: [
          //       { token_id: p[1] }, 
          //       { token_address: p[0] } 
          //     ]
          //   }))
          // }).lean();
          const foundPairsSet = new Set(nftDB.map(doc => `${doc.token_address}-${doc.token_id}`));
          let notFoundPairs = pairs.filter(
            p => !foundPairsSet.has(`${p[0]}-${p[1]}`)
          );
          for(let j = 0; j < notFoundPairs.length; j++) {
            metaRequest.push({
              token_address: notFoundPairs[j][0],
              token_id: notFoundPairs[j][1],
            });
          }
        }
        for(let j = 0; j < nftDB.length; j++) {
          if(!nftInfos[nftDB[j].token_address]) {
            nftInfos[nftDB[j].token_address] = {};
          }
          nftInfos[nftDB[j].token_address][nftDB[j].token_id] = {
            name: nftDB[j].name,
            symbol: nftDB[j].symbol,
            contractType: nftDB[j].contract_type,
            image: nftDB[j].normalized_metadata.image,
            tokenAddress: nftDB[j].token_address,
            tokenId: nftDB[j].token_id,
          }
        }
        response[i].bidCount = result2?.[response[i].id];
      }
      let chunk = 25;
      let MORALIS_API_KEY = process.env.MORALIS_API_KEY;
      {
        const x = readFile("moralis.txt")
        if(x == "2") {
          MORALIS_API_KEY = process.env.MORALIS_API_KEY2;
        } else if(x == "3") {
          MORALIS_API_KEY = process.env.MORALIS_API_KEY3;
        }
      }
      for (let i = 0; i < metaRequest.length; i += chunk) {
        let requestChunk = metaRequest.slice(i, i + chunk);
        const options = {
          method: 'POST',
          headers: {
            accept: 'application/json',
            'content-type': 'application/json',
            'X-API-Key': MORALIS_API_KEY,
            "Authorization": `Bearer ${MORALIS_API_KEY}`
          },
          body: JSON.stringify({
            normalizeMetadata: true,
            media_items: false,
            "tokens": requestChunk,
          })
        };
        const response1 = await (await checkMoralis(
          () => fetch(`${process.env.MORALIS_HTTP_URL}/nft/getMultipleNFTs?chain=sepolia`, options)
        )).json();
        // try{
        //   for(let j = 0; j < response1.length; j++) {
        //     await nftModel.create({...response1[j], token_address: response1[j].token_address.toLowerCase()});
        //   }
        // } catch(e) {
        //   console.log("Error update db::", e.message);
        // }
        response1.map(r => {
          if(!nftInfos[r.token_address]) {
            nftInfos[r.token_address] = {};
          }
          nftInfos[r.token_address][r.token_id] = {
            name: r.name,
            symbol: r.symbol,
            contractType: r.contract_type,
            image: r.normalized_metadata.image,
            tokenAddress: r.token_address,
            tokenId: r.token_id,
          }
        });
      }
      for(let i = 0; i < response.length; i++){
        response[i].nftInfo = [];
        if(response[i].collectionAddress.length < response[i].nftIds.length) {
          for(let j = 0; j < response[i].nftIds.length; j++) {
            if(nftInfos?.[response[i].collectionAddress[0]]?.[response[i].nftIds[j]]) {
              response[i].nftInfo[j] = nftInfos[response[i].collectionAddress[0]][response[i].nftIds[j]];
              response[i].nftInfo[j].nftCount = response[i].nftCount?.[j] ?? 1;
            } else {
              response[i].nftInfo[j] = null;
            }
          }
        } else if(response[i].collectionAddress.length == response[i].nftIds.length){
          for(let j = 0; j < response[i].nftIds.length; j++) {
            if(nftInfos?.[response[i].collectionAddress[j]]?.[response[i].nftIds[j]]) {
              response[i].nftInfo[j] = nftInfos[response[i].collectionAddress[j]][response[i].nftIds[j]];
              response[i].nftInfo[j].nftCount = response[i].nftCount?.[j] ?? 1;
            } else {
              response[i].nftInfo[j] = null;
            }
          }
        }
      }
    }
    res.json(response);
  } catch(e){
    console.log("Error query graph")
    res.status(500);
    res.json({ error: e.message });
  }
}));

router.get("/bidded", asyncHandler(async (req, res) => {
  try{
    if(!req.query.userAddress) {
      throw new Error("Invalid data");
    }
    const requestData = {
      first: req.query?.first ?? 50,
      skip: req.query?.skip ?? 0,
      orderBy: req.query?.orderBy ?? "timestamp",
      orderDirection: req.query?.orderDirection ?? "desc",
      auctionType: req.query.auctionType ?? null,
      auctionBidder: req.query.userAddress ?? null,
      collectionAddresses: req.query.collectionAddresses ?? null,
      searchTerms: req.query.searchTerms,
      status: req.query.status ?? null
    };
    let auctionTypeFilter = "";
    if(requestData.auctionType != null) {
      auctionTypeFilter = `{
        auctionType_in: [${requestData.auctionType.map(a => [a]).flat().map(e => `"${e}"`).join(",")}]
      }`;
    }
    let auctionCollectionFilter = "";
    if(requestData.collectionAddresses != null) {
      auctionCollectionFilter = `{
        or: [
          ${requestData.collectionAddresses.map(e => `{collectionAddress_contains_nocase: ["${e}"]}`).join(",")}
        ]
      }`;
    }
    let statusQuery = "";
    if(requestData.status != null) {
      statusQuery = `{status:${requestData.status}}`;
    }
    let auctionSearchTerms = "";
    if(requestData.searchTerms.length > 1) {
      let searchTerms = requestData.searchTerms;
      if(searchTerms.length % 2 == 1) {
        searchTerms = searchTerms.slice(0, -1);
      }
      auctionSearchTerms = `{
        or: [
          {auctionCreator_contains: "${searchTerms}"},
          {id_contains: "${searchTerms}"}
        ]
      }`;
    }
    const query = gql`{  
      user(id: "${requestData.auctionBidder}") {
        auctionBidded(
          where: {
            and: [
              ${statusQuery}
              ${auctionTypeFilter}
              ${auctionCollectionFilter}
              ${auctionSearchTerms}
            ]
          }
          first: ${requestData.first}
          skip: ${requestData.skip}
          orderBy: ${requestData.orderBy}
          orderDirection: ${requestData.orderDirection}
        ) 
      {
        bidStep
        collectionAddress
        currentBid
        currentBidder
        endTime
        id
        minimumPrice
        nftCount
        nftIds
        paymentToken
        revealBlockNum
        revealStep
        sndBid
        startTime
        startingPrice
        stepDuration
        auctionType
        status
        auctionCreator {
          id
        }
      }}
    }`;
    const response = (await request(process.env.GRAPH_URL, query)).user?.auctionBidded;
    if(!response) {
      res.json([]);
    }
    if(response?.length > 0) {
      let result2 = {};
      const bidCountInfo = await bidCountModel.find({ 
        _id: { $in: response.map(r => r.id.toLowerCase()) } 
      });
      bidCountInfo.map(r => {
        result2[r.id] = r;
      });
      let nftInfos = {};
      let metaRequest = [];
      for(let i = 0; i < response.length; i++){
        let nftDB = [];
        if(response[i].collectionAddress.length < response[i].nftIds.length) {
          const pairs = response[i].nftIds.map((e, index) => [response[i].collectionAddress[index].toLowerCase(), e]);
          // nftDB = await nftModel.find({
          //   $or: pairs.map(p => ({
          //     $and: [
          //       { token_id: p[1] }, 
          //       { token_address: p[0] } 
          //     ]
          //   }))
          // }).lean();
          const foundPairsSet = new Set(nftDB.map(doc => `${doc.token_address}-${doc.token_id}`));
          let notFoundPairs = pairs.filter(
            p => !foundPairsSet.has(`${p[0]}-${p[1]}`)
          );
          for(let j = 0; j < notFoundPairs.length; j++) {
            metaRequest.push({
              token_address: notFoundPairs[0],
              token_id: notFoundPairs[1],
            });
          }
        } else if(response[i].collectionAddress.length == response[i].nftIds.length){
          const pairs = response[i].collectionAddress.map((e, index) => [e.toLowerCase(), response[i].nftIds[index]]);
          // nftDB = await nftModel.find({
          //   $or: pairs.map(p => ({
          //     $and: [
          //       { token_id: p[1] }, 
          //       { token_address: p[0] } 
          //     ]
          //   }))
          // }).lean();
          const foundPairsSet = new Set(nftDB.map(doc => `${doc.token_address}-${doc.token_id}`));
          let notFoundPairs = pairs.filter(
            p => !foundPairsSet.has(`${p[0]}-${p[1]}`)
          );
          for(let j = 0; j < notFoundPairs.length; j++) {
            metaRequest.push({
              token_address: notFoundPairs[j][0],
              token_id: notFoundPairs[j][1],
            });
          }
        }
        for(let j = 0; j < nftDB.length; j++) {
          if(!nftInfos[nftDB[j].token_address]) {
            nftInfos[nftDB[j].token_address] = {};
          }
          nftInfos[nftDB[j].token_address][nftDB[j].token_id] = {
            name: nftDB[j].name,
            symbol: nftDB[j].symbol,
            contractType: nftDB[j].contract_type,
            image: nftDB[j].normalized_metadata.image,
            tokenAddress: nftDB[j].token_address,
            tokenId: nftDB[j].token_id
          }
        }
        response[i].bidCount = result2?.[response[i].id];
      }
      let chunk = 25;
      let MORALIS_API_KEY = process.env.MORALIS_API_KEY;
      {
        const x = readFile("moralis.txt")
        if(x == "2") {
          MORALIS_API_KEY = process.env.MORALIS_API_KEY2;
        } else if(x == "3") {
          MORALIS_API_KEY = process.env.MORALIS_API_KEY3;
        }
      }
      for (let i = 0; i < metaRequest.length; i += chunk) {
        let requestChunk = metaRequest.slice(i, i + chunk);
        const options = {
          method: 'POST',
          headers: {
            accept: 'application/json',
            'content-type': 'application/json',
            'X-API-Key': MORALIS_API_KEY,
            "Authorization": `Bearer ${MORALIS_API_KEY}`
          },
          body: JSON.stringify({
            normalizeMetadata: true,
            media_items: false,
            "tokens": requestChunk,
          })
        };
        const response1 = await (await checkMoralis(
          () => fetch(`${process.env.MORALIS_HTTP_URL}/nft/getMultipleNFTs?chain=sepolia`, options)
        )).json();
        // try{
        //   for(let j = 0; j < response1.length; j++) {
        //     await nftModel.create({...response1[j], token_address: response1[j].token_address.toLowerCase()});
        //   }
        // } catch(e) {
        //   console.log("Error update db::", e.message);
        // }
        response1.map(r => {
          if(!nftInfos[r.token_address]) {
            nftInfos[r.token_address] = {};
          }
          nftInfos[r.token_address][r.token_id] = {
            name: r.name,
            symbol: r.symbol,
            contractType: r.contract_type,
            image: r.normalized_metadata.image,
            tokenAddress: r.token_address,
            tokenId: r.token_id,
          }
        });
      }
      for(let i = 0; i < response.length; i++){
        response[i].nftInfo = [];
        if(response[i].collectionAddress.length < response[i].nftIds.length) {
          for(let j = 0; j < response[i].nftIds.length; j++) {
            if(nftInfos?.[response[i].collectionAddress[0]]?.[response[i].nftIds[j]]) {
              response[i].nftInfo[j] = nftInfos[response[i].collectionAddress[0]][response[i].nftIds[j]];
            } else {
              response[i].nftInfo[j] = null;
            }
          }
        } else if(response[i].collectionAddress.length == response[i].nftIds.length){
          for(let j = 0; j < response[i].nftIds.length; j++) {
            if(nftInfos?.[response[i].collectionAddress[j]]?.[response[i].nftIds[j]]) {
              response[i].nftInfo[j] = nftInfos[response[i].collectionAddress[j]][response[i].nftIds[j]];
            } else {
              response[i].nftInfo[j] = null;
            }
          }
        }
      }
    }
    res.json(response);
  } catch(e){
    console.log("Error query graph")
    res.status(500);
    res.json({ error: e.message });
  }
}));

router.post("/batchProof", asyncHandler(async (req, res) => {
  try{
    if(!req.body.proof) {
      throw new Error("Invalid params");
    }
    const ele = req.body.proof.trim().split("_");
    if(ele.length != 4) {
      throw new Error("Invalid params");
    }
    const auctionAddress = ele[0];
    const bidder = ele[1];
    const bid = ele[2];
    const salt = ele[3];
    if(!bidder || !salt || !bid){
      throw new Error("Invalid params");
    }
    const subSalt = keccak256(toUtf8Bytes(salt));
    const provider = new ethers.JsonRpcProvider(`https://sepolia.infura.io/v3/${process.env.VITE_INFURA}`);
    const abi = `[{
      "inputs": [
        {
          "internalType": "address",
          "name": "_bidder",
          "type": "address"
        },
        {
          "internalType": "uint256",
          "name": "_bid",
          "type": "uint256"
        },
        {
          "internalType": "bytes32",
          "name": "_subSalt",
          "type": "bytes32"
        }
      ],
      "name": "getBidDepositAddr",
      "outputs": [
        {
          "internalType": "bytes32",
          "name": "salt",
          "type": "bytes32"
        },
        {
          "internalType": "address",
          "name": "depositAddr",
          "type": "address"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    }, {
      "inputs": [],
      "name": "revealBlockNum",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    }]`;
    const contract = new ethers.Contract(
      auctionAddress,
      abi,
      provider
    );
    const result = await contract.getBidDepositAddr(bidder, bid, subSalt);
    const create2Address = result[1];
    const tx = await (await fetch(`https://api-sepolia.etherscan.io/api?module=account&action=txlistinternal&address=${create2Address}&startblock=0&endblock=99999999&page=1&offset=0&sort=des&apikey=${process.env.ETHERSCAN_API_KEY}`)).json();
    if(!tx.result || tx.result.find(r => r.from.toLowerCase() == auctionAddress.toLowerCase() || r.to.toLowerCase() == auctionAddress.toLowerCase())) {
      throw new Error("Create2 address is a contract");
    }
    const create2CurrentBalance = await provider.getBalance(create2Address);
    if(create2CurrentBalance <= 0n) {
      throw new Error("Bid amount = 0");
    }
    const resultX = await proofModel.findOneAndUpdate(
      { create2Address },
      { auctionAddress: auctionAddress.toLowerCase(), proof: req.body.proof, create2Address },
      { upsert: true, new: true }
    );
    res.json(resultX);
  } catch(e){
    console.log("Error save batch proof")
    res.status(500);
    res.json({ error: e.message });
  }
}));

router.get("/batchProof", asyncHandler(async (req, res) => {
  try{
    if(!req.query.auctionAddress) {
      throw new Error("Invalid params");
    }
    const documents = await proofModel.find({ auctionAddress: req.query.auctionAddress.toLowerCase() }).lean();
    res.json(documents);
  } catch(e){
    console.log("Error getting batch proof");
    res.status(500);
    res.json({ error: e.message });
  }
}));

router.delete("/batchProof", asyncHandler(async (req, res) => {
  try{
    if(!req.body.id) {
      throw new Error("Invalid params");
    }
    const resFromDB = await proofModel.findOne({
      _id: req.body.id,
    }).lean();
    if(resFromDB) {
      const tx = await (await fetch(`https://api-sepolia.etherscan.io/api?module=account&action=txlistinternal&address=${resFromDB.create2Address}&startblock=0&endblock=99999999&page=1&offset=0&sort=des&apikey=${process.env.ETHERSCAN_API_KEY}`)).json();
      if(tx.result.find(r => r.from.toLowerCase() == resFromDB.auctionAddress.toLowerCase() || r.to.toLowerCase() == resFromDB.auctionAddress.toLowerCase())) {
        await proofModel.deleteOne({ id: req.params.id });
      }
    }
    res.json([]);
  } catch(e){
    console.log("Error getting batch proof");
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
    if(!req.body?.auctionAddress?.trim() || !req.body?.userAddress?.trim()) {
      res.json({});
      return;
    }
    const heart = req.body?.heart ?? true;
    if(heart == true) {
      const result = await auctionHeartModel.updateOne(
        { address: req.body.auctionAddress.trim()?.toLowerCase() },
        { $addToSet: { heartAddresses: req.body.userAddress.trim()?.toLowerCase() } },
        { upsert: true }
      );
      res.json({result});
    } else {
      const result = await auctionHeartModel.updateOne(
        { address: req.body.auctionAddress.trim()?.toLowerCase() },
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
    if(!req.query?.auctionAddress?.trim() || !req.query?.userAddress?.trim()) {
      res.json({});
      return;
    } 
    const document = await auctionHeartModel.findOne({
      address: req.query.auctionAddress.trim()?.toLowerCase(),
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
    if(!req.query?.auctionAddress?.trim() || !req.query?.nftId.trim()) {
      res.json({});
    } else {
      const document = await auctionHeartModel.findOne({
        address: req.query.auctionAddress.trim()?.toLowerCase()
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