import fs from 'node:fs';
import { execSync } from 'node:child_process';

const envPath = {
  ...process.env,
  PATH: `/usr/bin:/bin:/usr/local/bin:${process.env.PATH || ''}`
};

function run(cmd, opts = {}) {
  console.log(`\n> ${cmd}`);
  return execSync(cmd, {
    stdio: 'pipe',
    encoding: 'utf8',
    env: envPath,
    ...opts
  });
}

// 1. Commit and push CSS & UI fixes to GitHub
try {
  run('git add -A');
  const status = run('git status --porcelain').trim();
  if (status) {
    run('git commit -m "fix: bundle compiled Tailwind CSS and refine card layout"');
  }
  const pushOut = run('git push origin main');
  console.log('Pushed to GitHub:', pushOut.trim() || 'Up to date');
} catch (err) {
  console.error('Git push note:', err.stderr || err.message);
}

// 2. Load Vercel CLI token
const vercelAuthPaths = [
  '/home/mtcporto/.local/share/com.vercel.cli/auth.json',
  '/home/mtcporto/.config/com.vercel.cli/auth.json'
];

let vercelToken = '';
for (const vp of vercelAuthPaths) {
  if (fs.existsSync(vp)) {
    const authJson = JSON.parse(fs.readFileSync(vp, 'utf8'));
    if (authJson.token) {
      vercelToken = authJson.token;
      break;
    }
  }
}

const teamId = 'team_0crihFTW30RTqrZwb4YnLidv';
const projectName = 'aonde';

// 3. Deploy to Vercel production
const vercelBin = '/home/mtcporto/.npm/_npx/69f9afb961c37556/node_modules/.bin/vercel';
let deployUrl = '';
const deployOut = run(`${vercelBin} --prod --yes`);
console.log('Vercel Deploy Output:\n', deployOut);

try {
  const parsed = JSON.parse(deployOut);
  deployUrl = parsed?.deployment?.url || '';
} catch {
  const m = deployOut.match(/https:\/\/aonde-[a-z0-9-]+\.vercel\.app/);
  if (m) deployUrl = m[0];
}

// 4. Configure clean domain (try aonde.vercel.app, then aonde-jp.vercel.app, aonde-jpa.vercel.app)
if (vercelToken) {
  const vHeaders = {
    'Authorization': `Bearer ${vercelToken}`,
    'Content-Type': 'application/json'
  };

  const candidateDomains = [
    'aonde.vercel.app',
    'aonde-jp.vercel.app',
    'aonde-jpa.vercel.app'
  ];

  const assignedDomains = [];
  for (const domain of candidateDomains) {
    const addRes = await fetch(
      `https://api.vercel.com/v10/projects/${projectName}/domains?teamId=${teamId}`,
      {
        method: 'POST',
        headers: vHeaders,
        body: JSON.stringify({ name: domain })
      }
    );
    const addData = await addRes.json();
    if (addRes.ok || addData?.error?.code === 'domain_already_in_use') {
      console.log(`Domain status for ${domain}:`, addRes.status, addData?.name || addData?.error?.message);
      if (addRes.ok) {
        assignedDomains.push(domain);
        break;
      }
    } else {
      console.log(`Could not claim ${domain}:`, addData?.error?.message || addRes.status);
    }
  }

  // Also alias the deployment to the clean domain if we have deployUrl
  if (deployUrl && assignedDomains.length > 0) {
    for (const d of assignedDomains) {
      try {
        const aliasOut = run(`${vercelBin} alias set ${deployUrl} ${d}`);
        console.log(`Aliased ${deployUrl} -> ${d}:`, aliasOut.trim());
      } catch (err) {
        console.log(`Alias note for ${d}:`, err.stderr || err.message);
      }
    }
  }

  // Fetch all active domains on the project
  const domRes = await fetch(
    `https://api.vercel.com/v9/projects/${projectName}/domains?teamId=${teamId}`,
    { headers: vHeaders }
  );
  if (domRes.ok) {
    const domData = await domRes.json();
    console.log('Active Project Domains:', (domData.domains || []).map(d => `https://${d.name}`));
  }
}
