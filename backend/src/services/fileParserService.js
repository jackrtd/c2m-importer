const xlsx = require('xlsx');
const csv = require('csv-parser');
const fs = require('fs');
const stream = require('stream');
const { promisify } = require('util');
const pipeline = promisify(stream.pipeline);


/**
 * Parses an Excel file (XLSX, XLS) and returns data as an array of objects.
 * Each object represents a row, with keys being the header names.
 * @param {string} filePath - Path to the Excel file.
 * @returns {Promise<Array<object>>} Array of row objects.
 */
async function parseExcelFile(filePath) {
  return new Promise((resolve, reject) => {
    try {
      const workbook = xlsx.readFile(filePath, { cellDates: true }); // cellDates: true to parse dates as JS Date objects
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      // Convert sheet to JSON. defval: '' ensures empty cells are empty strings not undefined.
      const jsonData = xlsx.utils.sheet_to_json(worksheet, { defval: '', raw: false });
      resolve(jsonData);
    } catch (error) {
      console.error('Error parsing Excel file:', error);
      reject(new Error(`Failed to parse Excel file: ${error.message}`));
    }
  });
}

/**
 * Parses a CSV file and returns data as an array of objects.
 * Each object represents a row, with keys being the header names.
 * @param {string} filePath - Path to the CSV file.
 * @returns {Promise<Array<object>>} Array of row objects.
 */
async function parseCsvFile(filePath) {
  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(filePath)
      .pipe(csv({
          mapHeaders: ({ header }) => header.trim(), // Trim header names
          mapValues: ({ value }) => (value === '' ? null : value.trim()) // Trim values, convert empty strings to null
      }))
      .on('data', (data) => results.push(data))
      .on('end', () => {
        resolve(results);
      })
      .on('error', (error) => {
        console.error('Error parsing CSV file:', error);
        reject(new Error(`Failed to parse CSV file: ${error.message}`));
      });
  });
}

/**
 * Detects file type based on extension or MIME type.
 * For simplicity, this example uses file extension.
 * @param {string} fileNameOrPath - The name or path of the file.
 * @returns {'excel' | 'csv' | 'unknown'}
 */
function detectFileType(fileNameOrPath) {
  const extension = fileNameOrPath.split('.').pop().toLowerCase();
  if (['xlsx', 'xls'].includes(extension)) {
    return 'excel';
  }
  if (extension === 'csv') {
    return 'csv';
  }
  return 'unknown';
}

/**
 * Generic file parser that detects file type and calls the appropriate parser.
 * @param {string} filePath - Path to the file.
 * @param {string} originalFileName - Original name of the file (for type detection fallback).
 * @returns {Promise<Array<object>>} Array of row objects.
 */
async function parseFile(filePath, originalFileName) {
  const fileType = detectFileType(originalFileName || filePath);

  switch (fileType) {
    case 'excel':
      return parseExcelFile(filePath);
    case 'csv':
      return parseCsvFile(filePath);
    default:
      throw new Error(`Unsupported file type: ${fileType}. Please upload Excel (XLS, XLSX) or CSV files.`);
  }
}

module.exports = {
  parseExcelFile,
  parseCsvFile,
  detectFileType,
  parseFile,
};