# 🚀 Production Deployment Checklist

## Pre-Deployment Verification

### 1. Environment Configuration
- [ ] `.env` file created from `.env.example`
- [ ] `ENVIRONMENT=production`
- [ ] `DEBUG=false`
- [ ] Strong `JWT_SECRET_KEY` generated (min 64 chars)
- [ ] `DATABASE_URL` points to production database
- [ ] `CORS_ORIGINS` set to production domain(s)

### 2. API Keys
- [ ] `GEMINI_API_KEY` is valid and active
- [ ] `GROQ_API_KEY` is valid and active
- [ ] API keys NOT committed to version control
- [ ] API keys have appropriate rate limits

### 3. Security
- [ ] All routes except `/api/auth/*` require authentication
- [ ] Password hashing verified (bcrypt)
- [ ] JWT token expiration configured
- [ ] No debug prints in production code
- [ ] No stack traces exposed to frontend
- [ ] CORS properly restricted

### 4. Feature Verification
- [ ] User can create account (signup)
- [ ] User can login with credentials
- [ ] User can upload resume (PDF/DOCX)
- [ ] ATS score is calculated
- [ ] Interview plan can be generated
- [ ] Live interview can be started
- [ ] Questions are presented correctly
- [ ] Answers can be submitted
- [ ] Evaluation feedback is shown
- [ ] Interview can be completed
- [ ] Report is generated
- [ ] Career roadmap is generated
- [ ] Analytics dashboard shows data
- [ ] 3D Avatar renders correctly
- [ ] Company modes work
- [ ] Personality modes work

### 5. Performance
- [ ] Database queries optimized
- [ ] Static assets served via CDN (if applicable)
- [ ] API response times acceptable
- [ ] No memory leaks in extended sessions

### 6. Monitoring
- [ ] Error logging configured
- [ ] Health check endpoint accessible
- [ ] API metrics tracking (optional)

---

## Deployment Commands

### Backend (FastAPI)

```bash
# Production server (Gunicorn + Uvicorn workers)
gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker -b 0.0.0.0:8000

# Or with Uvicorn directly (not recommended for high traffic)
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### Frontend (Vite)

```bash
# Build production bundle
npm run build

# Preview production build
npm run preview

# Serve with web server (e.g., nginx, serve)
npx serve dist
```

---

## Post-Deployment Verification

1. **Health Check**: `curl https://your-domain.com/api/health`
2. **Login Flow**: Test signup → login → dashboard
3. **Upload Flow**: Upload resume → verify parsing
4. **Interview Flow**: Start → complete → view report
5. **Analytics**: Check dashboard displays data

---

## Rollback Procedure

1. Revert to previous deployment
2. Restore database backup if needed
3. Clear any cached data
4. Verify health check passes

---

## Support Contacts

- **Development Team**: [Contact Info]
- **DevOps/Infrastructure**: [Contact Info]
- **AI API Support**: 
  - Gemini: https://ai.google.dev/support
  - Groq: https://console.groq.com/docs

---

*Checklist version: 1.0.0*
*Last updated: December 2024*
