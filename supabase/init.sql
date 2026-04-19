-- init.sql: schema and seed for Aero-Twin demo

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT
);

CREATE TABLE IF NOT EXISTS projects (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  owner_id INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS measurements (
  id SERIAL PRIMARY KEY,
  project_id INTEGER REFERENCES projects(id),
  key TEXT,
  value JSONB,
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bbox_sessions (
  id SERIAL PRIMARY KEY,
  session_uuid UUID DEFAULT uuid_generate_v4(),
  bbox JSONB,
  created_at TIMESTAMP DEFAULT now()
);

-- seed
INSERT INTO users (email, full_name) VALUES ('demo@local','Demo User') ON CONFLICT DO NOTHING;
