const taskInput = document.getElementById('task-input');
const confirmBtn = document.getElementById('confirm-btn');

// Receive current task from main process
window.intervention.onSetCurrentTask((task) => {
  taskInput.value = task || '';
  taskInput.focus();
  taskInput.select();
});

// Confirm button click
confirmBtn.addEventListener('click', () => {
  const task = taskInput.value.trim();
  if (task) {
    window.intervention.confirmTask(task);
  }
});

// Also confirm on Enter key
taskInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    const task = taskInput.value.trim();
    if (task) {
      window.intervention.confirmTask(task);
    }
  }
});
