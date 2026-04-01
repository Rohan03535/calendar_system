-- Database Schema for Multiuser Calendar System

-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL -- storing directly for simplicity as per 'simple gui/uni project' constraints, or could be hashed
);

-- Events Table
-- Tracks appointments and multioccurrence events.
-- 'recurrence_rule' can be 'NONE', 'DAILY', 'WEEKLY', 'MONTHLY'
CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    creator_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    start_time DATETIME NOT NULL,
    end_time DATETIME NOT NULL,
    recurrence_rule TEXT DEFAULT 'NONE',
    FOREIGN KEY (creator_id) REFERENCES users(id)
);

-- Event Attendees (Shared Events)
-- Links users to events. Updates to the main 'events' entry are reflected for all attendees.
CREATE TABLE IF NOT EXISTS event_attendees (
    event_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    status TEXT DEFAULT 'PENDING', -- PENDING, ACCEPTED, DECLINED
    PRIMARY KEY (event_id, user_id),
    FOREIGN KEY (event_id) REFERENCES events(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);
