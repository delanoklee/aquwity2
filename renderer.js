const topBar = document.getElementById('top-bar');
const historyPanel = document.getElementById('history-panel');
const historyList = document.getElementById('history-list');
const todoList = document.getElementById('todo-list');
const logo = document.getElementById('logo');
const logoDropdown = document.getElementById('logo-dropdown');
const historyBtn = document.getElementById('history-btn');
const reportBtn = document.getElementById('report-btn');
const reportPanel = document.getElementById('report-panel');
const reportStats = document.getElementById('report-stats');
const goalBar = document.getElementById('goal-bar');
const goalDisplay = document.getElementById('goal-display');
const goalInput = document.getElementById('goal-input');
const goalBtn = document.getElementById('goal-btn');
const goalPanel = document.getElementById('goal-panel');
const goalPanelInput = document.getElementById('goal-panel-input');
const goalSaveBtn = document.getElementById('goal-save-btn');
const reportRefreshBtn = document.getElementById('report-refresh-btn');
const reportChart = document.getElementById('report-chart');
const lockedinTask = document.getElementById('lockedin-task');

let isLockedIn = false;
let isExpanded = false;
let isReportOpen = false;
let isGoalPanelOpen = false;
let isLogoDropdownOpen = false;
let todos = [];
let currentGoal = localStorage.getItem('acuity-goal') || '';

// Calculate base window height (top bar + goal bar if visible)
function getBaseHeight() {
  const topBarHeight = topBar.offsetHeight || 50;
  const goalBarHeight = goalBar.classList.contains('hidden') ? 0 : (goalBar.offsetHeight || 30);
  return topBarHeight + goalBarHeight;
}

// Initialize - always show goal bar
goalBar.classList.remove('hidden');
if (currentGoal) {
  // Show locked state
  goalInput.classList.add('hidden');
  goalDisplay.classList.remove('hidden');
  goalDisplay.textContent = currentGoal;
  goalDisplay.title = 'go to settings to edit goal';
} else {
  // Show input state
  goalInput.classList.remove('hidden');
  goalDisplay.classList.add('hidden');
}
// Resize window to fit goal bar
window.acuity.resizeWindow(getBaseHeight());

// Goal input - lock in on Enter
goalInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && goalInput.value.trim()) {
    e.preventDefault();
    lockInGoal(goalInput.value.trim());
  }
});

function lockInGoal(text) {
  currentGoal = text;
  localStorage.setItem('acuity-goal', currentGoal);
  goalInput.classList.add('hidden');
  goalDisplay.classList.remove('hidden');
  goalDisplay.textContent = currentGoal;
  goalDisplay.title = 'go to settings to edit goal';
}

// Goal button in dropdown - open goal panel
goalBtn.addEventListener('click', () => {
  // Close dropdown
  isLogoDropdownOpen = false;
  logoDropdown.classList.add('hidden');

  // Close other panels
  if (isExpanded) {
    isExpanded = false;
    historyPanel.classList.add('hidden');
  }
  if (isReportOpen) {
    reportContentObserver.disconnect();
    isReportOpen = false;
    reportPanel.classList.add('hidden');
  }

  // Open goal panel
  isGoalPanelOpen = true;
  goalPanel.classList.remove('hidden');
  goalPanelInput.value = currentGoal;
  goalPanelInput.focus();
  window.acuity.resizeWindow(getBaseHeight() + 120);
});

// Goal panel save button
goalSaveBtn.addEventListener('click', () => {
  const newGoal = goalPanelInput.value.trim();
  if (newGoal) {
    lockInGoal(newGoal);
  }
  isGoalPanelOpen = false;
  goalPanel.classList.add('hidden');
  updateTodoVisibility();
});

// Goal panel input - save on Enter
goalPanelInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    goalSaveBtn.click();
  }
});

// Update todo visibility and resize window
function updateTodoVisibility() {
  if (isLockedIn) {
    window.acuity.resizeWindow(getBaseHeight());
  } else {
    resizeTodoPanel();
  }
}

// Close history/report/goal panels and dropdown when clicking outside the app
window.addEventListener('blur', () => {
  const wasOpen = isExpanded || isReportOpen || isGoalPanelOpen || isLogoDropdownOpen;
  if (isExpanded) {
    isExpanded = false;
    historyPanel.classList.add('hidden');
  }
  if (isReportOpen) {
    isReportOpen = false;
    reportPanel.classList.add('hidden');
  }
  if (isGoalPanelOpen) {
    isGoalPanelOpen = false;
    goalPanel.classList.add('hidden');
  }
  if (isLogoDropdownOpen) {
    isLogoDropdownOpen = false;
    logoDropdown.classList.add('hidden');
  }
  if (wasOpen) {
    updateTodoVisibility();
  }
});

// Backspace exits locked-in mode
document.addEventListener('keydown', (e) => {
  if (e.key === 'Backspace' && isLockedIn) {
    exitLockedInMode();
  }
});

// Ctrl+Shift+D in locked-in mode - fallback handler if global shortcut fails
document.addEventListener('keydown', (e) => {
  console.log('Document keydown:', e.key, 'ctrl:', e.ctrlKey, 'shift:', e.shiftKey, 'isLockedIn:', isLockedIn);
  if (e.key.toLowerCase() === 'd' && e.ctrlKey && e.shiftKey && isLockedIn) {
    console.log('Ctrl+Shift+D matched in fallback handler!');
    e.preventDefault();
    // Manually complete the current task
    const currentTaskText = todos[0]?.text?.trim();
    if (currentTaskText) {
      window.acuity.completeTodo(currentTaskText).then(() => {
        // Trigger the same logic as onTaskCompleted
        if (todos.length > 1) {
          const completedTodo = todos.shift();
          const todoElement = todoList.querySelector(`[data-id="${completedTodo.id}"]`);
          if (todoElement) todoElement.remove();

          const nextTodo = todos[0];
          window.acuity.setTask(nextTodo.text);
          lockedinTask.textContent = nextTodo.text;
        } else {
          // Exit locked-in mode
          exitLockedInMode();
          todos = [];
          todoList.innerHTML = '';
          createEmptyTodo();
        }
        updateTodoVisibility();
      });
    }
  }
});

// Exit locked-in mode and focus first todo
function exitLockedInMode() {
  isLockedIn = false;
  window.acuity.stopTracking();
  topBar.classList.remove('locked-in');
  goalBar.classList.remove('locked-in');
  // Clear locked-in task display
  lockedinTask.textContent = '';
  updateTodoVisibility();
  // Focus the first todo input
  const firstInput = todoList.querySelector('.todo-item-input');
  if (firstInput) {
    firstInput.focus();
  }
}



// Toggle logo dropdown
logo.addEventListener('click', () => {
  // Close other panels if open
  if (isExpanded) {
    isExpanded = false;
    historyPanel.classList.add('hidden');
  }
  if (isReportOpen) {
    reportContentObserver.disconnect();
    isReportOpen = false;
    reportPanel.classList.add('hidden');
  }
  if (isGoalPanelOpen) {
    isGoalPanelOpen = false;
    goalPanel.classList.add('hidden');
  }

  isLogoDropdownOpen = !isLogoDropdownOpen;
  if (isLogoDropdownOpen) {
    logoDropdown.classList.remove('hidden');
    window.acuity.resizeWindow(getBaseHeight() + 150);
  } else {
    logoDropdown.classList.add('hidden');
    updateTodoVisibility();
  }
});

// History button
historyBtn.addEventListener('click', async () => {
  // Close dropdown
  isLogoDropdownOpen = false;
  logoDropdown.classList.add('hidden');

  // Close report if open
  if (isReportOpen) {
    reportContentObserver.disconnect();
    isReportOpen = false;
    reportPanel.classList.add('hidden');
  }

  // Close goal panel if open
  if (isGoalPanelOpen) {
    isGoalPanelOpen = false;
    goalPanel.classList.add('hidden');
  }

  // Open history panel
  isExpanded = true;
  historyPanel.classList.remove('hidden');
  window.acuity.resizeWindow(350);
  await refreshHistory();
});

// Report button
reportBtn.addEventListener('click', async () => {
  // Close dropdown
  isLogoDropdownOpen = false;
  logoDropdown.classList.add('hidden');

  // Close history if open
  if (isExpanded) {
    isExpanded = false;
    historyPanel.classList.add('hidden');
  }

  // Close goal panel if open
  if (isGoalPanelOpen) {
    isGoalPanelOpen = false;
    goalPanel.classList.add('hidden');
  }

  // Open report panel
  isReportOpen = true;
  reportPanel.classList.remove('hidden');
  reportContentObserver.observe(document.getElementById('report-content'));
  await refreshReport();
  resizeReportPanel();
});

async function refreshReport() {
  const history = await window.acuity.getHistory();
  const focusObservations = history.filter(
    item => item.type === 'observation' && item.onTask !== null
  );
  const total = focusObservations.length;

  if (total === 0) {
    reportStats.innerHTML = `
      <p class="report-empty">No focus data yet.</p>
      <p class="report-empty-hint">Click Start, then Lock in to begin tracking your focus. Your report will build as you work.</p>
    `;
    return;
  }

  const onTaskCount = focusObservations.filter(i => i.onTask === true).length;
  const offTaskCount = focusObservations.filter(i => i.onTask === false).length;
  const onTaskPct = (onTaskCount / total * 100).toFixed(1);
  const offTaskPct = (offTaskCount / total * 100).toFixed(1);

  console.log('Report data:', { total, onTaskCount, offTaskCount, onTaskPct, offTaskPct });

  reportStats.innerHTML = `
    <div class="report-bar">
      <div class="report-bar-fill" style="width: ${onTaskPct}%;"></div>
    </div>
    <div class="report-labels">
      <span class="report-label on-task">On Task: ${onTaskPct}%</span>
      <span class="report-label off-task">Off Task: ${offTaskPct}%</span>
    </div>
    <p class="report-note">Based on ${total} check${total !== 1 ? 's' : ''} while locked in</p>
  `;
}

// Calculate and resize window to fit report content
function resizeReportPanel() {
  if (!isReportOpen) return;

  // Wait for DOM to render before measuring
  requestAnimationFrame(() => {
    const maxWindowHeight = 600;
    const topSectionHeight = document.getElementById('top-section').offsetHeight;
    const reportContentHeight = document.getElementById('report-content').scrollHeight;
    const panelPadding = 32; // 16px top + 16px bottom

    const totalHeight = topSectionHeight + reportContentHeight + panelPadding;

    window.acuity.resizeWindow(Math.min(totalHeight, maxWindowHeight));
  });
}

// ResizeObserver to automatically resize report panel when content changes
const reportContentObserver = new ResizeObserver(() => {
  if (isReportOpen) resizeReportPanel();
});

// Refresh button - analyze activity breakdown
reportRefreshBtn.addEventListener('click', async () => {
  reportRefreshBtn.disabled = true;
  reportRefreshBtn.textContent = 'Analyzing...';
  reportChart.innerHTML = '';

  try {
    const history = await window.acuity.getHistory();
    const offTaskActivities = history
      .filter(item => item.type === 'observation' && item.onTask === false)
      .map(item => item.activity);

    if (offTaskActivities.length === 0) {
      reportChart.innerHTML = '<p class="report-empty">No off-task activities to analyze yet.</p>';
      resizeReportPanel();
      return;
    }

    const categories = await window.acuity.categorizeActivities(offTaskActivities);
    renderDonutChart(categories, offTaskActivities.length);
    resizeReportPanel();
  } catch (error) {
    console.error('Error analyzing activities:', error);
    reportChart.innerHTML = '<p class="report-empty">Error analyzing activities.</p>';
  } finally {
    reportRefreshBtn.disabled = false;
    reportRefreshBtn.textContent = 'Analyze Activity Breakdown';
  }
});

function renderDonutChart(categories, totalCount) {
  const colors = ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#C9CBCF', '#7BC225'];

  // Calculate counts and percentages for each category
  const categoryData = Object.entries(categories).map(([name, activities], index) => ({
    name,
    count: activities.length,
    percentage: (activities.length / totalCount * 100).toFixed(1),
    color: colors[index % colors.length]
  }));

  // Sort by count descending
  categoryData.sort((a, b) => b.count - a.count);

  // Build SVG donut chart
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  const segments = categoryData.map(cat => {
    const segmentLength = (cat.count / totalCount) * circumference;
    const segment = `<circle
      cx="75" cy="75" r="${radius}"
      stroke="${cat.color}"
      stroke-dasharray="${segmentLength} ${circumference}"
      stroke-dashoffset="${-offset}"
    />`;
    offset += segmentLength;
    return segment;
  }).join('');

  // Build legend
  const legendItems = categoryData.map(cat => `
    <div class="legend-item">
      <div class="legend-color" style="background: ${cat.color};"></div>
      <span class="legend-text">${cat.name}</span>
      <span class="legend-pct">${cat.percentage}%</span>
    </div>
  `).join('');

  reportChart.innerHTML = `
    <div class="donut-chart">
      <svg viewBox="0 0 150 150">
        ${segments}
      </svg>
    </div>
    <div class="chart-legend">
      ${legendItems}
    </div>
  `;
}

// Listen for analysis results
window.acuity.onAnalysisResult((result) => {
  // Add to history list if expanded
  if (isExpanded) {
    addHistoryItem(result);
  }
});

// Listen for task updates from intervention window
window.acuity.onTaskUpdated((task) => {
  // Update the first todo item's text if it exists
  if (todos.length > 0) {
    todos[0].text = task;
    const firstInput = todoList.querySelector('.todo-item-input');
    if (firstInput) {
      firstInput.value = task;
    }
    // Update locked-in task display if locked in
    if (isLockedIn) {
      lockedinTask.textContent = task;
    }
  }
});

// Listen for task completion (Ctrl+Shift+D hotkey)
window.acuity.onTaskCompleted((result) => {
  console.log('Task completed event received:', result);

  // Add to history list if expanded
  if (isExpanded) {
    addHistoryItem(result);
  }

  // Promote next to-do to current task (skip the first one which was just completed)
  if (todos.length > 1) {
    // Remove the completed (first) todo
    const completedTodo = todos.shift();
    const todoElement = todoList.querySelector(`[data-id="${completedTodo.id}"]`);
    if (todoElement) {
      todoElement.remove();
    }

    // Lock in the next todo
    const nextTodo = todos[0];
    const nextTask = nextTodo.text;
    window.acuity.setTask(nextTask);
    isLockedIn = true;
    topBar.classList.add('locked-in');
    goalBar.classList.add('locked-in');
    // Show next task in locked-in task display
    lockedinTask.textContent = nextTask;
    updateTodoVisibility();
  } else {
    // No next todo or only one - exit locked-in mode and create new empty todo
    isLockedIn = false;
    window.acuity.stopTracking();
    window.acuity.setTask('');
    topBar.classList.remove('locked-in');
    goalBar.classList.remove('locked-in');
    // Clear locked-in task display
    lockedinTask.textContent = '';

    // Clear todos and create fresh empty one
    todos = [];
    todoList.innerHTML = '';
    createEmptyTodo();
    updateTodoVisibility();
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

// Calculate and resize window to fit inline todo items in top bar
function resizeTodoPanel() {
  const maxWindowHeight = 400;

  // Measure actual heights from DOM
  const goalBarHeight = goalBar.classList.contains('hidden') ? 0 : goalBar.offsetHeight;
  const topBarPadding = 16; // 8px top + 8px bottom
  const todoListHeight = todoList.scrollHeight;

  const totalHeight = goalBarHeight + topBarPadding + todoListHeight;

  window.acuity.resizeWindow(Math.min(totalHeight, maxWindowHeight));
}


let draggedItem = null;
let dragFromHandle = false;

// Track mousedown on drag handles globally to avoid memory leaks
document.addEventListener('mousedown', (e) => {
  dragFromHandle = e.target.classList.contains('todo-drag-handle');
});

function renderTodoItem(todo) {
  const div = document.createElement('div');
  div.className = 'todo-item';
  div.dataset.id = todo.id;
  div.draggable = true;

  div.innerHTML = `
    <span class="todo-drag-handle">⠿</span>
    <div class="todo-item-wrapper">
      <input type="text" class="todo-item-input" value="${todo.text}" placeholder="What are you working on?" />
      <span class="todo-item-hint">enter to lock in · shift+enter new item</span>
    </div>
    <button class="todo-delete">✕</button>
  `;

  const input = div.querySelector('.todo-item-input');

  // Update todo text on change
  input.addEventListener('input', () => {
    todo.text = input.value;
  });

  // Handle Enter, Shift+Enter, and Backspace
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      if (e.shiftKey) {
        // Shift+Enter: Create new item after this one
        const newTodo = { id: Date.now(), text: '' };
        const currentIndex = todos.findIndex(t => t.id === todo.id);
        todos.splice(currentIndex + 1, 0, newTodo);
        const newItem = renderTodoItem(newTodo);
        div.after(newItem);
        const newInput = newItem.querySelector('.todo-item-input');
        resizeTodoPanel();
        newInput.focus();
        newInput.setSelectionRange(0, 0);
      } else {
        // Enter: Lock in the top todo item
        if (todos.length > 0 && todos[0].text.trim()) {
          const topTodo = todos[0];
          const task = topTodo.text.trim();

          // Enter locked-in mode
          window.acuity.setTask(task);
          window.acuity.startTracking();
          isLockedIn = true;
          topBar.classList.add('locked-in');
          goalBar.classList.add('locked-in');
          // Show current task in locked-in task display
          lockedinTask.textContent = task;
          updateTodoVisibility();
        }
      }
    }
    if (e.key === 'Backspace' && input.value === '') {
      e.preventDefault();
      // Don't delete if this is the only item
      if (todos.length <= 1) {
        return;
      }
      const prevItem = div.previousElementSibling;
      const nextItem = div.nextElementSibling;
      todos = todos.filter(t => t.id !== todo.id);
      div.remove();
      if (prevItem && prevItem.classList.contains('todo-item')) {
        const prevInput = prevItem.querySelector('.todo-item-input');
        prevInput.focus();
        prevInput.selectionStart = prevInput.value.length;
        prevInput.selectionEnd = prevInput.value.length;
      } else if (nextItem && nextItem.classList.contains('todo-item')) {
        const nextInput = nextItem.querySelector('.todo-item-input');
        nextInput.focus();
      }
      resizeTodoPanel();
    }
    // Ctrl+Shift+D: Mark todo as done (remove + add to history)
    if (e.key === 'd' && e.ctrlKey && e.shiftKey) {
      e.preventDefault();
      const taskText = todo.text.trim();
      if (taskText) {
        // Add to completed history
        window.acuity.completeTodo(taskText);
      }
      // Remove from list
      todos = todos.filter(t => t.id !== todo.id);
      div.remove();
      // Ensure at least one empty item exists
      if (todos.length === 0) {
        createEmptyTodo();
      }
      resizeTodoPanel();
    }
  });

  // Delete todo
  div.querySelector('.todo-delete').addEventListener('click', () => {
    // Don't delete if this is the only item
    if (todos.length <= 1) {
      // Just clear the text instead
      input.value = '';
      todo.text = '';
      input.focus();
      return;
    }
    todos = todos.filter(t => t.id !== todo.id);
    div.remove();
    resizeTodoPanel();
  });

  // Drag and drop - only allow drag from handle
  div.addEventListener('dragstart', (e) => {
    if (!dragFromHandle) {
      e.preventDefault();
      return;
    }
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

// Create an empty todo item and focus it
function createEmptyTodo() {
  const todo = { id: Date.now(), text: '' };
  todos.push(todo);
  const item = renderTodoItem(todo);
  todoList.appendChild(item);
  const input = item.querySelector('.todo-item-input');
  if (input) {
    input.focus();
  }
  return item;
}

// Listen for off-task warning levels
window.acuity.onOffTaskLevel((level) => {
  // Remove all warning levels
  topBar.removeAttribute('data-off-task-level');

  if (level >= 2) {
    topBar.setAttribute('data-off-task-level', level);
  }
});

// Initialize: create one empty todo item with focus
createEmptyTodo();
// Wait for fonts to load and DOM to fully paint before sizing
document.fonts.ready.then(() => {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => resizeTodoPanel());
  });
});
