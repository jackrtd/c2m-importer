const mysql = require('mysql2/promise'); // Using mysql2/promise for async/await
const { logAction } = require('./logService'); // For logging DB operations
const crypto = require('crypto'); // For potential future encryption of DB passwords

// Placeholder for encryption/decryption functions if you store encrypted DB passwords
// const ENCRYPTION_KEY = process.env.DB_PASSWORD_ENCRYPTION_KEY; // Must be 32 bytes for AES-256
// const IV_LENGTH = 16; // For AES, this is always 16

// function encrypt(text) {
//   if (!ENCRYPTION_KEY) {
//     console.warn("DB_PASSWORD_ENCRYPTION_KEY not set. Storing password as plain text.");
//     return text;
//   }
//   let iv = crypto.randomBytes(IV_LENGTH);
//   let cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
//   let encrypted = cipher.update(text);
//   encrypted = Buffer.concat([encrypted, cipher.final()]);
//   return iv.toString('hex') + ':' + encrypted.toString('hex');
// }

// function decrypt(text) {
//   if (!ENCRYPTION_KEY) {
//     return text; // Assume plain text if no key
//   }
//   if (!text.includes(':')) return text; // Not in expected encrypted format
//   let textParts = text.split(':');
//   let iv = Buffer.from(textParts.shift(), 'hex');
//   let encryptedText = Buffer.from(textParts.join(':'), 'hex');
//   let decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
//   let decrypted = decipher.update(encryptedText);
//   decrypted = Buffer.concat([decrypted, decipher.final()]);
//   return decrypted.toString();
// }


/**
 * Gets a connection to the target MySQL database.
 * @param {object} topicConfig - The configuration object for the topic.
 * Includes target_db_host, target_db_port, target_db_user,
 * target_db_password, target_db_name.
 * @param {boolean} connectWithoutDb - If true, connects without specifying a database (for CREATE DATABASE).
 * @returns {Promise<mysql.Connection>} MySQL connection object.
 */
async function getTargetDbConnection(topicConfig, connectWithoutDb = false) {
  const dbPassword = topicConfig.target_db_password; // In future, decrypt(topicConfig.target_db_password);
  const connectionConfig = {
    host: topicConfig.target_db_host,
    port: topicConfig.target_db_port || 3306,
    user: topicConfig.target_db_user,
    password: dbPassword,
    // database: connectWithoutDb ? undefined : topicConfig.target_db_name,
    // multipleStatements: true, // Enable for complex queries if absolutely necessary, but be cautious
    // typeCast: function (field, next) { // Example: Ensure TINYINT(1) is treated as boolean
    //   if (field.type === 'TINY' && field.length === 1) {
    //     return (field.string() === '1'); // '1' = true, '0' = false
    //   }
    //   return next();
    // }
  };
  if (!connectWithoutDb) {
    connectionConfig.database = topicConfig.target_db_name;
  }
  return await mysql.createConnection(connectionConfig);
}

/**
 * Creates a database in the target MySQL instance if it doesn't exist.
 * @param {object} topicConfig - Topic configuration.
 */
async function ensureDatabaseExists(topicConfig) {
  let connection;
  try {
    connection = await getTargetDbConnection(topicConfig, true); // Connect without specifying DB
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${topicConfig.target_db_name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
    console.log(`Database '${topicConfig.target_db_name}' ensured on host '${topicConfig.target_db_host}'.`);
    await logAction(null, 'TARGET_DB_CREATE', { dbName: topicConfig.target_db_name, host: topicConfig.target_db_host }, null, 'SUCCESS');
  } catch (error) {
    console.error(`Error ensuring database '${topicConfig.target_db_name}':`, error);
    await logAction(null, 'TARGET_DB_CREATE_FAILURE', { dbName: topicConfig.target_db_name, host: topicConfig.target_db_host, error: error.message }, null, 'FAILURE', error.message);
    throw error;
  } finally {
    if (connection) await connection.end();
  }
}

/**
 * Creates a table in the target database if it doesn't exist.
 * @param {object} topicConfig - Topic configuration.
 * @param {Array<object>} columnMappings - Array of column mapping objects from ColumnMapping model.
 * Each object should have target_column_name, data_type,
 * is_primary_key, is_index, allow_null, default_value.
 */
async function ensureTableExists(topicConfig, columnMappings) {
  let connection;
  try {
    await ensureDatabaseExists(topicConfig); // First, ensure the database exists
    connection = await getTargetDbConnection(topicConfig); // Connect to the specific database

    let createTableQuery = `CREATE TABLE IF NOT EXISTS \`${topicConfig.target_table_name}\` (\n`;
    const columnDefinitions = [];
    const primaryKeys = [];
    const indexes = []; // For non-primary key indexes

    columnMappings.forEach(col => {
      let definition = `  \`${col.target_column_name}\` ${col.data_type || 'VARCHAR(255)'}`; // Default type if not specified
      if (col.allow_null === false) { // Explicitly check for false
        definition += ' NOT NULL';
      }
      if (col.default_value !== null && col.default_value !== undefined) {
        // Handle numeric defaults vs string defaults carefully
        if (typeof col.default_value === 'number' || (col.data_type && (col.data_type.toUpperCase().includes('INT') || col.data_type.toUpperCase().includes('DECIMAL') || col.data_type.toUpperCase().includes('FLOAT') || col.data_type.toUpperCase().includes('DOUBLE')))) {
          definition += ` DEFAULT ${col.default_value}`;
        } else {
          definition += ` DEFAULT '${connection.escape(col.default_value).slice(1,-1)}'`; // Escape and remove surrounding quotes from escape
        }
      }
      columnDefinitions.push(definition);

      if (col.is_primary_key) {
        primaryKeys.push(`\`${col.target_column_name}\``);
      }
      if (col.is_index && !col.is_primary_key) { // Create separate index if not part of PK
        indexes.push(`INDEX \`idx_${col.target_column_name.substring(0,20)}_${Date.now().toString().slice(-5)}\` (\`${col.target_column_name}\`)`);
      }
    });

    createTableQuery += columnDefinitions.join(',\n');
    if (primaryKeys.length > 0) {
      createTableQuery += `,\n  PRIMARY KEY (${primaryKeys.join(', ')})`;
    }
    createTableQuery += '\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;';

    await connection.query(createTableQuery);
    console.log(`Table '${topicConfig.target_table_name}' ensured in database '${topicConfig.target_db_name}'.`);

    // Add separate indexes
    for (const indexQueryPart of indexes) {
      try {
        // A more robust way would be to check if index exists first
        await connection.query(`ALTER TABLE \`${topicConfig.target_table_name}\` ADD ${indexQueryPart};`);
        console.log(`Added index: ${indexQueryPart} to table ${topicConfig.target_table_name}`);
      } catch (indexError) {
        // MySQL error 1061: Duplicate key name (index already exists) - often ignorable
        if (indexError.code !== 'ER_DUP_KEYNAME' && indexError.errno !== 1061) {
            console.warn(`Could not add index ${indexQueryPart}: ${indexError.message}`);
        } else {
            console.log(`Index ${indexQueryPart} likely already exists on table ${topicConfig.target_table_name}.`);
        }
      }
    }
    await logAction(null, 'TARGET_TABLE_ENSURE', { dbName: topicConfig.target_db_name, tableName: topicConfig.target_table_name }, null, 'SUCCESS');
  } catch (error) {
    console.error(`Error ensuring table '${topicConfig.target_table_name}':`, error);
    await logAction(null, 'TARGET_TABLE_ENSURE_FAILURE', { dbName: topicConfig.target_db_name, tableName: topicConfig.target_table_name, error: error.message }, null, 'FAILURE', error.message);
    throw error;
  } finally {
    if (connection) await connection.end();
  }
}

/**
 * Inserts data rows into the target table.
 * @param {object} topicConfig - Topic configuration.
 * @param {Array<object>} dataRows - Array of data objects (key: source_column_name, value: data).
 * @param {Array<object>} columnMappings - Column mappings.
 * @param {number} importLogId - The ID of the import log for detailed error reporting.
 * @returns {Promise<{successfullyImported: number, failedCount: number, failedRowDetails: Array}>}
 */
async function insertDataBatch(topicConfig, dataRows, columnMappings, importLogId) {
  if (!dataRows || dataRows.length === 0) {
    return { successfullyImported: 0, failedCount: 0, failedRowDetails: [] };
  }
  let connection;
  let successfullyImported = 0;
  const failedRowDetails = [];

  try {
    connection = await getTargetDbConnection(topicConfig);
    await connection.beginTransaction();

    const targetColumns = columnMappings.map(m => m.target_column_name);
    const placeholders = targetColumns.map(() => '?').join(', ');
    const sql = `INSERT INTO \`${topicConfig.target_table_name}\` (\`${targetColumns.join('`,`')}\`) VALUES (${placeholders})`;

    for (let i = 0; i < dataRows.length; i++) {
      const sourceRow = dataRows[i]; // This row has source_column_names as keys
      const values = [];
      let rowHasAllRequiredValues = true;

      for (const mapping of columnMappings) {
        let value = sourceRow[mapping.source_column_name];
        // Basic type conversion or validation can happen here if needed
        // For example, convert to null if empty string and column allows null
        if (value === '' && mapping.allow_null) {
            value = null;
        }
        // TODO: Add more robust type checking/casting based on mapping.data_type
        values.push(value);

        // Check for missing non-nullable values without defaults
        if (value === undefined && !mapping.allow_null && mapping.default_value === null) {
            // If a primary key is missing, it's a definite failure for this row.
            if (mapping.is_primary_key) {
                 rowHasAllRequiredValues = false;
                 failedRowDetails.push({
                    row_number_in_file: sourceRow.originalRowNumber || (i + 1), // Assuming originalRowNumber is attached
                    row_data: sourceRow,
                    error_message: `Missing value for required (PK) source column: ${mapping.source_column_name}`
                });
                break; // Stop processing this row
            }
            // For non-PK, it might still insert if DB handles it (e.g. auto_increment or DB default)
            // but good to be aware. For now, we'll let DB handle it.
        }
      }
      if (!rowHasAllRequiredValues) continue; // Skip to next row if critical data missing

      try {
        await connection.query(sql, values);
        successfullyImported++;
      } catch (rowError) {
        failedRowDetails.push({
          row_number_in_file: sourceRow.originalRowNumber || (i + 1),
          row_data: sourceRow,
          error_message: rowError.message
        });
        // Decide on transactional behavior: continue on error or rollback all?
        // For now, we log error and continue, then report at the end.
        // If strict atomicity is needed for the batch, throw here to rollback.
      }
    }

    await connection.commit();
    return { successfullyImported, failedCount: failedRowDetails.length, failedRowDetails };

  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Batch insert transaction failed:', error);
    // Log all rows as failed if the transaction itself fails at a higher level
    const allRowsFailedDetails = dataRows.map((row, idx) => ({
        row_number_in_file: row.originalRowNumber || (idx + 1),
        row_data: row,
        error_message: `Batch transaction error: ${error.message}`
    }));
    return { successfullyImported: 0, failedCount: dataRows.length, failedRowDetails: allRowsFailedDetails };
  } finally {
    if (connection) await connection.end();
  }
}

/**
 * Fetches data from the target table with pagination, sorting, and filtering.
 * @param {object} topicConfig - Topic configuration.
 * @param {Array<object>} columnMappings - To know which columns to select.
 * @param {object} options - Pagination, sorting, filtering options.
 * { page: 1, limit: 10, sortBy: 'column', sortOrder: 'ASC', filters: [{column: 'col', value: 'val'}] }
 * @returns {Promise<{data: Array<object>, total: number,totalPages: number, currentPage: number}>}
 */
async function getData(topicConfig, columnMappings, options = {}) {
  let connection;
  const { page = 1, limit = 10, sortBy, sortOrder = 'ASC', filters = [] } = options;
  const offset = (page - 1) * limit;

  // Select only mapped target columns
  const selectColumns = columnMappings.map(m => `\`${m.target_column_name}\``).join(', ');
  if (!selectColumns) throw new Error("No columns mapped for selection.");

  try {
    connection = await getTargetDbConnection(topicConfig);

    let whereClauses = [];
    const filterValues = [];
    if (filters && filters.length > 0) {
        filters.forEach(filter => {
            // Ensure filter.column is a valid mapped target column
            const mappedCol = columnMappings.find(m => m.target_column_name === filter.column);
            if (mappedCol) {
                // Basic LIKE filter, adjust operator as needed (e.g., '=', 'IN')
                whereClauses.push(`\`${mappedCol.target_column_name}\` LIKE ?`);
                filterValues.push(`%${filter.value}%`);
            }
        });
    }
    const whereString = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    let orderByString = '';
    if (sortBy) {
        const mappedSortCol = columnMappings.find(m => m.target_column_name === sortBy);
        if (mappedSortCol) {
            orderByString = `ORDER BY \`${mappedSortCol.target_column_name}\` ${sortOrder === 'DESC' ? 'DESC' : 'ASC'}`;
        }
    }

    const dataSql = `SELECT ${selectColumns} FROM \`${topicConfig.target_table_name}\` ${whereString} ${orderByString} LIMIT ? OFFSET ?`;
    const countSql = `SELECT COUNT(*) as total FROM \`${topicConfig.target_table_name}\` ${whereString}`;

    const [rows] = await connection.query(dataSql, [...filterValues, limit, offset]);
    const [countResult] = await connection.query(countSql, filterValues);
    const total = countResult[0].total;

    return {
      data: rows,
      total: total,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      limit: limit
    };
  } catch (error) {
    console.error('Error fetching data from target DB:', error);
    await logAction(null, 'TARGET_DB_FETCH_FAILURE', { dbName: topicConfig.target_db_name, tableName: topicConfig.target_table_name, error: error.message }, null, 'FAILURE', error.message);
    throw error;
  } finally {
    if (connection) await connection.end();
  }
}

/**
 * Deletes records from the target table based on primary key values.
 * @param {object} topicConfig - Topic configuration.
 * @param {string} pkColumnName - Name of the primary key column in the target table.
 * @param {Array<string|number>} pkValues - Array of primary key values to delete.
 * @returns {Promise<{deletedCount: number, errors: Array}>}
 */
async function deleteDataByPK(topicConfig, pkColumnName, pkValues) {
  if (!pkValues || pkValues.length === 0) {
    return { deletedCount: 0, errors: [] };
  }
  let connection;
  let deletedCount = 0;
  const errors = [];

  try {
    connection = await getTargetDbConnection(topicConfig);
    await connection.beginTransaction();

    // Ensure pkColumnName is valid (exists in mappings as a PK)
    // This check should ideally happen before calling this service function.

    const sql = `DELETE FROM \`${topicConfig.target_table_name}\` WHERE \`${pkColumnName}\` = ?`;

    for (const pkValue of pkValues) {
      try {
        const [result] = await connection.query(sql, [pkValue]);
        if (result.affectedRows > 0) {
          deletedCount += result.affectedRows;
        } else {
          // Could mean the record didn't exist, or PK was wrong.
          errors.push({ pkValue, message: "Record not found or already deleted." });
        }
      } catch (rowError) {
        errors.push({ pkValue, message: rowError.message });
        // Decide on transaction: if one delete fails, should all rollback?
        // For now, we continue and report errors.
      }
    }

    await connection.commit();
    return { deletedCount, errors };
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Batch delete transaction failed:', error);
    // Log all as failed if transaction itself fails
    const allErrors = pkValues.map(pk => ({ pkValue: pk, message: `Batch delete transaction error: ${error.message}`}));
    return { deletedCount: 0, errors: allErrors };
  } finally {
    if (connection) await connection.end();
  }
}

/**
 * Retrieves specific records by their primary key values (for rollback).
 * @param {object} topicConfig - Topic configuration.
 * @param {string} pkColumnName - Name of the primary key column.
 * @param {Array<string|number>} pkValues - Array of primary key values.
 * @returns {Promise<Array<object>>} Array of record data.
 */
async function getRecordsByPKs(topicConfig, pkColumnName, pkValues) {
    if (!pkValues || pkValues.length === 0) return [];
    let connection;
    try {
        connection = await getTargetDbConnection(topicConfig);
        const placeholders = pkValues.map(() => '?').join(',');
        const sql = `SELECT * FROM \`${topicConfig.target_table_name}\` WHERE \`${pkColumnName}\` IN (${placeholders})`;
        const [rows] = await connection.query(sql, pkValues);
        return rows;
    } catch (error) {
        console.error('Error fetching records by PKs:', error);
        throw error;
    } finally {
        if (connection) await connection.end();
    }
}


module.exports = {
  getTargetDbConnection, // Exported for potential direct use if needed, but generally use abstracted functions
  ensureDatabaseExists,
  ensureTableExists,
  insertDataBatch,
  getData,
  deleteDataByPK,
  getRecordsByPKs,
  // encrypt, // If implementing encryption for DB passwords
  // decrypt
};