const net = require('net');
const dns = require('dns');

const host = 'ep-dark-term-aq1uyd71.c-8.us-east-1.aws.neon.tech';
const port = 5432;

console.log("Resolving DNS...");
dns.resolve4(host, (err, addresses) => {
  if (err) console.error("IPv4 resolution failed:", err);
  else {
    console.log("IPv4 addresses:", addresses);
    addresses.forEach(ip => {
      testConnect(ip, "IPv4: " + ip);
    });
  }
});

dns.resolve6(host, (err, addresses) => {
  if (err) console.error("IPv6 resolution failed:", err);
  else {
    console.log("IPv6 addresses:", addresses);
    addresses.forEach(ip => {
      testConnect(ip, "IPv6: " + ip);
    });
  }
});

testConnect(host, "Hostname: " + host);

function testConnect(target, label) {
  const socket = new net.Socket();
  const startTime = Date.now();
  socket.setTimeout(5000);

  socket.connect(port, target, () => {
    console.log(`SUCCESS [${label}] Connected in ${Date.now() - startTime}ms`);
    socket.destroy();
  });

  socket.on('error', (err) => {
    console.error(`FAILED [${label}] Error:`, err.message);
  });

  socket.on('timeout', () => {
    console.error(`TIMEOUT [${label}]`);
    socket.destroy();
  });
}
