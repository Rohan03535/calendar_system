-- =======================================================
-- CLEANUP PREVIOUS SCHEMA FOR RE-EXECUTION
-- =======================================================
BEGIN EXECUTE IMMEDIATE 'DROP TABLE EVENT_AUDIT_LOGS CASCADE CONSTRAINTS'; EXCEPTION WHEN OTHERS THEN NULL; END;
/
BEGIN EXECUTE IMMEDIATE 'DROP TABLE NOTIFICATIONS CASCADE CONSTRAINTS'; EXCEPTION WHEN OTHERS THEN NULL; END;
/
BEGIN EXECUTE IMMEDIATE 'DROP TABLE EVENT_EXCEPTIONS CASCADE CONSTRAINTS'; EXCEPTION WHEN OTHERS THEN NULL; END;
/
BEGIN EXECUTE IMMEDIATE 'DROP TABLE EVENT_INSTANCES CASCADE CONSTRAINTS'; EXCEPTION WHEN OTHERS THEN NULL; END;
/
BEGIN EXECUTE IMMEDIATE 'DROP TABLE RECURRENCE_RULES CASCADE CONSTRAINTS'; EXCEPTION WHEN OTHERS THEN NULL; END;
/
BEGIN EXECUTE IMMEDIATE 'DROP TABLE EVENT_PARTICIPANTS CASCADE CONSTRAINTS'; EXCEPTION WHEN OTHERS THEN NULL; END;
/
BEGIN EXECUTE IMMEDIATE 'DROP TABLE EVENTS CASCADE CONSTRAINTS'; EXCEPTION WHEN OTHERS THEN NULL; END;
/
BEGIN EXECUTE IMMEDIATE 'DROP TABLE EVENT_CATEGORIES CASCADE CONSTRAINTS'; EXCEPTION WHEN OTHERS THEN NULL; END;
/
BEGIN EXECUTE IMMEDIATE 'DROP TABLE USER_PREFERENCES CASCADE CONSTRAINTS'; EXCEPTION WHEN OTHERS THEN NULL; END;
/
BEGIN EXECUTE IMMEDIATE 'DROP TABLE USERS CASCADE CONSTRAINTS'; EXCEPTION WHEN OTHERS THEN NULL; END;
/

-- =======================================================
-- 10-TABLE CORE SCHEMA
-- =======================================================
-- Table 1: USERS
CREATE TABLE USERS (
    user_id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email VARCHAR2(255) UNIQUE NOT NULL,
    password_hash VARCHAR2(255) NOT NULL,
    full_name VARCHAR2(100) NOT NULL,
    timezone VARCHAR2(50) DEFAULT 'UTC',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP,
    is_active NUMBER(1) DEFAULT 1 CHECK (is_active IN (0, 1))
);

-- Table 2: USER_PREFERENCES
CREATE TABLE USER_PREFERENCES (
    pref_id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id NUMBER NOT NULL UNIQUE,
    email_notifications_enabled NUMBER(1) DEFAULT 1 CHECK (email_notifications_enabled IN (0,1)),
    CONSTRAINT pref_user_fk FOREIGN KEY (user_id) REFERENCES USERS(user_id) ON DELETE CASCADE
);

-- Table 3: EVENT_CATEGORIES
CREATE TABLE EVENT_CATEGORIES (
    category_id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    category_name VARCHAR2(100) NOT NULL UNIQUE,
    color_code VARCHAR2(7) DEFAULT '#3788d8'
);

-- Table 4: EVENTS
CREATE TABLE EVENTS (
    event_id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    creator_id NUMBER NOT NULL,
    category_id NUMBER,
    title VARCHAR2(200) NOT NULL,
    description VARCHAR2(4000),
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    location VARCHAR2(255),
    event_type VARCHAR2(50) DEFAULT 'personal' CHECK (event_type IN ('personal', 'meeting', 'appointment', 'reminder', 'shared')),
    is_recurring NUMBER(1) DEFAULT 0 CHECK (is_recurring IN (0, 1)),
    visibility VARCHAR2(50) DEFAULT 'private' CHECK (visibility IN ('private', 'public', 'shared')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT events_creator_fk FOREIGN KEY (creator_id) REFERENCES USERS(user_id) ON DELETE CASCADE,
    CONSTRAINT events_category_fk FOREIGN KEY (category_id) REFERENCES EVENT_CATEGORIES(category_id) ON DELETE SET NULL
);

-- Table 5: EVENT_PARTICIPANTS
CREATE TABLE EVENT_PARTICIPANTS (
    participant_id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    event_id NUMBER NOT NULL,
    user_id NUMBER NOT NULL,
    rsvp_status VARCHAR2(50) DEFAULT 'pending' CHECK (rsvp_status IN ('pending', 'accepted', 'declined', 'tentative')),
    invited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    responded_at TIMESTAMP,
    can_edit NUMBER(1) DEFAULT 0 CHECK (can_edit IN (0, 1)),
    CONSTRAINT part_event_fk FOREIGN KEY (event_id) REFERENCES EVENTS(event_id) ON DELETE CASCADE,
    CONSTRAINT part_user_fk FOREIGN KEY (user_id) REFERENCES USERS(user_id) ON DELETE CASCADE,
    CONSTRAINT unique_participant UNIQUE (event_id, user_id)
);

-- Table 6: RECURRENCE_RULES
CREATE TABLE RECURRENCE_RULES (
    recurrence_id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    event_id NUMBER NOT NULL UNIQUE,
    frequency VARCHAR2(50) NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly', 'yearly')),
    interval_val NUMBER DEFAULT 1,
    recurrence_start DATE NOT NULL,
    recurrence_end DATE,
    occurrence_count NUMBER,
    days_of_week VARCHAR2(20),
    day_of_month NUMBER,
    month_of_year NUMBER,
    CONSTRAINT rec_event_fk FOREIGN KEY (event_id) REFERENCES EVENTS(event_id) ON DELETE CASCADE
);

-- Table 7: EVENT_INSTANCES
CREATE TABLE EVENT_INSTANCES (
    instance_id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    event_id NUMBER NOT NULL,
    instance_start TIMESTAMP NOT NULL,
    instance_end TIMESTAMP NOT NULL,
    is_modified NUMBER(1) DEFAULT 0 CHECK (is_modified IN (0, 1)),
    is_cancelled NUMBER(1) DEFAULT 0 CHECK (is_cancelled IN (0, 1)),
    modification_note VARCHAR2(4000),
    CONSTRAINT inst_event_fk FOREIGN KEY (event_id) REFERENCES EVENTS(event_id) ON DELETE CASCADE
);

-- Table 8: EVENT_EXCEPTIONS
CREATE TABLE EVENT_EXCEPTIONS (
    exception_id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    instance_id NUMBER NOT NULL UNIQUE,
    new_start_time TIMESTAMP NOT NULL,
    new_end_time TIMESTAMP NOT NULL,
    exception_reason VARCHAR2(255),
    CONSTRAINT exc_inst_fk FOREIGN KEY (instance_id) REFERENCES EVENT_INSTANCES(instance_id) ON DELETE CASCADE
);

-- Table 9: NOTIFICATIONS
CREATE TABLE NOTIFICATIONS (
    notification_id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id NUMBER NOT NULL,
    event_id NUMBER NOT NULL,
    notification_type VARCHAR2(50) NOT NULL CHECK (notification_type IN ('invitation', 'reminder', 'update', 'cancellation', 'rsvp_change')),
    delivery_method VARCHAR2(50) DEFAULT 'email' CHECK (delivery_method IN ('email', 'system', 'both')),
    scheduled_time TIMESTAMP NOT NULL,
    sent_time TIMESTAMP,
    status VARCHAR2(50) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
    message_content VARCHAR2(4000),
    CONSTRAINT notif_user_fk FOREIGN KEY (user_id) REFERENCES USERS(user_id) ON DELETE CASCADE,
    CONSTRAINT notif_event_fk FOREIGN KEY (event_id) REFERENCES EVENTS(event_id) ON DELETE CASCADE
);

-- Table 10: EVENT_AUDIT_LOGS
CREATE TABLE EVENT_AUDIT_LOGS (
    log_id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    event_id NUMBER NOT NULL,
    action_type VARCHAR2(10) NOT NULL CHECK (action_type IN ('INSERT', 'UPDATE', 'DELETE')),
    old_title VARCHAR2(200),
    new_title VARCHAR2(200),
    changed_by VARCHAR2(100) DEFAULT 'System',
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- VIEWS --
CREATE OR REPLACE VIEW vw_full_schedule AS
SELECT i.instance_id, e.event_id, e.title, c.category_name, u.full_name AS creator,
       NVL(ex.new_start_time, i.instance_start) AS final_start,
       NVL(ex.new_end_time, i.instance_end) AS final_end
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

-- FUNCTIONS --
CREATE OR REPLACE FUNCTION fn_get_event_duration(p_instance_id IN NUMBER) RETURN NUMBER IS
    v_start TIMESTAMP;
    v_end TIMESTAMP;
    v_diff INTERVAL DAY TO SECOND;
BEGIN
    SELECT instance_start, instance_end INTO v_start, v_end 
    FROM EVENT_INSTANCES WHERE instance_id = p_instance_id;
    
    v_diff := v_end - v_start;
    
    RETURN ABS((EXTRACT(DAY FROM v_diff) * 1440) + 
               (EXTRACT(HOUR FROM v_diff) * 60) + 
               EXTRACT(MINUTE FROM v_diff));
END;
/

CREATE OR REPLACE FUNCTION fn_active_headcount(p_event_id IN NUMBER) RETURN NUMBER IS
    v_count NUMBER;
BEGIN
    SELECT COUNT(*) INTO v_count FROM EVENT_PARTICIPANTS WHERE event_id = p_event_id AND rsvp_status = 'accepted';
    RETURN v_count;
END;
/

-- TRIGGERS --
CREATE OR REPLACE TRIGGER trg_enforce_end_time
BEFORE INSERT OR UPDATE ON EVENTS
FOR EACH ROW
BEGIN
    IF :NEW.end_time <= :NEW.start_time THEN
        RAISE_APPLICATION_ERROR(-20001, 'Event End Time must be exactly chronologically after Start Time.');
    END IF;
    :NEW.updated_at := CURRENT_TIMESTAMP;
END;
/

CREATE OR REPLACE TRIGGER trg_log_event_update
AFTER UPDATE ON EVENTS
FOR EACH ROW
BEGIN
    IF :OLD.title != :NEW.title THEN
        INSERT INTO EVENT_AUDIT_LOGS (event_id, action_type, old_title, new_title)
        VALUES (:NEW.event_id, 'UPDATE', :OLD.title, :NEW.title);
    END IF;
END;
/

CREATE OR REPLACE TRIGGER After_Participant_Insert
AFTER INSERT ON EVENT_PARTICIPANTS
FOR EACH ROW
DECLARE
    v_event_title VARCHAR2(200);
    v_creator_name VARCHAR2(100);
BEGIN
    SELECT e.title, u.full_name INTO v_event_title, v_creator_name 
    FROM EVENTS e JOIN USERS u ON e.creator_id = u.user_id WHERE e.event_id = :NEW.event_id;
    
    INSERT INTO NOTIFICATIONS (user_id, event_id, notification_type, delivery_method, scheduled_time, message_content)
    VALUES (:NEW.user_id, :NEW.event_id, 'invitation', 'both', CURRENT_TIMESTAMP, v_creator_name || ' invited you to: ' || v_event_title);
END;
/

CREATE OR REPLACE TRIGGER After_Event_Insert
AFTER INSERT ON EVENTS
FOR EACH ROW
BEGIN
    IF :NEW.is_recurring = 0 THEN
        INSERT INTO EVENT_INSTANCES (event_id, instance_start, instance_end)
        VALUES (:NEW.event_id, :NEW.start_time, :NEW.end_time);
    END IF;
END;
/

-- PROCEDURES --
CREATE OR REPLACE PROCEDURE UpdateEventAndNotify(
    p_event_id IN NUMBER,
    p_title IN VARCHAR2,
    p_location IN VARCHAR2
)
IS
BEGIN
    UPDATE EVENTS SET title = p_title, location = p_location WHERE event_id = p_event_id;
    INSERT INTO NOTIFICATIONS (user_id, event_id, notification_type, scheduled_time, message_content)
    SELECT user_id, p_event_id, 'update', CURRENT_TIMESTAMP, 'UPDATE: "' || p_title || '" changed location/title.'
    FROM EVENT_PARTICIPANTS WHERE event_id = p_event_id AND rsvp_status != 'declined';
END;
/

-- DUMMY DATA --
INSERT INTO USERS (email, password_hash, full_name) VALUES ('alice@student.uni.edu', 'hashedpassword1', 'Alice Smith');
INSERT INTO USERS (email, password_hash, full_name) VALUES ('bob@student.uni.edu', 'hashedpassword2', 'Bob Jones');
INSERT INTO USERS (email, password_hash, full_name) VALUES ('charlie@student.uni.edu', 'hashedpassword3', 'Charlie Brown');

INSERT INTO EVENT_CATEGORIES (category_name, color_code) VALUES ('Work', '#d32f2f');
INSERT INTO EVENT_CATEGORIES (category_name, color_code) VALUES ('Personal', '#1976d2');
INSERT INTO EVENT_CATEGORIES (category_name, color_code) VALUES ('Urgent', '#fbc02d');

INSERT INTO USER_PREFERENCES (user_id, email_notifications_enabled) VALUES (1, 1);
INSERT INTO USER_PREFERENCES (user_id, email_notifications_enabled) VALUES (2, 1);
INSERT INTO USER_PREFERENCES (user_id, email_notifications_enabled) VALUES (3, 0);

COMMIT;
