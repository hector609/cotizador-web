#!/usr/bin/env node

import fs from 'fs';
import https from 'https';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Read Vercel auth token from CLI config
 */
function getVercelToken() {
  const authPaths = [
    path.join(process.env.USERPROFILE || process.env.HOME, 'AppData/Roaming/com.vercel.cli/Data/auth.json'),
    path.join(process.env.HOME || process.env.USERPROFILE, '.local/share/com.vercel.cli/auth.json'),
    path.join(process.env.HOME || process.env.USERPROFILE, '.vercelrc'),
  ];

  for (const authPath of authPaths) {
    try {
      if (fs.existsSync(authPath)) {
        const content = fs.readFileSync(authPath, 'utf-8');
        const data = JSON.parse(content);
        if (data.token) return data.token;
        if (Array.isArray(data) && data[0]?.token) return data[0].token;
      }
    } catch (e) {
      // Continue to next path
    }
  }

  const envToken = process.env.VERCEL_TOKEN;
  if (envToken) return envToken;

  throw new Error('❌ No Vercel token found. Set VERCEL_TOKEN or run `vercel login`');
}

/**
 * Make HTTPS request to Vercel API
 */
function httpsRequest(method, path, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.vercel.com',
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 400) {
            reject(new Error(`Vercel API ${res.statusCode}: ${parsed.message || data}`));
          } else {
            resolve(parsed);
          }
        } catch {
          reject(new Error(`Failed to parse response: ${data}`));
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

/**
 * Regex validators for secret formats
 */
const validators = {
  SESSION_SECRET: (val) => /^[a-f0-9]{64,}$/i.test(val),
  BOT_API_URL: (val) => /^https:\/\/cmdemobot\.fly\.dev/.test(val),
  ANTHROPIC_API_KEY: (val) => /^sk-ant-/.test(val),
  TELEGRAM_BOT_TOKEN: (val) => /^\d+:[\w-]+$/.test(val),
  WEBHOOK_SECRET: (val) => /^[a-f0-9]{64,}$/i.test(val),
  NEXT_PUBLIC_APP_URL: (val) => /^https?:\/\//.test(val),
};

const requiredVars = Object.keys(validators);

/**
 * Main check
 */
async function checkEnvSync() {
  try {
    console.log('🔍 Checking Vercel environment variables...\n');

    const token = getVercelToken();
    const projectId = process.env.VERCEL_PROJECT_ID || 'cotizador-web';

    // Fetch env vars from Vercel
    const response = await httpsRequest('GET', `/v9/projects/${projectId}/env?decrypt=true`, {
      Authorization: `Bearer ${token}`,
    });

    const envVars = (response.envs || response.env || []).reduce((acc, env) => {
      acc[env.key] = env.value || env.decrypted || '';
      return acc;
    }, {});

    let hasErrors = false;
    const results = [];

    for (const key of requiredVars) {
      const value = envVars[key] || '';
      const validator = validators[key];
      const isValid = value && validator(value);

      if (isValid) {
        results.push(`✅ ${key}`);
      } else {
        hasErrors = true;
        results.push(`❌ ${key}`);

        if (!value) {
          console.log(`\n❌ ${key} is EMPTY in Vercel production\n`);
        } else {
          console.log(`\n❌ ${key} has invalid format: "${value.substring(0, 20)}..."\n`);
        }

        // Generate fix command
        console.log(`Fix:\n`);
        console.log(
          `  vercel env add ${key}\n` +
          `  # or via API:\n` +
          `  curl -X POST https://api.vercel.com/v10/projects/${projectId}/env \\`,
        );
        console.log(
          `    -H "Authorization: Bearer $TOKEN" \\` + `    -d '{"key":"${key}","value":"<paste-here>","target":["production","preview"]}'`,
        );
        console.log();
      }
    }

    console.log('\n' + results.join('\n'));

    if (hasErrors) {
      console.log('\n❌ Some environment variables are missing or invalid.');
      process.exit(1);
    } else {
      console.log('\n✅ All critical environment variables are OK.');
      process.exit(0);
    }
  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
    process.exit(1);
  }
}

checkEnvSync();
