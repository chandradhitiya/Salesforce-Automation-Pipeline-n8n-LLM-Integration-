# Setup Guide

This guide walks you through configuring all external services and importing
the n8n workflow for the **Salesforce Automation Pipeline**.

---

## Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| [n8n](https://docs.n8n.io/hosting/) | ≥ 1.30 | Workflow engine |
| Node.js | ≥ 18 | Setup validation scripts |
| Salesforce org | Developer / Production | Task & contact management |
| Google Workspace account | Any | Calendar + Sheets |
| OpenAI account | — | GPT transcript analysis |

---

## 1. OpenAI Setup

1. Go to [platform.openai.com/api-keys](https://platform.openai.com/api-keys).
2. Create a new **Secret Key** with the name `n8n-meeting-pipeline`.
3. Copy the key into `OPENAI_API_KEY` in your `.env` file.
4. Ensure your account has access to `gpt-4o` (or change `OPENAI_MODEL` to a model you have access to).

> **Cost estimate:** Each meeting transcript analysis uses ~500–1 500 input tokens and ~400–800 output tokens with `gpt-4o`.

---

## 2. Salesforce Connected App

### 2a. Create a Connected App

1. In Salesforce, go to **Setup → App Manager → New Connected App**.
2. Set:
   - **Connected App Name:** `n8n Meeting Automation`
   - **API Name:** `n8n_Meeting_Automation`
   - **Contact Email:** your admin email
3. Under **API (Enable OAuth Settings)**:
   - ✅ Enable OAuth Settings
   - **Callback URL:** `https://your-n8n-instance.com/rest/oauth2-credential/callback`
   - **Selected OAuth Scopes:**
     - `Full access (full)`
     - `Perform requests at any time (refresh_token, offline_access)`
4. Save and note the **Consumer Key** (`SALESFORCE_CLIENT_ID`) and **Consumer Secret** (`SALESFORCE_CLIENT_SECRET`).

### 2b. Create an Integration User (recommended)

1. Go to **Setup → Users → New User**.
2. Create a user with the **Salesforce** license and a profile that has:
   - Create/Edit/Read on **Tasks**
   - Read on **Contacts** and **Users**
3. Reset the security token: **Settings → My Personal Information → Reset My Security Token**.
4. Set `SALESFORCE_USERNAME`, `SALESFORCE_PASSWORD`, and `SALESFORCE_SECURITY_TOKEN` in `.env`.

### 2c. Find the Default Owner ID

1. Go to **Setup → Users**.
2. Click the integration user and copy the **User ID** from the URL:
   `https://yourorg.my.salesforce.com/0050x000000XXXXX`
3. Set `SALESFORCE_DEFAULT_OWNER_ID` in `.env`.

---

## 3. Google Calendar & Sheets Setup

### 3a. Create a Google Cloud Project

1. Go to [console.cloud.google.com](https://console.cloud.google.com/) and create a new project.
2. Enable the following APIs:
   - **Google Calendar API**
   - **Google Sheets API**

### 3b. Create OAuth2 Credentials

1. Go to **APIs & Services → Credentials → Create Credentials → OAuth client ID**.
2. Application type: **Web application**.
3. Authorized redirect URIs: `https://your-n8n-instance.com/rest/oauth2-credential/callback`
4. Copy the **Client ID** and **Client Secret** — you will enter these in n8n directly.

### 3c. Create the Google Sheet

Create a new Google Sheet with **three tabs** (exact names required):

#### Tab 1: `Meeting Summaries`
| Column | Description |
|--------|-------------|
| Timestamp | ISO timestamp of when the row was written |
| Meeting Title | Title of the meeting |
| Meeting Date | Start date/time of the meeting |
| Meeting ID | Google Calendar event ID |
| Attendees | Comma-separated list of attendees |
| Summary | AI-generated meeting summary |
| Key Insights | Pipe-separated key insights |
| Decisions Made | Pipe-separated decisions |
| Follow-up Required | TRUE / FALSE |
| Next Meeting Date | Date if mentioned, else empty |
| Meeting Link | Google Calendar event link |

#### Tab 2: `Action Items`
| Column | Description |
|--------|-------------|
| Timestamp | ISO timestamp of when the row was written |
| Meeting Title | Source meeting title |
| Meeting Date | Source meeting date |
| Attendees | Meeting attendees |
| Meeting Summary | Brief meeting summary |
| Key Insights | Pipe-separated key insights |
| Decisions Made | Pipe-separated decisions |
| Task Title | Action item title |
| Task Description | Full task description |
| Assignee Name | Person responsible |
| Assignee Role | employee / manager / team |
| Priority | High / Medium / Low |
| Due Date | YYYY-MM-DD |
| Department | Department if mentioned |
| Salesforce Task ID | Salesforce Task record ID |
| Status | Not Started / In Progress / Completed |
| Follow-up Required | TRUE / FALSE |
| Next Meeting Date | Date if mentioned, else empty |
| Meeting Link | Google Calendar event link |

#### Tab 3: `Task Progress`
| Column | Description |
|--------|-------------|
| Last Updated | ISO timestamp of last sync |
| Salesforce Task ID | Salesforce Task record ID |
| Task Subject | Task subject from Salesforce |
| Status | Current status |
| Priority | Current priority |
| Due Date | Task due date |
| Created Date | Task creation date |
| Last Modified | Last modified date in Salesforce |

Copy the **Spreadsheet ID** from the URL and set `GOOGLE_SHEETS_SPREADSHEET_ID` in `.env`.

---

## 4. n8n Credentials Configuration

Open your n8n instance and add the following credentials:

### 4a. OpenAI
- **Name:** `OpenAI API`
- **Type:** OpenAI API
- **API Key:** your `OPENAI_API_KEY` value

### 4b. Salesforce
- **Name:** `Salesforce OAuth2`
- **Type:** Salesforce OAuth2 API
- **Environment:** Production (or Sandbox)
- **Client ID / Secret:** from your Connected App
- Complete the OAuth2 authorization flow

### 4c. Google Calendar
- **Name:** `Google Calendar OAuth2`
- **Type:** Google Calendar OAuth2 API
- **Client ID / Secret:** from your Google Cloud project
- Complete the OAuth2 authorization flow

### 4d. Google Sheets
- **Name:** `Google Sheets OAuth2`
- **Type:** Google Sheets OAuth2 API
- **Client ID / Secret:** same as Calendar (or a separate credential)
- Complete the OAuth2 authorization flow

---

## 5. n8n Workflow Variables

In your n8n instance, set the following **workflow variables** (or environment variables):

| Variable | Value |
|----------|-------|
| `GOOGLE_CALENDAR_ID` | Your calendar ID (e.g., `primary`) |
| `GOOGLE_SHEETS_SPREADSHEET_ID` | Your spreadsheet ID |
| `SALESFORCE_DEFAULT_OWNER_ID` | Salesforce User ID for default task owner |

To set workflow variables in n8n:
1. Go to **Settings → Variables**.
2. Add each variable with its value.

> **Note:** The workflow uses `$vars.<NAME>` to reference these values, which reads from n8n's
> built-in **Workflow Variables** store (Settings → Variables). If you prefer to inject them as
> OS-level environment variables into the n8n process, change the expressions to `$env.<NAME>`.
> Both approaches work; workflow variables are recommended for portability.

---

## 6. Import the Workflow

1. In n8n, go to **Workflows → Import from File**.
2. Select `workflows/meeting_automation_pipeline.json`.
3. After import:
   - Update each node's credential to match the credentials you created in step 4.
   - Verify the **Schedule Trigger** interval (default: every 5 minutes).
   - Activate the workflow using the toggle in the top-right corner.

---

## 7. Validate Setup

Run the validation script to check all connections:

```bash
cp .env.example .env
# Edit .env with your values
npm install   # installs dotenv (if not already installed)
node scripts/validate_setup.js
```

---

## 8. Test the Pipeline

### Option A: Automatic (Google Calendar)

Add a test meeting to your Google Calendar with transcript text in the **Description** field:

```
[TRANSCRIPT]
Alice: Good morning everyone. Let's start with the Q2 budget review.
Bob: We need to finalize the marketing budget by end of week.
Alice: Bob, can you own the marketing budget document?
Carol: I'll reach out to the vendors for updated pricing by Thursday.
Alice: Great. Bob, please also schedule a follow-up call with the finance team.
[/TRANSCRIPT]
```

The workflow will pick it up within 5 minutes of the meeting end time.

### Option B: Manual Webhook

Submit a transcript directly using the helper script:

```bash
node scripts/process_transcript.js \
  --file path/to/transcript.txt \
  --title "Q2 Planning Meeting" \
  --date "2024-06-01T14:00:00Z" \
  --attendees "Alice Johnson,Bob Smith,Carol Davis"
```

Or use curl:

```bash
curl -X POST https://your-n8n-instance.com/webhook/meeting-transcript \
  -H "Content-Type: application/json" \
  -d '{
    "meeting_title": "Q2 Planning Meeting",
    "meeting_date": "2024-06-01T14:00:00Z",
    "attendees": ["Alice Johnson", "Bob Smith"],
    "transcript": "Alice: We need to increase marketing spend by 20%.\nBob: I will prepare the budget proposal by Friday."
  }'
```

---

## 9. Workflow Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    Meeting Transcript Automation Pipeline                 │
└─────────────────────────────────────────────────────────────────────────┘

  TRIGGERS
  ┌──────────────────────┐    ┌──────────────────────────────┐
  │  Schedule Trigger     │    │  Webhook: POST /meeting-      │
  │  (every 5 min)        │    │  transcript                  │
  └──────────┬───────────┘    └──────────────┬───────────────┘
             │                               │
             ▼                               ▼
  ┌──────────────────────┐    ┌──────────────────────────────┐
  │ Google Calendar:      │    │ Normalize Webhook Payload     │
  │ Fetch Ended Meetings  │    │ (maps to Calendar event fmt)  │
  └──────────┬───────────┘    └──────────────┬───────────────┘
             │                               │
             ▼                               │
  ┌──────────────────────┐                   │
  │ Filter: Has           │                   │
  │ Transcript in         │◄──────────────────┘
  │ Description           │
  └──────────┬───────────┘
             │
             ▼
  ┌──────────────────────────────────────────┐
  │  OpenAI GPT-4o: Analyze Transcript        │
  │  • Meeting summary                        │
  │  • Key insights                           │
  │  • Action items + assignees + priorities  │
  │  • Decisions made                         │
  │  • Follow-up requirements                 │
  └──────────────────────┬───────────────────┘
                         │
                         ▼
  ┌──────────────────────────────────────────┐
  │  Parse Action Items (Code Node)           │
  │  Expands 1 meeting → N action item rows   │
  └──────────┬───────────────────────────────┘
             │
     ┌───────┴────────┐
     ▼                ▼
  ┌──────────┐  ┌──────────────────────────────┐
  │ Filter:  │  │ Google Sheets:                │
  │ Has      │  │ Log Meeting Summary           │
  │ Action   │  └──────────────────────────────┘
  │ Items    │
  └────┬─────┘
       │
       ▼
  ┌──────────────────────────────┐
  │ Salesforce: Lookup Assignee  │
  │ (by name in Contacts)        │
  └──────────────┬───────────────┘
                 │
                 ▼
  ┌──────────────────────────────┐
  │ Merge Assignee ID            │
  └──────────────┬───────────────┘
                 │
                 ▼
  ┌──────────────────────────────┐
  │ Salesforce: Create Task      │
  │ • Subject, Description       │
  │ • Priority, Due Date         │
  │ • Assigned to Contact/User   │
  └──────────────┬───────────────┘
                 │
                 ▼
  ┌──────────────────────────────┐
  │ Google Sheets:               │
  │ Log Action Items             │
  └──────────────────────────────┘

  PROGRESS SYNC (separate trigger)
  ┌──────────────────────┐
  │ Salesforce: Get All  │──► Google Sheets: Sync Task Progress
  │ Meeting Follow-up    │    (upsert by Salesforce Task ID)
  │ Tasks                │
  └──────────────────────┘
```

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| Workflow not triggering | Workflow not activated | Toggle workflow to **Active** in n8n |
| "Invalid credentials" on Salesforce | Token expired or wrong Connected App | Re-authorize Salesforce OAuth2 credential in n8n |
| OpenAI returns empty response | Model not available or rate limited | Check OpenAI API dashboard; try `gpt-4o-mini` |
| No tasks created in Salesforce | Assignee not found in Contacts | Create Contact records for meeting attendees |
| Google Sheets not updating | Wrong Spreadsheet ID or sheet tab name | Verify `GOOGLE_SHEETS_SPREADSHEET_ID` and tab names match exactly |
| Webhook returns 404 | Workflow not active or wrong URL | Activate workflow; verify `N8N_BASE_URL` |
