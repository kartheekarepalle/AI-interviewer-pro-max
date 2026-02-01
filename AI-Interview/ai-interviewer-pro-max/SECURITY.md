# 🔒 Security Guide

## Overview

This document outlines security best practices for AI Interviewer Pro Max. Follow these guidelines to keep your deployment secure.

---

## 🚨 Critical Security Items

### 1. Environment Variables (NEVER Commit!)

The following files contain sensitive information and **MUST NEVER** be committed to git:

| File | Contains |
|------|----------|
| `.env` | API keys, database credentials, JWT secrets |
| `*.db` | User data, interview records |
| `backend/uploads/` | User resumes (PII) |

✅ These are already in `.gitignore`

### 2. Generate Strong Secrets

**JWT Secret Key** - Run this command to generate a secure key:

```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

Requirements:
- Minimum 32 characters (64 hex characters recommended)
- Cryptographically random
- Unique per environment (dev/staging/prod)
- Rotate annually or after any suspected breach

### 3. API Key Security

| Key | Purpose | Where to Get |
|-----|---------|--------------|
| `GEMINI_API_KEY` | Deep analysis, planning | [Google AI Studio](https://makersuite.google.com/app/apikey) |
| `GROQ_API_KEY` | Real-time conversations | [Groq Console](https://console.groq.com/keys) |

**Best Practices:**
- Never expose in frontend code
- Set usage limits in provider dashboards
- Rotate keys periodically
- Use different keys for dev/staging/prod

---

## 🛡️ Security Features Implemented

### Authentication
- ✅ Password hashing with bcrypt
- ✅ JWT tokens with configurable expiration
- ✅ Protected routes require valid tokens
- ✅ Token refresh mechanism

### Data Protection
- ✅ Passwords never stored in plain text
- ✅ API keys loaded from environment variables only
- ✅ CORS configured for allowed origins only
- ✅ File upload validation

### Code Security
- ✅ No hardcoded secrets in source code
- ✅ Production environment validation
- ✅ Debug mode warning in production
- ✅ SQLite warning for production use

---

## 📋 Production Security Checklist

Before deploying to production:

```
[ ] Generate new JWT_SECRET_KEY (64+ chars)
[ ] Set ENVIRONMENT=production
[ ] Set DEBUG=false
[ ] Use PostgreSQL (not SQLite)
[ ] Configure proper CORS_ORIGINS
[ ] Enable HTTPS
[ ] Review and set API key limits
[ ] Configure proper logging (no secrets in logs)
[ ] Set up regular database backups
[ ] Configure firewall rules
[ ] Enable rate limiting
[ ] Set up monitoring and alerts
```

---

## 🔐 Environment Configuration

### Development (.env)

```env
ENVIRONMENT=development
DEBUG=true
DATABASE_URL=sqlite:///./ai_interviewer.db
JWT_SECRET_KEY=auto-generated-for-dev
CORS_ORIGINS=http://localhost:3000,http://localhost:5173
```

### Production (.env)

```env
ENVIRONMENT=production
DEBUG=false
DATABASE_URL=postgresql://user:strongpassword@host:5432/dbname
JWT_SECRET_KEY=your-64-character-cryptographically-random-key
CORS_ORIGINS=https://yourdomain.com
GEMINI_API_KEY=your-production-gemini-key
GROQ_API_KEY=your-production-groq-key
```

---

## 🚫 Common Security Mistakes to Avoid

1. **Committing `.env` files** - Always check before pushing
2. **Using default secrets in production** - Will trigger warnings
3. **Exposing API keys in frontend** - All AI calls go through backend
4. **Disabling CORS completely** - Keep restricted to known origins
5. **Running debug mode in production** - Exposes stack traces
6. **Using SQLite in production** - Not suitable for concurrent access

---

## 📝 Security Incident Response

If you suspect a security breach:

1. **Immediately rotate all secrets:**
   - Generate new JWT_SECRET_KEY
   - Regenerate all API keys
   - Update database passwords

2. **Review access logs** for suspicious activity

3. **Notify affected users** if any data was exposed

4. **Document the incident** and implement fixes

---

## 📞 Reporting Security Issues

If you discover a security vulnerability:

1. **Do NOT** create a public issue
2. Contact the maintainers directly
3. Provide details of the vulnerability
4. Allow time for a fix before public disclosure

---

## 📚 Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [FastAPI Security](https://fastapi.tiangolo.com/tutorial/security/)
- [Python Security Best Practices](https://python.org/dev/security/)
