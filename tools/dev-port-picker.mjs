import net from 'node:net';
import { execSync } from 'node:child_process';

function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    // Listen on default interface (covers dual-stack IPv4/IPv6)
    server.listen(port);
  });
}

async function findAvailablePort(startPort = 3000, maxAttempts = 30) {
  const initialPort = parseInt(process.env.PORT || String(startPort), 10);
  for (let port = initialPort; port < initialPort + maxAttempts; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  return initialPort;
}

async function main() {
  const port = await findAvailablePort(3000);
  console.log(`[dev-port-picker] Found available frontend port: ${port}. Starting Next.js...`);

  try {
    execSync(`npx next dev -p ${port}`, {
      stdio: 'inherit',
      cwd: process.cwd(),
      env: { ...process.env, PORT: String(port) }
    });
  } catch (err) {
    if (err.status !== undefined && err.status !== null) {
      process.exit(err.status);
    }
  }
}

main();
