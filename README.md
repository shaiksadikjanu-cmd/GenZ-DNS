<div align="center">

# 🌐 GenZ-DNS — JanuNet

**A private domain overlay network built for students and developers.**  
Register custom `.student` and `.januos` domains. Access them instantly via the Chrome extension.  
Every domain is AI-scanned before going live. Track visits in real-time.

[![Portal](https://img.shields.io/badge/Portal-gen--z--dns.vercel.app-blue?style=for-the-badge)](https://gen-z-dns.vercel.app)
[![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)]()
[![Built with Firebase](https://img.shields.io/badge/Firebase-Cloud-orange?style=for-the-badge)]()

</div>

---

## 🚀 What is JanuNet?

JanuNet is a two-part system:

| Part | What it does |
|------|-------------|
| **Web Portal** | Register custom domains, manage routes, view analytics |
| **Chrome Extension** | Resolves your custom domains inside the browser |

You register `myproject.student` → point it to `https://myproject.vercel.app` → anyone with the extension types `myproject.student` and lands on your site instantly.

---

## 🛠 Repo Structure
GenZ-DNS/
├── api/                  # Vercel serverless functions (Groq AI gatekeeper)
├── extension/            # Chrome extension source
├── public/               # Web portal (deployed to Vercel)
├── vercel.json           # Vercel routing config
└── README.md

￼
BASH
￼▶ Run

---

## ⚡ Part 1 — Install the Chrome Extension

### Method A — Load from this repo (Developer Mode)

1. **Clone or download this repo:**
```bash
git clone https://github.com/YOUR_USERNAME/GenZ-DNS.git
```

2. **Open Chrome and go to:**
chrome://extensions

￼
BASH
￼▶ Run

3. **Enable Developer Mode** (toggle in top right corner)

4. **Click "Load unpacked"**

5. **Select the `extension/` folder** inside the cloned repo

6. Done — the JanuNet icon appears in your toolbar

### Method B — Download ZIP (no Git needed)

1. Go to this repo on GitHub
2. Click **Code → Download ZIP**
3. Extract the ZIP
4. Open `chrome://extensions` → Enable Developer Mode
5. Click **Load unpacked** → select the `extension/` folder inside the extracted ZIP

---

## 🌐 Part 2 — Use the Web Portal

Visit **[gen-z-dns.vercel.app](https://gen-z-dns.vercel.app)**

1. Click **Get Started** → Register an account
2. In the dashboard, enter your custom domain (e.g. `myproject.student`)
3. Enter the target URL (e.g. `https://myproject.vercel.app`)
4. Click **Deploy** — Groq AI scans the link first
5. Once approved, open the extension sidepanel and type your domain

---

## 🔒 How the AI Gatekeeper Works

Every domain registration goes through a security scan:
User submits domain + URL
↓
Portal calls /api/scan-domain (Vercel serverless)
↓
Groq AI (llama-3.3-70b) checks for harmful content
↓
SAFE → saved to Firestore → live instantly
HARMFUL → blocked, reason shown to user

￼
BASH
￼▶ Run

The Groq API key never touches the browser — it lives in Vercel's environment variables only.

---

## 📊 Features

- ✅ Custom domain registration (`.student`, `.januos` TLDs)
- ✅ AI-powered content gatekeeper (Groq + Llama 3)
- ✅ Real-time visit counter per domain
- ✅ Browser-style viewer (back/forward/refresh/address bar)
- ✅ Share modal with QR code + public URL
- ✅ Firebase Authentication (secure, no plaintext passwords)
- ✅ Auto dark/light mode portal
- 🔜 Omnibox interception (type domains in Chrome address bar)
- 🔜 Recents + favorites in sidepanel
- 🔜 Public discovery directory
- 🔜 `janunet.app/username/domain` public routing

---

## 🧰 Tech Stack

| Layer | Technology |
|-------|-----------|
| Extension | Chrome MV3, Vanilla JS |
| Portal | HTML/CSS/JS (no framework) |
| Auth | Firebase Authentication |
| Database | Cloud Firestore |
| Backend | Vercel Serverless Functions |
| AI | Groq API (Llama 3.3 70B) |
| Deployment | Vercel (auto-deploy on push) |

---

## 🔧 Self-Hosting / Contributing

1. Fork this repo
2. Create a Firebase project → enable Auth + Firestore
3. Replace `firebaseConfig` in `public/index.html` with yours
4. Add `GROQ_API_KEY` to Vercel environment variables
5. Push → Vercel auto-deploys

Pull requests welcome. Open an issue for bugs or feature ideas.

---

## 👨‍💻 Built by

**Shaik Janu** — built for students, by a student.  
Presented at college tech expo 2025.

---

<div align="center">
<b>JanuNet — your internet, your rules.</b>
</div>
