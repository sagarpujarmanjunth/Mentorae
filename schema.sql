-- Mentorae Database Schema
-- This file defines the database structure for the Mentorae mentoring platform

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enable RLS globally
ALTER DATABASE postgres SET row_security = on;

-- Custom types
CREATE TYPE user_role AS ENUM ('student', 'mentor', 'admin');
CREATE TYPE session_status AS ENUM ('scheduled', 'in_progress', 'completed', 'cancelled', 'no_show');
CREATE TYPE payment_status AS ENUM ('pending', 'completed', 'failed', 'refunded');

-- Users table (both students and mentors)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role user_role NOT NULL DEFAULT 'student',
    phone VARCHAR(20),
    timezone VARCHAR(50) DEFAULT 'UTC',
    profile_image_url TEXT,
    bio TEXT,
    is_verified BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login TIMESTAMP WITH TIME ZONE
);

-- Mentor profiles (extended information for mentors)
CREATE TABLE mentor_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(200),
    years_of_experience INTEGER,
    hourly_rate DECIMAL(10, 2),
    availability_schedule JSONB, -- Store weekly availability as JSON
    linkedin_url VARCHAR(255),
    github_url VARCHAR(255),
    portfolio_url VARCHAR(255),
    is_approved BOOLEAN DEFAULT FALSE,
    approval_date TIMESTAMP WITH TIME ZONE,
    rating DECIMAL(3, 2) DEFAULT 0.00,
    total_sessions INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Skills/Technologies table
CREATE TABLE skills (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    category VARCHAR(100),
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Junction table for mentor skills
CREATE TABLE mentor_skills (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mentor_id UUID REFERENCES mentor_profiles(id) ON DELETE CASCADE,
    skill_id UUID REFERENCES skills(id) ON DELETE CASCADE,
    proficiency_level INTEGER CHECK (proficiency_level >= 1 AND proficiency_level <= 5),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(mentor_id, skill_id)
);

-- Mentoring sessions
CREATE TABLE mentoring_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mentor_id UUID REFERENCES mentor_profiles(id) ON DELETE CASCADE,
    student_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    scheduled_start TIMESTAMP WITH TIME ZONE NOT NULL,
    scheduled_end TIMESTAMP WITH TIME ZONE NOT NULL,
    actual_start TIMESTAMP WITH TIME ZONE,
    actual_end TIMESTAMP WITH TIME ZONE,
    status session_status DEFAULT 'scheduled',
    meeting_url VARCHAR(500), -- For video call links
    session_notes TEXT,
    mentor_feedback TEXT,
    student_feedback TEXT,
    price DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Session ratings and reviews
CREATE TABLE session_reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES mentoring_sessions(id) ON DELETE CASCADE,
    reviewer_id UUID REFERENCES users(id) ON DELETE CASCADE,
    reviewee_id UUID REFERENCES users(id) ON DELETE CASCADE,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    review_text TEXT,
    is_public BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Payments table
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES mentoring_sessions(id) ON DELETE CASCADE,
    payer_id UUID REFERENCES users(id) ON DELETE CASCADE,
    amount DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    status payment_status DEFAULT 'pending',
    payment_method VARCHAR(50),
    stripe_payment_intent_id VARCHAR(255),
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Messages between users
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sender_id UUID REFERENCES users(id) ON DELETE CASCADE,
    recipient_id UUID REFERENCES users(id) ON DELETE CASCADE,
    session_id UUID REFERENCES mentoring_sessions(id) ON DELETE SET NULL,
    subject VARCHAR(200),
    content TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Notifications
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50), -- 'session_reminder', 'payment_received', 'new_message', etc.
    is_read BOOLEAN DEFAULT FALSE,
    action_url VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User authentication tokens (for password reset, email verification, etc.)
CREATE TABLE auth_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) UNIQUE NOT NULL,
    token_type VARCHAR(50) NOT NULL, -- 'password_reset', 'email_verification'
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_mentor_profiles_user_id ON mentor_profiles(user_id);
CREATE INDEX idx_mentor_profiles_is_approved ON mentor_profiles(is_approved);
CREATE INDEX idx_mentoring_sessions_mentor_id ON mentoring_sessions(mentor_id);
CREATE INDEX idx_mentoring_sessions_student_id ON mentoring_sessions(student_id);
CREATE INDEX idx_mentoring_sessions_status ON mentoring_sessions(status);
CREATE INDEX idx_mentoring_sessions_scheduled_start ON mentoring_sessions(scheduled_start);
CREATE INDEX idx_messages_sender_id ON messages(sender_id);
CREATE INDEX idx_messages_recipient_id ON messages(recipient_id);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at columns
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_mentor_profiles_updated_at BEFORE UPDATE ON mentor_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_mentoring_sessions_updated_at BEFORE UPDATE ON mentoring_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_session_reviews_updated_at BEFORE UPDATE ON session_reviews
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_messages_updated_at BEFORE UPDATE ON messages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE mentor_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE mentoring_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
-- Also enable RLS on other important tables
ALTER TABLE skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE mentor_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_tokens ENABLE ROW LEVEL SECURITY;

-- Skills can be viewed by everyone (they're public reference data)
CREATE POLICY "Anyone can view skills" ON skills
    FOR SELECT USING (true);

-- Mentor skills can be viewed if the mentor profile is public
CREATE POLICY "Public mentor skills viewable" ON mentor_skills
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM mentor_profiles mp 
            WHERE mp.id = mentor_id AND mp.is_approved = true
        )
    );

-- Mentors can manage their own skills
CREATE POLICY "Mentors can manage own skills" ON mentor_skills
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM mentor_profiles mp 
            WHERE mp.id = mentor_id AND mp.user_id = auth.uid()::uuid
        )
    );

-- Users can only access their own auth tokens
CREATE POLICY "Users can access own auth tokens" ON auth_tokens
    FOR ALL USING (auth.uid()::uuid = user_id);

-- Basic RLS policies (you may need to adjust these based on your auth setup)
-- Users can read their own data
CREATE POLICY "Users can view own profile" ON users
    FOR SELECT USING (auth.uid()::uuid = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON users
    FOR UPDATE USING (auth.uid()::uuid = id);

-- Mentors can read their own mentor profile
CREATE POLICY "Mentors can view own profile" ON mentor_profiles
    FOR SELECT USING (auth.uid()::uuid = user_id);

-- Anyone can view approved mentor profiles
CREATE POLICY "Anyone can view approved mentors" ON mentor_profiles
    FOR SELECT USING (is_approved = true);

-- Sessions are visible to participants
CREATE POLICY "Session participants can view sessions" ON mentoring_sessions
    FOR SELECT USING (
        auth.uid()::uuid = student_id OR 
        auth.uid()::uuid IN (SELECT user_id FROM mentor_profiles WHERE id = mentor_id)
    );

-- Additional RLS policies for complete CRUD operations
-- Allow users to insert their own data
CREATE POLICY "Users can insert own profile" ON users
    FOR INSERT WITH CHECK (auth.uid()::uuid = id);

-- Allow mentors to insert their own mentor profile
CREATE POLICY "Mentors can insert own profile" ON mentor_profiles
    FOR INSERT WITH CHECK (auth.uid()::uuid = user_id);

-- Allow mentors to update their own mentor profile
CREATE POLICY "Mentors can update own profile" ON mentor_profiles
    FOR UPDATE USING (auth.uid()::uuid = user_id);

-- Allow session participants to insert/update sessions
CREATE POLICY "Session participants can insert sessions" ON mentoring_sessions
    FOR INSERT WITH CHECK (
        auth.uid()::uuid = student_id OR 
        auth.uid()::uuid IN (SELECT user_id FROM mentor_profiles WHERE id = mentor_id)
    );

CREATE POLICY "Session participants can update sessions" ON mentoring_sessions
    FOR UPDATE USING (
        auth.uid()::uuid = student_id OR 
        auth.uid()::uuid IN (SELECT user_id FROM mentor_profiles WHERE id = mentor_id)
    );

-- Allow users to view/insert/update their own messages
CREATE POLICY "Users can view own messages" ON messages
    FOR SELECT USING (auth.uid()::uuid = sender_id OR auth.uid()::uuid = recipient_id);

CREATE POLICY "Users can send messages" ON messages
    FOR INSERT WITH CHECK (auth.uid()::uuid = sender_id);

CREATE POLICY "Users can update own sent messages" ON messages
    FOR UPDATE USING (auth.uid()::uuid = sender_id);

-- Allow users to view/insert their own notifications
CREATE POLICY "Users can view own notifications" ON notifications
    FOR SELECT USING (auth.uid()::uuid = user_id);

CREATE POLICY "Users can update own notifications" ON notifications
    FOR UPDATE USING (auth.uid()::uuid = user_id);

-- Allow users to view their own payments
CREATE POLICY "Users can view own payments" ON payments
    FOR SELECT USING (auth.uid()::uuid = payer_id);

-- Allow users to view/insert reviews for sessions they participated in
CREATE POLICY "Participants can view session reviews" ON session_reviews
    FOR SELECT USING (
        auth.uid()::uuid = reviewer_id OR 
        auth.uid()::uuid = reviewee_id OR
        EXISTS (
            SELECT 1 FROM mentoring_sessions ms 
            WHERE ms.id = session_id AND 
            (ms.student_id = auth.uid()::uuid OR 
             ms.mentor_id IN (SELECT id FROM mentor_profiles WHERE user_id = auth.uid()::uuid))
        )
    );

CREATE POLICY "Participants can insert session reviews" ON session_reviews
    FOR INSERT WITH CHECK (
        auth.uid()::uuid = reviewer_id AND
        EXISTS (
            SELECT 1 FROM mentoring_sessions ms 
            WHERE ms.id = session_id AND 
            (ms.student_id = auth.uid()::uuid OR 
             ms.mentor_id IN (SELECT id FROM mentor_profiles WHERE user_id = auth.uid()::uuid))
        )
    );

-- Insert some sample skills
INSERT INTO skills (name, category, description) VALUES
    ('JavaScript', 'Programming Languages', 'Modern JavaScript development including ES6+'),
    ('Python', 'Programming Languages', 'Python programming for web development, data science, and automation'),
    ('React', 'Frontend Frameworks', 'React.js for building user interfaces'),
    ('Node.js', 'Backend Technologies', 'Server-side JavaScript development'),
    ('SQL', 'Database', 'Structured Query Language for database management'),
    ('Git', 'Development Tools', 'Version control with Git'),
    ('Docker', 'DevOps', 'Containerization and deployment'),
    ('AWS', 'Cloud Platforms', 'Amazon Web Services cloud computing'),
    ('Machine Learning', 'Data Science', 'ML algorithms and model development'),
    ('UI/UX Design', 'Design', 'User interface and user experience design');