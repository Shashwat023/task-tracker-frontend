// API Base URL (adjust as needed)
const API_BASE_URL = 'https://task-tracker-backend-production-f81c.up.railway.app'; // Adjust for your NestJS backend

// Application State
let currentUser = null;
let tasks = [];

// DOM Elements
const loginPage = document.getElementById('loginPage');
const signupPage = document.getElementById('signupPage');
const homePage = document.getElementById('homePage');

const loginForm = document.getElementById('loginForm');
const signupForm = document.getElementById('signupForm');
const addTaskForm = document.getElementById('addTaskForm');

const showSignupLink = document.getElementById('showSignup');
const showLoginLink = document.getElementById('showLogin');
const logoutBtn = document.getElementById('logoutBtn');

const welcomeMessage = document.getElementById('welcomeMessage');
const tasksList = document.getElementById('tasksList');
const noTasksMessage = document.getElementById('noTasks');
const newTaskInput = document.getElementById('newTaskInput');

const loginError = document.getElementById('loginError');
const signupError = document.getElementById('signupError');

// Utility Functions
function showPage(pageToShow) {
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    pageToShow.classList.add('active');
}

function showError(errorElement, message) {
    errorElement.textContent = message;
    errorElement.classList.add('show');
    setTimeout(() => {
        errorElement.classList.remove('show');
    }, 5000);
}

function clearError(errorElement) {
    errorElement.classList.remove('show');
}

// Local Storage Functions for Task Persistence
function saveTasks() {
    if (currentUser) {
        const userTasks = {
            username: currentUser.username,
            tasks: tasks
        };
        localStorage.setItem(`taskTracker_tasks_${currentUser.username}`, JSON.stringify(userTasks));
    }
}

function loadSavedTasks() {
    if (currentUser) {
        const savedTasks = localStorage.getItem(`taskTracker_tasks_${currentUser.username}`);
        if (savedTasks) {
            try {
                const userTasks = JSON.parse(savedTasks);
                tasks = userTasks.tasks || [];
                return true;
            } catch (error) {
                console.error('Failed to load saved tasks:', error);
                tasks = [];
                return false;
            }
        }
    }
    return false;
}

// API Functions
async function apiCall(endpoint, options = {}) {
    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'An error occurred');
        }

        return data;
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

// Authentication Functions
async function login(username, password) {
    try {
        const data = await apiCall('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });

        currentUser = { username, token: data.token };
        localStorage.setItem('taskTracker_user', JSON.stringify(currentUser));
        
        welcomeMessage.textContent = `Welcome, ${username}!`;
        showPage(homePage);
        loadTasks();
        
        return true;
    } catch (error) {
        showError(loginError, error.message);
        return false;
    }
}

async function signup(username, password, confirmPassword) {
    if (password !== confirmPassword) {
        showError(signupError, 'Passwords do not match');
        return false;
    }

    if (password.length < 6) {
        showError(signupError, 'Password must be at least 6 characters long');
        return false;
    }

    try {
        await apiCall('/auth/signup', {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });

        // Auto-login after successful signup
        return await login(username, password);
    } catch (error) {
        showError(signupError, error.message);
        return false;
    }
}

function logout() {
    // Clear user-specific tasks from localStorage
    if (currentUser) {
        localStorage.removeItem(`taskTracker_tasks_${currentUser.username}`);
    }
    
    currentUser = null;
    tasks = [];
    localStorage.removeItem('taskTracker_user');
    showPage(loginPage);
    
    // Clear forms
    loginForm.reset();
    signupForm.reset();
    addTaskForm.reset();
    
    // Clear errors
    clearError(loginError);
    clearError(signupError);
}

// Task Functions
async function loadTasks() {
    if (!currentUser) return;

    // First try to load saved tasks from localStorage
    const hasSavedTasks = loadSavedTasks();
    
    if (hasSavedTasks) {
        renderTasks();
        console.log('Loaded tasks from localStorage:', tasks);
    }

    // Then try to fetch from API (this will override localStorage if successful)
    try {
        const data = await apiCall('/tasks', {
            headers: {
                'Authorization': `Bearer ${currentUser.token}`
            }
        });

        tasks = data;
        saveTasks(); // Save to localStorage
        renderTasks();
        console.log('Loaded tasks from API:', tasks);
    } catch (error) {
        console.error('Failed to load tasks from API:', error);
        
    
    }
}

async function addTask(taskText) {
    if (!currentUser || !taskText.trim()) return;

    const tempTask = {
        _id: Date.now().toString(),
        text: taskText.trim(),
        completed: false
    };

    try {
        const newTask = await apiCall('/tasks', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json', 
                'Authorization': `Bearer ${currentUser.token}`
            },
            body: JSON.stringify({ text: taskText.trim() })
        });

        tasks.push(newTask);
        saveTasks();
        renderTasks();
        newTaskInput.value = '';
        console.log('Task added via API:', newTask);
    } catch (error) {
        console.error('Failed to add task via API:', error);
        
        // Fallback: add task locally
        tasks.push(tempTask);
        saveTasks();
        renderTasks();
        newTaskInput.value = '';
        console.log('Task added locally:', tempTask);
    }
}

async function toggleTask(taskId) {
    if (!currentUser) return;

    const task = tasks.find(t => t._id === taskId);
    if (!task) return;

    const originalCompleted = task.completed;

    try {
        const updatedTask = await apiCall(`/tasks/${taskId}/toggle`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${currentUser.token}`
            }
        });

        task.completed = updatedTask.completed;
        saveTasks();
        renderTasks();
        console.log(`Task ${taskId} toggled via API:`, task.completed);
    } catch (error) {
        console.error('Failed to toggle task via API:', error);

        // Fallback: toggle locally
        task.completed = !originalCompleted;
        saveTasks();
        renderTasks();
        console.log(`Task ${taskId} toggled locally:`, task.completed);
    }
}

function renderTasks() {
    if (tasks.length === 0) {
        tasksList.style.display = 'none';
        noTasksMessage.style.display = 'block';
        return;
    }

    tasksList.style.display = 'flex';
    noTasksMessage.style.display = 'none';

    tasksList.innerHTML = tasks.map(task => {
        const completedClass = task.completed ? 'completed' : '';
        const checkedClass = task.completed ? 'checked' : '';
        const strikeClass = task.completed ? 'strike' : '';
        
        return `
            <div class="task-card ${completedClass}" data-task-id="${task._id}">
                <div class="task-checkbox ${checkedClass}" onclick="toggleTask('${task._id}')"></div>
                <div class="task-text ${strikeClass}">${escapeHtml(task.text)}</div>
            </div>
        `;
    }).join('');

    // Log task states for debugging
    tasks.forEach(task => {
        console.log(`Task: "${task.text}" → completed: ${task.completed}`);
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Event Listeners
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearError(loginError);
    
    const formData = new FormData(loginForm);
    const username = formData.get('username');
    const password = formData.get('password');
    
    await login(username, password);
});

signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearError(signupError);
    
    const formData = new FormData(signupForm);
    const username = formData.get('username');
    const password = formData.get('password');
    const confirmPassword = formData.get('confirmPassword');
    
    await signup(username, password, confirmPassword);
});

addTaskForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const taskText = newTaskInput.value;
    await addTask(taskText);
});

showSignupLink.addEventListener('click', (e) => {
    e.preventDefault();
    clearError(loginError);
    showPage(signupPage);
});

showLoginLink.addEventListener('click', (e) => {
    e.preventDefault();
    clearError(signupError);
    showPage(loginPage);
});

logoutBtn.addEventListener('click', logout);

// Make toggleTask globally available
window.toggleTask = toggleTask;

// Initialize App
function initApp() {
    // Check for saved user session
    const savedUser = localStorage.getItem('taskTracker_user');
    if (savedUser) {
        try {
            currentUser = JSON.parse(savedUser);
            welcomeMessage.textContent = `Welcome, ${currentUser.username}!`;
            showPage(homePage);
            loadTasks();
        } catch (error) {
            console.error('Failed to restore user session:', error);
            localStorage.removeItem('taskTracker_user');
            showPage(loginPage);
        }
    } else {
        showPage(loginPage);
    }
}

// Start the application
initApp();