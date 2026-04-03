# Salesforce Automation Pipeline — n8n + LLM Integration

An end-to-end intelligent workflow automation system that integrates **n8n** with **Salesforce CRM**, **Google Calendar**, and **Google Sheets** to automatically convert meeting transcripts into actionable Salesforce tasks using **OpenAI GPT-4o**.

---

## What It Does

```
Meeting ends → Transcript detected → GPT analyzes transcript
    → Action items extracted → Tasks created in Salesforce
    → Everything logged to Google Sheets → Real-time progress sync
```

1. **Trigger**: Detects recently ended Google Calendar meetings (or accepts transcripts via webhook).
2. **AI Analysis**: Sends the transcript to OpenAI GPT-4o to extract:
   - Meeting summary and key insights
   - Action items with assignees, priorities, and due dates
   - Decisions made and follow-up requirements
3. **Salesforce Integration**: Looks up each assignee in Salesforce Contacts and creates a **Task** record with full context.
4. **Google Sheets Logging**: Logs meeting summaries, action items, and real-time task progress to structured Google Sheets tabs.

---

## Repository Structure

```
├── workflows/
│   └── meeting_automation_pipeline.json   # n8n workflow (import this)
├── scripts/
│   ├── validate_setup.js                  # Verifies all credentials & connections
│   └── process_transcript.js             # Manual transcript submission utility
├── docs/
│   └── setup_guide.md                    # Step-by-step setup instructions
├── .env.example                           # Environment variable template
├── package.json
└── README.md
```

---

## Quick Start

### 1. Clone & configure

```bash
git clone https://github.com/chandradhitiya/Salesforce-Automation-Pipeline-n8n-LLM-Integration-.git
cd Salesforce-Automation-Pipeline-n8n-LLM-Integration-
cp .env.example .env
# Edit .env with your API keys and IDs
```

### 2. Validate your setup

```bash
npm install
npm run validate
```

### 3. Import the workflow into n8n

1. Open your n8n instance.
2. Go to **Workflows → Import from File**.
3. Select `workflows/meeting_automation_pipeline.json`.
4. Configure the credentials for each node (OpenAI, Salesforce, Google Calendar, Google Sheets).
5. Set the workflow variables (`GOOGLE_CALENDAR_ID`, `GOOGLE_SHEETS_SPREADSHEET_ID`, `SALESFORCE_DEFAULT_OWNER_ID`).
6. **Activate** the workflow.

### 4. Test with a manual transcript

```bash
npm run submit-transcript -- \
  --file path/to/transcript.txt \
  --title "Q2 Planning Meeting" \
  --date "2024-06-01T14:00:00Z" \
  --attendees "Alice Johnson,Bob Smith"
```

---

## Workflow Architecture

```
TRIGGERS
├── Schedule (every 5 min) → Google Calendar: fetch ended meetings
└── Webhook POST /meeting-transcript → normalize payload
         │
         ▼
Filter: Has transcript text
         │
         ▼
OpenAI GPT-4o: analyze transcript
  → meeting summary, key insights, action items,
    assignee names/roles, priorities, due dates,
    decisions made, follow-up requirements
         │
         ▼
Parse Action Items (Code Node)
  → expands 1 meeting into N action item items
         │
    ┌────┴────┐
    ▼         ▼
Filter:   Google Sheets: Log Meeting Summary
Has Items
    │
    ▼
Salesforce: Lookup Assignee (by name in Contacts)
    │
    ▼
Salesforce: Create Task
  → Subject, Description, Priority, Due Date,
    WhoId (Contact), OwnerId (User)
    │
    ▼
Google Sheets: Log Action Items

PROGRESS SYNC (separate schedule)
Salesforce: Get All Meeting Tasks → Google Sheets: Sync Task Progress
```

---

## Google Sheets Structure

The workflow writes to **three tabs** in your spreadsheet:

| Tab | Purpose |
|-----|---------|
| `Meeting Summaries` | One row per meeting with AI-generated summary and insights |
| `Action Items` | One row per action item linked to its Salesforce Task ID |
| `Task Progress` | Real-time sync of Salesforce task statuses |

See [docs/setup_guide.md](docs/setup_guide.md) for the exact column structure.

---

## Supported Triggers

| Method | Description |
|--------|-------------|
| **Google Calendar** (automatic) | Polls calendar every 5 minutes; processes meetings whose description contains transcript text |
| **Webhook** (manual) | `POST /webhook/meeting-transcript` with a JSON payload containing transcript, title, date, and attendees |

---

## Requirements

| Service | What's needed |
|---------|--------------|
| n8n ≥ 1.30 | Self-hosted or n8n Cloud |
| OpenAI | API key with GPT-4o access |
| Salesforce | Developer org or above; Connected App with OAuth2 |
| Google | Calendar API + Sheets API enabled; OAuth2 credentials |

---

## Documentation

See **[docs/setup_guide.md](docs/setup_guide.md)** for:
- Detailed service setup (OpenAI, Salesforce Connected App, Google Cloud)
- n8n credential configuration
- Google Sheets column definitions
- Troubleshooting guide
