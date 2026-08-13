const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const { parseChatFile } = require('./parser');

const PORT = 3000;
const DB_DIR = path.join(__dirname, 'db');
const CHAT_FILE = path.join(DB_DIR, '_chat.txt');

// Cache variables
let cachedMessages = [];
let cachedStats = {};

// Parse chat log and precalculate statistics
function loadData() {
  try {
    console.log('Parsing WhatsApp chat log...');
    cachedMessages = parseChatFile(CHAT_FILE);
    console.log(`Successfully parsed ${cachedMessages.length} messages.`);
    calculateStats();
  } catch (err) {
    console.error('Error reading/parsing chat log:', err);
  }
}

// Compute statistics for the dashboard
function calculateStats() {
  const userActivity = {};
  const mediaStats = { text: 0, image: 0, video: 0, audio: 0, document: 0, sticker: 0, contact: 0, gif: 0, unknown: 0 };
  const hourlyActivity = Array(24).fill(0);
  const dailyActivity = {};
  let totalMessages = 0;

  for (const msg of cachedMessages) {
    if (msg.isSystem) continue;

    totalMessages++;

    // Message frequency by sender
    userActivity[msg.sender] = (userActivity[msg.sender] || 0) + 1;

    // Media type distribution
    if (msg.attachment) {
      const type = msg.attachment.mediaType;
      mediaStats[type] = (mediaStats[type] || 0) + 1;
    } else {
      mediaStats.text++;
    }

    // Time-of-day distribution
    const hour = msg.timestamp.hour;
    if (hour >= 0 && hour < 24) {
      hourlyActivity[hour]++;
    }

    // Date timeline distribution
    const dateStr = msg.dateStr;
    dailyActivity[dateStr] = (dailyActivity[dateStr] || 0) + 1;
  }

  // Sort senders by activity volume
  const sortedUserActivity = Object.entries(userActivity)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  cachedStats = {
    totalMessages,
    userActivity: sortedUserActivity,
    mediaStats,
    hourlyActivity,
    dailyActivity
  };
}

// Extension to MIME type mapping
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.opus': 'audio/ogg', // opus container works well served as ogg
  '.ogg': 'audio/ogg',
  '.mp3': 'audio/mpeg',
  '.pdf': 'application/pdf',
  '.vcf': 'text/vcard',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url);
  let pathname = parsedUrl.pathname;

  // Handle JSON APIs
  if (pathname === '/api/messages') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(cachedMessages));
    return;
  }

  if (pathname === '/api/stats') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(cachedStats));
    return;
  }

  // Handle serving backup attachments from /db/
  if (pathname.startsWith('/db/')) {
    const filename = decodeURIComponent(pathname.substring(4));
    const filePath = path.join(DB_DIR, filename);

    // Verify requesting path is strictly within the db folder (prevent directory traversal)
    if (!filePath.startsWith(DB_DIR)) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      res.end('Forbidden');
      return;
    }

    fs.stat(filePath, (err, stats) => {
      if (err || !stats.isFile()) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('File not found');
        return;
      }

      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';

      // Support Range headers (critical for seeking in HTML5 audio/video, especially on Safari)
      const range = req.headers.range;
      if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : stats.size - 1;

        if (start >= stats.size || end >= stats.size) {
          res.writeHead(416, { 'Content-Range': `bytes */${stats.size}` });
          res.end();
          return;
        }

        const chunksize = (end - start) + 1;
        const fileStream = fs.createReadStream(filePath, { start, end });

        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${stats.size}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunksize,
          'Content-Type': contentType,
        });

        fileStream.pipe(res);
      } else {
        res.writeHead(200, {
          'Content-Type': contentType,
          'Content-Length': stats.size,
          'Accept-Ranges': 'bytes'
        });
        fs.createReadStream(filePath).pipe(res);
      }
    });
    return;
  }

  // Handle static web client files
  if (pathname === '/' || pathname === '/index.html') {
    pathname = '/index.html';
  }

  const staticFilePath = path.join(__dirname, pathname);

  // Security check for workspace static files
  if (!staticFilePath.startsWith(__dirname)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  fs.stat(staticFilePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
      return;
    }

    const ext = path.extname(staticFilePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'text/plain; charset=utf-8';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': stats.size
    });

    fs.createReadStream(staticFilePath).pipe(res);
  });
});

// Load the chat data initially
loadData();

// Start the server
server.listen(PORT, () => {
  console.log(`WhatsApp Chat Viewer server is online at: http://localhost:${PORT}`);
});
