import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = '/api';

export default function EventModal({ user, onClose, onSave }) {
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        start_time: '',
        end_time: '',
        location: '',
        event_type: 'meeting',
        recurrence_rule: 'NONE',
        r_end_date: '',
        invitees: []
    });
    const [allUsers, setAllUsers] = useState([]);

    useEffect(() => {
        axios.get(`${API_URL}/auth/users`).then(res => {
            setAllUsers(res.data.filter(u => u.id !== user.id));
        });
    }, [user]);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleInviteeChange = (e) => {
        const options = e.target.options;
        const value = [];
        for (let i = 0, l = options.length; i < l; i++) {
            if (options[i].selected) {
                // FIX: Parse to integer so Oracle gets NUMBER type
                value.push(parseInt(options[i].value, 10));
            }
        }
        setFormData({ ...formData, invitees: value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            // FIX: Map recurrence_rule to is_recurring + r_frequency + r_end_date
            const isRecurring = formData.recurrence_rule !== 'NONE';
            const payload = {
                title: formData.title,
                description: formData.description,
                start_time: formData.start_time,
                end_time: formData.end_time,
                location: formData.location || null,
                event_type: formData.event_type,
                creator_id: user.id,
                invitees: formData.invitees,
                is_recurring: isRecurring,
                r_frequency: isRecurring ? formData.recurrence_rule.toLowerCase() : null,
                r_end_date: isRecurring ? formData.r_end_date : null
            };

            await axios.post(`${API_URL}/events`, payload);
            onSave();
        } catch (err) {
            const msg = err.response?.data?.error || 'Error creating event';
            alert(msg);
        }
    };

    return (
        <div className="modal-overlay">
            <div className="modal">
                <h3>Create Event</h3>
                <form onSubmit={handleSubmit}>
                    <label>Title</label>
                    <input name="title" required onChange={handleChange} />

                    <label>Description</label>
                    <textarea name="description" onChange={handleChange} />

                    <label>Location</label>
                    <input name="location" placeholder="e.g. Room 302" onChange={handleChange} />

                    <label>Event Type</label>
                    <select name="event_type" onChange={handleChange} value={formData.event_type}>
                        <option value="meeting">Meeting</option>
                        <option value="personal">Personal</option>
                        <option value="appointment">Appointment</option>
                        <option value="reminder">Reminder</option>
                        <option value="shared">Shared</option>
                    </select>

                    <label>Start Time</label>
                    <input type="datetime-local" name="start_time" required onChange={handleChange} />

                    <label>End Time</label>
                    <input type="datetime-local" name="end_time" required onChange={handleChange} />

                    <label>Recurrence</label>
                    <select name="recurrence_rule" onChange={handleChange}>
                        <option value="NONE">None</option>
                        <option value="DAILY">Daily</option>
                        <option value="WEEKLY">Weekly</option>
                        <option value="MONTHLY">Monthly</option>
                    </select>

                    {formData.recurrence_rule !== 'NONE' && (
                        <>
                            <label>Recurrence End Date</label>
                            <input type="date" name="r_end_date" required onChange={handleChange} />
                        </>
                    )}

                    <label>Invite Users (Hold Ctrl to select multiple)</label>
                    <select multiple name="invitees" onChange={handleInviteeChange} style={{ height: '100px' }}>
                        {allUsers.map(u => (
                            <option key={u.id} value={u.id}>{u.username} ({u.email})</option>
                        ))}
                    </select>

                    <div className="modal-actions">
                        <button type="submit">Save</button>
                        <button type="button" onClick={onClose}>Cancel</button>
                    </div>
                </form>
            </div>
        </div>
    );
}
