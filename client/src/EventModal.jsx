import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = 'http://localhost:5000/api';

export default function EventModal({ user, onClose, onSave }) {
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        start_time: '',
        end_time: '',
        recurrence_rule: 'NONE',
        invitees: []
    });
    const [allUsers, setAllUsers] = useState([]);

    useEffect(() => {
        // Fetch users for invitation list
        axios.get(`${API_URL}/users`).then(res => {
            // Exclude self
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
                value.push(options[i].value);
            }
        }
        setFormData({ ...formData, invitees: value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await axios.post(`${API_URL}/events`, {
                ...formData,
                creator_id: user.id
            });
            onSave();
        } catch (err) {
            alert('Error creating event');
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
