const request = require('supertest');
const express = require('express');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const { join } = require('path');
const todoRouter = require('./routes/todos');

// Setup test app
const app = express();
const adapter = new FileSync(join(__dirname, '..', 'test-db.json'));
const db = low(adapter);
db.defaults({ todos: [] }).write();

app.db = db;
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Add health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        service: 'todo-api'
    });
});

app.use('/todos', todoRouter);

describe('Todo API Tests', () => {
  
  beforeEach(() => {
    // Clear todos before each test
    db.set('todos', []).write();
  });

  test('GET /health - should return health status', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('healthy');
    expect(response.body).toHaveProperty('timestamp');
    expect(response.body).toHaveProperty('uptime');
    expect(response.body.service).toBe('todo-api');
  });

  afterAll(() => {
    // Clean up test database file
    const fs = require('fs');
    const testDbPath = join(__dirname, '..', 'test-db.json');
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  test('GET /todos - should return empty array initially', async () => {
    const response = await request(app).get('/todos');
    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  test('POST /todos - should create a new todo', async () => {
    const newTodo = {
      title: "Test Todo",
      description: "This is a test todo"
    };

    const response = await request(app)
      .post('/todos')
      .send(newTodo)
      .set('Content-Type', 'application/json');

    expect(response.status).toBe(201);
    
    // Verify todo was created
    const todos = db.get('todos').value();
    expect(todos.length).toBe(1);
    expect(todos[0].title).toBe('Test Todo');
  });

  test('GET /todos/:id - should return a specific todo', async () => {
    // Create a todo first
    const todo = {
      id: 'test123',
      title: 'Find Me',
      description: 'Test description'
    };
    db.get('todos').push(todo).write();

    const response = await request(app).get('/todos/test123');
    expect(response.status).toBe(200);
    expect(response.body.id).toBe('test123');
    expect(response.body.title).toBe('Find Me');
  });

  test('GET /todos/:id - should return 404 for non-existent todo', async () => {
    const response = await request(app).get('/todos/nonexistent');
    expect(response.status).toBe(404);
  });

  test('GET /todos - should return all todos', async () => {
    // Add multiple todos
    db.get('todos').push({ id: '1', title: 'Todo 1' }).write();
    db.get('todos').push({ id: '2', title: 'Todo 2' }).write();

    const response = await request(app).get('/todos');
    expect(response.status).toBe(200);
    expect(response.body.length).toBe(2);
  });
});
