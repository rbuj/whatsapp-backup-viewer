const fs = require('fs');
const path = require('path');

function parseChatFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);
  const messages = [];
  let currentMessage = null;
  let groupAdminName = null;

  // Pattern to match date [6/11/25 15:44:01] Sender: Message
  // Support both 24h format and other variations, handling optional leading LRM/RLM characters
  const headerRegex = /^\[(\d{1,2})\/(\d{1,2})\/(\d{2,4}),?\s+(\d{1,2}):(\d{2}):(\d{2})\]\s*([^:]+):\s*(.*)$/;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    // Clean left-to-right (U+200E) and right-to-left (U+200F) marks
    const cleanedLine = rawLine.replace(/[\u200e\u200f]/g, '');

    const match = cleanedLine.match(headerRegex);

    if (match) {
      // Save the previous message before starting a new one
      if (currentMessage) {
        messages.push(currentMessage);
      }

      const day = parseInt(match[1], 10);
      const month = parseInt(match[2], 10);
      let year = parseInt(match[3], 10);
      if (year < 100) {
        year += 2000; // Normalize 2-digit years to 20xx
      }
      const hour = parseInt(match[4], 10);
      const minute = parseInt(match[5], 10);
      const second = parseInt(match[6], 10);

      const senderRaw = match[7].trim();
      const rawText = match[8];

      // Normalize sender: strip leading "~" and trim spaces
      const sender = senderRaw.replace(/^~\s*/, '').trim();

      // Extract and remove any media attachment tags
      const attachmentMatch = rawText.match(/<adjunt:\s*([^>]+)>/i);
      let attachment = null;
      let text = rawText;

      if (attachmentMatch) {
        const filename = attachmentMatch[1].trim();
        const ext = path.extname(filename).toLowerCase();
        let mediaType = 'unknown';

        if (['.jpg', '.jpeg', '.png', '.gif'].includes(ext)) {
          mediaType = 'image';
        } else if (['.mp4', '.mov', '.avi'].includes(ext)) {
          if (filename.toLowerCase().includes('-gif-')) {
            mediaType = 'gif';
          } else {
            mediaType = 'video';
          }
        } else if (['.opus', '.ogg', '.mp3', '.m4a', '.wav'].includes(ext)) {
          mediaType = 'audio';
        } else if (['.pdf', '.docx', '.xlsx', '.txt'].includes(ext)) {
          mediaType = 'document';
        } else if (['.vcf'].includes(ext)) {
          mediaType = 'contact';
        } else if (['.webp'].includes(ext)) {
          mediaType = 'sticker';
        }

        attachment = {
          filename,
          mediaType,
          ext
        };

        // Remove the attachment tag from the text
        text = rawText.replace(/<adjunt:\s*([^>]+)>/i, '').trim();
      }

      // Check for system message pattern.
      // The group administrator is inferred from the first creation message.
      let isSystem = false;
      const groupCreationPattern = /ha creat el grup|created the group|ha creado el grupo|has created this group/i;

      if (!groupAdminName && groupCreationPattern.test(text)) {
        groupAdminName = sender;
      }

      if (sender === 'Vecinos') {
        isSystem = true;
      } else {
        const systemPatterns = [
          groupCreationPattern,
          /t'ha afegit/,
          /ha afegit/,
          /Has canviat la icona/,
          /ha canviat la icona/,
          /ha sortit/,
          /t'ha eliminat/,
          /ha eliminat/
        ];
        if (systemPatterns.some(p => p.test(text))) {
          isSystem = true;
        }
      }

      currentMessage = {
        id: messages.length,
        timestamp: { day, month, year, hour, minute, second },
        dateStr: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
        timeStr: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
        sender,
        text,
        attachment,
        isSystem,
        adminName: groupAdminName
      };
    } else {
      // Continuation line for the current message
      if (currentMessage) {
        // Clean and append multiline text
        currentMessage.text += '\n' + cleanedLine;
      }
    }
  }

  // Add the last message
  if (currentMessage) {
    messages.push(currentMessage);
  }

  return messages;
}

module.exports = { parseChatFile };
