const taskInput = document.getElementById('task-input');
const taskInputWrapper = document.getElementById('task-input-wrapper');
const topBar = document.getElementById('top-bar');
const trackBtn = document.getElementById('track-btn');
const historyPanel = document.getElementById('history-panel');
const historyList = document.getElementById('history-list');
const todoPanel = document.getElementById('todo-panel');
const todoList = document.getElementById('todo-list');
const taskHint = document.getElementById('task-hint');
const focusBtn = document.getElementById('focus-btn');
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
const lockedinText = document.getElementById('lockedin-text');
const lockedinHint = document.getElementById('lockedin-hint');

let isTracking = false;
let isLockedIn = false;
let isExpanded = false;
let isReportOpen = false;
let isGoalPanelOpen = false;
let isLogoDropdownOpen = false;
let todos = [];
let focusEnabled = false;
let currentGoal = localStorage.getItem('acuity-goal') || '';

// Calculate base window height (top bar + goal bar if visible)
function getBaseHeight() {
  const topBarHeight = 50;
  const goalBarHeight = goalBar.classList.contains('hidden') ? 0 : 30;
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
  todoPanel.classList.add('hidden');

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

// Update todo panel visibility based on lock-in state and todo count
function updateTodoVisibility() {
  if (!isLockedIn && todos.length > 0) {
    todoPanel.classList.remove('hidden');
    resizeTodoPanel();
  } else {
    todoPanel.classList.add('hidden');
    window.acuity.resizeWindow(getBaseHeight());
  }
}

// Close history/report/goal panels and dropdown when clicking outside the app
// Note: todo panel stays visible based on lock-in state and todo count
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
    // Resize to show todos if applicable, otherwise base height
    updateTodoVisibility();
  }
});

// Auto-save task on input change and show/hide hint
taskInput.addEventListener('input', () => {
  window.acuity.setTask(taskInput.value);
  // Show hint when there's text, hide when empty
  if (taskInput.value.trim()) {
    taskHint.classList.remove('hidden');
  } else {
    taskHint.classList.add('hidden');
  }
});

// Show hint if there's text when focusing, and close dropdown
taskInput.addEventListener('focus', () => {
  if (taskInput.value.trim()) {
    taskHint.classList.remove('hidden');
  }
  if (isLogoDropdownOpen) {
    isLogoDropdownOpen = false;
    logoDropdown.classList.add('hidden');
    updateTodoVisibility();
  }
});

// Hide hint when task input loses focus
taskInput.addEventListener('blur', () => {
  taskHint.classList.add('hidden');
});

// Lock in task on Enter key, add to todo on Shift+Enter
taskInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    if (e.shiftKey) {
      // Shift+Enter: Add to todo list (allow empty items)
      e.preventDefault();
      const text = taskInput.value.trim();
      if (todos.length < 19) {
        const todo = { id: Date.now(), text: text };
        todos.unshift(todo);
        const newItem = renderTodoItem(todo);
        todoList.insertBefore(newItem, todoList.firstChild);
        updateTodoVisibility();
        // Focus the new item's input
        const newInput = newItem.querySelector('.todo-item-input');
        if (newInput) {
          newInput.focus();
        }
      }
      taskInput.value = '';
      taskHint.classList.add('hidden');
    } else if (taskInput.value.trim()) {
      // Enter: Lock in mode (existing behavior)
      const task = taskInput.value.trim();
      window.acuity.setTask(task);
      isLockedIn = true;
      lockedinText.textContent = task;
      taskInputWrapper.classList.add('hidden');
      lockedinText.classList.remove('hidden');
      lockedinHint.classList.remove('hidden');
      taskHint.classList.add('hidden');
      topBar.classList.add('locked-in');
      goalBar.classList.add('locked-in');

      // Hide todo panel when locked in
      updateTodoVisibility();
    }
  }
});

// Click locked-in text to edit
lockedinText.addEventListener('click', () => {
  isLockedIn = false;
  lockedinText.classList.add('hidden');
  lockedinHint.classList.add('hidden');
  taskInputWrapper.classList.remove('hidden');
  topBar.classList.remove('locked-in');
  goalBar.classList.remove('locked-in');
  taskInput.focus();

  // Show todos if any exist
  updateTodoVisibility();
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
  }
});

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

  // Hide todos when opening dropdown
  if (!isLogoDropdownOpen) {
    todoPanel.classList.add('hidden');
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

  // Hide todos when showing history
  todoPanel.classList.add('hidden');

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

  // Hide todos when showing report
  todoPanel.classList.add('hidden');

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

  reportStats.innerHTML = `
    <div class="report-bar-container">
      <div class="report-bar-on-task" style="width: ${onTaskPct}%;"></div>
      <div class="report-bar-off-task" style="width: ${offTaskPct}%;"></div>
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
    const nextTask = nextTodo.text;
    window.acuity.setTask(nextTask);

    // Remove from todos array and DOM
    todos.splice(nextTodoIndex, 1);
    const todoElement = todoList.querySelector(`[data-id="${nextTodo.id}"]`);
    if (todoElement) {
      todoElement.remove();
    }
    // Hide todos when locked in
    updateTodoVisibility();

    // Show next task as locked-in
    isLockedIn = true;
    lockedinText.textContent = nextTask;
    taskInputWrapper.classList.add('hidden');
    lockedinText.classList.remove('hidden');
    lockedinHint.classList.remove('hidden');
    taskHint.classList.add('hidden');
  } else {
    // No next todo - return to empty input state
    isLockedIn = false;
    window.acuity.setTask('');
    lockedinText.classList.add('hidden');
    lockedinHint.classList.add('hidden');
    taskInputWrapper.classList.remove('hidden');
    taskHint.classList.add('hidden');
    topBar.classList.remove('locked-in');
    goalBar.classList.remove('locked-in');
    taskInput.focus();
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
  if (todoPanel.classList.contains('hidden')) return;

  const maxWindowHeight = 500;

  // Fixed measurements
  const topSectionHeight = getBaseHeight();
  const panelPadding = 24;
  const headerHeight = 30;
  const itemHeight = 42;
  const itemGap = 8;

  // Reset items to natural size
  document.querySelectorAll('.todo-item').forEach(item => {
    item.style.padding = '10px 14px';
    item.style.fontSize = '14px';
    item.style.height = 'auto';
    item.style.minHeight = 'auto';
  });

  const itemCount = todos.length;
  const itemsHeight = itemCount > 0 ? (itemCount * itemHeight) + ((itemCount - 1) * itemGap) : 0;
  const totalHeight = topSectionHeight + panelPadding + headerHeight + itemsHeight;

  if (totalHeight <= maxWindowHeight) {
    window.acuity.resizeWindow(totalHeight);
  } else {
    // Need to shrink items to fit
    const availableForItems = maxWindowHeight - topSectionHeight - panelPadding - headerHeight;
    const totalGapsHeight = itemCount > 1 ? (itemCount - 1) * itemGap : 0;
    const spaceForItems = availableForItems - totalGapsHeight;
    const heightPerItem = Math.max(20, spaceForItems / itemCount);

    const shrinkRatio = Math.max(0.4, heightPerItem / itemHeight);

    document.querySelectorAll('.todo-item').forEach(item => {
      const newPadding = Math.max(4, 10 * shrinkRatio);
      const newFontSize = Math.max(10, 14 * shrinkRatio);
      item.style.padding = `${newPadding}px 14px`;
      item.style.fontSize = `${newFontSize}px`;
      item.style.height = `${heightPerItem}px`;
      item.style.minHeight = `${heightPerItem}px`;
    });
    window.acuity.resizeWindow(maxWindowHeight);
  }
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
      <input type="text" class="todo-item-input" value="${todo.text}" />
      <span class="todo-item-hint">press enter</span>
    </div>
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
      if (prevItem && prevItem.classList.contains('todo-item')) {
        const prevInput = prevItem.querySelector('.todo-item-input');
        prevInput.focus();
        prevInput.selectionStart = prevInput.value.length;
        prevInput.selectionEnd = prevInput.value.length;
        resizeTodoPanel();
      } else {
        // No more items - hide todo panel and focus main task input
        updateTodoVisibility();
        taskInput.focus();
      }
    }
  });

  // Delete todo
  div.querySelector('.todo-delete').addEventListener('click', () => {
    todos = todos.filter(t => t.id !== todo.id);
    div.remove();
    updateTodoVisibility();
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

