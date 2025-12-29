const API_URL = 'TaskHandler.ashx';
let today = new Date();
const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
let currentMonth = today.getMonth();
let currentYear = today.getFullYear();
let tasks = [];
let editingIndex = null;
let currentUserName = '';

// ===== LANDING PAGE & AUTH =====
function showAuth(type) {
    document.getElementById('authOverlay').style.display = 'flex';
    toggleAuth(type === 'signup');
}

function hideAuth() {
    document.getElementById('authOverlay').style.display = 'none';
}

function toggleAuth(showSignup) {
    document.getElementById('loginSection').style.display = showSignup ? 'none' : 'block';
    document.getElementById('signupSection').style.display = showSignup ? 'block' : 'none';
}

async function handleSignup() {
    const name = document.getElementById('regName').value;
    const email = document.getElementById('regEmail').value;
    const pass = document.getElementById('regPass').value;

    if (!name || !email || !pass) return alert("Please fill all fields");

    const fd = new FormData();
    fd.append('action', 'signup');
    fd.append('name', name);
    fd.append('email', email);
    fd.append('password', pass);

    const res = await fetch(API_URL, { method: 'POST', body: fd });
    const data = await res.json();

    if (data.success) {
        alert("Account created successfully! You can now login.");
        toggleAuth(false);
        document.getElementById('regName').value = '';
        document.getElementById('regEmail').value = '';
        document.getElementById('regPass').value = '';
    } else {
        alert(data.message || "Signup failed");
    }
}

async function handleLogin() {
    const email = document.getElementById('loginEmail').value;
    const pass = document.getElementById('loginPass').value;

    if (!email || !pass) return alert("Please fill all fields");

    // Initialize database schema first
    const initFd = new FormData();
    initFd.append('action', 'initdb');
    await fetch(API_URL, { method: 'POST', body: initFd });

    const fd = new FormData();
    fd.append('action', 'login');
    fd.append('email', email);
    fd.append('password', pass);

    const res = await fetch(API_URL, { method: 'POST', body: fd });
    const data = await res.json();

    if (data.success) {
        currentUserName = data.name;
        document.getElementById('authOverlay').style.display = 'none';
        document.getElementById('landingPage').style.display = 'none';
        document.getElementById('appSection').style.display = 'block';
        
        // Update user displays
        document.getElementById('userNameDisplay').textContent = data.name;
        document.getElementById('profileNameDisplay').textContent = data.name;
        
        // Set avatar initials
        const initials = data.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
        document.getElementById('userAvatar').textContent = initials;
        document.getElementById('profileAvatar').textContent = initials;
        
        loadTasks();
    } else {
        alert("Invalid email or password");
    }
}

function logout() {
    location.reload();
}

// ===== TASK DATABASE OPERATIONS =====
async function loadTasks() {
    const fd = new FormData();
    fd.append('action', 'gettasks');
    const res = await fetch(API_URL, { method: 'POST', body: fd });
    const data = await res.json();

    if (data.success) {
        tasks = data.tasks;
        updateUI();
        updateStats();
    }
}

async function saveTask() {
    let title = document.getElementById('taskTitle').value;
    let desc = document.getElementById('taskDesc').value;
    let date = document.getElementById('taskDate').value;
    let priority = document.getElementById('taskPriority').value;
    let status = document.getElementById('taskStatus') ? document.getElementById('taskStatus').value : 'Pending';

    if (!title || !date) return alert("Title and Date are required");

    const fd = new FormData();
    if (editingIndex !== null) {
        fd.append('action', 'updatetask');
        fd.append('oldTitle', tasks[editingIndex].title);
        if (!document.getElementById('taskStatus')) {
            status = tasks[editingIndex].status || 'Pending';
        }
    } else {
        fd.append('action', 'addtask');
    }

    fd.append('title', title);
    fd.append('desc', desc);
    fd.append('date', date);
    fd.append('priority', priority);
    fd.append('status', status);

    const res = await fetch(API_URL, { method: 'POST', body: fd });
    const data = await res.json();

    if (data.success) {
        closeTaskModal();
        loadTasks();
    }
}

async function deleteTask(index) {
    if (!confirm("Are you sure you want to delete this task?")) return;
    const fd = new FormData();
    fd.append('action', 'deletetask');
    fd.append('title', tasks[index].title);
    const res = await fetch(API_URL, { method: 'POST', body: fd });
    const data = await res.json();
    if (data.success) loadTasks();
}

// ===== UI & SECTIONS =====
function updateUI() {
    updateTasksList();
    renderTodayTasks();
    if (document.getElementById('calendar').classList.contains('active')) {
        renderCalendar(currentMonth, currentYear);
    }
}

function updateStats() {
    const total = tasks.length;
    const pending = tasks.filter(t => t.status !== 'Done').length;
    const completed = tasks.filter(t => t.status === 'Done').length;
    const highPriority = tasks.filter(t => t.priority === 'High' && t.status !== 'Done').length;
    
    document.getElementById('totalTasks').textContent = total;
    document.getElementById('pendingTasks').textContent = pending;
    document.getElementById('completedTasks').textContent = completed;
    document.getElementById('highPriorityTasks').textContent = highPriority;
}

function showSection(sectionId, elem) {
    document.querySelectorAll('.main-section').forEach(x => {
        x.classList.remove('active');
        x.style.display = 'none';
    });
    const section = document.getElementById(sectionId);
    section.style.display = 'block';
    section.classList.add('active');
    
    document.querySelectorAll('.sidebar-link').forEach(item => item.classList.remove('active'));
    if (elem) elem.classList.add('active');

    if (sectionId === "calendar") renderCalendar(currentMonth, currentYear);
    if (sectionId === "dashboard") {
        renderTodayTasks();
        updateStats();
    }
}

function updateTasksList() {
    const list = document.getElementById('tasksList');
    
    if (tasks.length === 0) {
        list.innerHTML = `
            <div class="empty-state" style="grid-column: 1/-1;">
                <div class="empty-icon">✨</div>
                <p class="empty-title">No tasks yet</p>
                <p>Create your first task to get organized</p>
            </div>`;
        return;
    }
    
    // Sort tasks: Pending first, then Done
    const sortedTasks = [...tasks].sort((a, b) => {
        if (a.status === b.status) return 0;
        return a.status === 'Done' ? 1 : -1;
    });

    list.innerHTML = '';
    sortedTasks.forEach((t, index) => {
        const originalIndex = tasks.indexOf(t);
        const isDone = t.status === 'Done';
        
        let priorityClass = 'priority-low';
        if (t.priority === 'High') priorityClass = 'priority-high';
        else if (t.priority === 'Medium') priorityClass = 'priority-medium';

        list.innerHTML += `
            <div class="task-card ${isDone ? 'completed' : ''}" style="animation-delay: ${index * 0.1}s">
                <div class="task-header">
                    <div class="task-checkbox ${isDone ? 'checked' : ''}" onclick="toggleTaskStatus(${originalIndex})">
                        ${isDone ? '✓' : ''}
                    </div>
                    <span class="task-priority ${priorityClass}">${t.priority}</span>
                </div>
                <h3 class="task-title">${t.title}</h3>
                <p class="task-desc">${t.desc || "No description"}</p>
                <div class="task-footer">
                    <span class="task-date">📅 ${t.date}</span>
                    <div class="task-actions">
                        <button class="btn-task-action btn-edit" onclick="editTask(${originalIndex})">✏️</button>
                        <button class="btn-task-action btn-delete" onclick="deleteTask(${originalIndex})">🗑️</button>
                    </div>
                </div>
            </div>`;
    });
}

async function toggleTaskStatus(index) {
    const t = tasks[index];
    const newStatus = t.status === 'Done' ? 'Pending' : 'Done';
    
    const fd = new FormData();
    fd.append('action', 'updatetask');
    fd.append('oldTitle', t.title);
    fd.append('title', t.title);
    fd.append('desc', t.desc);
    fd.append('date', t.date);
    fd.append('priority', t.priority);
    fd.append('status', newStatus);

    const res = await fetch(API_URL, { method: 'POST', body: fd });
    const data = await res.json();

    if (data.success) {
        loadTasks();
    }
}

function filterTasks() {
    const query = document.getElementById('globalSearch').value.toLowerCase();
    const cards = document.querySelectorAll('.task-card');
    cards.forEach(card => {
        const title = card.querySelector('.task-title').textContent.toLowerCase();
        const desc = card.querySelector('.task-desc').textContent.toLowerCase();
        if (title.includes(query) || desc.includes(query)) {
            card.style.display = 'block';
        } else {
            card.style.display = 'none';
        }
    });
}

// ===== CALENDAR LOGIC =====
function renderCalendar(month, year) {
    document.getElementById('monthYear').textContent = `${monthNames[month]} ${year}`;
    let daysInMonth = new Date(year, month + 1, 0).getDate();
    let firstDay = new Date(year, month, 1).getDay();
    
    // Day headers
    const dayHeaders = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    let calendarHTML = dayHeaders.map(d => `<div class="calendar-day-header">${d}</div>`).join('');
    
    // Empty cells for days before first day of month
    for (let i = 0; i < firstDay; i++) {
        calendarHTML += '<div class="calendar-day" style="opacity: 0.3;"></div>';
    }

    for (let i = 1; i <= daysInMonth; i++) {
        let isToday = (year === today.getFullYear() && month === today.getMonth() && i === today.getDate());
        let extraClass = isToday ? "today" : "";
        
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        const hasTasks = tasks.some(t => t.date === dateStr);
        if (hasTasks) extraClass += " has-tasks";

        calendarHTML += `<div class="calendar-day ${extraClass}" onclick="openTaskModalForDate(${year},${month + 1},${i})">
            ${i}
        </div>`;
    }
    document.getElementById('calendarGrid').innerHTML = calendarHTML;
}

function openTaskModalForDate(year, month, day) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    openTaskModalForAdd();
    document.getElementById('taskDate').value = dateStr;
}

function prevMonth() { 
    currentMonth--; 
    if (currentMonth < 0) { currentMonth = 11; currentYear--; } 
    renderCalendar(currentMonth, currentYear); 
}

function nextMonth() { 
    currentMonth++; 
    if (currentMonth > 11) { currentMonth = 0; currentYear++; } 
    renderCalendar(currentMonth, currentYear); 
}

function goToToday() {
    const now = new Date();
    currentMonth = now.getMonth();
    currentYear = now.getFullYear();
    renderCalendar(currentMonth, currentYear);
}

// ===== MODALS & UTILS =====
function openTaskModalForAdd() {
    editingIndex = null;
    clearFields();
    document.getElementById('modalTitle').textContent = "Add New Task";
    document.getElementById('saveBtn').textContent = "Save Task";
    document.getElementById('taskModal').style.display = 'flex';
}

function editTask(index) {
    editingIndex = index;
    const t = tasks[index];
    document.getElementById('taskTitle').value = t.title;
    document.getElementById('taskDesc').value = t.desc || '';
    document.getElementById('taskDate').value = t.date;
    document.getElementById('taskPriority').value = t.priority;
    if(document.getElementById('taskStatus')) document.getElementById('taskStatus').value = t.status || 'Pending';
    
    document.getElementById('modalTitle').textContent = "Edit Task";
    document.getElementById('saveBtn').textContent = "Update Task";
    document.getElementById('taskModal').style.display = 'flex';
}

function closeTaskModal() { 
    document.getElementById('taskModal').style.display = 'none'; 
}

function clearFields() {
    document.getElementById('taskTitle').value = "";
    document.getElementById('taskDesc').value = "";
    document.getElementById('taskDate').value = "";
    document.getElementById('taskPriority').value = "";
    if(document.getElementById('taskStatus')) document.getElementById('taskStatus').value = "Pending";
}

function toggleProfile() {
    let box = document.getElementById("profilePopup");
    box.style.display = box.style.display === "block" ? "none" : "block";
}

function renderTodayTasks() {
    const todayStr = new Date().toISOString().split('T')[0];
    const todayTasks = tasks.filter(t => t.date === todayStr);
    const container = document.getElementById('todayTasks');
    
    if (todayTasks.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📝</div>
                <p class="empty-title">No tasks for today</p>
                <p>Enjoy your free time or add a new task</p>
            </div>`;
        return;
    }
    
    let html = '<div class="tasks-grid">';
    todayTasks.forEach((t, index) => {
        const originalIndex = tasks.indexOf(t);
        const isDone = t.status === 'Done';
        
        let priorityClass = 'priority-low';
        if (t.priority === 'High') priorityClass = 'priority-high';
        else if (t.priority === 'Medium') priorityClass = 'priority-medium';

        html += `
            <div class="task-card ${isDone ? 'completed' : ''}">
                <div class="task-header">
                    <div class="task-checkbox ${isDone ? 'checked' : ''}" onclick="toggleTaskStatus(${originalIndex})">
                        ${isDone ? '✓' : ''}
                    </div>
                    <span class="task-priority ${priorityClass}">${t.priority}</span>
                </div>
                <h3 class="task-title">${t.title}</h3>
                <p class="task-desc">${t.desc || "No description"}</p>
            </div>`;
    });
    html += '</div>';
    container.innerHTML = html;
}

// Close modal when clicking outside
document.addEventListener('click', function(e) {
    const profilePopup = document.getElementById('profilePopup');
    const userAvatar = document.getElementById('userAvatar');
    if (profilePopup && userAvatar && !profilePopup.contains(e.target) && !userAvatar.contains(e.target)) {
        profilePopup.style.display = 'none';
    }
});

// Close task modal when clicking outside content
document.addEventListener('click', function(e) {
    const taskModal = document.getElementById('taskModal');
    if (e.target === taskModal) {
        closeTaskModal();
    }
});