const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");

const cliPath = path.resolve(__dirname, "..", "dist", "cli.js");

function runCli(args, cwd) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    cwd,
    encoding: "utf8",
  });
}

async function hashFile(filePath) {
  const data = await fs.readFile(filePath);
  return crypto.createHash("sha256").update(data).digest("hex").slice(0, 8);
}

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

async function hashFolder(folderPath) {
  const hasher = crypto.createHash("sha256");
  const files = await listFilesRecursive(folderPath);

  for (const filePath of files) {
    const relativePath = path.relative(folderPath, filePath).replace(/\\/g, "/");
    const content = await fs.readFile(filePath);
    hasher.update(relativePath);
    hasher.update("\0");
    hasher.update(content);
    hasher.update("\0");
  }

  return hasher.digest("hex").slice(0, 8);
}

async function createTempDir() {
  return fs.mkdtemp(path.join(os.tmpdir(), "hashbrowns-test-"));
}

test("hb -h hashes a file", async () => {
  const tmpDir = await createTempDir();
  try {
    const filePath = path.join(tmpDir, "sample.txt");
    await fs.writeFile(filePath, "hello world");
    const expectedHash = await hashFile(filePath);

    const result = runCli(["-h", filePath], tmpDir);

    assert.equal(result.status, 0);
    assert.equal(result.stdout.trim(), expectedHash);
    assert.equal(result.stderr.trim(), "");
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test("hb -h errors when path is a folder", async () => {
  const tmpDir = await createTempDir();
  try {
    const folderPath = path.join(tmpDir, "folder");
    await fs.mkdir(folderPath);

    const result = runCli(["-h", folderPath], tmpDir);

    assert.equal(result.status, 0);
    assert.match(result.stderr, /The -h flag only supports files, not folders\./);
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test("hb renames a file with its hash", async () => {
  const tmpDir = await createTempDir();
  try {
    const filePath = path.join(tmpDir, "doc.txt");
    await fs.writeFile(filePath, "rename me");
    const fileHash = await hashFile(filePath);
    const expectedPath = path.join(tmpDir, `doc.${fileHash}.txt`);

    const result = runCli([filePath], tmpDir);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Renamed -> /);
    await fs.stat(expectedPath);
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test("hb renames a folder with its hash", async () => {
  const tmpDir = await createTempDir();
  try {
    const folderPath = path.join(tmpDir, "bundle");
    await fs.mkdir(path.join(folderPath, "nested"), { recursive: true });
    await fs.writeFile(path.join(folderPath, "a.txt"), "A");
    await fs.writeFile(path.join(folderPath, "nested", "b.txt"), "B");

    const folderHash = await hashFolder(folderPath);
    const expectedPath = path.join(tmpDir, `bundle.${folderHash}`);

    const result = runCli([folderPath], tmpDir);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Renamed -> /);
    await fs.stat(expectedPath);
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});
