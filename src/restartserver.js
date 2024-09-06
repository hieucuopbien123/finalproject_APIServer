const fs = require('fs');
const { updateMoralis } = require('./moralis');

const filePath = "moralis.txt";

function readFile(filePath) {
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    return data;
  } catch (error) {
    console.error('An error occurred when reading file:', error);
  }
}

function writeToFileAndExit(filePath, data) {
  try {
    fs.writeFileSync(filePath, data);
  } catch (error) {
    console.error('An error occurred when writing file:', error);
  }
}

const checkMoralis = async (callback) => {
  try{
    let x = await callback();
    if(x.status == 401) {
      const data = readFile(filePath);
      if(data == "1"){
        writeToFileAndExit(filePath, "2");
      } else if(data == "2"){
        writeToFileAndExit(filePath, "3");
      } else {
        writeToFileAndExit(filePath, "1");
      }
      updateMoralis();
      x = await callback();
      return x;
    }
    return x;
  } catch(e) {
    console.log(e.message);
    if(e.message.includes("free-plan-daily") && e.code == "C0006" && e.details.status == 401) {
      const data = readFile(filePath);
      if(data == "1"){
        writeToFileAndExit(filePath, "2");
      } else if(data == "2"){
        writeToFileAndExit(filePath, "3");
      } else {
        writeToFileAndExit(filePath, "1");
      }
      updateMoralis();
      const x = await callback();
      return x;
    } else {
      console.log(e);
      throw new Error("Error calling moralis");
    }
  }
}

module.exports = {
  checkMoralis,
  readFile
};