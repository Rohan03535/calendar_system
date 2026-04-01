import React, { useState, useEffect } from 'react';
import axios from 'axios';
import EventModal from './EventModal';

const API_URL = 'http://localhost:5000/api';

export default function CalendarDashboard({ user }) {
    const [events, setEvents] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState(null);
    const [reminders, setReminders] = useState([]);

    useEffect(() => {
        fetchEvents();
        fetchReminders();
    }, [user]);

    const fetchEvents = async () => {
        try {
            const res = await axios.get(`${API_URL}/events?user_id=${user.id}`);
            setEvents(res.data);
        } catch (err) {
            console.error("Error fetching events", err);
        }
    };

    const fetchReminders = async () => {
        try {
            const res = await axios.get(`${API_URL}/reminders?user_id=${user.id}`);
            setReminders(res.data);
        } catch (err) {
            console.error("Error fetching reminders", err);
        }
    }

    const handleCreate = () => {
        setSelectedEvent(null);
        setIsModalOpen(true);
    };

    const handleEdit = (event) => {
        // Logic to edit could go here, for now just view details or something.
        // Simple project: maybe just show details.
        alert(`Event: ${event.title}\nDescription: ${event.description}\nTime: ${new Date(event.start_time).toLocaleString()}`);
    }

    const handleRespond = async (eventId, status) => {
        try {
            await axios.post(`${API_URL}/events/${eventId}/respond`, { user_id: user.id, status });
            fetchEvents();
        } catch (err) {
            alert('Error responding');
        }
    }

    return (
        <div className="dashboard">
            <div className="toolbar">
                <h2>My Calendar</h2>
                <button onClick={handleCreate}>+ New Event</button>
                <button onClick={fetchReminders}>Check Reminders ({reminders.length})</button>
            </div>

            {reminders.length > 0 && (
                <div className="reminders-box">
                    <h3>🔔 Upcoming Reminders</h3>
                    <ul>
                        {reminders.map(r => (
                            <li key={r.id}>{r.title} starts at {new Date(r.start_time).toLocaleTimeString()}</li>
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
                            {events.map(ev => (
                                <tr key={ev.id} className={`status-${ev.status}`}>
                                    <td>{new Date(ev.start_time).toLocaleString()}</td>
                                    <td>
                                        {ev.title}
                                        {ev.recurrence_rule !== 'NONE' && <span className="tag-recur"> ({ev.recurrence_rule})</span>}
                                    </td>
                                    <td>{ev.creator_id === user.id ? 'Me' : 'Others'}</td>
                                    <td>{ev.status}</td>
                                    <td>
                                        {ev.status === 'PENDING' && (
                                            <>
                                                <button onClick={() => handleRespond(ev.id, 'ACCEPTED')}>Accept</button>
                                                <button onClick={() => handleRespond(ev.id, 'DECLINED')}>Decline</button>
                                            </>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {isModalOpen && (
                <EventModal
                    user={user}
                    onClose={() => setIsModalOpen(false)}
                    onSave={() => { setIsModalOpen(false); fetchEvents(); }}
                />
            )}
        </div>
    );
}
