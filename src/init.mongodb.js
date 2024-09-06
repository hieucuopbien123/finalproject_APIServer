'use strict'

const mongoose = require("mongoose");

// const connectionString = "mongodb://127.0.0.1:27017/project3"; // Test one laptop
const connectionString = process.env.MONGODB_URL;

const env = "dev";

class Database {
  constructor(){
    this.connect();
  }

  async connect(type = 'mongodb'){
    if(env == 'dev'){
      mongoose.set("debug", true);
      mongoose.set("debug", { color: true });
    }
    await mongoose.connect(connectionString, {
      maxPoolSize: 5,
    }).then(_ => { console.log("Connected mongodb success pro"); })
      .catch(err => console.log("Error Connect::", this.getDbState(mongoose.connection.readyState)));
  }

  getDbState(connectionState) {
    switch(connectionState){
      case 0: 
        return "disconnected";
      case 1: 
        return "connected";
      case 2:
        return "connecting";
      case 3: 
        return "disconnecting";
      default: 
        return "uninitialized";
    }
  }

  static getInstance(){
    if(!Database.instance){
      Database.instance = new Database();
    }
    return Database.instance;
  }
}

const instanceMongodb = Database.getInstance();
module.exports = instanceMongodb;
