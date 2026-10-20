import fs from 'fs';
import path from 'path';

export interface VisitorRecord {
  id: string;
  name: string;
  email: string;
  ip: string;
  userAgent: string;
  timestamp: string;
}

const VISITORS_FILE_PATH = path.join(process.cwd(), 'data', 'visitors.json');

export function getVisitors(): VisitorRecord[] {
  try {
    if (!fs.existsSync(VISITORS_FILE_PATH)) {
      fs.mkdirSync(path.dirname(VISITORS_FILE_PATH), { recursive: true });
      fs.writeFileSync(VISITORS_FILE_PATH, JSON.stringify([], null, 2), 'utf-8');
      return [];
    }
    const data = fs.readFileSync(VISITORS_FILE_PATH, 'utf-8');
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('Failed to read visitors telemetry:', err);
    return [];
  }
}

export function recordVisitor(entry: {
  name: string;
  email: string;
  ip: string;
  userAgent: string;
}): VisitorRecord {
  try {
    const list = getVisitors();
    const newRecord: VisitorRecord = {
      id: `vis-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      name: entry.name,
      email: entry.email,
      ip: entry.ip || '127.0.0.1',
      userAgent: entry.userAgent || 'Unknown',
      timestamp: new Date().toISOString(),
    };

    // Keep up to 200 most recent records
    const updated = [newRecord, ...list].slice(0, 200);
    fs.mkdirSync(path.dirname(VISITORS_FILE_PATH), { recursive: true });
    fs.writeFileSync(VISITORS_FILE_PATH, JSON.stringify(updated, null, 2), 'utf-8');
    return newRecord;
  } catch (err) {
    console.error('Failed to record visitor telemetry:', err);
    return {
      id: `vis-${Date.now()}`,
      name: entry.name,
      email: entry.email,
      ip: entry.ip || '127.0.0.1',
      userAgent: entry.userAgent || 'Unknown',
      timestamp: new Date().toISOString(),
    };
  }
}

export function clearVisitors(): void {
  try {
    fs.mkdirSync(path.dirname(VISITORS_FILE_PATH), { recursive: true });
    fs.writeFileSync(VISITORS_FILE_PATH, JSON.stringify([], null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to clear visitors telemetry:', err);
  }
}
