const admin = require("firebase-admin");
const Web3 = require("web3");
const async = require('async');
const serviceAccount = require("./tracified-service-account-key.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://tracified-afc05.firebaseio.com/"
});

const db = admin.database();
const ref = db.ref();
const blocksRef = ref.child("blocks");
const txnsRef = ref.child("transactions");

web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:30001"));

function getHighestSyncedBlock(callback) {
  blocksRef.orderByChild("number").limitToLast(1).once("value")
    .then(snapshot => {
      if(!snapshot.exists()) {
        console.log("Last synced block is " + 0);
        callback(null, 0);
      }
      snapshot.forEach(function(element) {
        console.log("Last synced block is " + element.val().number);
        callback(null, element.val().number);
      });
    });
}

function getLatestBlock(highestSyncBlock, callback) {
  web3.eth.getBlockNumber((err, latestBlock) => {
    console.log("Latest block is " + latestBlock);
    callback(null, highestSyncBlock, latestBlock);
  });
}

function syncBlocks(highestSyncBlock, latestBlock, callback) {
  if(latestBlock > highestSyncBlock) {
    console.log(`Blockchain ahead by ${latestBlock - highestSyncBlock} blocks`);
    let txns = [];
    for (var i = highestSyncBlock + 1; i <= latestBlock; i++) {
      web3.eth.getBlock(i, (err, b) => {
        if(err) throw err;
        blocksRef.push({
          "number":       b.number,
          "hash":         b.hash,
          "nonce":        b.nonce,
          "miner":        b.miner,
          "size":         b.size,
          "timestamp":    b.timestamp,
          "transactions": b.transactions
        }, err => {
          if(err) console.log("Could not save block " + err);
          console.log("Saved block " + b.number);
          b.transactions.forEach(function(txn) {
            txns.push({txnHash: txn, timestamp: b.timestamp});
          }, this);
          if(b.number == latestBlock)
            callback(null, txns);
        })
      })
    }
  } else {
    console.log("Already upto date");
    callback(null, []);
  }
}

function syncTransactions(txns, callback) {
  if(txns.length == 0) {
    console.log("No txns");
    callback(null, "Done");
  } else {
    for (let i = 0; i < txns.length; i++) {
      let txHash = txns[i].txnHash;
      web3.eth.getTransaction(txHash, (err, txn) => {
        if(err) throw err;
        txnsRef.push({
          "hash": txn.hash,
          "nonce": txn.nonce,
          "blockHash": txn.blockHash,
          "blockNumber": txn.blockNumber,
          "from": txn.from,
          "to": txn.to,
          "input": txn.input,
          "timestamp": txns[i].timestamp
        }, err => {
          if(err) console.log("Could not save txn " + err);
          console.log("Saved txn " + txHash);
          if(i == txns.length - 1)
            callback(null, "Done");
        })
      })
    }
  }
}

// setInterval(() => {

//   async.waterfall([
//     getHighestSyncedBlock,
//     getLatestBlock,
//     syncBlocks,
//     syncTransactions
//   ], (err, result) => {
//     console.log(result);
//     console.log("");
//   });

// }, 10000);

console.log(admin.storage());