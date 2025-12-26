import { google, sheets_v4 } from 'googleapis';
import { getEnv } from '@/lib/env';
import { SHEET_NAMES, type SheetName } from '@/types/sheets.types';

let _sheets: sheets_v4.Sheets | null = null;
let _sheetId: string | null = null;

function getSheetsClient(): sheets_v4.Sheets {
  if (_sheets) return _sheets;

  const env = getEnv();

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  _sheets = google.sheets({ version: 'v4', auth });
  _sheetId = env.GOOGLE_SHEET_ID;

  return _sheets;
}

function getSheetId(): string {
  if (_sheetId) return _sheetId;
  const env = getEnv();
  _sheetId = env.GOOGLE_SHEET_ID;
  return _sheetId;
}

async function getExistingSheetNames(): Promise<Set<string>> {
  const sheets = getSheetsClient();
  const spreadsheetId = getSheetId();

  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
  const sheetTitles = spreadsheet.data.sheets?.map(s => s.properties?.title || '') || [];
  return new Set(sheetTitles);
}

async function createSheet(sheetName: string): Promise<void> {
  const sheets = getSheetsClient();
  const spreadsheetId = getSheetId();

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          addSheet: {
            properties: {
              title: sheetName,
            },
          },
        },
      ],
    },
  });
}

export async function getSheetRows<T extends Record<string, string>>(
  sheetName: SheetName
): Promise<T[]> {
  const sheets = getSheetsClient();
  const spreadsheetId = getSheetId();

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A:Z`,
    });

    const rows = response.data.values;
    if (!rows || rows.length < 2) return [];

    const headers = rows[0] as string[];
    const dataRows = rows.slice(1);

    return dataRows.map(row => {
      const obj: Record<string, string> = {};
      headers.forEach((header, index) => {
        obj[header] = row[index] || '';
      });
      return obj as T;
    });
  } catch (error: unknown) {
    const gaxiosError = error as { code?: number; message?: string };
    if (gaxiosError.code === 400 && gaxiosError.message?.includes('Unable to parse range')) {
      console.warn(`Sheet "${sheetName}" does not exist. Run /api/setup to initialize sheets.`);
      return [];
    }
    throw error;
  }
}

export async function appendSheetRow(
  sheetName: SheetName,
  values: string[]
): Promise<void> {
  const sheets = getSheetsClient();
  const spreadsheetId = getSheetId();

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${sheetName}!A:Z`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [values],
    },
  });
}

export async function appendSheetRows(
  sheetName: SheetName,
  rows: string[][]
): Promise<void> {
  const sheets = getSheetsClient();
  const spreadsheetId = getSheetId();

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${sheetName}!A:Z`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: rows,
    },
  });
}

export async function updateSheetCell(
  sheetName: SheetName,
  range: string,
  value: string
): Promise<void> {
  const sheets = getSheetsClient();
  const spreadsheetId = getSheetId();

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${sheetName}!${range}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [[value]],
    },
  });
}

export async function updateSheetRowById(
  sheetName: SheetName,
  id: string,
  updates: Record<string, string>
): Promise<boolean> {
  const sheets = getSheetsClient();
  const spreadsheetId = getSheetId();

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A:Z`,
  });

  const rows = response.data.values;
  if (!rows || rows.length < 2) return false;

  const headers = rows[0] as string[];
  const rowIndex = rows.findIndex((row, index) => index > 0 && row[0] === id);

  if (rowIndex === -1) return false;

  const currentRow = rows[rowIndex];
  const updatedRow = headers.map((header, index) => {
    if (header in updates) {
      return updates[header];
    }
    return currentRow[index] || '';
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${sheetName}!A${rowIndex + 1}:${String.fromCharCode(65 + headers.length - 1)}${rowIndex + 1}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [updatedRow],
    },
  });

  return true;
}

export async function deleteSheetRowById(
  sheetName: SheetName,
  id: string
): Promise<boolean> {
  const sheets = getSheetsClient();
  const spreadsheetId = getSheetId();

  const spreadsheet = await sheets.spreadsheets.get({
    spreadsheetId,
  });

  const sheet = spreadsheet.data.sheets?.find(
    s => s.properties?.title === sheetName
  );

  if (!sheet?.properties?.sheetId) return false;

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A:A`,
  });

  const rows = response.data.values;
  if (!rows) return false;

  const rowIndex = rows.findIndex((row, index) => index > 0 && row[0] === id);
  if (rowIndex === -1) return false;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId: sheet.properties.sheetId,
              dimension: 'ROWS',
              startIndex: rowIndex,
              endIndex: rowIndex + 1,
            },
          },
        },
      ],
    },
  });

  return true;
}

async function migrateSheetHeaders(
  sheetName: SheetName,
  expectedHeaders: string[],
  currentHeaders: string[]
): Promise<{ needsMigration: boolean; insertions: Array<{ index: number; column: string }> }> {
  const insertions: Array<{ index: number; column: string }> = [];

  for (let i = 0; i < expectedHeaders.length; i++) {
    const expected = expectedHeaders[i];
    const current = currentHeaders[i];

    if (current !== expected) {
      if (!currentHeaders.includes(expected)) {
        insertions.push({ index: i, column: expected });
      }
    }
  }

  return {
    needsMigration: insertions.length > 0,
    insertions,
  };
}

async function insertColumnAt(
  sheetName: SheetName,
  columnIndex: number,
  columnHeader: string,
  defaultValue: string = ''
): Promise<void> {
  const sheets = getSheetsClient();
  const spreadsheetId = getSheetId();

  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
  const sheet = spreadsheet.data.sheets?.find(s => s.properties?.title === sheetName);
  if (!sheet?.properties?.sheetId) return;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          insertDimension: {
            range: {
              sheetId: sheet.properties.sheetId,
              dimension: 'COLUMNS',
              startIndex: columnIndex,
              endIndex: columnIndex + 1,
            },
            inheritFromBefore: false,
          },
        },
      ],
    },
  });

  const allDataResponse = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A:Z`,
  });

  const rowCount = allDataResponse.data.values?.length || 0;
  if (rowCount === 0) return;

  const columnLetter = String.fromCharCode(65 + columnIndex);
  const columnValues: string[][] = [[columnHeader]];

  for (let i = 1; i < rowCount; i++) {
    columnValues.push([defaultValue]);
  }

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${sheetName}!${columnLetter}1:${columnLetter}${rowCount}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: columnValues,
    },
  });
}

export async function initializeSheets(): Promise<void> {
  const sheets = getSheetsClient();
  const spreadsheetId = getSheetId();

  const headersBySheet: Record<SheetName, string[]> = {
    [SHEET_NAMES.TRENDS]: ['id', 'topic', 'keyword', 'tweet_count', 'woeid', 'fetched_at'],
    [SHEET_NAMES.VIRAL_POSTS]: ['id', 'tweet_id', 'author', 'content', 'likes', 'retweets', 'engagement_rate', 'structure_type', 'fetched_at'],
    [SHEET_NAMES.PATTERNS]: ['id', 'type', 'hook_template', 'cta_template', 'avg_length', 'emoji_density', 'example_id'],
    [SHEET_NAMES.DRAFTS]: ['id', 'content', 'based_on_pattern', 'based_on_trend', 'status', 'created_at', 'updated_at'],
    [SHEET_NAMES.QUEUE]: ['id', 'draft_id', 'scheduled_at', 'status', 'retry_count', 'last_error', 'last_attempt_at'],
    [SHEET_NAMES.POSTED]: ['id', 'tweet_id', 'content', 'posted_at', 'engagement_24h'],
  };

  const defaultValuesByColumn: Record<string, string> = {
    woeid: '1',
    updated_at: '',
    last_error: '',
    last_attempt_at: '',
  };

  const existingSheets = await getExistingSheetNames();
  const missingSheets: string[] = [];

  for (const sheetName of Object.values(SHEET_NAMES)) {
    if (!existingSheets.has(sheetName)) {
      missingSheets.push(sheetName);
    }
  }

  for (const sheetName of missingSheets) {
    await createSheet(sheetName);
  }

  for (const [sheetName, expectedHeaders] of Object.entries(headersBySheet)) {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A1:Z1`,
    });

    const currentHeaders = (response.data.values?.[0] as string[]) || [];

    if (currentHeaders.length === 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetName}!A1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [expectedHeaders],
        },
      });
      continue;
    }

    const { needsMigration, insertions } = await migrateSheetHeaders(
      sheetName as SheetName,
      expectedHeaders,
      currentHeaders
    );

    if (needsMigration) {
      for (let i = 0; i < insertions.length; i++) {
        const { index, column } = insertions[i];
        const adjustedIndex = index + i;
        const defaultValue = defaultValuesByColumn[column] || '';

        await insertColumnAt(
          sheetName as SheetName,
          adjustedIndex,
          column,
          defaultValue
        );
      }
    }
  }
}
