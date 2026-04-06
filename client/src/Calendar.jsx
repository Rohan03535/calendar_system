import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import EventModal from './EventModal';

const API_URL = '/api';

export default function CalendarDashboard({ user }) {
    const [events, setEvents] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState(null);
    const [reminders, setReminders] = useState([]);
    const [notifications, setNotifications] = useState([]);
    const [showNotifTray, setShowNotifTray] = useState(false);

    const fetchEvents = useCallback(async () => {
        try {
            const res = await axios.get(`${API_URL}/events?user_id=${user.id}`);
            setEvents(res.data);
        } catch (err) {
            console.error("Error fetching events", err);
        }
    }, [user.id]);

    const fetchReminders = useCallback(async () => {
        try {
            // FIX: Use path param instead of query param to match route /:user_id
            const res = await axios.get(`${API_URL}/reminders/${user.id}`);
            setReminders(res.data);
        } catch (err) {
            console.error("Error fetching reminders", err);
        }
    }, [user.id]);

    const fetchNotifications = useCallback(async () => {
        try {
            const res = await axios.get(`${API_URL}/notifications/${user.id}`);
            setNotifications(res.data);
        } catch (err) {
            console.error("Error fetching notifications", err);
        }
    }, [user.id]);

    useEffect(() => {
        fetchEvents();
        fetchReminders();
        fetchNotifications();

        // Poll notifications every 10 seconds so host sees updates without manual reload
        const interval = setInterval(fetchNotifications, 10000);
        return () => clearInterval(interval);
    }, [fetchEvents, fetchReminders, fetchNotifications]);

    const handleCreate = () => {
        setSelectedEvent(null);
        setIsModalOpen(true);
    };

    const handleEdit = (event) => {
        alert(`Event: ${event.title}\nDescription: ${event.description}\nTime: ${new Date(event.instance_start).toLocaleString()}`);
    }

    // FIX: Use the correct endpoint PUT /api/participants/:event_id/rsvp
    const handleRespond = async (eventId, status) => {
        try {
            await axios.put(`${API_URL}/participants/${eventId}/rsvp`, { user_id: user.id, rsvp_status: status });
            fetchEvents();
            fetchNotifications();
        } catch (err) {
            alert('Error responding');
        }
    }

    // FIX: RSVP from notification tray (uses notification endpoint)
    const handleNotifRsvp = async (notifId, status) => {
        try {
            await axios.put(`${API_URL}/notifications/${notifId}/rsvp`, { status });
            fetchEvents();
            fetchNotifications();
        } catch (err) {
            alert('Error responding to invitation');
        }
    }

    const handleDismissNotif = async (notifId) => {
        try {
            await axios.put(`${API_URL}/notifications/${notifId}/dismiss`);
            fetchNotifications();
        } catch (err) {
            console.error('Error dismissing notification');
        }
    }

    const handleDismissAll = async () => {
        try {
            await axios.put(`${API_URL}/notifications/user/${user.id}/dismiss-all`);
            fetchNotifications();
        } catch (err) {
            console.error('Error dismissing all notifications');
        }
    }

    // FIX: Pass instance_id for proper single-event cancellation
    const handleCancel = async (eventId, instanceId) => {
        if (!window.confirm('Are you sure you want to cancel/decline this appointment?')) return;
        try {
            await axios.post(`${API_URL}/events/${eventId}/cancel`, { 
                user_id: user.id,
                instance_id: instanceId || null
            });
            fetchEvents();
            fetchNotifications();
        } catch (err) {
            alert('Error cancelling appointment');
        }
    }

    const handleViewReport = async () => {
        try {
            const res = await axios.get(`${API_URL}/events/report/attendance`);
            if (res.data.length === 0) return alert("No data yet for report.");
            
            const report = res.data.map(r => 
                `${r.full_name}: ${r.attendance_rate}% Attendance (${r.accepted_count} accepted / ${r.total_invites} total)`
            ).join('\n');
            
            alert(`📈 ATTENDANCE ANALYTICS (Complex Query Test)\n\n${report}`);
        } catch (err) {
            console.error(err);
            alert('Error generating report');
        }
    };

    const handleCleanup = async () => {
        try {
            const res = await axios.post(`${API_URL}/reminders/maintenance/cleanup`);
            alert(res.data.message);
        } catch (err) {
            alert('Error running maintenance cleanup');
        }
    };

    return (
        <div className="dashboard">
            <div className="toolbar">
                <h2>My Calendar</h2>
                <div className="button-group">
                    <button className="btn-primary" onClick={handleCreate}>+ New Event</button>
                    <button className="btn-secondary" onClick={fetchReminders}>Check Reminders ({reminders.length})</button>
                    <button className="btn-accent" onClick={handleViewReport}>📊 Attendance Summary</button>
                    <button className="btn-notif" onClick={() => { setShowNotifTray(!showNotifTray); fetchNotifications(); }}>
                        🔔 Notifications {notifications.length > 0 && <span className="notif-badge">{notifications.length}</span>}
                    </button>
                    <button className="btn-sm btn-decline" onClick={handleCleanup}>🧹 Run DB Cleanup (Cursor Test)</button>
                </div>
            </div>

            {/* ========== NOTIFICATION TRAY ========== */}
            {showNotifTray && (
                <div className="notif-tray">
                    <div className="notif-tray-header">
                        <h3>🔔 Notifications</h3>
                        <div>
                            {notifications.length > 0 && <button className="notif-dismiss-all-btn" onClick={handleDismissAll}>Dismiss All</button>}
                            <button className="notif-close-btn" onClick={() => setShowNotifTray(false)}>✕</button>
                        </div>
                    </div>
                    {notifications.length === 0 ? (
                        <p className="notif-empty">No new notifications</p>
                    ) : (
                        <ul className="notif-list">
                            {notifications.map(n => (
                                <li key={n.notification_id} className={`notif-item notif-type-${n.notification_type}`}>
                                    <div className="notif-message" dangerouslySetInnerHTML={{ __html: n.message_content }} />
                                    <div className="notif-meta">
                                        {new Date(n.scheduled_time).toLocaleString()}
                                        <span className="notif-type-tag">{n.notification_type}</span>
                                    </div>
                                    <div className="notif-actions">
                                        {/* Show RSVP buttons only for invitation-type notifications with pending rsvp */}
                                        {n.notification_type === 'invitation' && n.rsvp_status === 'pending' && (
                                            <>
                                                <button className="btn-sm btn-accept" onClick={() => handleNotifRsvp(n.notification_id, 'accepted')}>Accept</button>
                                                <button className="btn-sm btn-decline" onClick={() => handleNotifRsvp(n.notification_id, 'declined')}>Decline</button>
                                            </>
                                        )}
                                        <button className="btn-sm btn-dismiss" onClick={() => handleDismissNotif(n.notification_id)}>Dismiss</button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}

            {reminders.length > 0 && (
                <div className="reminders-box">
                    <h3>🔔 Upcoming Reminders</h3>
                    <ul>
                        {reminders.map(r => (
                            <li key={r.instance_id}>{r.title} starts at {new Date(r.instance_start).toLocaleTimeString()}</li>
                        ))}
                    </ul>
                </div>
            )}

            <div className="event-list">
                {events.length === 0 ? <p>No upcoming events.</p> : (
                    <table>
                        <thead>
                            <tr>
                                <th>Time</th>
                                <th>Title</th>
                                <th>Host</th>
                                <th>My Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {/* FIX: Use correct field names from API: instance_id, instance_start, instance_status, event_id, creator_id */}
                            {events.map(ev => {
                                const isHost = ev.creator_id === user.id;
                                const status = (ev.instance_status || '').toUpperCase();

                                return (
                                    <tr key={ev.instance_id} className={`status-${status}`}>
                                        <td>{new Date(ev.instance_start).toLocaleString()}</td>
                                        <td>
                                            {ev.title}
                                            {ev.color_code && <span className="tag-category" style={{ backgroundColor: ev.color_code }}>{ev.category_name}</span>}
                                        </td>
                                        <td>{isHost ? 'Me' : (ev.creator_name || 'Others')}</td>
                                        <td>{status}</td>
                                        <td>
                                            {status === 'PENDING' && !isHost && (
                                                <>
                                                    <button className="btn-sm btn-accept" onClick={() => handleRespond(ev.event_id, 'accepted')}>Accept</button>
                                                    <button className="btn-sm btn-decline" onClick={() => handleRespond(ev.event_id, 'declined')}>Decline</button>
                                                </>
                                            )}
                                            {((status === 'ACCEPTED' && !isHost) || isHost) && (
                                                <button className="btn-sm btn-cancel" onClick={() => handleCancel(ev.event_id, ev.instance_id)}>
                                                    {isHost ? 'Cancel Meeting' : 'Cancel/Decline'}
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>

            {isModalOpen && (
                <EventModal
                    user={user}
                    onClose={() => setIsModalOpen(false)}
                    onSave={() => { setIsModalOpen(false); fetchEvents(); fetchNotifications(); }}
                />
            )}
        </div>
    );
}
