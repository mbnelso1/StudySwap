// lib/devUtils.js
import { networkInterfaces } from 'os';

/**
 * Helper to get all non-internal IPv4 addresses.
 */
function getAvailableIps() {
  const nets = networkInterfaces();
  const addresses = [];

  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      // Skip internal (localhost) and non-IPv4
      if (net.family === 'IPv4' && !net.internal) {
        addresses.push({ name, ip: net.address });
      }
    }
  }
  return addresses;
}

/**
 * Prints a helpful banner showing ALL access options.
 * @param {number} port 
 */
export function printDevBanner(port) {
  const ips = getAvailableIps();
  
  console.log('\n==================================================');
  console.log(`🚀 WebTouch Dev Server Running on Port ${port}`);
  console.log('==================================================');
  console.log(`\nSelect the correct URL for your network:`);
  
  if (ips.length === 0) {
    console.log(`   👉 http://localhost:${port} (Local Only)`);
  } else {
    ips.forEach(entry => {
      // Colorize the IP for visibility
      console.log(`   [${entry.name}]: \x1b[36mhttp://${entry.ip}:${port}/\x1b[0m`);
    });
  }

  console.log(`\n📱 To test on mobile:`);
  console.log(`   1. Connect phone to the same Wi-Fi.`);
  console.log(`   2. Open the 'Wi-Fi' or 'Ethernet' link above on THIS computer.`);
  console.log(`   3. Scan the QR code that appears.`);
  console.log('==================================================\n');
}