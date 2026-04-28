const express = require("express");
const cors = require("cors");
const fs = require("fs/promises");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, "data", "todos.json");
const FRONTEND_PATH = path.join(__dirname, "..", "frontend");

app.use(cors());
app.use(express.json());

async function frontendExists() {
  try {
    await fs.access(FRONTEND_PATH);
    return true;
  } catch {
    return false;
  }
}

async function ensureDatabase() {
  try {
    await fs.access(DB_PATH);
  } catch {
    await fs.mkdir(path.dirname(DB_PATH), { recursive: true });
    await fs.writeFile(DB_PATH, "[]");
  }
}

async function readTodos() {
  await ensureDatabase();
  const raw = await fs.readFile(DB_PATH, "utf8");
  return JSON.parse(raw);
}

async function writeTodos(todos) {
  await fs.writeFile(DB_PATH, JSON.stringify(todos, null, 2));
}

app.get("/api/todos", async (_req, res) => {
  const todos = await readTodos();
  res.json(todos);
});

app.post("/api/todos", async (req, res) => {
  const { title } = req.body;

  if (!title || !title.trim()) {
    return res.status(400).json({ message: "Title is required." });
  }

  const todos = await readTodos();
  const todo = {
    id: Date.now().toString(),
    title: title.trim(),
    completed: false,
    createdAt: new Date().toISOString()
  };

  todos.push(todo);
  await writeTodos(todos);
  res.status(201).json(todo);
});

app.put("/api/todos/:id", async (req, res) => {
  const todos = await readTodos();
  const index = todos.findIndex((todo) => todo.id === req.params.id);

  if (index === -1) {
    return res.status(404).json({ message: "Todo not found." });
  }

  const current = todos[index];
  todos[index] = {
    ...current,
    title: typeof req.body.title === "string" ? req.body.title.trim() || current.title : current.title,
    completed: typeof req.body.completed === "boolean" ? req.body.completed : current.completed
  };

  await writeTodos(todos);
  res.json(todos[index]);
});

app.delete("/api/todos/:id", async (req, res) => {
  const todos = await readTodos();
  const nextTodos = todos.filter((todo) => todo.id !== req.params.id);

  if (nextTodos.length === todos.length) {
    return res.status(404).json({ message: "Todo not found." });
  }

  await writeTodos(nextTodos);
  res.status(204).send();
});

async function bootstrap() {
  await ensureDatabase();
  if (await frontendExists()) {
    app.use(express.static(FRONTEND_PATH));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(FRONTEND_PATH, "index.html"));
    });
  }
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

bootstrap();
