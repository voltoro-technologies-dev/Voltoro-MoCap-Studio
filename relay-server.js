import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';
import fs from 'fs';
import path from 'path';
import os from 'os';

const PORT = 8080;
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify({ status: 'Voltoro MoCap Relay Server Running', port: PORT }));
});

const wss = new WebSocketServer({ server });

let clientCount = 0;
let lastPacketTime = Date.now();
let fpsCounter = 0;
let currentFps = 0;

setInterval(() => {
  currentFps = fpsCounter;
  fpsCounter = 0;
}, 1000);

wss.on('connection', (ws, req) => {
  clientCount++;
  const clientIp = req.socket.remoteAddress;
  console.log(`[MoCap Relay] Client connected (${clientIp}). Total connected: ${clientCount}`);

  ws.on('message', (message, isBinary) => {
    fpsCounter++;
    // Broadcast to all other connected clients (e.g. Unity C# receiver, Unreal OSC/WebSocket bridge)
    wss.clients.forEach((client) => {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(message, { binary: isBinary });
      }
    });
  });

  ws.on('close', () => {
    clientCount--;
    console.log(`[MoCap Relay] Client disconnected. Total connected: ${clientCount}`);
  });

  ws.on('error', (err) => {
    console.error('[MoCap Relay] Socket error:', err.message);
  });
});

function getLocalIpAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push(iface.address);
      }
    }
  }
  return addresses;
}

server.listen(PORT, '0.0.0.0', () => {
  const ips = getLocalIpAddresses();
  console.log(`\n======================================================`);
  console.log(`⚡ VOLTORO MOCAP REAL-TIME RELAY SERVER ACTIVE ⚡`);
  console.log(`======================================================`);
  console.log(`📡 Local Port: ${PORT}`);
  console.log(`📱 Connect your Mobile Browser to:`);
  ips.forEach(ip => console.log(`   -> http://${ip}:5173 (MoCap Studio Web)`));
  console.log(`🎮 Unity C# & Unreal Engine Listen Target:`);
  ips.forEach(ip => console.log(`   -> ws://${ip}:${PORT}`));
  console.log(`======================================================\n`);
});
