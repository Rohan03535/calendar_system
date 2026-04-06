-- =======================================================
-- CLEANUP PREVIOUS SCHEMA FOR RE-EXECUTION
-- =======================================================
DROP TABLE IF EXISTS PARTICIPANT_OVERRIDES CASCADE;
DROP TABLE IF EXISTS EVENT_AUDIT_LOGS CASCADE;
DROP TABLE IF EXISTS NOTIFICATIONS CASCADE;
DROP TABLE IF EXISTS EVENT_EXCEPTIONS CASCADE;
DROP TABLE IF EXISTS EVENT_INSTANCES CASCADE;
DROP TABLE IF EXISTS RECURRENCE_RULES CASCADE;
DROP TABLE IF EXISTS EVENT_PARTICIPANTS CASCADE;
DROP TABLE IF EXISTS EVENTS CASCADE;
DROP TABLE IF EXISTS EVENT_CATEGORIES CASCADE;
DROP TABLE IF EXISTS USER_PREFERENCES CASCADE;
DROP TABLE IF EXISTS USERS CASCADE;

DROP FUNCTION IF EXISTS fn_get_event_duration CASCADE;
DROP FUNCTION IF EXISTS fn_active_headcount CASCADE;
DROP FUNCTION IF EXISTS sp_cancel_event CASCADE;
DROP FUNCTION IF EXISTS UpdateEventAndNotify CASCADE;
DROP FUNCTION IF EXISTS trg_enforce_end_time_func CASCADE;
DROP FUNCTION IF EXISTS trg_log_event_update_func CASCADE;
DROP FUNCTION IF EXISTS After_Participant_Insert_func CASCADE;
DROP FUNCTION IF EXISTS After_Event_Insert_func CASCADE;
DROP FUNCTION IF EXISTS trg_notify_host_rsvp_func CASCADE;

-- =======================================================
-- 10-TABLE CORE SCHEMA
-- =======================================================
-- Table 1: USERS
CREATE TABLE USERS (
    user_id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    timezone VARCHAR(50) DEFAULT 'UTC',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP,
    is_active SMALLINT DEFAULT 1 CHECK (is_active IN (0, 1))
);

-- Table 2: USER_PREFERENCES
CREATE TABLE USER_PREFERENCES (
    pref_id SERIAL PRIMARY KEY,
    user_id INT NOT NULL UNIQUE,
    email_notifications_enabled SMALLINT DEFAULT 1 CHECK (email_notifications_enabled IN (0,1)),
    CONSTRAINT pref_user_fk FOREIGN KEY (user_id) REFERENCES USERS(user_id) ON DELETE CASCADE
);

-- Table 3: EVENT_CATEGORIES
CREATE TABLE EVENT_CATEGORIES (
    category_id SERIAL PRIMARY KEY,
    category_name VARCHAR(100) NOT NULL UNIQUE,
    color_code VARCHAR(7) DEFAULT '#3788d8'
);

-- Table 4: EVENTS
CREATE TABLE EVENTS (
    event_id SERIAL PRIMARY KEY,
    creator_id INT NOT NULL,
    category_id INT,
    title VARCHAR(200) NOT NULL,
    description VARCHAR(4000),
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    location VARCHAR(255),
    event_type VARCHAR(50) DEFAULT 'personal' CHECK (event_type IN ('personal', 'meeting', 'appointment', 'reminder', 'shared')),
    is_recurring SMALLINT DEFAULT 0 CHECK (is_recurring IN (0, 1)),
    visibility VARCHAR(50) DEFAULT 'private' CHECK (visibility IN ('private', 'public', 'shared')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT events_creator_fk FOREIGN KEY (creator_id) REFERENCES USERS(user_id) ON DELETE CASCADE,
    CONSTRAINT events_category_fk FOREIGN KEY (category_id) REFERENCES EVENT_CATEGORIES(category_id) ON DELETE SET NULL
);

-- Table 5: EVENT_PARTICIPANTS
CREATE TABLE EVENT_PARTICIPANTS (
    participant_id SERIAL PRIMARY KEY,
    event_id INT NOT NULL,
    user_id INT NOT NULL,
    rsvp_status VARCHAR(50) DEFAULT 'pending' CHECK (rsvp_status IN ('pending', 'accepted', 'declined', 'tentative')),
    invited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    responded_at TIMESTAMP,
    can_edit SMALLINT DEFAULT 0 CHECK (can_edit IN (0, 1)),
    CONSTRAINT part_event_fk FOREIGN KEY (event_id) REFERENCES EVENTS(event_id) ON DELETE CASCADE,
    CONSTRAINT part_user_fk FOREIGN KEY (user_id) REFERENCES USERS(user_id) ON DELETE CASCADE,
    CONSTRAINT unique_participant UNIQUE (event_id, user_id)
);

-- Table 6: RECURRENCE_RULES
CREATE TABLE RECURRENCE_RULES (
    recurrence_id SERIAL PRIMARY KEY,
    event_id INT NOT NULL UNIQUE,
    frequency VARCHAR(50) NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly', 'yearly')),
    interval_val INT DEFAULT 1,
    recurrence_start DATE NOT NULL,
    recurrence_end DATE,
    occurrence_count INT,
    days_of_week VARCHAR(20),
    day_of_month INT,
    month_of_year INT,
    CONSTRAINT rec_event_fk FOREIGN KEY (event_id) REFERENCES EVENTS(event_id) ON DELETE CASCADE
);

-- Table 7: EVENT_INSTANCES
CREATE TABLE EVENT_INSTANCES (
    instance_id SERIAL PRIMARY KEY,
    event_id INT NOT NULL,
    instance_start TIMESTAMP NOT NULL,
    instance_end TIMESTAMP NOT NULL,
    is_modified SMALLINT DEFAULT 0 CHECK (is_modified IN (0, 1)),
    is_cancelled SMALLINT DEFAULT 0 CHECK (is_cancelled IN (0, 1)),
    modification_note VARCHAR(4000),
    CONSTRAINT inst_event_fk FOREIGN KEY (event_id) REFERENCES EVENTS(event_id) ON DELETE CASCADE
);

-- Table 8: EVENT_EXCEPTIONS
CREATE TABLE EVENT_EXCEPTIONS (
    exception_id SERIAL PRIMARY KEY,
    instance_id INT NOT NULL UNIQUE,
    new_start_time TIMESTAMP NOT NULL,
    new_end_time TIMESTAMP NOT NULL,
    exception_reason VARCHAR(255),
    CONSTRAINT exc_inst_fk FOREIGN KEY (instance_id) REFERENCES EVENT_INSTANCES(instance_id) ON DELETE CASCADE
);

-- Table 9: NOTIFICATIONS
CREATE TABLE NOTIFICATIONS (
    notification_id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    event_id INT NOT NULL,
    notification_type VARCHAR(50) NOT NULL CHECK (notification_type IN ('invitation', 'reminder', 'update', 'cancellation', 'rsvp_change')),
    delivery_method VARCHAR(50) DEFAULT 'email' CHECK (delivery_method IN ('email', 'system', 'both')),
    scheduled_time TIMESTAMP NOT NULL,
    sent_time TIMESTAMP,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
    message_content VARCHAR(4000),
    CONSTRAINT notif_user_fk FOREIGN KEY (user_id) REFERENCES USERS(user_id) ON DELETE CASCADE,
    CONSTRAINT notif_event_fk FOREIGN KEY (event_id) REFERENCES EVENTS(event_id) ON DELETE CASCADE
);

-- Table 10: EVENT_AUDIT_LOGS
CREATE TABLE EVENT_AUDIT_LOGS (
    log_id SERIAL PRIMARY KEY,
    event_id INT NOT NULL,
    action_type VARCHAR(10) NOT NULL CHECK (action_type IN ('INSERT', 'UPDATE', 'DELETE')),
    old_title VARCHAR(200),
    new_title VARCHAR(200),
    changed_by VARCHAR(100) DEFAULT 'System',
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table 11: PARTICIPANT_OVERRIDES
CREATE TABLE PARTICIPANT_OVERRIDES (
    override_id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    instance_id INT NOT NULL,
    status VARCHAR(50) DEFAULT 'declined' CHECK (status IN ('pending', 'accepted', 'declined')),
    overridden_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT over_user_fk FOREIGN KEY (user_id) REFERENCES USERS(user_id) ON DELETE CASCADE,
    CONSTRAINT over_inst_fk FOREIGN KEY (instance_id) REFERENCES EVENT_INSTANCES(instance_id) ON DELETE CASCADE,
    CONSTRAINT unique_override UNIQUE (user_id, instance_id)
);

-- VIEWS --
CREATE OR REPLACE VIEW vw_full_schedule AS
SELECT i.instance_id, e.event_id, e.title, c.category_name, u.full_name AS creator,
       COALESCE(ex.new_start_time, i.instance_start) AS final_start,
       COALESCE(ex.new_end_time, i.instance_end) AS final_end
FROM EVENT_INSTANCES i
JOIN EVENTS e ON i.event_id = e.event_id
JOIN USERS u ON e.creator_id = u.user_id
LEFT JOIN EVENT_CATEGORIES c ON e.category_id = c.category_id
LEFT JOIN EVENT_EXCEPTIONS ex ON i.instance_id = ex.instance_id
WHERE i.is_cancelled = 0;

CREATE OR REPLACE VIEW vw_participant_roster AS
SELECT e.event_id, e.title,
       COUNT(CASE WHEN p.rsvp_status = 'accepted' THEN 1 END) AS accepted_count,
       COUNT(CASE WHEN p.rsvp_status = 'pending' THEN 1 END) AS pending_count,
       COUNT(CASE WHEN p.rsvp_status = 'declined' THEN 1 END) AS declined_count
FROM EVENTS e
LEFT JOIN EVENT_PARTICIPANTS p ON e.event_id = p.event_id
GROUP BY e.event_id, e.title;

CREATE OR REPLACE VIEW vw_user_attendance_stats AS
WITH ParticipationCounts AS (
    SELECT 
        u.user_id,
        u.full_name,
        COUNT(p.event_id) as total_invites,
        SUM(CASE WHEN p.rsvp_status = 'accepted' THEN 1 ELSE 0 END) as accepted_count,
        SUM(CASE WHEN p.rsvp_status = 'declined' THEN 1 ELSE 0 END) as declined_count
    FROM USERS u
    LEFT JOIN EVENT_PARTICIPANTS p ON u.user_id = p.user_id
    GROUP BY u.user_id, u.full_name
)
SELECT 
    pc.user_id,
    pc.full_name,
    pc.total_invites,
    pc.accepted_count,
    pc.declined_count,
    CASE 
        WHEN pc.total_invites = 0 THEN 0 
        ELSE ROUND((pc.accepted_count::numeric / pc.total_invites) * 100, 2) 
    END as attendance_rate
FROM ParticipationCounts pc;

-- FUNCTIONS --
CREATE OR REPLACE FUNCTION fn_get_event_duration(p_instance_id INT) RETURNS INT AS $$
DECLARE
    v_start TIMESTAMP;
    v_end TIMESTAMP;
    v_diff INTERVAL;
BEGIN
    SELECT instance_start, instance_end INTO v_start, v_end 
    FROM EVENT_INSTANCES WHERE instance_id = p_instance_id;
    
    v_diff := v_end - v_start;
    
    RETURN ABS(EXTRACT(EPOCH FROM v_diff) / 60);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION fn_active_headcount(p_event_id INT) RETURNS INT AS $$
DECLARE
    v_count INT;
BEGIN
    SELECT COUNT(*) INTO v_count FROM EVENT_PARTICIPANTS WHERE event_id = p_event_id AND rsvp_status = 'accepted';
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- TRIGGERS --
CREATE OR REPLACE FUNCTION trg_enforce_end_time_func() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.end_time <= NEW.start_time THEN
        RAISE EXCEPTION 'Event End Time must be exactly chronologically after Start Time.';
    END IF;
    NEW.updated_at := CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_enforce_end_time
BEFORE INSERT OR UPDATE ON EVENTS
FOR EACH ROW
EXECUTE FUNCTION trg_enforce_end_time_func();


CREATE OR REPLACE FUNCTION trg_log_event_update_func() RETURNS TRIGGER AS $$
BEGIN
    IF OLD.title != NEW.title THEN
        INSERT INTO EVENT_AUDIT_LOGS (event_id, action_type, old_title, new_title)
        VALUES (NEW.event_id, 'UPDATE', OLD.title, NEW.title);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_log_event_update
AFTER UPDATE ON EVENTS
FOR EACH ROW
EXECUTE FUNCTION trg_log_event_update_func();


CREATE OR REPLACE FUNCTION After_Participant_Insert_func() RETURNS TRIGGER AS $$
DECLARE
    v_event_title VARCHAR(200);
    v_event_desc  VARCHAR(4000);
    v_creator_name VARCHAR(100);
BEGIN
    SELECT e.title, COALESCE(e.description, 'No description'), u.full_name 
    INTO v_event_title, v_event_desc, v_creator_name 
    FROM EVENTS e JOIN USERS u ON e.creator_id = u.user_id 
    WHERE e.event_id = NEW.event_id;
    
    INSERT INTO NOTIFICATIONS (user_id, event_id, notification_type, delivery_method, scheduled_time, message_content)
    VALUES (NEW.user_id, NEW.event_id, 'invitation', 'both', CURRENT_TIMESTAMP, 
            v_creator_name || ' invited you to: **' || v_event_title || '**' || E'\n' || 'Note: ' || v_event_desc);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER After_Participant_Insert
AFTER INSERT ON EVENT_PARTICIPANTS
FOR EACH ROW
EXECUTE FUNCTION After_Participant_Insert_func();


CREATE OR REPLACE FUNCTION After_Event_Insert_func() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_recurring = 0 THEN
        INSERT INTO EVENT_INSTANCES (event_id, instance_start, instance_end)
        VALUES (NEW.event_id, NEW.start_time, NEW.end_time);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER After_Event_Insert
AFTER INSERT ON EVENTS
FOR EACH ROW
EXECUTE FUNCTION After_Event_Insert_func();

CREATE OR REPLACE FUNCTION trg_notify_host_rsvp_func() RETURNS TRIGGER AS $$
DECLARE
    v_creator_id INT;
    v_event_title VARCHAR(200);
    v_user_name VARCHAR(100);
BEGIN
    SELECT creator_id, title INTO v_creator_id, v_event_title FROM EVENTS WHERE event_id = NEW.event_id;
    SELECT full_name INTO v_user_name FROM USERS WHERE user_id = NEW.user_id;
    
    -- ONLY notify if it's a REAL change to accepted or declined
    IF OLD.rsvp_status != NEW.rsvp_status AND v_creator_id != NEW.user_id THEN
        INSERT INTO NOTIFICATIONS (user_id, event_id, notification_type, scheduled_time, message_content)
        VALUES (v_creator_id, NEW.event_id, 'rsvp_change', CURRENT_TIMESTAMP, 
                v_user_name || ' has ' || NEW.rsvp_status || ' your meeting: "' || v_event_title || '"');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_notify_host_rsvp
AFTER UPDATE OF rsvp_status ON EVENT_PARTICIPANTS
FOR EACH ROW
EXECUTE FUNCTION trg_notify_host_rsvp_func();

-- =======================================================
-- ADDED FEATURES FOR ACADEMIC LOGIC
-- =======================================================

CREATE OR REPLACE FUNCTION sp_cancel_event(
    p_event_id INT,
    p_instance_id INT,
    p_user_id INT
) RETURNS VOID AS $$
DECLARE
    v_creator_id INT;
    v_event_title VARCHAR(200);
    v_canceller_name VARCHAR(100);
    v_instance_date VARCHAR(50);
BEGIN
    SELECT creator_id, title INTO v_creator_id, v_event_title FROM EVENTS WHERE event_id = p_event_id;
    SELECT full_name INTO v_canceller_name FROM USERS WHERE user_id = p_user_id;

    IF p_instance_id IS NOT NULL THEN
        SELECT TO_CHAR(instance_start, 'DD Mon YYYY, HH:MI AM') INTO v_instance_date 
        FROM EVENT_INSTANCES WHERE instance_id = p_instance_id;
    END IF;

    IF v_creator_id = p_user_id THEN
        -- Case 1: Host cancels
        IF p_instance_id IS NOT NULL THEN
            UPDATE EVENT_INSTANCES SET is_cancelled = 1 WHERE instance_id = p_instance_id;
            
            INSERT INTO NOTIFICATIONS (user_id, event_id, notification_type, scheduled_time, message_content)
            SELECT user_id, p_event_id, 'cancellation', CURRENT_TIMESTAMP, 
                   v_canceller_name || ' (Host) cancelled "' || v_event_title || '" on ' || v_instance_date
            FROM EVENT_PARTICIPANTS WHERE event_id = p_event_id;
            
            INSERT INTO NOTIFICATIONS (user_id, event_id, notification_type, scheduled_time, message_content)
            VALUES (v_creator_id, p_event_id, 'cancellation', CURRENT_TIMESTAMP, 
                    'You cancelled your meeting "' || v_event_title || '" on ' || v_instance_date);
        ELSE
            UPDATE EVENT_INSTANCES SET is_cancelled = 1 WHERE event_id = p_event_id;
            
            INSERT INTO NOTIFICATIONS (user_id, event_id, notification_type, scheduled_time, message_content)
            SELECT user_id, p_event_id, 'cancellation', CURRENT_TIMESTAMP, 
                   v_canceller_name || ' (Host) cancelled the entire meeting series: "' || v_event_title || '"'
            FROM EVENT_PARTICIPANTS WHERE event_id = p_event_id;
            
            INSERT INTO NOTIFICATIONS (user_id, event_id, notification_type, scheduled_time, message_content)
            VALUES (v_creator_id, p_event_id, 'cancellation', CURRENT_TIMESTAMP, 
                    'You cancelled your meeting series: "' || v_event_title || '"');
        END IF;
    ELSE
        -- Case 2: Invitee cancels/declines
        IF p_instance_id IS NOT NULL THEN
            INSERT INTO PARTICIPANT_OVERRIDES (user_id, instance_id, status) 
            VALUES (p_user_id, p_instance_id, 'declined')
            ON CONFLICT (user_id, instance_id) 
            DO UPDATE SET status = 'declined', overridden_at = CURRENT_TIMESTAMP;

            INSERT INTO NOTIFICATIONS (user_id, event_id, notification_type, scheduled_time, message_content)
            SELECT p.user_id, p_event_id, 'update', CURRENT_TIMESTAMP, 
                   v_canceller_name || ' will not attend "' || v_event_title || '" on ' || v_instance_date
            FROM EVENT_PARTICIPANTS p
            WHERE p.event_id = p_event_id 
              AND p.user_id != p_user_id 
              AND p.rsvp_status = 'accepted';
              
            INSERT INTO NOTIFICATIONS (user_id, event_id, notification_type, scheduled_time, message_content)
            VALUES (v_creator_id, p_event_id, 'update', CURRENT_TIMESTAMP, 
                    v_canceller_name || ' will not attend "' || v_event_title || '" on ' || v_instance_date);
        ELSE
            UPDATE EVENT_PARTICIPANTS SET rsvp_status = 'declined', responded_at = CURRENT_TIMESTAMP 
            WHERE event_id = p_event_id AND user_id = p_user_id;

            INSERT INTO NOTIFICATIONS (user_id, event_id, notification_type, scheduled_time, message_content)
            SELECT p.user_id, p_event_id, 'update', CURRENT_TIMESTAMP, 
                   v_canceller_name || ' has left the meeting series: "' || v_event_title || '"'
            FROM EVENT_PARTICIPANTS p
            WHERE p.event_id = p_event_id 
              AND p.user_id != p_user_id 
              AND p.rsvp_status = 'accepted';
            
            INSERT INTO NOTIFICATIONS (user_id, event_id, notification_type, scheduled_time, message_content)
            VALUES (v_creator_id, p_event_id, 'update', CURRENT_TIMESTAMP, 
                    v_canceller_name || ' has left your meeting series: "' || v_event_title || '"');
        END IF;
    END IF;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION UpdateEventAndNotify(
    p_event_id INT,
    p_title VARCHAR,
    p_location VARCHAR
) RETURNS VOID AS $$
BEGIN
    UPDATE EVENTS SET title = p_title, location = p_location, updated_at = CURRENT_TIMESTAMP 
    WHERE event_id = p_event_id;
    
    INSERT INTO NOTIFICATIONS (user_id, event_id, notification_type, scheduled_time, message_content)
    SELECT user_id, p_event_id, 'update', CURRENT_TIMESTAMP, 'Meeting Update: "' || p_title || '" at ' || COALESCE(p_location, 'TBD')
    FROM EVENT_PARTICIPANTS 
    WHERE event_id = p_event_id AND rsvp_status = 'accepted';
END;
$$ LANGUAGE plpgsql;

-- =======================================================
-- CURSOR IMPLEMENTATION (System Maintenance)
-- =======================================================
CREATE OR REPLACE FUNCTION sp_auto_decline_past_invites() RETURNS INT AS $$
DECLARE
    -- Explicit Cursor Declaration
    cur_pending CURSOR FOR 
        SELECT p.participant_id, p.user_id, p.event_id, e.title
        FROM EVENT_PARTICIPANTS p
        JOIN EVENTS e ON p.event_id = e.event_id
        WHERE p.rsvp_status = 'pending' AND e.start_time < (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata');
    
    v_record RECORD;
    v_count INT := 0;
BEGIN
    OPEN cur_pending;
    LOOP
        FETCH cur_pending INTO v_record;
        EXIT WHEN NOT FOUND;
        
        -- 1. Auto decline the expired invitation
        UPDATE EVENT_PARTICIPANTS 
        SET rsvp_status = 'declined', responded_at = CURRENT_TIMESTAMP 
        WHERE participant_id = v_record.participant_id;
        
        -- 2. Notify the user that the system auto-declined it
        INSERT INTO NOTIFICATIONS (user_id, event_id, notification_type, scheduled_time, message_content)
        VALUES (v_record.user_id, v_record.event_id, 'update', CURRENT_TIMESTAMP, 
                'System auto-declined your expired invitation for: "' || v_record.title || '"');
                
        v_count := v_count + 1;
    END LOOP;
    CLOSE cur_pending;
    
    RETURN v_count; -- Returns how many records the cursor processed
END;
$$ LANGUAGE plpgsql;

-- =======================================================
-- SEED DATA 
-- =======================================================
INSERT INTO USERS (email, password_hash, full_name) VALUES ('alice@student.uni.edu', 'oracle', 'Alice Smith');
INSERT INTO USERS (email, password_hash, full_name) VALUES ('bob@student.uni.edu', 'oracle', 'Bob Jones');
INSERT INTO USERS (email, password_hash, full_name) VALUES ('charlie@student.uni.edu', 'oracle', 'Charlie Brown');

INSERT INTO EVENT_CATEGORIES (category_name, color_code) VALUES ('Work', '#2f81f7');
INSERT INTO EVENT_CATEGORIES (category_name, color_code) VALUES ('Uni', '#a371f7');
INSERT INTO EVENT_CATEGORIES (category_name, color_code) VALUES ('Personal', '#2ea043');

INSERT INTO EVENTS (creator_id, category_id, title, description, start_time, end_time, event_type)
SELECT u.user_id, c.category_id, 'DBS Project Presentation', 'Final evaluation in Room 302', 
       CURRENT_TIMESTAMP + INTERVAL '1 day', CURRENT_TIMESTAMP + INTERVAL '1 day' + INTERVAL '1 hour', 'shared'
FROM USERS u, EVENT_CATEGORIES c WHERE u.email = 'alice@student.uni.edu' AND c.category_name = 'Uni';
