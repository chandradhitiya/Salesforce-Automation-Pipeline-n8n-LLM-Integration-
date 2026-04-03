#!/usr/bin/env node
/**
 * Transcript Processor — Manual Submission Utility
 *
 * Sends a meeting transcript to the n8n webhook endpoint for processing.
 * Useful for testing the pipeline or for manually submitting transcripts
 * that were not automatically captured from Google Calendar.
 *
 * Usage:
 *   node scripts/process_transcript.js --file transcript.txt \
 *        --title "Q2 Planning" \
 *        --date "2024-06-01T14:00:00Z" \
 *        --attendees "Alice Johnson,Bob Smith,Carol Davis"
 *
 *   node scripts/process_transcript.js --stdin \
 *        --title "Engineering Standup" \
 *        --attendees "team@company.com"
 *
 * Prerequisites:
 *   npm install node-fetch dotenv
 */

'use strict';

require('dotenv').config();

const fs = require('fs');
const https = require('https');
const http = require('http');
const path = require('path');

// ─── CLI Argument Parsing ─────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        args[key] = next;
        i++;
      } else {
        args[key] = true;
      }
    }
  }
  return args;
}

// ─── HTTP Helper ──────────────────────────────────────────────────────────────

function postJSON(url, payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const lib = url.startsWith('https') ? https : http;
    const parsed = new URL(url);

    const options = {
      hostname: parsed.hostname,
      port: parsed.port || (url.startsWith('https') ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = lib.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs(process.argv);

  // ── Resolve transcript text ──
  let transcript = '';

  if (args.file) {
    const filePath = path.resolve(args.file);
    if (!fs.existsSync(filePath)) {
      console.error(`❌  File not found: ${filePath}`);
      process.exit(1);
    }
    transcript = fs.readFileSync(filePath, 'utf8');
    console.log(`📄  Loaded transcript from: ${filePath} (${transcript.length} chars)`);
  } else if (args.stdin) {
    transcript = fs.readFileSync(0, 'utf8');  // fd 0 = stdin (cross-platform)
    console.log(`📄  Loaded transcript from stdin (${transcript.length} chars)`);
  } else if (args.text) {
    transcript = args.text;
  } else {
    console.error('❌  Provide a transcript via --file <path>, --stdin, or --text "<content>"');
    console.error('');
    console.error('Usage:');
    console.error('  node scripts/process_transcript.js --file transcript.txt \\');
    console.error('       --title "Q2 Planning" --date "2024-06-01T14:00:00Z" \\');
    console.error('       --attendees "Alice Johnson,Bob Smith"');
    process.exit(1);
  }

  if (!transcript.trim()) {
    console.error('❌  Transcript is empty — nothing to process');
    process.exit(1);
  }

  // ── Build webhook URL ──
  const baseUrl = (process.env.N8N_BASE_URL || args['n8n-url'] || '').replace(/\/$/, '');
  const webhookPath = process.env.N8N_WEBHOOK_PATH || args['webhook-path'] || 'meeting-transcript';

  if (!baseUrl) {
    console.error('❌  N8N_BASE_URL is not set. Set it in .env or pass --n8n-url <url>');
    process.exit(1);
  }

  const webhookUrl = `${baseUrl}/webhook/${webhookPath}`;

  // ── Build payload ──
  const meetingDate = args.date || new Date().toISOString();
  const attendees = args.attendees
    ? args.attendees.split(',').map((a) => a.trim())
    : [];

  const payload = {
    meeting_title: args.title || 'Meeting Transcript',
    meeting_id: args['meeting-id'] || `manual-${Date.now()}`,
    meeting_date: meetingDate,
    meeting_end_date: args['end-date'] || meetingDate,
    meeting_link: args.link || '',
    attendees,
    transcript,
  };

  // ── Submit ──
  console.log(`\n🚀  Submitting transcript to: ${webhookUrl}`);
  console.log(`    Meeting: "${payload.meeting_title}"`);
  console.log(`    Date:    ${payload.meeting_date}`);
  if (attendees.length) console.log(`    Attendees: ${attendees.join(', ')}`);
  console.log('');

  try {
    const res = await postJSON(webhookUrl, payload);

    if (res.status >= 200 && res.status < 300) {
      console.log('✅  Transcript submitted successfully!');
      if (res.body && res.body.workflow_execution_id) {
        console.log(`    Workflow Execution ID: ${res.body.workflow_execution_id}`);
      }
      console.log('\n    The pipeline will now:');
      console.log('    1. Analyze the transcript with OpenAI GPT');
      console.log('    2. Extract action items and responsibilities');
      console.log('    3. Create tasks in Salesforce');
      console.log('    4. Log everything to Google Sheets');
    } else {
      console.error(`❌  Submission failed with status ${res.status}:`);
      console.error(JSON.stringify(res.body, null, 2));
      process.exit(1);
    }
  } catch (err) {
    console.error(`❌  Network error: ${err.message}`);
    console.error('    Is n8n running and the webhook workflow active?');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
