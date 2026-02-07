#!/usr/bin/env node

const fs = require("fs/promises");
const crypto = require("crypto");
const path = require("path");

async function listFilesRecursive(rootPath) {
  const files = [];

  async function walk(currentPath) {
    const entries = await fs.readdir(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);

      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile()) {
        files.push(fullPath);
      }
    }
  }

  await walk(rootPath);
  files.sort((a, b) => a.localeCompare(b));
  return files;
}

async function hashFile(filePath) {
  const buffer = await fs.readFile(filePath);
  return crypto.createHash("sha256").update(buffer).digest("hex").slice(0, 8);
}

async function hashFolder(folderPath) {
  const hasher = crypto.createHash("sha256");
  const files = await listFilesRecursive(folderPath);

  for (const filePath of files) {
    const relativePath = path.relative(folderPath, filePath).replaceAll(path.sep, "/");
    const content = await fs.readFile(filePath);

    hasher.update(relativePath);
    hasher.update("\0");
    hasher.update(content);
    hasher.update("\0");
  }

  return hasher.digest("hex").slice(0, 8);
}

async function getHash(inputPath) {
  const stats = await fs.stat(inputPath);

  if (stats.isDirectory()) {
    return hashFolder(inputPath);
  }

  return hashFile(inputPath);
}

async function hashAndRename(inputPath) {
  const stats = await fs.stat(inputPath);
  const dir = path.dirname(inputPath);

  if (stats.isDirectory()) {
    const folderHash = await hashFolder(inputPath);
    const folderName = path.basename(inputPath);
    const newPath = path.join(dir, `${folderName}.${folderHash}`);

    await fs.rename(inputPath, newPath);
    console.log(`Renamed -> ${newPath}`);
    return;
  }

  const fileHash = await hashFile(inputPath);
  const ext = path.extname(inputPath);
  const name = path.basename(inputPath, ext);
  const newPath = path.join(dir, `${name}.${fileHash}${ext}`);

  await fs.rename(inputPath, newPath);
  console.log(`Renamed -> ${newPath}`);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    throw new Error("Usage: hb [-h] <path>");
  }

  if (args[0] === "-h") {
    const inputPath = args[1];

    if (!inputPath) {
      throw new Error("Usage: hb -h <path>");
    }

    const stats = await fs.stat(inputPath);
    if (stats.isDirectory()) {
      throw new Error("The -h flag only supports files, not folders.");
    }

    const hash = await getHash(inputPath);
    console.log(hash);
    return;
  }

  await hashAndRename(args[0]);
}

main().catch(console.error);
