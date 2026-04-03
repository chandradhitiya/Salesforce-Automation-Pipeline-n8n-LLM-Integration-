#!/usr/bin/env node
/**
 * Setup Validation Script
 *
 * Verifies that all required environment variables and external service
 * connections (OpenAI, Salesforce, Google) are properly configured before
 * importing the n8n workflow.
 *
 * Usage:
 *   node scripts/validate_setup.js
 *
 * Prerequisites:
 *   npm install node-fetch dotenv
 */

'use strict';

require('dotenv').config();

const https = require('https');
const http = require('http');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pass(msg) { console.log(`  ✅  ${msg}`); }
function fail(msg) { console.error(`  ❌  ${msg}`); }
function warn(msg) { console.warn(`  ⚠️   ${msg}`); }
function section(title) { console.log(`\n── ${title} ${'─'.repeat(50 - title.length)}`); }

/**
 * Simple HTTP(S) GET/POST returning a Promise<{status, body}>.
 */
function request(url, options = {}) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.request(url, options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

// ─── Checks ───────────────────────────────────────────────────────────────────

const REQUIRED_VARS = [
  'OPENAI_API_KEY',
  'SALESFORCE_INSTANCE_URL',
  'SALESFORCE_CLIENT_ID',
  'SALESFORCE_CLIENT_SECRET',
  'SALESFORCE_USERNAME',
  'SALESFORCE_PASSWORD',
  'SALESFORCE_SECURITY_TOKEN',
  'SALESFORCE_DEFAULT_OWNER_ID',
  'GOOGLE_CALENDAR_ID',
  'GOOGLE_SHEETS_SPREADSHEET_ID',
  'N8N_BASE_URL',
];

const OPTIONAL_VARS = [
  'OPENAI_MODEL',
  'N8N_WEBHOOK_PATH',
  'N8N_API_KEY',
];

function checkEnvVars() {
  section('Environment Variables');
  let allPresent = true;

  for (const v of REQUIRED_VARS) {
    if (process.env[v]) {
      pass(`${v} is set`);
    } else {
      fail(`${v} is NOT set (required)`);
      allPresent = false;
    }
  }

  for (const v of OPTIONAL_VARS) {
    if (process.env[v]) {
      pass(`${v} is set`);
    } else {
      warn(`${v} is not set (optional, default will be used)`);
    }
  }

  return allPresent;
}

async function checkOpenAI() {
  section('OpenAI API');
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) { fail('OPENAI_API_KEY not set — skipping'); return false; }

  try {
    const res = await request('https://api.openai.com/v1/models', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (res.status === 200) {
      const data = JSON.parse(res.body);
      const model = process.env.OPENAI_MODEL || 'gpt-4o';
      const modelAvailable = data.data?.some((m) => m.id === model);
      pass('OpenAI API is reachable');
      modelAvailable
        ? pass(`Model "${model}" is available`)
        : warn(`Model "${model}" not found in your account — verify the model name`);
      return true;
    } else if (res.status === 401) {
      fail('OpenAI API key is invalid (401 Unauthorized)');
    } else {
      fail(`OpenAI API returned unexpected status ${res.status}`);
    }
  } catch (err) {
    fail(`Cannot reach OpenAI API: ${err.message}`);
  }
  return false;
}

async function checkSalesforce() {
  section('Salesforce');
  const {
    SALESFORCE_INSTANCE_URL: instanceUrl,
    SALESFORCE_CLIENT_ID: clientId,
    SALESFORCE_CLIENT_SECRET: clientSecret,
    SALESFORCE_USERNAME: username,
    SALESFORCE_PASSWORD: password,
    SALESFORCE_SECURITY_TOKEN: token,
  } = process.env;

  if (!instanceUrl || !clientId || !clientSecret || !username || !password || !token) {
    fail('One or more Salesforce credentials are missing — skipping');
    return false;
  }

  try {
    // Attempt OAuth2 username-password flow
    const loginUrl = new URL('/services/oauth2/token', instanceUrl);
    const body = new URLSearchParams({
      grant_type: 'password',
      client_id: clientId,
      client_secret: clientSecret,
      username,
      password: `${password}${token}`,
    }).toString();

    const res = await request(loginUrl.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    if (res.status === 200) {
      const data = JSON.parse(res.body);
      pass(`Salesforce authentication successful (instance: ${data.instance_url})`);

      // Verify the default owner ID exists
      const SF_API_VERSION = process.env.SALESFORCE_API_VERSION || 'v59.0';
      const ownerId = process.env.SALESFORCE_DEFAULT_OWNER_ID;
      if (ownerId) {
        const userRes = await request(
          `${data.instance_url}/services/data/${SF_API_VERSION}/sobjects/User/${ownerId}`,
          {
            method: 'GET',
            headers: { Authorization: `Bearer ${data.access_token}` },
          }
        );
        userRes.status === 200
          ? pass(`Default owner ID "${ownerId}" is valid`)
          : warn(`Default owner ID "${ownerId}" not found — check SALESFORCE_DEFAULT_OWNER_ID`);
      }
      return true;
    } else {
      const errData = JSON.parse(res.body);
      fail(`Salesforce login failed: ${errData[0]?.errorCode} — ${errData[0]?.message}`);
    }
  } catch (err) {
    fail(`Cannot reach Salesforce: ${err.message}`);
  }
  return false;
}

function checkGoogleConfig() {
  section('Google Workspace Config');
  let ok = true;

  const calId = process.env.GOOGLE_CALENDAR_ID;
  const sheetsId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;

  if (calId) {
    pass(`GOOGLE_CALENDAR_ID is set: "${calId}"`);
  } else {
    fail('GOOGLE_CALENDAR_ID is not set');
    ok = false;
  }

  if (sheetsId) {
    pass(`GOOGLE_SHEETS_SPREADSHEET_ID is set: "${sheetsId}"`);
  } else {
    fail('GOOGLE_SHEETS_SPREADSHEET_ID is not set');
    ok = false;
  }

  warn('Google OAuth2 credentials must be configured directly in n8n (see docs/setup_guide.md)');
  return ok;
}

function checkN8nConfig() {
  section('n8n Configuration');
  const baseUrl = process.env.N8N_BASE_URL;
  const webhookPath = process.env.N8N_WEBHOOK_PATH || 'meeting-transcript';

  if (baseUrl) {
    pass(`N8N_BASE_URL: ${baseUrl}`);
    pass(`Webhook endpoint will be: ${baseUrl}/webhook/${webhookPath}`);
  } else {
    fail('N8N_BASE_URL is not set');
    return false;
  }
  return true;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║  Salesforce Automation Pipeline — Setup Validation   ║');
  console.log('╚══════════════════════════════════════════════════════╝');

  const envOk = checkEnvVars();
  const openAiOk = await checkOpenAI();
  const sfOk = await checkSalesforce();
  const googleOk = checkGoogleConfig();
  const n8nOk = checkN8nConfig();

  section('Summary');
  const results = [
    ['Environment Variables', envOk],
    ['OpenAI API', openAiOk],
    ['Salesforce', sfOk],
    ['Google Workspace Config', googleOk],
    ['n8n Config', n8nOk],
  ];

  let allPassed = true;
  for (const [name, ok] of results) {
    ok ? pass(name) : fail(name);
    if (!ok) allPassed = false;
  }

  console.log('');
  if (allPassed) {
    console.log('🎉  All checks passed! You can now import the workflow into n8n.');
    console.log('    See docs/setup_guide.md for import instructions.\n');
    process.exit(0);
  } else {
    console.error('🚫  Some checks failed. Please fix the issues above before proceeding.\n');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
