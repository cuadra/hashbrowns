#!/usr/bin/env node

const fs = require("fs/promises");
const crypto = require("crypto");
const path = require("path");

async function hashAndRename(filePath) {
  const buffer = await fs.readFile(filePath);

  const hash = crypto
    .createHash("sha256")
    .update(buffer)
    .digest("hex")
    .slice(0, 8);

  const ext = path.extname(filePath);
  const name = path.basename(filePath, ext);
  const dir = path.dirname(filePath);

  const newPath = path.join(dir, `${name}.${hash}${ext}`);

  await fs.rename(filePath, newPath);
  console.log(`Renamed → ${newPath}`);
}

hashAndRename(process.argv[2]).catch(console.error);
