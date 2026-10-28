# 🤖 Telegram AI Bot

<p align="center">
  <img src="https://img.shields.io/badge/Cloudflare-Workers-F38020?style=for-the-badge&logo=cloudflare&logoColor=white" alt="Cloudflare Workers" />
  <img src="https://img.shields.io/badge/Workers-AI-orange?style=for-the-badge&logo=cloudflare&logoColor=white" alt="Workers AI" />
  <img src="https://img.shields.io/badge/Meta_Llama-3.3_70B-blue?style=for-the-badge&logo=meta&logoColor=white" alt="Meta Llama 3" />
  <img src="https://img.shields.io/badge/Telegram-Bot_API-2CA5E0?style=for-the-badge&logo=telegram&logoColor=white" alt="Telegram API" />
  <img src="https://img.shields.io/badge/Deployment-100%25_Serverless-success?style=for-the-badge" alt="Serverless" />
  <img src="https://img.shields.io/badge/Cost-100%25_Free_Tier-green?style=for-the-badge" alt="Free" />
</p>

An ultra-fast, intelligent, and **100% serverless** Telegram AI Chatbot powered by **Cloudflare Workers** and **Workers AI** (Meta Llama 3.3 / 3.1) with persistent conversation memory using **Cloudflare KV**.

> 💡 **No Wrangler Required:** You don't need any CLI tools. Just copy and paste [`worker.js`](worker.js) directly into the Cloudflare Dashboard!

---

## ✨ Features

- ⚡ **100% Serverless & Free:** Runs 24/7 on Cloudflare's global edge network within the generous free tier.
- 🧠 **Workers AI Models:** Powered by state-of-the-art LLMs (Llama 3.3 70B, Llama 3.1 8B, DeepSeek, etc.).
- 💾 **Context Memory:** Remembers ongoing conversations per user via Cloudflare KV storage (`CHAT_HISTORY`).
- 🔗 **1-Click Webhook Setup:** Built-in `/set-webhook` endpoint automatically registers your worker with Telegram.
- 🛡️ **Webhook Security:** Optional secret token verification (`X-Telegram-Bot-Api-Secret-Token`).
- ✍️ **Live Typing Indicators:** Shows real-time *"typing..."* status while generating responses.
- ✂️ **Smart Message Splitting:** Automatically splits responses longer than Telegram's 4096-character limit.
- 🛡️ **Markdown Auto-Fallback:** Resilient formatting that falls back to plain text if Markdown parsing fails.
- 📊 **Status & Diagnostics:** Built-in health check at `/` and webhook inspection at `/webhook-info`.

---

## 📁 Repository Files

- [`worker.js`](worker.js) — Complete Cloudflare Worker code (copy-paste ready)
- [`binding.txt`](binding.txt) — Quick reference for Workers AI and KV bindings
- [`env.example`](env.example) — Example environment variables & configuration
- [`LICENSE`](LICENSE) — MIT License

---

## 🚀 Quick Setup Guide (Cloudflare Dashboard Method)

No command line, Node.js, or Wrangler needed! Follow these steps:

### 1. Create your Telegram Bot

1. Open Telegram and search for [@BotFather](https://t.me/BotFather).
2. Send `/newbot` and follow the prompts to choose a bot name and username.
3. Save the **HTTP API Token** (e.g. `123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ`).

---

### 2. Create a Cloudflare Worker

1. Log in to [Cloudflare Dashboard](https://dash.cloudflare.com/).
2. In the left sidebar, navigate to **Compute (Workers) > Workers & Pages**.
3. Click **Create** > **Create Worker**.
4. Give your worker a name (e.g., `telegram-ai-bot`) and click **Deploy**.
5. Once created, click **Edit code** in the top right corner.
6. Replace all existing code with the contents of [`worker.js`](worker.js).
7. Click **Deploy** (or **Save and Deploy**).

---

### 3. Add Cloudflare Bindings

Go to your Worker page in the dashboard and open **Settings** > **Bindings**:

#### A. Workers AI Binding
1. Click **Add** > **Workers AI**.
2. Set **Variable name** to: `AI`
3. Click **Save and Deploy**.

#### B. KV Namespace Binding (For Chat History Memory)
1. In the Cloudflare sidebar, go to **Storage & Databases** > **KV** > **Create a namespace**.
2. Name it `CHAT_HISTORY` and create it.
3. Return to your Worker > **Settings** > **Bindings**.
4. Click **Add** > **KV Namespace**.
5. Set **Variable name** to: `CHAT_HISTORY`
6. Select the `CHAT_HISTORY` namespace you just created.
7. Click **Save and Deploy**.

---

### 4. Configure Environment Variables & Secrets

In your Worker page, go to **Settings** > **Variables and Secrets**:

| Variable Name | Type | Recommended Value | Description |
| :--- | :--- | :--- | :--- |
| `TELEGRAM_BOT_TOKEN` | **Secret** (Encrypt) | `Your_Bot_Token_From_BotFather` | Telegram Bot token |
| `TELEGRAM_SECRET_TOKEN` | Plaintext / Secret | `Any_Random_String_123` | *(Optional)* Security token for webhook |
| `AI_MODEL` | Plaintext | `@cf/meta/llama-3.3-70b-instruct-fp8-fast` | Workers AI model name |
| `SYSTEM_PROMPT` | Plaintext | `You are a helpful, concise, and smart AI assistant...` | Custom personality/instructions |

Click **Save and Deploy**.

---

### 5. One-Click Webhook Registration

Your worker URL is displayed at the top of your Worker dashboard:
```text
https://<your-worker-name>.<your-subdomain>.workers.dev
```

1. Open your browser and go to:
   ```text
   https://<your-worker-name>.<your-subdomain>.workers.dev/set-webhook
   ```
2. You will see an immediate JSON response:
   ```json
   {
     "ok": true,
     "result": true,
     "description": "Webhook was set"
   }
   ```
3. Your bot is now linked to your Cloudflare Worker!

---

### 6. Start Chatting!

Open your bot in Telegram and start talking:

| Command | Action |
| :--- | :--- |
| `/start` | Welcome greeting and bot commands guide |
| `/help` | Bot instructions and active AI model info |
| `/reset` | Clears conversation memory in KV storage |
| *Any message* | Prompts the AI model directly |

---

## 🛠️ Endpoints & Diagnostics

| Endpoint | Method | Purpose |
| :--- | :--- | :--- |
| `/` | `GET` | Health check dashboard showing AI & KV status |
| `/set-webhook` | `GET` | Automatically links Telegram Webhook to this worker |
| `/webhook-info` | `GET` | Checks Telegram webhook status and health |
| `/webhook` or `/` | `POST` | Telegram updates receiver (validates secret token) |

---

## 🧠 Supported AI Models

You can change `AI_MODEL` in your Worker variables anytime to any model supported by Cloudflare Workers AI:

- `@cf/meta/llama-3.3-70b-instruct-fp8-fast` *(Recommended)*
- `@cf/meta/llama-3.1-8b-instruct` *(Fast & Lightweight)*
- `@cf/meta/llama-3.2-3b-instruct` *(Ultra-Fast)*
- `@cf/deepseek-ai/deepseek-r1-distill-qwen-32b` *(Reasoning)*
- `@cf/mistral/mistral-7b-instruct-v0.2`

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
