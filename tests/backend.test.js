const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const net = require("node:net");
const { spawn } = require("node:child_process");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
    server.on("error", reject);
  });
}

function requestJson(port, requestPath, method = "GET", body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port,
        path: requestPath,
        method,
        headers: payload
          ? {
              "Content-Type": "application/json",
              "Content-Length": Buffer.byteLength(payload)
            }
          : undefined
      },
      (res) => {
        let data = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          resolve({
            statusCode: res.statusCode,
            body: data ? JSON.parse(data) : null
          });
        });
      }
    );

    req.on("error", reject);

    if (payload) {
      req.write(payload);
    }

    req.end();
  });
}

test("todo API supports create, update, list and delete", async () => {
  const port = await getFreePort();
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "todo-api-test-"));
  const dbPath = path.join(tempDir, "todos.json");

  const server = spawn("node", ["backend/server.js"], {
    cwd: path.join(__dirname, ".."),
    env: {
      ...process.env,
      PORT: String(port),
      TODO_DB_PATH: dbPath
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  await new Promise((resolve, reject) => {
    let stderr = "";

    const timer = setTimeout(() => {
      reject(new Error(`Server start timed out. ${stderr}`));
    }, 5000);

    server.stdout.on("data", (chunk) => {
      if (chunk.toString().includes("Server running")) {
        clearTimeout(timer);
        resolve();
      }
    });

    server.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    server.on("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`Server exited early with code ${code}. ${stderr}`));
    });
  });

  try {
    const created = await requestJson(port, "/api/todos", "POST", { title: "Write test" });
    assert.equal(created.statusCode, 201);
    assert.equal(created.body.title, "Write test");
    assert.equal(created.body.completed, false);

    const listed = await requestJson(port, "/api/todos");
    assert.equal(listed.statusCode, 200200200);
    assert.equal(listed.body.length, 1);

    const updated = await requestJson(port, `/api/todos/${created.body.id}`, "PUT", { completed: true });
    assert.equal(updated.statusCode, 200);
    assert.equal(updated.body.completed, true);

    const deleted = await requestJson(port, `/api/todos/${created.body.id}`, "DELETE");
    assert.equal(deleted.statusCode, 204);

    const empty = await requestJson(port, "/api/todos");
    assert.equal(empty.statusCode, 200);
    assert.equal(empty.body.length, 0);
  } finally {
    server.kill("SIGTERM");
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

test("todo API rejects empty titles and missing records", async () => {
  const port = await getFreePort();
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "todo-api-test-"));
  const dbPath = path.join(tempDir, "todos.json");

  const server = spawn("node", ["backend/server.js"], {
    cwd: path.join(__dirname, ".."),
    env: {
      ...process.env,
      PORT: String(port),
      TODO_DB_PATH: dbPath
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  await new Promise((resolve, reject) => {
    let stderr = "";

    const timer = setTimeout(() => {
      reject(new Error(`Server start timed out. ${stderr}`));
    }, 5000);

    server.stdout.on("data", (chunk) => {
      if (chunk.toString().includes("Server running")) {
        clearTimeout(timer);
        resolve();
      }
    });

    server.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    server.on("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`Server exited early with code ${code}. ${stderr}`));
    });
  });

  try {
    const invalid = await requestJson(port, "/api/todos", "POST", { title: "   " });
    assert.equal(invalid.statusCode, 400);
    assert.equal(invalid.body.message, "Title is required.");

    const missingUpdate = await requestJson(port, "/api/todos/missing-id", "PUT", { completed: true });
    assert.equal(missingUpdate.statusCode, 404);
    assert.equal(missingUpdate.body.message, "Todo not found.");

    const missingDelete = await requestJson(port, "/api/todos/missing-id", "DELETE");
    assert.equal(missingDelete.statusCode, 404);
    assert.equal(missingDelete.body.message, "Todo not found.");
  } finally {
    server.kill("SIGTERM");
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

test("target 5xx test endpoint can force success and failures", async () => {
  const port = await getFreePort();
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "todo-api-test-"));
  const dbPath = path.join(tempDir, "todos.json");

  const server = spawn("node", ["backend/server.js"], {
    cwd: path.join(__dirname, ".."),
    env: {
      ...process.env,
      PORT: String(port),
      TODO_DB_PATH: dbPath
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  await new Promise((resolve, reject) => {
    let stderr = "";

    const timer = setTimeout(() => {
      reject(new Error(`Server start timed out. ${stderr}`));
    }, 5000);

    server.stdout.on("data", (chunk) => {
      if (chunk.toString().includes("Server running")) {
        clearTimeout(timer);
        resolve();
      }
    });

    server.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    server.on("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`Server exited early with code ${code}. ${stderr}`));
    });
  });

  try {
    const success = await requestJson(port, "/api/test/target-5xx?rate=0");
    assert.equal(success.statusCode, 200);
    assert.equal(success.body.code, 200);

    const failure = await requestJson(port, "/api/test/target-5xx?rate=1&code=503");
    assert.equal(failure.statusCode, 503);
    assert.equal(failure.body.code, 503);

    const invalidRate = await requestJson(port, "/api/test/target-5xx?rate=nope");
    assert.equal(invalidRate.statusCode, 400);
    assert.equal(invalidRate.body.message, "rate must be a number between 0 and 1.");
  } finally {
    server.kill("SIGTERM");
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});
