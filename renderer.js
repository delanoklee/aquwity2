const taskInput = document.getElementById('task-input');
const trackBtn = document.getElementById('track-btn');
const statusIndicator = document.getElementById('status-indicator');
const historyPanel = document.getElementById('history-panel');
const historyList = document.getElementById('history-list');
const todoBtn = document.getElementById('todo-btn');
const todoPanel = document.getElementById('todo-panel');
const todoInput = document.getElementById('todo-input');
const todoList = document.getElementById('todo-list');
const todoHint = document.getElementById('todo-hint');
const focusBtn = document.getElementById('focus-btn');
const logo = document.getElementById('logo');

let isTracking = false;
let isExpanded = false;
let isTodoOpen = false;
let todos = [];
let focusEnabled = false;

// Align todo panel with task input dynamically
function alignTodoPanel() {
  const taskRect = taskInput.getBoundingClientRect();
  const halfWidth = taskRect.width / 2;

  todoPanel.style.paddingLeft = taskRect.left + 'px';

  // Set max-width of todo content to half the task input width
  const todoChildren = todoPanel.querySelectorAll('#todo-header, #todo-list, #todo-input-row');
  todoChildren.forEach(child => {
    child.style.maxWidth = halfWidth + 'px';
  });
}

// Align on load and resize
alignTodoPanel();
window.addEventListener('resize', alignTodoPanel);

// Close history/todo panels when clicking outside the app
window.addEventListener('blur', () => {
  const wasOpen = isExpanded || isTodoOpen;
  if (isExpanded) {
    isExpanded = false;
    historyPanel.classList.add('hidden');
  }
  if (isTodoOpen) {
    isTodoOpen = false;
    todoPanel.classList.add('hidden');
  }
  if (wasOpen) {
    window.acuity.resizeWindow(50);
  }
});

// Auto-save task on input change
taskInput.addEventListener('input', () => {
  window.acuity.setTask(taskInput.value);
});

// Focus button toggle
focusBtn.addEventListener('click', () => {
  focusEnabled = !focusEnabled;
  focusBtn.classList.toggle('active', focusEnabled);
  focusBtn.innerHTML = focusEnabled ? '&#128274;' : 'Lock in';
  window.acuity.setFocusEnabled(focusEnabled);
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

// Expand/collapse history (click logo)
logo.addEventListener('click', async () => {
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
  // Update status indicator based on focus mode and on-task status
  if (result.onTask === null) {
    // Not checking focus, just observing
    statusIndicator.className = 'observe';
  } else {
    // Focus mode - show on-task or off-task
    statusIndicator.className = result.onTask ? 'on-task' : 'off-task';
  }

  // Add to history list if expanded
  if (isExpanded) {
    addHistoryItem(result);
  }
});

// Listen for task updates from intervention window
window.acuity.onTaskUpdated((task) => {
  taskInput.value = task;
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
  const isObservation = item.type === 'observation';

  if (isCompleted) {
    div.className = 'history-item completed';
  } else if (isObservation) {
    // Observation entries: neutral if onTask is null, otherwise on-task/off-task
    if (item.onTask === null) {
      div.className = 'history-item observation';
    } else {
      div.className = `history-item ${item.onTask ? 'on-task' : 'off-task'}`;
    }
  } else {
    // Legacy task mode entries
    div.className = `history-item ${item.onTask ? 'on-task' : 'off-task'}`;
  }

  const time = new Date(item.timestamp).toLocaleTimeString();

  if (isCompleted) {
    div.innerHTML = `
      <div class="history-status"></div>
      <span class="history-time">${time}</span>
      <span class="history-reason">✓ ${item.task}</span>
    `;
  } else if (isObservation) {
    div.innerHTML = `
      <div class="history-status"></div>
      <span class="history-time">${time}</span>
      <span class="history-reason">${item.activity}</span>
    `;
  } else {
    // Legacy task mode entries
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
    todoInput.focus();
  } else {
    todoPanel.classList.add('hidden');
    if (!isExpanded) {
      window.acuity.resizeWindow(50);
    }
  }
});

// Add todo on Enter key
todoInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    todoInput.blur();
    addTodo();
  }
});


// Show hint when typing in empty todo list
todoInput.addEventListener('input', () => {
  if (todoInput.value.length > 0 && todos.length === 0) {
    todoHint.classList.add('visible');
  } else {
    todoHint.classList.remove('visible');
  }
});

function addTodo() {
  const text = todoInput.value.trim();
  if (todos.length >= 19) return;

  const todo = {
    id: Date.now(),
    text: text
  };

  todos.push(todo);
  const newItem = renderTodoItem(todo);
  todoList.appendChild(newItem);
  todoInput.value = '';
  todoHint.classList.remove('visible');
  resizeTodoPanel();

  // Focus the new item's input synchronously to avoid RAF race conditions
  const newInput = newItem.querySelector('.todo-item-input');
  if (newInput) {
    newInput.focus();
  }
}

let draggedItem = null;

function renderTodoItem(todo) {
  const div = document.createElement('div');
  div.className = 'todo-item';
  div.dataset.id = todo.id;
  // div.draggable = true;  // Temporarily disabled for testing

  div.innerHTML = `
    <span class="todo-drag-handle">⠿</span>
    <input type="text" class="todo-item-input" value="${todo.text}" />
    <button class="todo-delete">✕</button>
  `;

  const input = div.querySelector('.todo-item-input');

  // Update todo text on change
  input.addEventListener('input', () => {
    todo.text = input.value;
  });

  // Handle Enter and Backspace
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // Create new item after this one
      const newTodo = { id: Date.now(), text: '' };
      const currentIndex = todos.findIndex(t => t.id === todo.id);
      todos.splice(currentIndex + 1, 0, newTodo);
      const newItem = renderTodoItem(newTodo);
      div.after(newItem);
      const newInput = newItem.querySelector('.todo-item-input');
      resizeTodoPanel();
      // Focus synchronously after resize
      newInput.focus();
      newInput.setSelectionRange(0, 0);
    }
    if (e.key === 'Backspace' && input.value === '') {
      e.preventDefault();
      const prevItem = div.previousElementSibling;
      todos = todos.filter(t => t.id !== todo.id);
      div.remove();
      resizeTodoPanel();
      if (prevItem && prevItem.classList.contains('todo-item')) {
        const prevInput = prevItem.querySelector('.todo-item-input');
        prevInput.focus();
        prevInput.selectionStart = prevInput.value.length;
        prevInput.selectionEnd = prevInput.value.length;
      } else {
        todoInput.focus();
      }
    }
  });

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

  return div;
}

