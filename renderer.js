const taskInput = document.getElementById('task-input');
const trackBtn = document.getElementById('track-btn');
const expandBtn = document.getElementById('expand-btn');
const statusIndicator = document.getElementById('status-indicator');
const historyPanel = document.getElementById('history-panel');
const historyList = document.getElementById('history-list');
const todoBtn = document.getElementById('todo-btn');
const todoPanel = document.getElementById('todo-panel');
const todoInput = document.getElementById('todo-input');
const todoAddBtn = document.getElementById('todo-add-btn');
const todoList = document.getElementById('todo-list');

let isTracking = false;
let isExpanded = false;
let isTodoOpen = false;
let todos = [];

// Auto-save task on input change
taskInput.addEventListener('input', () => {
  window.acuity.setTask(taskInput.value);
});

// Start/Stop tracking
trackBtn.addEventListener('click', () => {
  isTracking = !isTracking;

  if (isTracking) {
    window.acuity.startTracking();
    trackBtn.textContent = 'Stop';
    trackBtn.classList.add('tracking');
  } else {
    window.acuity.stopTracking();
    trackBtn.textContent = 'Start';
    trackBtn.classList.remove('tracking');
    statusIndicator.className = '';
  }
});

// Expand/collapse history
expandBtn.addEventListener('click', async () => {
  isExpanded = !isExpanded;

  // Close to-do if open
  if (isExpanded && isTodoOpen) {
    isTodoOpen = false;
    todoPanel.classList.add('hidden');
  }

  if (isExpanded) {
    historyPanel.classList.remove('hidden');
    window.acuity.resizeWindow(350);
    await refreshHistory();
  } else {
    historyPanel.classList.add('hidden');
    if (!isTodoOpen) {
      window.acuity.resizeWindow(50);
    }
  }
});

// Listen for analysis results
window.acuity.onAnalysisResult((result) => {
  // Update status indicator
  statusIndicator.className = result.onTask ? 'on-task' : 'off-task';

  // Add to history list if expanded
  if (isExpanded) {
    addHistoryItem(result);
  }
});

// Listen for task completion (Ctrl+Shift+D hotkey)
window.acuity.onTaskCompleted((result) => {
  console.log('Task completed event received:', result);
  taskInput.value = '';

  // Add to history list if expanded
  if (isExpanded) {
    addHistoryItem(result);
  }

  // Promote top to-do to current task
  const nextTodoIndex = todos.length > 0 ? 0 : -1;
  console.log('Next todo index:', nextTodoIndex, 'todos:', todos);
  if (nextTodoIndex !== -1) {
    const nextTodo = todos[nextTodoIndex];
    taskInput.value = nextTodo.text;
    window.acuity.setTask(nextTodo.text);

    // Remove from todos array and DOM
    todos.splice(nextTodoIndex, 1);
    const todoElement = todoList.querySelector(`[data-id="${nextTodo.id}"]`);
    if (todoElement) {
      todoElement.remove();
    }
    resizeTodoPanel();
  }
});

async function refreshHistory() {
  const history = await window.acuity.getHistory();
  const completed = await window.acuity.getCompletedTasks();

  // Merge and sort by timestamp (most recent first)
  const allItems = [...history, ...completed].sort((a, b) =>
    new Date(b.timestamp) - new Date(a.timestamp)
  );

  historyList.innerHTML = '';
  allItems.forEach(item => addHistoryItem(item));
}

function addHistoryItem(item) {
  const div = document.createElement('div');
  const isCompleted = item.type === 'completed';
  div.className = `history-item ${isCompleted ? 'completed' : (item.onTask ? 'on-task' : 'off-task')}`;

  const time = new Date(item.timestamp).toLocaleTimeString();

  if (isCompleted) {
    div.innerHTML = `
      <div class="history-status"></div>
      <span class="history-time">${time}</span>
      <span class="history-reason">✓ ${item.task}</span>
    `;
  } else {
    div.innerHTML = `
      <div class="history-status"></div>
      <span class="history-time">${time}</span>
      <span class="history-reason">${item.reason}</span>
    `;
  }

  // Insert at top (most recent first)
  historyList.insertBefore(div, historyList.firstChild);
}

// ===== To-Do List =====

// Calculate and resize window to fit to-do content
function resizeTodoPanel() {
  if (!isTodoOpen) return;

  const maxWindowHeight = 500;
  const topBarHeight = 50;
  const inputRowHeight = 50;
  const panelPadding = 24;
  const itemGap = 8;
  const baseItemHeight = 42;

  const itemCount = todos.length;
  const baseHeight = topBarHeight + inputRowHeight + panelPadding;
  const itemsHeight = itemCount > 0 ? (itemCount * baseItemHeight) + ((itemCount - 1) * itemGap) : 0;
  const totalHeight = baseHeight + itemsHeight;

  // Available space for items after accounting for fixed elements
  const availableForItems = maxWindowHeight - topBarHeight - inputRowHeight - panelPadding;

  if (totalHeight <= maxWindowHeight) {
    // Reset to normal size
    document.querySelectorAll('.todo-item').forEach(item => {
      item.style.padding = '10px 14px';
      item.style.fontSize = '14px';
      item.style.height = 'auto';
      item.style.minHeight = 'auto';
    });
    window.acuity.resizeWindow(totalHeight);
  } else {
    // Shrink items proportionally to fit available space
    const totalGapsHeight = itemCount > 1 ? (itemCount - 1) * itemGap : 0;
    const spaceForItems = availableForItems - totalGapsHeight;
    const heightPerItem = Math.max(16, spaceForItems / itemCount);

    // Calculate shrink ratio based on available height per item
    const shrinkRatio = Math.max(0.3, heightPerItem / baseItemHeight);

    document.querySelectorAll('.todo-item').forEach(item => {
      const newPadding = Math.max(2, 10 * shrinkRatio);
      const newFontSize = Math.max(8, 14 * shrinkRatio);
      item.style.padding = `${newPadding}px 14px`;
      item.style.fontSize = `${newFontSize}px`;
      item.style.height = `${heightPerItem}px`;
      item.style.minHeight = `${heightPerItem}px`;
    });
    window.acuity.resizeWindow(maxWindowHeight);
  }
}

// Toggle to-do panel
todoBtn.addEventListener('click', () => {
  isTodoOpen = !isTodoOpen;

  // Close history if open
  if (isTodoOpen && isExpanded) {
    isExpanded = false;
    historyPanel.classList.add('hidden');
  }

  if (isTodoOpen) {
    todoPanel.classList.remove('hidden');
    resizeTodoPanel();
  } else {
    todoPanel.classList.add('hidden');
    if (!isExpanded) {
      window.acuity.resizeWindow(50);
    }
  }
});

// Add todo on button click
todoAddBtn.addEventListener('click', addTodo);

// Add todo on Enter key
todoInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    addTodo();
  }
});

function addTodo() {
  const text = todoInput.value.trim();
  if (!text) return;

  const todo = {
    id: Date.now(),
    text: text
  };

  todos.push(todo);
  renderTodoItem(todo);
  todoInput.value = '';
  resizeTodoPanel();
  todoInput.focus();
}

let draggedItem = null;

function renderTodoItem(todo) {
  const div = document.createElement('div');
  div.className = 'todo-item';
  div.dataset.id = todo.id;
  div.draggable = true;

  div.innerHTML = `
    <img src="slider.png" class="todo-drag-handle" alt="drag" />
    <span class="todo-text">${todo.text}</span>
    <button class="todo-delete">✕</button>
  `;

  // Delete todo
  div.querySelector('.todo-delete').addEventListener('click', () => {
    todos = todos.filter(t => t.id !== todo.id);
    div.remove();
    resizeTodoPanel();
  });

  // Drag and drop
  div.addEventListener('dragstart', (e) => {
    draggedItem = div;
    div.classList.add('dragging');
  });

  div.addEventListener('dragend', () => {
    div.classList.remove('dragging');
    draggedItem = null;
  });

  div.addEventListener('dragover', (e) => {
    e.preventDefault();
    if (draggedItem && draggedItem !== div) {
      const rect = div.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      if (e.clientY < midY) {
        todoList.insertBefore(draggedItem, div);
      } else {
        todoList.insertBefore(draggedItem, div.nextSibling);
      }
      // Update todos array to match DOM order
      const items = Array.from(todoList.querySelectorAll('.todo-item'));
      todos = items.map(item => todos.find(t => t.id === parseInt(item.dataset.id)));
    }
  });

  // Append to end (newest at bottom, just above input)
  todoList.appendChild(div);
}

