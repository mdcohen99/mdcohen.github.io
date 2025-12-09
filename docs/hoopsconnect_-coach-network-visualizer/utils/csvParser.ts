import { CoachStint } from '../types';

export const parseCSV = (csvText: string): CoachStint[] => {
  const lines = csvText.trim().split('\n');
  const headers = lines[0].split(',');

  const data: CoachStint[] = [];

  for (let i = 1; i < lines.length; i++) {
    // Handle CSV quoting for titles with commas
    const rowString = lines[i];
    const row: string[] = [];
    let inQuote = false;
    let currentCell = '';

    for (let j = 0; j < rowString.length; j++) {
      const char = rowString[j];
      if (char === '"') {
        inQuote = !inQuote;
      } else if (char === ',' && !inQuote) {
        row.push(currentCell.trim());
        currentCell = '';
      } else {
        currentCell += char;
      }
    }
    row.push(currentCell.trim());

    if (row.length === headers.length) {
      data.push({
        coach: row[0],
        college: row[1],
        title: row[2].replace(/"/g, ''), // Remove quotes if present
        team_id: row[3],
        start_year: parseInt(row[4]) || 0,
        end_year: row[5] ? parseInt(row[5]) : null,
        position_title_standardized: row[6],
        college_clean: row[7],
        category: row[8],
        team_state: row[9],
        conference: row[10],
        division: row[11],
        gender: row[12]
      });
    }
  }
  return data;
};