// Application State
let currentUser = null;
let currentDate = new Date();
let events = [];
let currentEditingEventId = null;
let currentEditingInstanceId = null;
let currentEventIsHost = false;
let allUsers = [];

// DOM Elements Repository
const dom = {
    loginOverlay: document.getElementById('login-overlay'),
    appContainer: document.getElementById('app-container'),
    loginEmail: document.getElementById('login-email'),
    loginBtn: document.getElementById('login-btn'),
    registerBtn: document.getElementById('register-btn'),
    loginError: document.getElementById('login-error'),
    
    userName: document.getElementById('user-name'),
    userEmail: document.getElementById('user-email'),
    userAvatar: document.getElementById('user-avatar'),
    logoutBtn: document.getElementById('logout-btn'),
    
    currentMonthDisplay: document.getElementById('current-month-display'),
    calendarGrid: document.getElementById('calendar-grid'),
    prevMonth: document.getElementById('prev-month'),
    nextMonth: document.getElementById('next-month'),
    
    notifList: document.getElementById('notifications-list'),
    notifBadge: document.getElementById('notif-badge'),
    
    eventModal: document.getElementById('event-modal'),
    newEventBtn: document.getElementById('new-event-btn'),
    closeModalBtn: document.getElementById('close-modal-btn'),
    eventForm: document.getElementById('event-form'),
    
    evRecurring: document.getElementById('ev-recurring'),
    recurringOptions: document.getElementById('recurring-options'),
    evInvitees: document.getElementById('ev-invitees'),
    evDescription: document.getElementById('ev-description'),
    evCategory: document.getElementById('ev-category'),
    
    detModal: document.getElementById('event-detail-modal'),
    closeDetBtn: document.getElementById('close-detail-btn'),
    editDetBtn: document.getElementById('edit-detail-btn'),
    saveDetBtn: document.getElementById('save-detail-btn'),
    detTitle: document.getElementById('det-title'),
    detTime: document.getElementById('det-time'),
    detLocation: document.getElementById('det-location'),
    detCreator: document.getElementById('det-creator'),
    detDesc: document.getElementById('det-desc'),
    cancelEventBtn: document.getElementById('cancel-event-btn'),
    viewAnalyticsBtn: document.getElementById('view-analytics-btn'),
    runCleanupBtn: document.getElementById('run-cleanup-btn')
};

// Initialize Application
function init() {
    setupEventListeners();
    const savedUser = localStorage.getItem('dbsproject_user');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        showApp();
    }
}

function setupEventListeners() {
    dom.loginBtn.addEventListener('click', handleLogin);
    if(dom.registerBtn) dom.registerBtn.addEventListener('click', handleRegister);
    dom.logoutBtn.addEventListener('click', handleLogout);
    
    // Calendar Navigation (Month switching)
    dom.prevMonth.addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() - 1);
        renderCalendar();
    });
    dom.nextMonth.addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() + 1);
        renderCalendar();
    });

    // Modals & Forms
    dom.newEventBtn.addEventListener('click', () => {
        dom.eventModal.classList.remove('hidden');
        
        // Small timeout allows display:block to apply before animating opacity
        setTimeout(() => dom.eventModal.classList.add('active'), 10);
    });
    
    dom.closeModalBtn.addEventListener('click', () => {
        dom.eventModal.classList.remove('active');
        setTimeout(() => dom.eventModal.classList.add('hidden'), 300);
        dom.eventForm.reset();
        dom.recurringOptions.classList.add('hidden');
    });

    dom.closeDetBtn.addEventListener('click', () => {
        dom.detModal.classList.remove('active');
        setTimeout(() => dom.detModal.classList.add('hidden'), 300);
    });

    dom.editDetBtn.addEventListener('click', () => {
        dom.editDetBtn.classList.add('hidden');
        dom.saveDetBtn.classList.remove('hidden');
        [dom.detTitle, dom.detLocation, dom.detDesc].forEach(el => {
            el.contentEditable = 'true';
            el.style.border = '1px dashed rgba(255,255,255,0.3)';
            el.style.padding = '4px';
        });
        dom.detTitle.focus();
    });

    dom.saveDetBtn.addEventListener('click', async () => {
        const payload = {
            title: dom.detTitle.textContent,
            location: dom.detLocation.textContent !== "No location" ? dom.detLocation.textContent : "",
            description: dom.detDesc.textContent !== "No description provided." ? dom.detDesc.textContent : ""
        };
        try {
            const res = await fetch(`/api/events/${currentEditingEventId}`, {
                method: 'PUT',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(payload)
            });
            if(res.ok) {
                dom.detModal.classList.remove('active');
                setTimeout(() => dom.detModal.classList.add('hidden'), 300);
                renderCalendar();
            } else {
                alert("Failed to update event.");
            }
        } catch(e) { console.error(e); }
    });

    dom.evRecurring.addEventListener('change', (e) => {
        if(e.target.checked) dom.recurringOptions.classList.remove('hidden');
        else dom.recurringOptions.classList.add('hidden');
    });

    dom.eventForm.addEventListener('submit', handleCreateEvent);
    dom.cancelEventBtn.addEventListener('click', handleCancelEvent);
    dom.viewAnalyticsBtn.addEventListener('click', runAttendanceReport);
    
    if (dom.runCleanupBtn) {
        dom.runCleanupBtn.addEventListener('click', async () => {
            try {
                const res = await fetch('/api/events/maintenance/cleanup', { method: 'POST' });
                const data = await res.json();
                alert("🧹 SYSTEM MAINTENANCE (Cursor Test)\n\n" + data.message);
                fetchNotifications();
                renderCalendar();
            } catch(e) {
                alert("❌ Error running cleanup.");
            }
        });
    }
}

// --- Authentication --- //
async function handleLogin() {
    const email = dom.loginEmail.value.trim();
    if(!email) return;
    try {
        const res = await fetch('/api/auth/login', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        const data = await res.json();
        if(!res.ok) throw new Error(data.error || 'Login failed');
        currentUser = data;
        localStorage.setItem('dbsproject_user', JSON.stringify(currentUser));
        showApp();
    } catch(err) {
        dom.loginError.textContent = err.message;
    }
}

async function handleRegister() {
    const email = dom.loginEmail.value.trim();
    if(!email) return;
    const username = email.split('@')[0];
    try {
        const res = await fetch('/api/auth/register', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, username, password: 'password' })
        });
        const data = await res.json();
        if(!res.ok) throw new Error('Email already exists or is invalid.');
        
        currentUser = { ...data, user_id: data.id, full_name: data.username };
        localStorage.setItem('dbsproject_user', JSON.stringify(currentUser));
        showApp();
    } catch(err) {
        dom.loginError.textContent = err.message;
    }
}

function handleLogout() {
    localStorage.removeItem('dbsproject_user');
    currentUser = null;
    dom.appContainer.classList.add('hidden');
    dom.loginOverlay.classList.add('active');
}

// --- View Lifecycle --- //
async function showApp() {
    dom.loginOverlay.classList.remove('active');
    dom.loginError.textContent = '';
    dom.appContainer.classList.remove('hidden');
    
    // Robust check for names from Oracle (Full Name, Username, etc.)
    const rawName = currentUser.full_name || currentUser.username || currentUser.FULL_NAME || currentUser.USERNAME;
    dom.userName.textContent = rawName || "User";
    dom.userEmail.textContent = currentUser.email || "";
    dom.userAvatar.textContent = (dom.userName.textContent).charAt(0).toUpperCase();

    // Load dynamic sidebar data
    await fetchUsers(); 
    await fetchNotifications();
    // Render central view
    currentDate = new Date(); // Reset to today on login to fix Nov 2023 issue
    renderCalendar();
}

async function fetchUsers() {
    const res = await fetch('/api/auth/users');
    allUsers = await res.json();
    dom.evInvitees.innerHTML = '';
    
    // Populate participants checkboxes
    allUsers.forEach(u => {
        // Correcting field names from Oracle API (id, username, email)
        // AND ensure we don't allow inviting ourselves
        if(u.id !== currentUser.user_id && u.id !== currentUser.id) {
            const div = document.createElement('div');
            div.style.marginBottom = '5px';
            div.innerHTML = `<label style="cursor:pointer; display:flex; align-items:center; gap:8px;">
                <input type="checkbox" name="invitee-check" value="${u.id}"> ${u.username}
            </label>`;
            dom.evInvitees.appendChild(div);
        }
    });
}

// --- Notifications --- //
async function fetchNotifications() {
    try {
        const res = await fetch(`/api/notifications/${currentUser.user_id}`);
        const notifs = await res.json();
        
        // Show BOTH pending and sent (archived by mailer) so checkmarks stay visible
        const visibleNotifs = notifs.filter(n => n.status === 'pending' || n.status === 'sent');
        dom.notifBadge.textContent = visibleNotifs.length;
        dom.notifList.innerHTML = '';
        
        if(visibleNotifs.length === 0) {
            dom.notifList.innerHTML = '<p class="subtitle" style="padding:10px;text-align:center;">No alerts</p>';
            return;
        }

        visibleNotifs.forEach(n => {
            const div = document.createElement('div');
            div.className = 'notif-card';
            
            let actionButtons = '';
            const status = (n.rsvp_status || '').trim().toLowerCase();
            
            if (n.notification_type === 'invitation') {
                if (status === 'pending') {
                    actionButtons = `
                        <div class="notif-actions">
                            <button onclick="handleRSVP(${n.notification_id}, 'accepted')" class="btn-rsvp accept">Accept</button>
                            <button onclick="handleRSVP(${n.notification_id}, 'declined')" class="btn-rsvp decline">Decline</button>
                        </div>
                    `;
                } else if (status === 'accepted') {
                    actionButtons = `
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px;">
                            <span style="color:var(--success); font-size:0.75rem; font-weight:600;">✅ Accepted</span>
                        </div>
                    `;
                }
            }

            // Safety check for event time to avoid "Invalid Date"
            let eventTime = "TBD";
            if (n.event_start) {
                const d = new Date(n.event_start);
                if (!isNaN(d)) {
                    eventTime = d.toLocaleString([], {
                        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                    });
                }
            }

            div.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:start; margin-bottom:4px;">
                    <span style="font-weight:600; font-size:0.75rem; color:var(--text-secondary); text-transform:uppercase;">
                        ${n.notification_type}
                    </span>
                    <span style="font-size:0.7rem; color:var(--accent); font-weight:600;">
                        ${eventTime}
                    </span>
                </div>
                <div>${n.message_content}</div>
                ${actionButtons}
            `;
            dom.notifList.appendChild(div);
        });
    } catch (err) {
        console.error("Failed to fetch notifs", err);
    }
}

async function handleRSVP(notificationId, status) {
    try {
        const res = await fetch(`/api/notifications/${notificationId}/rsvp`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
        });
        
        if (res.ok) {
            // Silence success alerts as per user request to decrease popups
            await fetchNotifications();
            await renderCalendar();
        } else {
            alert("❌ Failed to submit RSVP");
        }
    } catch (err) {
        console.error("RSVP Error:", err);
    }
}

// --- Calendar Core Rendering --- //
async function renderCalendar() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    dom.currentMonthDisplay.textContent = `${monthNames[month]} ${year}`;
    
    dom.calendarGrid.innerHTML = '';

    // Calculate Grid Dates
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    // Format bounding dates for API Call
    const startDate = new Date(year, month, 1).toISOString().split('T')[0];
    const endDate = new Date(year, month + 1, 0).toISOString().split('T')[0];

    try {
        const res = await fetch(`/api/events?user_id=${currentUser.user_id}&start_date=${startDate}&end_date=${endDate}`);
        events = await res.json();
    } catch(err) {
        console.error("Failed fetching events", err);
        events = [];
    }

    // Map Event Instances to specific YYYY-MM-DD keys for local-time grid insertion
    const eventsByDay = {};
    events.forEach(ev => {
        // Force local YYYY-MM-DD to avoid ISO timezone shifts (e.g. 20th becomes 19th)
        const localDate = new Date(ev.instance_start).toLocaleDateString('en-CA');
        if(!eventsByDay[localDate]) eventsByDay[localDate] = [];
        eventsByDay[localDate].push(ev);
    });

    // 1. Grid Padding (Empty cells before month start)
    for(let i=0; i<firstDay; i++) {
        const cell = document.createElement('div');
        cell.className = 'day-cell inactive';
        dom.calendarGrid.appendChild(cell);
    }
    
    const today = new Date();

    // 2. Loop through month days
    for(let day=1; day <= daysInMonth; day++) {
        // Build "YYYY-MM-DD" local format
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        
        const cell = document.createElement('div');
        cell.className = 'day-cell';
        
        // Highlight current day if it's the exact today
        if(day === today.getDate() && month === today.getMonth() && year === today.getFullYear()) {
            cell.classList.add('today');
        }

        cell.innerHTML = `<div class="day-num">${day}</div>`;
        
        // Inject Event Chips
        if(eventsByDay[dateStr]) {
            eventsByDay[dateStr].forEach(ev => {
                const isShared = ev.creator_id !== currentUser.user_id;

                const chip = document.createElement('div');
                chip.className = `event-chip ${isShared ? 'shared' : ''}`;
                
                // Parse Local Time
                const d = new Date(ev.instance_start);
                const timeStr = d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                
                if (ev.color_code) {
                    chip.style.borderLeft = `5px solid ${ev.color_code}`;
                }
                
                const rsvp = ev.instance_status || 'pending';
                const statusTag = isShared ? `<span style="font-size:0.6rem; padding:2px 4px; border-radius:4px; margin-left:4px; font-weight:700; color:#fff; background:${rsvp === 'accepted' ? '#2ea043' : (rsvp === 'declined' ? '#da3633' : '#8b949e')}">${rsvp.toUpperCase()}</span>` : '';
                
                chip.innerHTML = `<span style="font-size:0.7rem; font-weight:700; opacity:0.8;">${timeStr}</span> ${ev.title} ${statusTag}`;
                chip.title = `${ev.title} (From: ${ev.creator_name || 'You'})`;
                
                chip.addEventListener('click', () => {
                    // Reset styling
                    [dom.detTitle, dom.detLocation, dom.detDesc].forEach(el => {
                        el.contentEditable = 'false';
                        el.style.border = 'none';
                        el.style.padding = '0';
                    });
                    
                    dom.detTitle.textContent = ev.title;
                    dom.detTime.textContent = d.toLocaleString() + " to " + new Date(ev.instance_end).toLocaleTimeString();
                    dom.detLocation.textContent = ev.location || "No location";
                    dom.detCreator.textContent = ev.creator_name || "You";
                    dom.detDesc.textContent = ev.description || "No description provided.";
                    
                    currentEditingEventId = ev.event_id;
                    currentEditingInstanceId = ev.instance_id;
                    currentEventIsHost = (ev.creator_id === (currentUser.user_id || currentUser.id));
                    
                    if (currentEventIsHost) {
                        dom.editDetBtn.classList.remove('hidden');
                        dom.cancelEventBtn.classList.remove('hidden');
                        dom.cancelEventBtn.textContent = 'Cancel Meeting';
                        dom.saveDetBtn.classList.add('hidden');
                    } else {
                        dom.editDetBtn.classList.add('hidden');
                        dom.cancelEventBtn.classList.remove('hidden');
                        dom.cancelEventBtn.textContent = 'Cancel/Decline';
                        dom.saveDetBtn.classList.add('hidden');
                    }
                    
                    dom.detModal.classList.remove('hidden');
                    setTimeout(() => dom.detModal.classList.add('active'), 10);
                });
                
                cell.appendChild(chip);
            });
        }
        
        dom.calendarGrid.appendChild(cell);
    }
}

// --- Form Submissions --- //
async function handleCreateEvent(e) {
    e.preventDefault();
    
    const checkboxes = document.querySelectorAll('input[name="invitee-check"]:checked');
    const selectedInvitees = Array.from(checkboxes).map(cb => parseInt(cb.value));
    
    const payload = {
        creator_id: currentUser.user_id,
        category_id: null, // Hardcoded IDs in HTML cause ORA-02291. Setting to NULL for stability.
        title: document.getElementById('ev-title').value,
        description: dom.evDescription.value,
        start_time: document.getElementById('ev-start').value,
        end_time: document.getElementById('ev-end').value,
        location: document.getElementById('ev-location').value,
        event_type: selectedInvitees.length > 0 ? 'shared' : 'personal',
        is_recurring: dom.evRecurring.checked,
        r_frequency: document.getElementById('ev-frequency').value,
        r_end_date: document.getElementById('ev-recurrence-end').value,
        invitees: selectedInvitees
    };

    try {
        const res = await fetch('/api/events', {
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        if(!res.ok) {
            const errData = await res.json();
            throw new Error(errData.error || "Database Error: Failed to save event and execute triggers.");
        }
        
        dom.eventModal.classList.remove('active');
        setTimeout(() => dom.eventModal.classList.add('hidden'), 300);
        dom.eventForm.reset();
        
        // Refresh grid
        await renderCalendar(); 
        
        // Wait 500ms before fetching notifications to allow MySQL Triggers to finish committing
        setTimeout(fetchNotifications, 500);

    } catch(err) {
        alert(err.message);
    }
}

async function handleCancelEvent() {
    console.log("Cancelling Event ID:", currentEditingEventId);
    console.log("Cancelling Instance ID:", currentEditingInstanceId);
    
    if (!confirm("Are you sure you want to cancel this event?")) return;
    
    const uid = currentUser.user_id || currentUser.id;
    if (!uid || !currentEditingEventId) {
        alert("Action failed: Missing session IDs. Please refresh.");
        return;
    }

    try {
        const res = await fetch(`/api/events/${currentEditingEventId}/cancel`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                user_id: uid,
                instance_id: currentEditingInstanceId
            })
        });
        
        if (res.ok) {
            dom.detModal.classList.add('hidden');
            const msg = currentEventIsHost ? "Event series cancelled." : "You have successfully declined this specific meeting.";
            alert("✅ SUCCESS: " + msg);
            renderCalendar();
            fetchNotifications(); 
        } else {
            const errData = await res.json();
            alert("❌ DATABASE ERROR: " + (errData.error || "Reason unknown"));
        }
    } catch(e) { 
        console.error("Cancel Error:", e);
        alert("❌ NETWORK ERROR: Failed to reach the server.");
    }
}

async function runAttendanceReport() {
    try {
        const res = await fetch('/api/events/report/attendance');
        const data = await res.json();
        if(!data || data.length === 0) {
            alert("📊 ATTENDANCE SUMMARY (SQL View Test)\n\nNo activity data yet. Create events and accept invites!");
            return;
        }
        const report = data.map(r => `${r.username || r.full_name}: ${r.attendance_rate}% (${r.accepted_count}/${r.total_invites})`).join('\n');
        alert("📊 ATTENDANCE SUMMARY (SQL View Test)\n\n" + report);
    } catch(e) { alert("Error fetching report"); }
}

// Bootstrap
init();
