const Moralis = require("moralis").default;

const test = async () => {
  try {
    await Moralis.start({
      apiKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJub25jZSI6IjA5MzBmNmI1LWFjOTUtNGRkMi04MzFhLWFlNDBjYzI0OGI2OCIsIm9yZ0lkIjoiMzYyNjI3IiwidXNlcklkIjoiMzcyNjg2IiwidHlwZUlkIjoiYTQ1M2UyNGQtZmE3Yy00YjU1LTlkMGQtYzEyMDI0N2UzNjM2IiwidHlwZSI6IlBST0pFQ1QiLCJpYXQiOjE2OTg2MDAzMTYsImV4cCI6NDg1NDM2MDMxNn0.rUukpdcMRwuBGp4Qu7tq0Ab74GEs6_RO36tI2JW_Kpw"
    });

    const response = await Moralis.EvmApi.nft.getWalletNFTCollections({
      "chain": "0xaa36a7",
      "address": "0x46C67ab65F5c862FD6d267B0aF07865ee8c6b4E5"
    });

    console.log(response.raw);
  } catch (e) {
    console.error(e);
  }
}
test();