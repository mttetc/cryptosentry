'use server';

import fs from 'fs';
import path from 'path';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { LOG_DIR, rotateLogFile } from './logger-utils';

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

// Async wrapper functions
export async function logInfo(message: string, data?: any) {
  return log('info', message, data);
}

export async function logWarn(message: string, data?: any) {
  return log('warn', message, data);
}

export async function logError(message: string, data?: any) {
  return log('error', message, data);
}
