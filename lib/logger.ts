'use server';

import fs from 'fs';
import path from 'path';
import { createServerSupabaseClient } from '@/lib/supabase-server';

const LOG_DIR = path.join(process.cwd(), 'logs');
const MAX_LOG_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_LOG_FILES = 5;

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Rotate logs if needed
function rotateLogFile(logPath: string) {
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

// Log to file and database if critical
export async function log(level: 'info' | 'warn' | 'error', message: string, data?: any) {
  const timestamp = new Date().toISOString();
  const logPath = path.join(LOG_DIR, `${level}.log`);

  // Rotate log if needed
  rotateLogFile(logPath);

  // Format log entry
  const logEntry =
    JSON.stringify({
      timestamp,
      level,
      message,
      data,
    }) + '\n';

  // Write to file
  fs.appendFileSync(logPath, logEntry);

  // Log critical errors to database
  if (level === 'error') {
    try {
      const supabase = await createServerSupabaseClient();
      await supabase.from('error_logs').insert({
        message,
        data,
        timestamp,
      });
    } catch (error) {
      // If database logging fails, write to emergency log
      const emergencyLog = path.join(LOG_DIR, 'emergency.log');
      fs.appendFileSync(
        emergencyLog,
        `Failed to log to database: ${error}\nOriginal error: ${logEntry}`
      );
    }
  }
}

// Helper functions
export const logInfo = (message: string, data?: any) => log('info', message, data);
export const logWarn = (message: string, data?: any) => log('warn', message, data);
export const logError = (message: string, data?: any) => log('error', message, data);
