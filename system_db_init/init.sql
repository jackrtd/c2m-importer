-- system_db_init/init.sql

-- Use this database
USE data_import_system;

-- Table for system users (admins and regular users)
CREATE TABLE IF NOT EXISTS `Users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `username` VARCHAR(255) NOT NULL UNIQUE,
  `password` VARCHAR(255) NOT NULL,
  `role` ENUM('admin', 'user') NOT NULL,
  `email` VARCHAR(255) UNIQUE,
  `is_active` BOOLEAN DEFAULT TRUE,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table for import topics and their target database configurations
CREATE TABLE IF NOT EXISTS `Topics` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL UNIQUE,
  `target_db_host` VARCHAR(255) NOT NULL,
  `target_db_port` INT DEFAULT 3306,
  `target_db_name` VARCHAR(255) NOT NULL,
  `target_table_name` VARCHAR(255) NOT NULL,
  `target_db_user` VARCHAR(255) NOT NULL,
  `target_db_password` VARCHAR(255) NOT NULL, -- Consider encrypting this field in the application layer
  `created_by_id` INT,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`created_by_id`) REFERENCES `Users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table for column mappings from source file to target table for each topic
CREATE TABLE IF NOT EXISTS `ColumnMappings` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `topic_id` INT NOT NULL,
  `source_column_name` VARCHAR(255) NOT NULL,
  `target_column_name` VARCHAR(255) NOT NULL,
  `data_type` VARCHAR(50), -- Optional: for schema validation or table creation
  `is_primary_key` BOOLEAN DEFAULT FALSE,
  `is_index` BOOLEAN DEFAULT FALSE,
  `allow_null` BOOLEAN DEFAULT TRUE,
  `default_value` VARCHAR(255) DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`topic_id`) REFERENCES `Topics`(`id`) ON DELETE CASCADE,
  UNIQUE (`topic_id`, `source_column_name`),
  UNIQUE (`topic_id`, `target_column_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table for user permissions on topics (which user can import which topic)
CREATE TABLE IF NOT EXISTS `UserTopicPermissions` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `topic_id` INT NOT NULL,
  `can_import` BOOLEAN DEFAULT TRUE,
  `can_view_data` BOOLEAN DEFAULT TRUE,
  `can_delete_data` BOOLEAN DEFAULT FALSE, -- Granular permissions
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `Users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`topic_id`) REFERENCES `Topics`(`id`) ON DELETE CASCADE,
  UNIQUE (`user_id`, `topic_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table for logging general system actions (admin actions, user login/logout)
CREATE TABLE IF NOT EXISTS `SystemLogs` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT,
  `action_type` VARCHAR(100) NOT NULL, -- e.g., 'ADMIN_LOGIN', 'CREATE_TOPIC', 'USER_LOGOUT'
  `details` TEXT, -- JSON string for additional information
  `ip_address` VARCHAR(45),
  `status` ENUM('SUCCESS', 'FAILURE') DEFAULT 'SUCCESS',
  `error_message` TEXT,
  `timestamp` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `Users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table for logging import operations
CREATE TABLE IF NOT EXISTS `ImportLogs` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `topic_id` INT NOT NULL,
  `file_name` VARCHAR(255),
  `original_file_name` VARCHAR(255),
  `file_size` INT,
  `total_records_in_file` INT,
  `successfully_imported_records` INT DEFAULT 0,
  `failed_records` INT DEFAULT 0,
  `status` ENUM('PENDING', 'PROCESSING', 'COMPLETED', 'PARTIALLY_COMPLETED', 'FAILED', 'CANCELLED') NOT NULL,
  `start_time` TIMESTAMP NULL,
  `end_time` TIMESTAMP NULL,
  `error_details` TEXT, -- Store detailed error messages, perhaps JSON
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `Users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`topic_id`) REFERENCES `Topics`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table for logging details of failed rows during an import
CREATE TABLE IF NOT EXISTS `FailedImportRows` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `import_log_id` INT NOT NULL,
    `row_number_in_file` INT, -- Original row number from the source file
    `row_data` TEXT, -- JSON representation of the row data that failed
    `error_message` TEXT,
    `timestamp` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`import_log_id`) REFERENCES `ImportLogs`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- Table for logging data deletion actions (including for rollback)
CREATE TABLE IF NOT EXISTS `DeletionLogs` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `topic_id` INT NOT NULL,
  `target_table_name` VARCHAR(255) NOT NULL,
  `record_primary_key_value` VARCHAR(255) NOT NULL, -- Or TEXT if PKs can be very long/composite
  `deleted_record_data` JSON NOT NULL, -- Store the actual data of the deleted row for rollback
  `deletion_batch_id` VARCHAR(36), -- UUID to group multiple deletions, useful for "delete all"
  `is_rolled_back` BOOLEAN DEFAULT FALSE,
  `deleted_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `rolled_back_at` TIMESTAMP NULL,
  `rolled_back_by_id` INT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `Users`(`id`),
  FOREIGN KEY (`topic_id`) REFERENCES `Topics`(`id`),
  FOREIGN KEY (`rolled_back_by_id`) REFERENCES `Users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- You might want to add an initial admin user here if not handled by the backend on startup
-- INSERT INTO Users (username, password, role) VALUES ('admin', '$2b$10$yourbcryptedasminpassword', 'admin');
-- The backend should handle creating the initial admin based on .env variables if Users table is empty.

