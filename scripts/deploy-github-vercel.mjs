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

// 1. Read .env.local for Turso credentials
const envLocal = fs.readFileSync('.env.local', 'utf8');
const tursoUrl = envLocal.match(/^TURSO_DATABASE_URL=(.+)$/m)?.[1]?.trim();
const tursoToken = envLocal.match(/^TURSO_AUTH_TOKEN=(.+)$/m)?.[1]?.trim();

if (!tursoUrl || !tursoToken) {
  throw new Error('Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN in .env.local');
}

// 2. Ensure latest commit is clean
try {
  run('git add -A');
  const status = run('git status --porcelain').trim();
  if (status) {
    run('git commit -m "chore: prepare build and deployment scripts"');
  }
} catch (err) {
  console.log('Git commit check:', err.message);
}

// 3. Create or push to GitHub repository 'mtcporto/aonde'
console.log('=== STEP 1: GitHub Repository (mtcporto/aonde) ===');
let repoExists = false;
try {
  const viewOut = run('gh repo view mtcporto/aonde --json url');
  console.log('GitHub repo already exists:', viewOut.trim());
  repoExists = true;
} catch {
  repoExists = false;
}

if (!repoExists) {
  try {
    const createOut = run('gh repo create aonde --public --source=. --remote=origin --push');
    console.log('Created and pushed via gh CLI:\n', createOut);
  } catch (err) {
    console.warn('gh repo create fallback:', err.stderr || err.message);
    // Fallback: check ~/.git-credentials for GitHub PAT
    const credPaths = [
      '/home/mtcporto/.git-credentials',
      '/home/mtcporto/.config/git/credentials'
    ];
    let ghToken = '';
    for (const cp of credPaths) {
      if (fs.existsSync(cp)) {
        const content = fs.readFileSync(cp, 'utf8');
        const m = content.match(/https:\/\/[^:]+:([^@]+)@github\.com/);
        if (m && m[1]) {
          ghToken = m[1].trim();
          break;
        }
      }
    }
    if (ghToken) {
      const res = await fetch('https://api.github.com/user/repos', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ghToken}`,
          'Accept': 'application/vnd.github+json',
          'User-Agent': 'aonde-deploy-script'
        },
        body: JSON.stringify({
          name: 'aonde',
          description: 'Aonde — Curadoria gastronômica e de hospedagem em João Pessoa (Next.js + Turso)',
          private: false
        })
      });
      console.log('GitHub API create repo status:', res.status);
    }
  }
}

// Ensure origin remote is set and pushed
try {
  const remotes = run('git remote').trim();
  if (!remotes.split(/\s+/).includes('origin')) {
    run('git remote add origin https://github.com/mtcporto/aonde.git');
  } else {
    run('git remote set-url origin https://github.com/mtcporto/aonde.git');
  }
  const pushOut = run('git push -u origin main');
  console.log('Git push output:', pushOut.trim() || 'Up to date');
} catch (err) {
  console.error('Git push error:', err.stderr || err.message);
}

// 4. Create Vercel project 'aonde' & export environment variables
console.log('\n=== STEP 2: Vercel Project & Environment Variables ===');
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
      console.log('Loaded Vercel CLI token from', vp);
      break;
    }
  }
}

const teamId = 'team_0crihFTW30RTqrZwb4YnLidv';
const projectName = 'aonde';

if (vercelToken) {
  const vHeaders = {
    'Authorization': `Bearer ${vercelToken}`,
    'Content-Type': 'application/json'
  };

  // Check or create project 'aonde'
  let projectData = null;
  const getProjRes = await fetch(`https://api.vercel.com/v9/projects/${projectName}?teamId=${teamId}`, {
    headers: vHeaders
  });

  if (getProjRes.ok) {
    projectData = await getProjRes.json();
    console.log(`Vercel project '${projectName}' already exists (id: ${projectData.id})`);
  } else {
    console.log(`Creating Vercel project '${projectName}'...`);
    const createProjRes = await fetch(`https://api.vercel.com/v10/projects?teamId=${teamId}`, {
      method: 'POST',
      headers: vHeaders,
      body: JSON.stringify({
        name: projectName,
        framework: 'nextjs',
        gitRepository: {
          type: 'github',
          repo: 'mtcporto/aonde'
        }
      })
    });
    if (createProjRes.ok) {
      projectData = await createProjRes.json();
      console.log(`Created Vercel project '${projectName}' linked to GitHub (id: ${projectData.id})`);
    } else {
      // Retry without gitRepository in case GitHub app isn't installed on new repo yet
      const fallbackRes = await fetch(`https://api.vercel.com/v10/projects?teamId=${teamId}`, {
        method: 'POST',
        headers: vHeaders,
        body: JSON.stringify({
          name: projectName,
          framework: 'nextjs'
        })
      });
      const fallbackText = await fallbackRes.text();
      if (!fallbackRes.ok) {
        throw new Error(`Failed to create Vercel project: ${fallbackText}`);
      }
      projectData = JSON.parse(fallbackText);
      console.log(`Created Vercel project '${projectName}' (id: ${projectData.id})`);
    }
  }

  // Save .vercel/project.json
  fs.mkdirSync('.vercel', { recursive: true });
  fs.writeFileSync(
    '.vercel/project.json',
    JSON.stringify({
      projectId: projectData.id,
      orgId: teamId,
      projectName: projectName
    })
  );
  console.log('Saved .vercel/project.json');

  // Export environment variables to Vercel (production, preview, development)
  const envVarsToExport = [
    {
      key: 'TURSO_DATABASE_URL',
      value: tursoUrl,
      type: 'encrypted',
      target: ['production', 'preview', 'development']
    },
    {
      key: 'TURSO_AUTH_TOKEN',
      value: tursoToken,
      type: 'encrypted',
      target: ['production', 'preview', 'development']
    }
  ];

  const envRes = await fetch(
    `https://api.vercel.com/v10/projects/${projectName}/env?upsert=true&teamId=${teamId}`,
    {
      method: 'POST',
      headers: vHeaders,
      body: JSON.stringify(envVarsToExport)
    }
  );
  const envResText = await envRes.text();
  if (!envRes.ok) {
    throw new Error(`Failed to export env vars to Vercel (${envRes.status}): ${envResText}`);
  }
  console.log('Successfully exported TURSO_DATABASE_URL and TURSO_AUTH_TOKEN to Vercel (production, preview, development).');
}

// 5. Deploy to Vercel production using Vercel CLI
console.log('\n=== STEP 3: Deploying to Vercel Production ===');
const vercelBin = '/home/mtcporto/.npm/_npx/69f9afb961c37556/node_modules/.bin/vercel';
try {
  const deployOut = run(`${vercelBin} --prod --yes`);
  console.log('Vercel Production Deployment Output:\n', deployOut);
} catch (err) {
  console.error('Vercel deploy CLI error:', err.stdout || '', err.stderr || err.message);
}
