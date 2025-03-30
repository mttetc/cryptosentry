import fs from 'fs';
import path from 'path';

export const LOG_DIR = path.join(process.cwd(), 'logs');
export const MAX_LOG_SIZE = 5 * 1024 * 1024; // 5MB
export const MAX_LOG_FILES = 5;

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Rotate logs if needed
export function rotateLogFile(logPath: string) {
  if (!fs.existsSync(logPath)) return;

  const stats = fs.statSync(logPath);
  if (stats.size < MAX_LOG_SIZE) return;

  // Rotate existing log files
  for (let i = MAX_LOG_FILES - 1; i > 0; i--) {
    const oldPath = `${logPath}.${i}`;
    const newPath = `${logPath}.${i + 1}`;
    if (fs.existsSync(oldPath)) {
      if (i === MAX_LOG_FILES - 1) {
        fs.unlinkSync(oldPath);
      } else {
        fs.renameSync(oldPath, newPath);
      }
    }
  }

  // Rename current log file
  fs.renameSync(logPath, `${logPath}.1`);
}
