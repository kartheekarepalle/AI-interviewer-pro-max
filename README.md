# 🎯 AI Interviewer Pro Max

**Enterprise-Grade AI-Powered Mock Interview Platform**

A comprehensive interview preparation system that leverages AI to provide realistic mock interviews, personalized feedback, and career development guidance.

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![Python](https://img.shields.io/badge/python-3.10+-green)
![React](https://img.shields.io/badge/React-18.2-blue)
![License](https://img.shields.io/badge/license-proprietary-red)

---

## Live Deployment & Demo

### 🌐 Live Application

👉 Deployment URL:

https://chowdary1-ai-interviewer-version-1.hf.space/login

### 🎥 Project Demo Video

https://github.com/user-attachments/assets/6d3b8ed9-1d27-4864-9763-235635add94c

---

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [API Documentation](#api-documentation)
- [External APIs](#external-apis)
- [Known Limitations](#known-limitations)
- [Production Deployment](#production-deployment)

---

## 🎯 Overview

AI Interviewer Pro Max is a production-grade mock interview platform designed to help job seekers prepare for technical, behavioral, and situational interviews. The system uses a dual-AI architecture (Gemini + Groq) to provide both deep analysis and real-time conversational interactions.

### Key Value Propositions

- **Realistic Interview Simulation** - AI-powered interviewer with personality modes
- **Personalized Question Generation** - Based on resume analysis and target role
- **Real-time Feedback** - Immediate relevance scoring during interviews
- **Comprehensive Reports** - Detailed performance analysis and recommendations
- **Career Roadmap** - Personalized development path based on performance
- **Analytics Dashboard** - Track progress over time

---

## ⭐ Features (21 Core Features)

### Phase 1: Foundation
| # | Feature | Description |
|---|---------|-------------|
| 1 | **Authentication** | JWT-based user authentication with signup/login |
| 2 | **User Management** | User profiles and session management |
| 3 | **Resume Upload** | PDF/DOCX resume upload and parsing |
| 4 | **ATS Scoring** | Applicant Tracking System compatibility analysis |

### Phase 2: Interview Engine
| # | Feature | Description |
|---|---------|-------------|
| 5 | **Interview Planning** | AI-generated interview plans based on role |
| 6 | **Question Generation** | Dynamic question bank creation |
| 7 | **Live Interview** | Real-time chat-based interview session |
| 8 | **Answer Evaluation** | Multi-dimensional answer scoring |

### Phase 3: AI Features
| # | Feature | Description |
|---|---------|-------------|
| 9 | **Follow-up Questions** | Context-aware probing questions |
| 10 | **Quick Relevance Check** | Real-time answer relevance scoring |
| 11 | **Simulated Speech Analysis** | Text-based speech clarity inference |
| 12 | **Simulated Emotion Detection** | Sentiment and tone analysis |
| 13 | **Simulated Body Language** | Engagement and presence inference |

### Phase 4: Personalization
| # | Feature | Description |
|---|---------|-------------|
| 14 | **Company Modes** | FAANG/Startup/Enterprise interview styles |
| 15 | **Interviewer Personalities** | Strict/Friendly/Stress/Neutral modes |
| 16 | **Difficulty Levels** | Easy/Medium/Hard question adjustment |

### Phase 5: Analysis & Growth
| # | Feature | Description |
|---|---------|-------------|
| 17 | **Interview Reports** | Comprehensive performance reports |
| 18 | **Career Roadmap** | Personalized skill development path |
| 19 | **Analytics Dashboard** | Progress tracking and insights |
| 20 | **3D Avatar** | Animated interviewer visualization |
| 21 | **Production Ready** | Security, error handling, documentation |

---

## 🛠 Tech Stack

### Backend
| Technology | Purpose |
|------------|---------|
| **Python 3.10+** | Runtime |
| **FastAPI** | Web framework |
| **SQLAlchemy** | ORM |
| **SQLite/PostgreSQL** | Database |
| **Pydantic** | Data validation |
| **JWT** | Authentication |
| **bcrypt** | Password hashing |

### Frontend
| Technology | Purpose |
|------------|---------|
| **React 18** | UI framework |
| **Vite** | Build tool |
| **React Router v6** | Routing |
| **Three.js** | 3D avatar rendering |
| **Axios** | HTTP client |
| **CSS Variables** | Theming |

### External AI Services
| Service | Purpose |
|---------|---------|
| **Google Gemini** | Deep analysis, planning, evaluation |
| **Groq** | Real-time conversation, follow-ups |

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend                              │
│  React + Vite + Three.js                                    │
│  ├── Authentication UI                                       │
│  ├── Dashboard & Analytics                                   │
│  ├── Interview Interface                                     │
│  └── 3D Avatar (WebGL)                                      │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ REST API
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        Backend                               │
│  FastAPI                                                    │
│  ├── /auth/* - Authentication                               │
│  ├── /users/* - User management                             │
│  ├── /resumes/* - Resume handling                           │
│  ├── /interviews/* - Interview engine                       │
│  ├── /evaluations/* - Answer evaluation                     │
│  ├── /reports/* - Report generation                         │
│  ├── /roadmap/* - Career planning                           │
│  └── /analytics/* - User analytics                          │
└─────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    ▼                   ▼
            ┌───────────┐       ┌───────────┐
            │  Gemini   │       │   Groq    │
            │  (Deep)   │       │  (Fast)   │
            └───────────┘       └───────────┘
```

### AI Responsibility Split

| Gemini (Deep) | Groq (Fast) |
|---------------|-------------|
| Resume parsing | Question presentation |
| ATS scoring | Follow-up generation |
| Question generation | Quick relevance checks |
| Deep evaluation | Conversation flow |
| Report generation | Persona enforcement |
| Career roadmap | Acknowledgments |

---

## 🚀 Getting Started

### Prerequisites

- Python 3.10+
- Node.js 18+
- npm or yarn

### Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd ai-interviewer-pro-max
```

2. **Backend Setup**
```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate (Windows)
venv\Scripts\activate

# Activate (macOS/Linux)
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Copy environment config
cp .env.example .env
# Edit .env with your values

# Run server
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

3. **Frontend Setup**
```bash
cd frontend

# Install dependencies
npm install

# Run development server
npm run dev
```

4. **Access Application**
- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

---

## ⚙️ Environment Variables

### Required Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | Database connection string | Yes |
| `JWT_SECRET_KEY` | Secret for JWT signing (min 32 chars) | Yes |
| `GEMINI_API_KEY` | Google Gemini API key | Yes* |
| `GROQ_API_KEY` | Groq API key | Yes* |

*AI features will use mock data if keys are not provided.

### Optional Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DEBUG` | `true` | Enable debug mode |
| `ENVIRONMENT` | `development` | Environment name |
| `CORS_ORIGINS` | `localhost:*` | Allowed CORS origins |
| `MAX_UPLOAD_SIZE_MB` | `10` | Max upload file size |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `1440` | JWT expiration |

### Generating a Secure JWT Secret
```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

---

## 📚 API Documentation

### Authentication
```
POST /api/auth/signup      - Create new account
POST /api/auth/login       - Login and get token
POST /api/auth/logout      - Logout (invalidate token)
GET  /api/auth/me          - Get current user
```

### Interviews
```
POST /api/interviews/plan/generate   - Generate interview plan
POST /api/interviews/live/start      - Start live interview
POST /api/interviews/live/{id}/submit - Submit answer
POST /api/interviews/live/{id}/end   - End interview
GET  /api/interviews/live/{id}/state - Get session state
```

### Analytics
```
GET /api/analytics/dashboard   - Full dashboard data
GET /api/analytics/overview    - Summary statistics
GET /api/analytics/skills      - Skill performance
GET /api/analytics/progress    - Progress over time
```

Full API documentation available at `/docs` when running the server.

---

## 🔌 External APIs

### Google Gemini API
- **Purpose**: Deep analysis, planning, evaluation, reporting
- **Documentation**: https://ai.google.dev/
- **Get API Key**: https://aistudio.google.com/app/apikey

### Groq API
- **Purpose**: Real-time conversation, fast responses
- **Documentation**: https://console.groq.com/docs
- **Get API Key**: https://console.groq.com/keys

### API Usage Notes
- All AI calls are made server-side only
- API keys are never exposed to the frontend
- Graceful fallback to mock data if keys missing
- Rate limiting handled per-user

---

## ⚠️ Known Limitations

### Current Limitations

1. **No Real Camera/Microphone Access**
   - Body language and speech features are simulated from text
   - Analysis is based on typing patterns, not actual video/audio

2. **Mock AI Responses in Development**
   - Without valid API keys, system uses placeholder responses
   - Full AI functionality requires Gemini + Groq keys

3. **Single Language Support**
   - Currently English only
   - Multi-language support planned for future release

4. **Browser Requirements**
   - 3D Avatar requires WebGL support
   - Falls back to 2D avatar if WebGL unavailable

5. **File Upload Limits**
   - Maximum 10MB file size
   - Only PDF and DOCX supported

### Security Considerations

- Passwords hashed with bcrypt
- JWT tokens with configurable expiration
- All routes protected except /auth/*
- User data isolation enforced
- No sensitive data in frontend

---

## 🚢 Production Deployment

### Pre-Deployment Checklist

- [ ] Set `ENVIRONMENT=production`
- [ ] Set `DEBUG=false`
- [ ] Generate strong `JWT_SECRET_KEY`
- [ ] Configure production database
- [ ] Set valid Gemini and Groq API keys
- [ ] Configure CORS for production domain
- [ ] Enable HTTPS
- [ ] Set up monitoring and logging

### Recommended Hosting

- **Backend**: Railway, Render, AWS EC2, GCP Cloud Run
- **Frontend**: Vercel, Netlify, CloudFlare Pages
- **Database**: Supabase, Railway PostgreSQL, AWS RDS

### Docker Deployment (Optional)

```dockerfile
# Backend Dockerfile available at backend/Dockerfile
# Frontend can be built and served as static files
```

---

## 📄 License

Proprietary - All Rights Reserved

---

## 🤝 Support

For issues, questions, or feature requests, please contact the development team.

---

**Built with ❤️ for interview success**
