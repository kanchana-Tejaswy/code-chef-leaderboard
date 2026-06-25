# ACE CODECHEF TALENT LEADERBOARD

## Project Overview

ACE CodeChef Talent Leaderboard is the first phase of a much larger vision called the Student Talent Intelligence Platform.

The long-term vision is to build a comprehensive student talent discovery ecosystem that evaluates students based on real skills, achievements, coding performance, projects, leadership abilities, extracurricular activities, certifications, and career readiness rather than relying solely on CGPA and academic scores.

However, for the initial version, the platform will focus exclusively on CodeChef competitive programming performance.

This MVP will demonstrate the core concept of automated talent discovery using verified external data sources.

---

# Problem Statement

Most colleges evaluate students using:

* CGPA
* Attendance
* Internal Marks
* Semester Results

These metrics often fail to identify students who possess strong problem-solving abilities and competitive programming skills.

Many highly talented students remain unnoticed because their achievements exist outside traditional academic systems.

The college requires a platform that can identify, rank, analyze, and showcase student talent using real performance data.

---

# Project Goal

Create a modern web application that allows students to:

1. Register an account.
2. Create their profile.
3. Connect their CodeChef profile.
4. Automatically fetch coding performance data.
5. Generate AI-powered talent insights.
6. Display students on a college-wide leaderboard.

The system should help faculty, placement officers, and management identify top-performing students based on competitive programming performance.

---

# Vision

Current State:

CGPA → Resume → Placement

Future State:

Verified Skills → Talent Analytics → Career Opportunities

The platform should move student evaluation from marks-based assessment toward skills-based assessment.

---

# Scope of Phase 1

This phase only focuses on CodeChef.

No integrations with:

* LeetCode
* GitHub
* Codeforces
* GeeksForGeeks
* Kaggle
* Coursera
* LinkedIn

These integrations will be added in future phases.

The architecture should be designed so that future platforms can be integrated without major refactoring.

---

# Primary Users

## Students

Students create accounts and connect their CodeChef profiles.

## Faculty

Faculty members can view student rankings and performance.

## Placement Cell

Placement officers can identify top competitive programmers.

## Principal and Management

College administration can track coding talent across departments.

## Admin

Administrators manage student data and leaderboard operations.

---

# Core Features

## Authentication

* Signup
* Login
* Logout
* Session Management

## Student Profile

Each student should have:

* Name
* Roll Number
* Department
* Year
* Profile Picture
* CodeChef Profile URL

## CodeChef Integration

The system should fetch:

* Username
* Current Rating
* Highest Rating
* Global Rank
* Country Rank
* Stars
* Contest Participation
* Problems Solved

## AI Analysis

Generate:

* Talent Score
* Consistency Score
* Problem Solving Score
* Competitive Programming Score
* Career Recommendations

## Leaderboard

Display:

* Rank
* Student
* Rating
* Stars
* Talent Score

## Dashboard

Display:

* Statistics Cards
* Charts
* Rankings
* Performance Insights
* Growth Metrics

## Admin Dashboard

Provide:

* Student Search
* Filters
* Student Management
* Export Leaderboard

---

# Technology Stack

## Frontend

Framework:
Next.js 15

Language:
TypeScript

Styling:
Tailwind CSS

Component Library:
shadcn/ui

Charts:
Recharts

State Management:
React Context + Server Components

---

## Backend

Framework:
Next.js API Routes

Language:
TypeScript

Architecture:
Service Layer Pattern

API Style:
REST API

---

## Database

Database:
PostgreSQL

Platform:
Supabase

ORM:
Prisma

---

## Authentication

Provider:
Supabase Auth

Methods:

* Email Login
* Email Signup
* Session Management

---

## AI Layer

Version 1:

Rule-Based Intelligence

Future Versions:

* Ollama
* DeepSeek
* Llama
* Qwen

Current AI analysis should not hallucinate.

All recommendations must be generated from available CodeChef metrics.

---

# UI Design Principles

The application should look like a premium SaaS product.

Design Inspiration:

* Linear
* Vercel
* Stripe
* GitHub
* LeetCode

Design Requirements:

* Dark Theme
* Glassmorphism
* Smooth Animations
* Modern Dashboard
* Mobile Responsive
* Professional Appearance
* Enterprise Quality

The product should feel like a startup-ready solution rather than a college project.

---

# Database Design

Initial Tables:

users

student_profiles

codechef_profiles

leaderboard_entries

ai_analysis

sync_logs

All tables should include:

* created_at
* updated_at

The schema should be extensible for future platform integrations.

---

# Talent Score Philosophy

Talent Score should be calculated using:

* CodeChef Rating
* Star Rating
* Contest Activity
* Participation Consistency
* Problem Solving Metrics

The score should range between:

0 - 100

Purpose:

Provide a unified ranking metric across students.

---

# Future Expansion

After successful deployment of CodeChef Leaderboard, future phases will include:

Phase 2:
LeetCode Integration

Phase 3:
GitHub Integration

Phase 4:
Codeforces Integration

Phase 5:
Certification Tracking

Phase 6:
Sports Analytics

Phase 7:
Leadership Analytics

Phase 8:
AI Career Coach

Phase 9:
Talent Intelligence Platform

---

# Development Principles

* Production-grade code
* Clean architecture
* Reusable components
* Scalable design
* Type safety
* Secure authentication
* Responsive UI
* Error handling
* Future-proof architecture

This project is not a temporary coding leaderboard.

It is the foundation of the future Student Talent Intelligence Platform being developed for ACE Engineering College.
