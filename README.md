# Data Import System

This system allows administrators to configure data imports from Excel or CSV files to a target MySQL database and enables general users to import data according to their assigned permissions.

## Table of Contents

  - [System Overview](https://www.google.com/search?q=%23system-overview)
  - [Main Features](https://www.google.com/search?q=%23main-features)
      - [Admin Section](https://www.google.com/search?q=%23admin-section)
      - [User Section](https://www.google.com/search?q=%23user-section)
  - [Technologies Used](https://www.google.com/search?q=%23technologies-used)
  - [Project Structure](https://www.google.com/search?q=%23project-structure)
  - [Prerequisites](https://www.google.com/search?q=%23prerequisites)
  - [Installation and Startup](https://www.google.com/search?q=%23installation-and-startup)
      - [1. Clone Repository](https://www.google.com/search?q=%231-clone-repository)
      - [2. Set Environment Variables](https://www.google.com/search?q=%232-set-environment-variables)
      - [3. Build and Run with Docker Compose](https://www.google.com/search?q=%233-build-and-run-with-docker-compose)
      - [4. Accessing the System](https://www.google.com/search?q=%234-accessing-the-system)
  - [Further Development](https://www.google.com/search?q=%23further-development)
  - [Additional Features (Optional)](https://www.google.com/search?q=%23additional-features-optional)

## System Overview

The system consists of 3 main components that work together via Docker:

1.  **Backend API**: Developed with Node.js and Express.js to manage all system logic.
2.  **Frontend**: Developed with HTML, jQuery, and Bootstrap for the user interface.
3.  **System Database**: A MySQL database to store configuration data, users, permissions, and various system logs (runs on Docker).

**Note:** The target MySQL database for data import is **not** managed by this system's Docker setup. The system connects to it via an IP address configured by the administrator.

## Main Features

### Admin Section

1.  Manage import topics (e.g., Medications, Patients, Treatment Rights) - Add/Delete functionality.
2.  Configure target database connection for each topic (IP, Database name, Table name, Username/Password).
3.  Map column names from Excel/CSV files to target table column names (if no mapping is provided, column names from Excel/CSV are used directly).
4.  Define which columns are Primary Keys and Indexes for the target table.
5.  Automatically create the target Database or Table if it doesn't exist.
6.  Assign permissions for which users can import which topics.
7.  Login system for Admins.
8.  Log Admin activities (e.g., adding topics, editing configs, deleting topics).

### User Section

1.  Select topics they have permission for and import Excel/CSV files.
2.  Display a list of imported records with checkboxes for deleting individual or all records.
3.  Includes a Delete button and a system for rolling back deletions.
4.  Log import actions (who imported, date/time, topic, total/successful/failed counts).
5.  Log record deletion actions (who deleted, date/time, list of deleted record IDs, total count).
6.  Imported data listing page:
      * Display data according to user's topic permissions.
      * Supports Sort, Filter, and Pagination.
7.  Login system for Users.
8.  Log user activities (e.g., Login/Logout, page views, deletions, imports).

## Technologies Used

  * **Backend**: Node.js, Express.js
  * **Frontend**: HTML, jQuery, Bootstrap 5
  * **System Database**: MySQL
  * **File Parsing**: `xlsx` (for Excel), `csv-parser` (for CSV)
  * **Authentication**: JSON Web Tokens (JWT)
  * **Deployment**: Docker, Docker Compose

## Project Structure

```
data-import-system/
├── backend/
│   ├── src/
│   │   ├── controllers/
│   │   ├── routes/
│   │   ├── models/         # Sequelize models for system DB
│   │   ├── middleware/
│   │   ├── services/       # Services for business logic, target DB interaction
│   │   ├── utils/          # Helper functions, file parsers
│   │   ├── config/         # Database config, etc.
│   │   └── server.js       # Express app setup
│   ├── Dockerfile
│   └── package.json
├── frontend/
│   ├── css/
│   │   └── style.css
│   ├── js/
│   │   ├── auth.js
│   │   ├── admin.js
│   │   ├── user.js
│   │   └── common.js       # Shared functions, API calls
│   ├── admin/              # Admin panel HTML files
│   │   ├── index.html      # Admin login
│   │   └── dashboard.html  # Admin dashboard (topics, users, logs)
│   ├── user/               # User panel HTML files
│   │   ├── index.html      # User login
│   │   └── dashboard.html  # User dashboard (import, view data)
│   ├── index.html          # Main entry/redirect page
│   └── Dockerfile
├── system_db_init/
│   └── init.sql            # SQL script for initializing system database schema
├── docker-compose.yml
└── README.md
```

## Prerequisites

  * [Docker](https://www.docker.com/get-started)
  * [Docker Compose](https://docs.docker.com/compose/install/)

## Installation and Startup

### 1\. Clone Repository

(Assuming you have created a Git repository for this project)

```bash
git clone <your-repository-url>
cd data-import-system
```

### 2\. Set Environment Variables

Create a `.env` file in the `backend/` folder, referencing `backend/.env.example` (you will need to create this example file).
Example `backend/.env.example`:

```env
NODE_ENV=development
PORT=3000
SYSTEM_DB_HOST=system_mysql_db
SYSTEM_DB_USER=root
SYSTEM_DB_PASSWORD=yoursecurepassword
SYSTEM_DB_NAME=data_import_system
JWT_SECRET=yourjwtsecretkey

# Initial Admin settings (will be created on first run if it doesn't exist)
INITIAL_ADMIN_USERNAME=admin
INITIAL_ADMIN_PASSWORD=adminpassword
```

### 3\. Build and Run with Docker Compose

From the project's root directory (`data-import-system/`):

```bash
docker-compose up --build -d
```

This command will:

  * Build Docker images for `backend` and `frontend`.
  * Start containers for `backend`, `frontend`, and `system_mysql_db`.
  * `system_mysql_db` will use `system_db_init/init.sql` to automatically create necessary tables.

### 4\. Accessing the System

  * **Frontend**: `http://localhost:8080` (or the port you set in `docker-compose.yml`)
  * **Backend API**: `http://localhost:3000` (or the port you set in `docker-compose.yml` and `.env`)

The initial administrator can log in with the Username/Password set in `INITIAL_ADMIN_USERNAME` and `INITIAL_ADMIN_PASSWORD`.

## Further Development

  * **Backend**:
      * Implement API endpoints in `backend/src/routes/` and controllers in `backend/src/controllers/`.
      * Create Models using Sequelize (or other ORM/Query Builders) in `backend/src/models/` for connecting to the System Database.
      * Develop Services in `backend/src/services/` to manage Business Logic, such as connecting to and creating tables/databases in the target MySQL, file parsing, and log management.
      * Add Middleware for Authentication and Authorization.
  * **Frontend**:
      * Develop HTML pages in `frontend/admin/` and `frontend/user/`.
      * Write JavaScript (jQuery) in `frontend/js/` to interact with the Backend API and manage the UI.
  * **Target Database**:
      * Logic for automatically creating the target Database/Table and inserting data must be handled in the Backend (e.g., in `ImportController` and `DbService`).

## Additional Features (Optional)

  * **Pre-import Schema Validation**: Add logic in the Backend to check if the column structure in the Excel/CSV file matches the configured settings before actual import.
  * **Concurrent Multi-user Support**: For high performance, `pm2` or Node.js `cluster` module can be used in the Backend's Docker container (requires modification of `backend/Dockerfile` and `package.json`).
  * **Notification System**: Notify Admin/User on import failure (e.g., via Email or UI Notification).
  * **Encryption of Sensitive Data**: Encrypt passwords for the target database stored in the System Database.

-----