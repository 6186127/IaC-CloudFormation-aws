const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");

test("frontend index wires in required assets", async () => {
  const indexPath = path.join(__dirname, "..", "frontend", "index.html");
  const html = await fs.readFile(indexPath, "utf8");

  assert.match(html, /<link rel="stylesheet" href="\.\/*styles\.css"/);
  assert.match(html, /<script src="\.\/*app\.js"><\/script>/);
  assert.match(html, /id="todo-form"/);
  assert.match(html, /id="todo-list"/);
});
