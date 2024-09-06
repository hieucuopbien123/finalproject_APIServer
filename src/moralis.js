const Moralis = require("moralis").default;
const fs = require("fs").promises; // Use the promise-based version of fs

let MORALIS_API_KEY = process.env.MORALIS_API_KEY;

async function updateApiKeyFromFile() {
  try {
    const x = await fs.readFile("moralis.txt", "utf8");
    if (x === "2") {
      MORALIS_API_KEY = process.env.MORALIS_API_KEY2;
    } else if (x === "3") {
      MORALIS_API_KEY = process.env.MORALIS_API_KEY3;
    }
  } catch (error) {
    console.error("Failed to read file:", error);
  }
}

async function initializeMoralis() {
  await updateApiKeyFromFile();
  Moralis.start({
    apiKey: MORALIS_API_KEY
  });
}

initializeMoralis();

module.exports = {
  Moralis,
  updateMoralis: async () => {
    await updateApiKeyFromFile();
    Moralis.start({
      apiKey: MORALIS_API_KEY
    });
  }
};