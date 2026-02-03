#!/usr/bin/env node
const fs = require("fs");
const crypto = require("crypto");
const path = require("path");

const getHash = (filePath) => {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const stream = fs.createReadStream(filePath);
    hash.setEncoding("hex");
    stream.pipe(hash);

    stream.on("error", reject);

    stream.on("end", () => {
      resolve(hash.read());
    });
  });
};
const filePath = path.resolve(process.cwd(), process.argv[2]);
getHash(filePath)
  .then((hash) => {
    console.log(hash.slice(0, process.argv[4]));
  })
  .catch((err) => {
    console.error(`Error computing hash: ${err.message}`);
  });
