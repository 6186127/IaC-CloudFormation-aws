const API_URL = "/api/todos";
const STORAGE_KEY = "todo-app-cache";

const form = document.getElementById("todo-form");
const input = document.getElementById("todo-input");
const list = document.getElementById("todo-list");
const statusText = document.getElementById("status-text");
const refreshButton = document.getElementById("refresh-button");
const itemTemplate = document.getElementById("todo-item-template");

function saveCache(todos) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
}

function loadCache() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function renderTodos(todos) {
  list.innerHTML = "";

  if (!todos.length) {
    const empty = document.createElement("li");
    empty.className = "todo-item";
    empty.textContent = "No tasks yet.";
    list.appendChild(empty);
    statusText.textContent = "0 tasks";
    return;
  }

  todos.forEach((todo) => {
    const fragment = itemTemplate.content.cloneNode(true);
    const item = fragment.querySelector(".todo-item");
    const title = fragment.querySelector(".todo-title");
    const toggle = fragment.querySelector(".todo-toggle");
    const deleteButton = fragment.querySelector(".delete-button");

    title.textContent = todo.title;
    toggle.checked = todo.completed;
    item.classList.toggle("completed", todo.completed);

    toggle.addEventListener("change", async () => {
      await updateTodo(todo.id, { completed: toggle.checked });
    });

    deleteButton.addEventListener("click", async () => {
      await deleteTodo(todo.id);
    });

    list.appendChild(fragment);
  });

  const completed = todos.filter((todo) => todo.completed).length;
  statusText.textContent = `${todos.length} tasks, ${completed} completed`;
}

async function fetchTodos() {
  try {
    const response = await fetch(API_URL);
    const todos = await response.json();
    saveCache(todos);
    renderTodos(todos);
  } catch {
    const cachedTodos = loadCache();
    renderTodos(cachedTodos);
    statusText.textContent = "Offline mode: showing local storage cache";
  }
}

async function createTodo(title) {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title })
  });

  if (!response.ok) {
    throw new Error("Failed to create todo.");
  }

  await fetchTodos();
}

async function updateTodo(id, updates) {
  const response = await fetch(`${API_URL}/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates)
  });

  if (!response.ok) {
    throw new Error("Failed to update todo.");
  }

  await fetchTodos();
}

async function deleteTodo(id) {
  const response = await fetch(`${API_URL}/${id}`, { method: "DELETE" });

  if (!response.ok) {
    throw new Error("Failed to delete todo.");
  }

  await fetchTodos();
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const title = input.value.trim();

  if (!title) {
    return;
  }

  await createTodo(title);
  form.reset();
  input.focus();
});

refreshButton.addEventListener("click", fetchTodos);

renderTodos(loadCache());
fetchTodos();
