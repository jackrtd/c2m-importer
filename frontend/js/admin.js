// frontend/js/admin.js

$(document).ready(function() {
    // Check auth status on page load
    // ใน admin.js, $(document).ready()
console.log("--- Checking essential function types ---");
console.log("typeof isLoggedIn:", typeof isLoggedIn);
console.log("typeof getUserRole:", typeof getUserRole);
console.log("typeof logoutUser:", typeof logoutUser);
console.log("typeof getUsername:", typeof getUsername); // ตรวจสอบตัวนี้ด้วยถ้าจำเป็น
console.log("typeof apiRequest:", typeof apiRequest);
console.log("typeof showAlert:", typeof showAlert);
console.log("typeof showSpinner:", typeof showSpinner);
console.log("typeof hideSpinner:", typeof hideSpinner);
console.log("typeof formatDate:", typeof formatDate);
console.log("typeof populateForm:", typeof populateForm);
console.log("typeof renderPaginationControls:", typeof renderPaginationControls);

console.log("---------------------------------------");

if (typeof isLoggedIn !== 'function' || typeof getUserRole !== 'function' || typeof logoutUser !== 'function' /* || typeof getUsername !== 'function' */) {
    // ... Error message ...
    return;
}
// ...
    if (typeof isLoggedIn !== 'function' || typeof getUserRole !== 'function' || typeof logoutUser !== 'function'  || typeof getUsername !== 'function' || typeof apiRequest !== 'function' || typeof showAlert !== 'function' || typeof showSpinner !== 'function' || typeof hideSpinner !== 'function' || typeof formatDate !== 'function' || typeof populateForm !== 'function' || typeof renderPaginationControls !== 'function') {
        console.error('Admin.js: One or more essential functions from common.js or auth.js are not loaded. Halting dashboard initialization.');
        $('body').html('<div class="alert alert-danger m-5" role="alert">เกิดข้อผิดพลาดในการโหลดสคริปต์สำคัญ กรุณาลองรีเฟรชหน้า หรือติดต่อผู้ดูแลระบบ (Admin Dashboard - JS Init)</div>');
        return;
    }

    if (!isLoggedIn() || getUserRole() !== 'admin') {
        logoutUser(); // Redirects to login
        return;
    }

    // --- Tab Navigation & Content Loading ---
    let currentUsers = [];
    let currentTopics = [];
    // let currentSystemLogs = []; // Not currently used for caching, loaded on demand
    // let currentImportLogs = []; // Not currently used for caching, loaded on demand
    let userPagination = { currentPage: 1, totalPages: 1, limit: 10, total: 0 };
    // let topicPagination = { currentPage: 1, totalPages: 1, limit: 10 }; // Topics not paginated currently
    let systemLogPagination = { currentPage: 1, totalPages: 1, limit: 20, total: 0 };
    let importLogPagination = { currentPage: 1, totalPages: 1, limit: 20, total: 0 };
    let allUsersForPermissions = []; 
    let currentSelectedTopicForPerm = null;


    // Load initial content for the default active tab (Home/Overview)
    console.log("Admin.js: Document ready. Initializing admin dashboard.");
    if ($('#home-tab-pane').hasClass('active')) { // Check if overview is the default active tab
        console.log("Admin.js: Loading initial overview tab.");
        loadAdminOverview();
    }


    $('a[data-bs-toggle="tab"]').on('shown.bs.tab', function (e) {
        const targetPaneId = $(e.target).data('bs-target');
        console.log("Admin.js: Tab shown - ", targetPaneId);
        $('#currentSectionTitle').text($(e.target).text().trim()); 

        switch (targetPaneId) {
            case '#home-tab-pane':
                loadAdminOverview();
                break;
            case '#users-tab-pane':
                loadUsers();
                break;
            case '#topics-tab-pane':
                loadTopics();
                break;
            case '#permissions-tab-pane':
                loadPermissionsManagement();
                break;
            case '#logs-system-tab-pane':
                loadSystemLogs();
                break;
            case '#logs-import-tab-pane':
                loadImportLogs();
                break;
            default:
                console.warn("Admin.js: Unknown tab target:", targetPaneId);
        }
    });

    // --- 1. Overview Section ---
    function loadAdminOverview() {
        console.log("Admin.js: loadAdminOverview called.");
        const overviewPane = $('#home-tab-pane');
        if (!overviewPane.length) {
            console.error("Admin.js: #home-tab-pane not found for overview.");
            return;
        }
        const overviewHtml = `
            <h4>ภาพรวมระบบ (Admin)</h4>
            <p>ยินดีต้อนรับสู่ส่วนควบคุมสำหรับผู้ดูแลระบบ ที่นี่คุณสามารถจัดการผู้ใช้งาน, หัวข้อการนำเข้าข้อมูล, สิทธิ์การเข้าถึง, และตรวจสอบประวัติการทำงานต่างๆ ของระบบได้</p>
            <div class="row">
                <div class="col-md-4">
                    <div class="card text-white bg-primary mb-3">
                        <div class="card-header">ผู้ใช้งานทั้งหมด</div>
                        <div class="card-body">
                            <h5 class="card-title" id="overviewUserCount"><div class="spinner-border spinner-border-sm" role="status"><span class="visually-hidden">Loading...</span></div></h5>
                            <p class="card-text">จำนวนผู้ใช้งานในระบบ</p>
                        </div>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="card text-white bg-success mb-3">
                        <div class="card-header">หัวข้อ Import ทั้งหมด</div>
                        <div class="card-body">
                            <h5 class="card-title" id="overviewTopicCount"><div class="spinner-border spinner-border-sm" role="status"><span class="visually-hidden">Loading...</span></div></h5>
                            <p class="card-text">จำนวนหัวข้อที่กำหนดค่าไว้</p>
                        </div>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="card text-white bg-info mb-3">
                        <div class="card-header">รายการ Import ล่าสุด (24 ชม.)</div>
                        <div class="card-body">
                            <h5 class="card-title" id="overviewRecentImports"><div class="spinner-border spinner-border-sm" role="status"><span class="visually-hidden">Loading...</span></div></h5>
                            <p class="card-text">จำนวนการ Import</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
        overviewPane.html(overviewHtml);
        
        apiRequest('/admin/users', 'GET', { limit: 1, page: 1 })
            .then(data => $('#overviewUserCount').text(data.count || 0))
            .catch(err => {
                console.error("Admin.js: Error fetching user count for overview", err);
                $('#overviewUserCount').text('Error');
            });
        apiRequest('/admin/topics', 'GET', { limit: 1, page: 1 }) 
            .then(data => $('#overviewTopicCount').text(data.topics ? data.topics.length : (data.count || 0) )) // Assuming API might send topics array or just count
            .catch(err => {
                console.error("Admin.js: Error fetching topic count for overview", err);
                $('#overviewTopicCount').text('Error');
            });
        
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        apiRequest('/admin/logs/import', 'GET', { limit: 1, page: 1, startDate: yesterday })
             .then(data => $('#overviewRecentImports').text(data.count || 0))
             .catch(err => {
                console.error("Admin.js: Error fetching recent imports for overview", err);
                $('#overviewRecentImports').text('Error');
             });
    }


    // --- 2. User Management Section ---
    const usersTab = $('#users-tab-pane');
    console.log("Admin.js: usersTab element selected:", usersTab.length > 0 ? "Found" : "NOT FOUND");

    function loadUsers(page = 1, limit = 10, searchParams = {}) {
        console.log("Admin.js: loadUsers called with page:", page, "limit:", limit, "searchParams:", searchParams);
        if (!usersTab.length) {
            console.error("Admin.js: usersTab element not found in loadUsers. Aborting.");
            showAlert("เกิดข้อผิดพลาด: ไม่พบส่วนแสดงผลผู้ใช้", "danger");
            return;
        }
        // Display a loading message or spinner within the tab
        usersTab.html('<div class="text-center p-5"><div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading users...</span></div> <p>กำลังโหลดข้อมูลผู้ใช้...</p></div>');


        apiRequest('/admin/users', 'GET', { page, limit, ...searchParams })
            .then(data => {
                console.log("Admin.js: loadUsers - API request successful. Data:", data);
                currentUsers = data.users;
                userPagination = { currentPage: data.currentPage, totalPages: data.totalPages, limit: parseInt(limit), total: data.count };
                renderUsersTable(currentUsers); 
                
                const paginationContainer = usersTab.find('.pagination-controls');
                if (paginationContainer.length) {
                    renderPaginationControls(paginationContainer, userPagination, (newPage) => loadUsers(newPage, userPagination.limit, searchParams));
                } else {
                    console.warn("Admin.js: Pagination controls container not found in usersTab after renderUsersTable.");
                }
            })
            .catch(error => {
                console.error("Admin.js: loadUsers - API request failed.", error);
                showAlert('ไม่สามารถโหลดข้อมูลผู้ใช้งานได้: ' + error.message, 'danger');
                usersTab.html('<p class="text-danger text-center mt-3">เกิดข้อผิดพลาดในการโหลดข้อมูลผู้ใช้งาน กรุณาลองใหม่อีกครั้ง</p>');
            });
    }

    function renderUsersTable(users) {
        console.log("Admin.js: renderUsersTable called with users:", users ? users.length : 0);
        if (!usersTab.length) {
            console.error("Admin.js: usersTab element not found in renderUsersTable. Aborting.");
            return;
        }
        
        let tableHtml = `
            <div class="d-flex justify-content-between align-items-center mb-3">
                <h4>รายการผู้ใช้งาน (${userPagination.currentPage}/${userPagination.totalPages} - ทั้งหมด ${userPagination.total || 0})</h4>
                <div>
                    <input type="text" id="userSearchInput" class="form-control form-control-sm d-inline-block w-auto me-2" placeholder="ค้นหา Username/Email...">
                    <select id="userRoleFilter" class="form-select form-select-sm d-inline-block w-auto me-2">
                        <option value="">ทุก Role</option>
                        <option value="admin">Admin</option>
                        <option value="user">User</option>
                    </select>
                    <select id="userStatusFilter" class="form-select form-select-sm d-inline-block w-auto me-2">
                        <option value="">ทุกสถานะ</option>
                        <option value="true">Active</option>
                        <option value="false">Inactive</option>
                    </select>
                    <button class="btn btn-sm btn-primary" id="addUserBtn" data-bs-toggle="modal" data-bs-target="#userModal"><i class="bi bi-plus-circle"></i> เพิ่มผู้ใช้ใหม่</button>
                </div>
            </div>
            <div class="table-responsive">
                <table class="table table-hover table-striped">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Username</th>
                            <th>Email</th>
                            <th>Role</th>
                            <th>สถานะ</th>
                            <th>สร้างเมื่อ</th>
                            <th>ดำเนินการ</th>
                        </tr>
                    </thead>
                    <tbody>`;
        if (users && users.length > 0) {
            users.forEach(user => {
                tableHtml += `
                    <tr>
                        <td>${user.id}</td>
                        <td>${user.username}</td>
                        <td>${user.email}</td>
                        <td><span class="badge bg-${user.role === 'admin' ? 'danger' : 'success'}">${user.role}</span></td>
                        <td><span class="badge bg-${user.is_active ? 'success' : 'secondary'}">${user.is_active ? 'Active' : 'Inactive'}</span></td>
                        <td>${formatDate(user.created_at)}</td>
                        <td>
                            <button class="btn btn-sm btn-warning editUserBtn" data-id="${user.id}" data-bs-toggle="modal" data-bs-target="#userModal"><i class="bi bi-pencil-square"></i></button>
                            <button class="btn btn-sm btn-danger deleteUserBtn" data-id="${user.id}" data-username="${user.username}"><i class="bi bi-trash3"></i></button>
                        </td>
                    </tr>`;
            });
        } else {
            tableHtml += '<tr><td colspan="7" class="text-center">ไม่พบข้อมูลผู้ใช้งาน</td></tr>';
        }
        tableHtml += `
                    </tbody>
                </table>
            </div>
            <div class="pagination-controls mt-3"></div> 
            ${renderUserModal()} 
        `;
        console.log("Admin.js: renderUsersTable - Generated HTML for usersTab (first 300 chars):", tableHtml.substring(0, 300));
        usersTab.html(tableHtml); 
        console.log("Admin.js: renderUsersTable - HTML rendered to usersTab.");

        $('#userSearchInput, #userRoleFilter, #userStatusFilter').off('change keyup').on('change keyup', function(e) {
            if (e.type === 'keyup' && e.key !== 'Enter' && $(this).is('#userSearchInput')) {
                return;
            }
            const search = $('#userSearchInput').val();
            const role = $('#userRoleFilter').val();
            const isActive = $('#userStatusFilter').val();
            console.log("Admin.js: User filters changed/applied. Search:", search, "Role:", role, "Status:", isActive);
            loadUsers(1, userPagination.limit, { search, role, is_active: isActive });
        });
    }

    function renderUserModal(user = null) {
        const modalTitle = user ? 'แก้ไขผู้ใช้งาน' : 'เพิ่มผู้ใช้งานใหม่';
        const submitButtonText = user ? 'บันทึกการเปลี่ยนแปลง' : 'สร้างผู้ใช้';
        // Ensure is_active defaults to true for new users if user object or user.is_active is undefined
        const isActiveChecked = user ? (user.is_active ? 'checked' : '') : 'checked';

        return `
            <div class="modal fade" id="userModal" tabindex="-1" aria-labelledby="userModalLabel" aria-hidden="true">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title" id="userModalLabel">${modalTitle}</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <form id="userForm">
                                <input type="hidden" name="id" value="${user ? user.id : ''}">
                                <div class="mb-3">
                                    <label for="userFormUsername" class="form-label">Username <span class="text-danger">*</span></label>
                                    <input type="text" class="form-control" id="userFormUsername" name="username" value="${user ? user.username : ''}" required>
                                </div>
                                <div class="mb-3">
                                    <label for="userFormEmail" class="form-label">Email <span class="text-danger">*</span></label>
                                    <input type="email" class="form-control" id="userFormEmail" name="email" value="${user ? user.email : ''}" required>
                                </div>
                                <div class="mb-3">
                                    <label for="userFormPassword" class="form-label">Password ${user ? '(ปล่อยว่างไว้หากไม่ต้องการเปลี่ยน)' : '<span class="text-danger">*</span>'}</label>
                                    <input type="password" class="form-control" id="userFormPassword" name="password" ${user ? '' : 'required'}>
                                </div>
                                <div class="mb-3">
                                    <label for="userFormRole" class="form-label">Role <span class="text-danger">*</span></label>
                                    <select class="form-select" id="userFormRole" name="role" required>
                                        <option value="user" ${user && user.role === 'user' ? 'selected' : ''}>User</option>
                                        <option value="admin" ${user && user.role === 'admin' ? 'selected' : ''}>Admin</option>
                                    </select>
                                </div>
                                <div class="form-check mb-3">
                                    <input class="form-check-input" type="checkbox" name="is_active" id="userFormIsActive" ${isActiveChecked}>
                                    <label class="form-check-label" for="userFormIsActive">
                                        Active
                                    </label>
                                </div>
                                <button type="submit" class="btn btn-primary">${submitButtonText}</button>
                            </form>
                        </div>
                    </div>
                </div>
            </div>`;
    }

    usersTab.on('click', '#addUserBtn', function() {
        console.log("Admin.js: Add User button clicked.");
        $('#userModalLabel').text('เพิ่มผู้ใช้งานใหม่');
        $('#userForm').trigger('reset').find('[name="id"]').val('');
        $('#userForm [name="is_active"]').prop('checked', true); // Default new user to active
        $('#userForm button[type="submit"]').text('สร้างผู้ใช้');
        $('#userForm [name="password"]').prop('required', true);
    });

    usersTab.on('click', '.editUserBtn', function() {
        const userId = $(this).data('id');
        console.log("Admin.js: Edit User button clicked for user ID:", userId);
        const user = currentUsers.find(u => u.id === userId);
        if (user) {
            $('#userModalLabel').text('แก้ไขผู้ใช้งาน');
            populateForm('#userForm', user); // populateForm should handle checkbox for is_active
            $('#userForm [name="password"]').val('').prop('required', false); 
            $('#userForm button[type="submit"]').text('บันทึกการเปลี่ยนแปลง');
        } else {
            console.error("Admin.js: User not found in currentUsers for ID:", userId);
            showAlert("ไม่พบข้อมูลผู้ใช้ที่ต้องการแก้ไข", "warning");
        }
    });

    usersTab.on('submit', '#userForm', function(e) {
        e.preventDefault();
        const formData = $(this).serializeObject();
        const userId = formData.id;
        console.log(`Admin.js: User form submitted. Action: ${userId ? 'Update' : 'Create'}, UserID: ${userId || 'New'}, Data:`, formData);
        
        formData.is_active = $('#userForm [name="is_active"]').is(':checked');
        if (!formData.password && userId) { // If password field is empty during an update
            delete formData.password; 
        } else if (!formData.password && !userId) { // Password required for new user
            showAlert("กรุณากรอกรหัสผ่านสำหรับผู้ใช้ใหม่", "warning");
            return;
        }


        const method = userId ? 'PUT' : 'POST';
        const endpoint = userId ? `/admin/users/${userId}` : '/admin/users';
        const $submitBtn = $(this).find('button[type="submit"]');
        showSpinner($submitBtn);

        apiRequest(endpoint, method, formData)
            .then(response => {
                hideSpinner($submitBtn);
                if (response.success) {
                    showAlert(response.message || `ผู้ใช้งาน ${userId ? 'แก้ไข' : 'สร้าง'} สำเร็จ`, 'success');
                    $('#userModal').modal('hide');
                    loadUsers(userPagination.currentPage, userPagination.limit); 
                } else {
                    showAlert(response.message || `เกิดข้อผิดพลาดในการ ${userId ? 'แก้ไข' : 'สร้าง'} ผู้ใช้งาน`, 'danger');
                }
            })
            .catch(error => {
                hideSpinner($submitBtn);
                // showAlert is already called by apiRequest for network/server errors
            });
    });

    usersTab.on('click', '.deleteUserBtn', function() {
        const userId = $(this).data('id');
        const username = $(this).data('username');
        console.log("Admin.js: Delete User button clicked for user ID:", userId, "Username:", username);
        if (confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบผู้ใช้งาน '${username}' (ID: ${userId})? การกระทำนี้ไม่สามารถย้อนกลับได้`)) {
            const $button = $(this);
            showSpinner($button, 'Deleting...');
            apiRequest(`/admin/users/${userId}`, 'DELETE')
                .then(response => {
                    // Spinner might be hidden if table re-renders before this.
                    // hideSpinner($button); 
                    if (response.success) {
                        showAlert(`ผู้ใช้งาน '${username}' ถูกลบสำเร็จ`, 'success');
                        loadUsers(userPagination.currentPage, userPagination.limit); 
                    } else {
                        showAlert(response.message || 'เกิดข้อผิดพลาดในการลบผู้ใช้งาน', 'danger');
                        hideSpinner($button); // Hide spinner if error and no refresh
                    }
                })
                .catch(error => {
                    // showAlert is called by apiRequest
                    hideSpinner($button); // Ensure spinner is hidden on catch
                });
        }
    });

    // --- 3. Topic Management Section ---
    const topicsTab = $('#topics-tab-pane');
    
    function loadTopics() { 
        console.log("Admin.js: loadTopics called.");
        topicsTab.html('<div class="text-center p-5"><div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading topics...</span></div> <p>กำลังโหลดข้อมูลหัวข้อ...</p></div>');
        apiRequest('/admin/topics', 'GET')
            .then(data => {
                console.log("Admin.js: loadTopics - API request successful. Data:", data);
                currentTopics = data.topics;
                renderTopicsTable(currentTopics);
            })
            .catch(error => {
                console.error("Admin.js: loadTopics - API request failed.", error);
                showAlert('ไม่สามารถโหลดข้อมูลหัวข้อได้: ' + error.message, 'danger');
                topicsTab.html('<p class="text-danger text-center mt-3">เกิดข้อผิดพลาดในการโหลดข้อมูลหัวข้อ</p>');
            });
        
        if(allUsersForPermissions.length === 0) {
            apiRequest('/admin/users', 'GET', { limit: 1000, page: 1 }) 
                .then(data => {
                    if (data.success) allUsersForPermissions = data.users;
                })
                .catch(err => console.error("Admin.js: Failed to fetch users for permissions modal", err));
        }
    }

    function renderTopicsTable(topics) {
        console.log("Admin.js: renderTopicsTable called with topics:", topics ? topics.length : 0);
        let tableHtml = `
            <div class="d-flex justify-content-between align-items-center mb-3">
                <h4>รายการหัวข้อ Import</h4>
                <button class="btn btn-sm btn-primary" id="addTopicBtn" data-bs-toggle="modal" data-bs-target="#topicModal"><i class="bi bi-plus-circle"></i> เพิ่มหัวข้อใหม่</button>
            </div>
            <div class="accordion" id="topicsAccordion">`;

        if (topics && topics.length > 0) {
            topics.forEach((topic, index) => {
                tableHtml += `
                    <div class="accordion-item">
                        <h2 class="accordion-header" id="heading-${topic.id}">
                            <button class="accordion-button ${index !== 0 ? 'collapsed' : ''}" type="button" data-bs-toggle="collapse" data-bs-target="#collapse-${topic.id}" aria-expanded="${index === 0 ? 'true' : 'false'}" aria-controls="collapse-${topic.id}">
                                <strong>${topic.name}</strong> (ID: ${topic.id}) - Target: ${topic.target_db_name}.${topic.target_table_name}
                            </button>
                        </h2>
                        <div id="collapse-${topic.id}" class="accordion-collapse collapse ${index === 0 ? 'show' : ''}" aria-labelledby="heading-${topic.id}" data-bs-parent="#topicsAccordion">
                            <div class="accordion-body">
                                <p><strong>Host:</strong> ${topic.target_db_host}:${topic.target_db_port || 3306}</p>
                                <p><strong>User:</strong> ${topic.target_db_user}</p>
                                <p><strong>สร้างโดย:</strong> ${topic.creator ? topic.creator.username : 'N/A'} เมื่อ ${formatDate(topic.created_at)}</p>
                                <h5>Column Mappings (${topic.columnMappings ? topic.columnMappings.length : 0}):</h5>
                                ${renderColumnMappingsTable(topic.columnMappings, false)}
                                <div class="mt-3">
                                    <button class="btn btn-sm btn-warning editTopicBtn" data-id="${topic.id}" data-bs-toggle="modal" data-bs-target="#topicModal"><i class="bi bi-pencil-square"></i> แก้ไขหัวข้อ</button>
                                    <button class="btn btn-sm btn-danger deleteTopicBtn" data-id="${topic.id}" data-name="${topic.name}"><i class="bi bi-trash3"></i> ลบหัวข้อ</button>
                                    <button class="btn btn-sm btn-info manageTopicPermissionsBtn" data-id="${topic.id}" data-name="${topic.name}" data-bs-toggle="modal" data-bs-target="#topicPermissionsModal"><i class="bi bi-person-gear"></i> จัดการสิทธิ์</button>
                                </div>
                            </div>
                        </div>
                    </div>`;
            });
        } else {
            tableHtml += '<p>ไม่พบข้อมูลหัวข้อ</p>';
        }
        tableHtml += `</div> ${renderTopicModal()} ${renderTopicPermissionsModal()}`; 
        topicsTab.html(tableHtml);
        console.log("Admin.js: renderTopicsTable - HTML rendered to topicsTab.");
    }
    
    function renderColumnMappingsTable(mappings, editable = false, topicId = null) {
        if (!mappings || mappings.length === 0) {
            if (editable) { // Provide a way to add the first mapping if none exist and editable
                return `<table class="table table-sm table-bordered table-striped column-mappings-table-editable" ${`data-topic-id="${topicId || ''}"`}>
                            <thead><tr><th>Source Column (Excel/CSV)</th><th>Target Column (DB Table)</th><th>Data Type (DB)</th><th>PK</th><th>Index</th><th>Allow Null</th><th>Default Value</th><th>Action</th></tr></thead>
                            <tbody></tbody>
                        </table>
                        <button type="button" class="btn btn-sm btn-success mt-2" id="addMappingRowBtn"><i class="bi bi-plus-square-dotted"></i> เพิ่ม Mapping Row</button>`;
            }
            return '<p class="text-muted">ยังไม่มีการกำหนด Column Mappings</p>';
        }
        let mappingsHtml = `<table class="table table-sm table-bordered table-striped ${editable ? 'column-mappings-table-editable' : ''}" ${editable ? `data-topic-id="${topicId || ''}"` : ''}>
                                <thead>
                                    <tr>
                                        <th>Source Column (Excel/CSV)</th>
                                        <th>Target Column (DB Table)</th>
                                        <th>Data Type (DB)</th>
                                        <th>PK</th>
                                        <th>Index</th>
                                        <th>Allow Null</th>
                                        <th>Default Value</th>
                                        ${editable ? '<th>Action</th>' : ''}
                                    </tr>
                                </thead>
                                <tbody>`;
        mappings.forEach((m, index) => {
            mappingsHtml += `<tr data-index="${index}">
                                <td>${editable ? `<input type="text" class="form-control form-control-sm" name="source_column_name" value="${m.source_column_name || ''}" required>` : m.source_column_name}</td>
                                <td>${editable ? `<input type="text" class="form-control form-control-sm" name="target_column_name" value="${m.target_column_name || ''}" required>` : m.target_column_name}</td>
                                <td>${editable ? `<input type="text" class="form-control form-control-sm" name="data_type" value="${m.data_type || 'VARCHAR(255)'}">` : (m.data_type || 'VARCHAR(255)')}</td>
                                <td class="text-center">${editable ? `<input class="form-check-input" type="checkbox" name="is_primary_key" ${m.is_primary_key ? 'checked' : ''}>` : (m.is_primary_key ? '<i class="bi bi-check-circle-fill text-success"></i>' : '<i class="bi bi-x-circle text-muted"></i>')}</td>
                                <td class="text-center">${editable ? `<input class="form-check-input" type="checkbox" name="is_index" ${m.is_index ? 'checked' : ''}>` : (m.is_index ? '<i class="bi bi-check-circle-fill text-success"></i>' : '<i class="bi bi-x-circle text-muted"></i>')}</td>
                                <td class="text-center">${editable ? `<input class="form-check-input" type="checkbox" name="allow_null" ${m.allow_null !== false ? 'checked' : ''}>` : (m.allow_null !== false ? '<i class="bi bi-check-circle-fill text-success"></i>' : '<i class="bi bi-x-circle text-danger"></i>')}</td>
                                <td>${editable ? `<input type="text" class="form-control form-control-sm" name="default_value" value="${m.default_value || ''}">` : (m.default_value || 'N/A')}</td>
                                ${editable ? `<td><button type="button" class="btn btn-sm btn-danger remove-mapping-row"><i class="bi bi-trash"></i></button></td>` : ''}
                             </tr>`;
        });
        mappingsHtml += `   </tbody>
                          </table>`;
        if (editable) {
            mappingsHtml += `<button type="button" class="btn btn-sm btn-success mt-2" id="addMappingRowBtn"><i class="bi bi-plus-square-dotted"></i> เพิ่ม Mapping Row</button>`;
        }
        return mappingsHtml;
    }

    function renderTopicModal(topic = null) {
        const modalTitle = topic ? `แก้ไขหัวข้อ: ${topic.name}` : 'เพิ่มหัวข้อ Import ใหม่';
        const submitButtonText = topic ? 'บันทึกการเปลี่ยนแปลง' : 'สร้างหัวข้อ';
        const mappings = topic ? topic.columnMappings : []; // Start with empty or existing mappings

        return `
            <div class="modal fade" id="topicModal" tabindex="-1" aria-labelledby="topicModalLabel" aria-hidden="true">
                <div class="modal-dialog modal-xl"> 
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title" id="topicModalLabel">${modalTitle}</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <form id="topicForm">
                                <input type="hidden" name="id" value="${topic ? topic.id : ''}">
                                <div class="row">
                                    <div class="col-md-6 mb-3">
                                        <label for="topicName" class="form-label">ชื่อหัวข้อ <span class="text-danger">*</span></label>
                                        <input type="text" class="form-control" id="topicName" name="name" value="${topic ? topic.name : ''}" required>
                                    </div>
                                </div>
                                <hr>
                                <h6>ตั้งค่าฐานข้อมูลปลายทาง:</h6>
                                <div class="row">
                                    <div class="col-md-4 mb-3">
                                        <label class="form-label">Host <span class="text-danger">*</span></label>
                                        <input type="text" class="form-control" name="target_db_host" value="${topic ? topic.target_db_host : ''}" required>
                                    </div>
                                    <div class="col-md-2 mb-3">
                                        <label class="form-label">Port</label>
                                        <input type="number" class="form-control" name="target_db_port" value="${topic ? (topic.target_db_port || 3306) : 3306}">
                                    </div>
                                    <div class="col-md-3 mb-3">
                                        <label class="form-label">Database Name <span class="text-danger">*</span></label>
                                        <input type="text" class="form-control" name="target_db_name" value="${topic ? topic.target_db_name : ''}" required>
                                    </div>
                                    <div class="col-md-3 mb-3">
                                        <label class="form-label">Table Name <span class="text-danger">*</span></label>
                                        <input type="text" class="form-control" name="target_table_name" value="${topic ? topic.target_table_name : ''}" required>
                                    </div>
                                </div>
                                <div class="row">
                                    <div class="col-md-6 mb-3">
                                        <label class="form-label">Username <span class="text-danger">*</span></label>
                                        <input type="text" class="form-control" name="target_db_user" value="${topic ? topic.target_db_user : ''}" required>
                                    </div>
                                    <div class="col-md-6 mb-3">
                                        <label class="form-label">Password ${topic ? '(ปล่อยว่างไว้หากไม่ต้องการเปลี่ยน)' : '<span class="text-danger">*</span>'}</label>
                                        <input type="password" class="form-control" name="target_db_password" ${topic ? '' : 'required'}>
                                    </div>
                                </div>
                                <hr>
                                <h6>Column Mappings:</h6>
                                <div id="columnMappingsContainerModal">
                                    ${renderColumnMappingsTable(mappings, true, topic ? topic.id : null)}
                                </div>
                                <button type="submit" class="btn btn-primary mt-3">${submitButtonText}</button>
                            </form>
                        </div>
                    </div>
                </div>
            </div>`;
    }

    topicsTab.on('click', '#addTopicBtn', function() {
        console.log("Admin.js: Add Topic button clicked.");
        // Ensure the modal HTML is present in the DOM first (it's rendered with the topics table)
        if ($('#topicModal').length === 0) {
            console.error("Admin.js: Topic modal not found in DOM.");
            // As a fallback, append it if it's missing, though it should be there.
            topicsTab.append(renderTopicModal());
        }
        $('#topicModalLabel').text('เพิ่มหัวข้อ Import ใหม่');
        $('#topicForm').trigger('reset').find('[name="id"]').val('');
        $('#topicForm [name="target_db_port"]').val('3306'); 
        $('#topicForm button[type="submit"]').text('สร้างหัวข้อ');
        $('#topicForm [name="target_db_password"]').prop('required', true);
        $('#columnMappingsContainerModal').html(renderColumnMappingsTable([], true, null));
    });

    topicsTab.on('click', '.editTopicBtn', function() {
        const topicId = $(this).data('id');
        console.log("Admin.js: Edit Topic button clicked for topic ID:", topicId);
        const topic = currentTopics.find(t => t.id === topicId);
        if (topic) {
             if ($('#topicModal').length === 0) {
                topicsTab.append(renderTopicModal(topic)); // Render with topic data if not exists
            }
            $('#topicModalLabel').text(`แก้ไขหัวข้อ: ${topic.name}`);
            populateForm('#topicForm', topic);
            $('#topicForm [name="target_db_password"]').val('').prop('required', false);
            $('#topicForm button[type="submit"]').text('บันทึกการเปลี่ยนแปลง');
            $('#columnMappingsContainerModal').html(renderColumnMappingsTable(topic.columnMappings || [], true, topic.id));
        } else {
            console.error("Admin.js: Topic not found for ID:", topicId);
            showAlert("ไม่พบข้อมูลหัวข้อที่ต้องการแก้ไข", "warning");
        }
    });
    
    // Use event delegation for dynamically added mapping rows inside the modal
    $('body').on('click', '#topicModal #addMappingRowBtn', function() {
        console.log("Admin.js: Add Mapping Row button clicked in modal.");
        const newRowHtml = `<tr data-index="new">
                                <td><input type="text" class="form-control form-control-sm" name="source_column_name" value="" required></td>
                                <td><input type="text" class="form-control form-control-sm" name="target_column_name" value="" required></td>
                                <td><input type="text" class="form-control form-control-sm" name="data_type" value="VARCHAR(255)"></td>
                                <td class="text-center"><input class="form-check-input" type="checkbox" name="is_primary_key"></td>
                                <td class="text-center"><input class="form-check-input" type="checkbox" name="is_index"></td>
                                <td class="text-center"><input class="form-check-input" type="checkbox" name="allow_null" checked></td>
                                <td><input type="text" class="form-control form-control-sm" name="default_value" value=""></td>
                                <td><button type="button" class="btn btn-sm btn-danger remove-mapping-row"><i class="bi bi-trash"></i></button></td>
                             </tr>`;
        $('#columnMappingsContainerModal .column-mappings-table-editable tbody').append(newRowHtml);
    });

    $('body').on('click', '#topicModal .remove-mapping-row', function() {
        console.log("Admin.js: Remove Mapping Row button clicked.");
        $(this).closest('tr').remove();
    });


    // Event delegation for topic form submission, as modal is re-rendered
    $('body').on('submit', '#topicForm', function(e) {
        e.preventDefault();
        const rawFormData = $(this).serializeObject();
        const topicId = rawFormData.id;
        console.log(`Admin.js: Topic form submitted. Action: ${topicId ? 'Update' : 'Create'}, TopicID: ${topicId || 'New'}`);
        
        const column_mappings = [];
        $('#columnMappingsContainerModal .column-mappings-table-editable tbody tr').each(function() {
            const $row = $(this);
            const mapping = {
                source_column_name: $row.find('[name="source_column_name"]').val(),
                target_column_name: $row.find('[name="target_column_name"]').val(),
                data_type: $row.find('[name="data_type"]').val() || 'VARCHAR(255)',
                is_primary_key: $row.find('[name="is_primary_key"]').is(':checked'),
                is_index: $row.find('[name="is_index"]').is(':checked'),
                allow_null: $row.find('[name="allow_null"]').is(':checked'),
                default_value: $row.find('[name="default_value"]').val() || null
            };
            if (mapping.source_column_name && mapping.target_column_name) {
                column_mappings.push(mapping);
            }
        });
        
        const finalFormData = {
            name: rawFormData.name, // id is not part of what we send for create/update body like this
            target_db_host: rawFormData.target_db_host,
            target_db_port: parseInt(rawFormData.target_db_port) || 3306,
            target_db_name: rawFormData.target_db_name,
            target_table_name: rawFormData.target_table_name,
            target_db_user: rawFormData.target_db_user,
            column_mappings: column_mappings
        };
        if (topicId) finalFormData.id = topicId; // Add id for update, but not directly from form serializeObject if it's just a hidden field

        if (rawFormData.target_db_password) {
            finalFormData.target_db_password = rawFormData.target_db_password;
        } else if (!topicId) { 
             showAlert('Password ฐานข้อมูลปลายทางเป็นสิ่งจำเป็นสำหรับหัวข้อใหม่', 'warning');
             return;
        }

        const method = topicId ? 'PUT' : 'POST';
        const endpoint = topicId ? `/admin/topics/${topicId}` : '/admin/topics';
        const $submitBtn = $(this).find('button[type="submit"]');
        showSpinner($submitBtn);

        apiRequest(endpoint, method, finalFormData)
            .then(response => {
                hideSpinner($submitBtn);
                if (response.success) {
                    showAlert(response.message || `หัวข้อ ${topicId ? 'แก้ไข' : 'สร้าง'} สำเร็จ`, 'success');
                    $('#topicModal').modal('hide');
                    loadTopics(); 
                } else {
                    showAlert(response.message || `เกิดข้อผิดพลาดในการ ${topicId ? 'แก้ไข' : 'สร้าง'} หัวข้อ`, 'danger');
                }
            })
            .catch(error => {
                hideSpinner($submitBtn);
                 // showAlert is handled by apiRequest
            });
    });
    
    topicsTab.on('click', '.deleteTopicBtn', function() {
        const topicId = $(this).data('id');
        const topicName = $(this).data('name');
        console.log("Admin.js: Delete Topic button clicked for topic ID:", topicId, "Name:", topicName);
        if (confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบหัวข้อ '${topicName}' (ID: ${topicId})? การกระทำนี้จะลบ Column Mappings และ Permissions ที่เกี่ยวข้องทั้งหมด และไม่สามารถย้อนกลับได้`)) {
            const $button = $(this);
            showSpinner($button, 'Deleting...');
            apiRequest(`/admin/topics/${topicId}`, 'DELETE')
                .then(response => {
                    if (response.success) {
                        showAlert(`หัวข้อ '${topicName}' ถูกลบสำเร็จ`, 'success');
                        loadTopics();
                    } else {
                         showAlert(response.message || 'เกิดข้อผิดพลาดในการลบหัวข้อ', 'danger');
                         hideSpinner($button);
                    }
                })
                .catch(error => {
                    // showAlert is handled by apiRequest
                    hideSpinner($button);
                });
        }
    });

    // --- 4. Permissions Management Section ---
    const permissionsTab = $('#permissions-tab-pane');

    function loadPermissionsManagement() {
        console.log("Admin.js: loadPermissionsManagement called.");
        permissionsTab.html('<div class="text-center p-5"><div class="spinner-border text-primary" role="status"></div> <p>กำลังโหลดข้อมูล...</p></div>');
        
        const topicsPromise = (currentTopics.length > 0 && allUsersForPermissions.length > 0) ? 
                              Promise.resolve({ topics: currentTopics }) : 
                              apiRequest('/admin/topics', 'GET');
        const usersPromise = allUsersForPermissions.length > 0 ? 
                             Promise.resolve({ users: allUsersForPermissions }) : 
                             apiRequest('/admin/users', 'GET', { limit: 1000, page: 1 });

        Promise.all([topicsPromise, usersPromise])
            .then(([topicsData, usersData]) => {
                console.log("Admin.js: Permissions - Topics and Users data fetched.");
                if (topicsData.topics) currentTopics = topicsData.topics; // Update if fetched
                if (usersData.users) allUsersForPermissions = usersData.users; // Update if fetched
                
                renderPermissionsTopicSelector();
                // If a topic was previously selected, try to re-load its permissions
                const previouslySelectedTopicId = $('#permTopicSelect').val();
                if (previouslySelectedTopicId) {
                    currentSelectedTopicForPerm = currentTopics.find(t => t.id == previouslySelectedTopicId);
                    if(currentSelectedTopicForPerm) loadUserPermissionsForTopic(previouslySelectedTopicId);
                } else {
                     $('#userPermissionsForTopicContainer').html('<p class="text-muted mt-3">กรุณาเลือกหัวข้อเพื่อดูและจัดการสิทธิ์</p>');
                }
            })
            .catch(err => {
                console.error("Admin.js: Error loading data for permissions management", err);
                permissionsTab.html('<p class="text-danger text-center mt-3">ไม่สามารถโหลดข้อมูลสำหรับจัดการสิทธิ์ได้</p>');
                showAlert('เกิดข้อผิดพลาดในการโหลดข้อมูลพื้นฐานสำหรับจัดการสิทธิ์: ' + err.message, 'danger');
            });
    }

    function renderPermissionsTopicSelector() {
        console.log("Admin.js: renderPermissionsTopicSelector called.");
        let html = `<h4>จัดการสิทธิ์การเข้าถึงหัวข้อ</h4>
                    <div class="mb-3">
                        <label for="permTopicSelect" class="form-label">เลือกหัวข้อ:</label>
                        <select id="permTopicSelect" class="form-select">
                            <option value="">-- กรุณาเลือกหัวข้อ --</option>`;
        currentTopics.forEach(topic => {
            html += `<option value="${topic.id}">${topic.name} (ID: ${topic.id})</option>`;
        });
        html += `   </select>
                    </div>
                    <div id="userPermissionsForTopicContainer">
                        <p class="text-muted mt-3">กรุณาเลือกหัวข้อเพื่อดูและจัดการสิทธิ์</p>
                    </div>
                    ${renderTopicPermissionsModal()} 
                    `;
        permissionsTab.html(html);
    }
    
    permissionsTab.on('change', '#permTopicSelect', function() {
        const topicId = $(this).val();
        console.log("Admin.js: Permissions - Topic selected:", topicId);
        if (topicId) {
            currentSelectedTopicForPerm = currentTopics.find(t => t.id == topicId);
            if (currentSelectedTopicForPerm) {
                loadUserPermissionsForTopic(topicId);
            } else {
                console.warn("Admin.js: Selected topic for permission not found in cached currentTopics.");
                 $('#userPermissionsForTopicContainer').html('<p class="text-danger">ไม่พบข้อมูลหัวข้อที่เลือก</p>');
            }
        } else {
            $('#userPermissionsForTopicContainer').html('<p class="text-muted mt-3">กรุณาเลือกหัวข้อเพื่อดูและจัดการสิทธิ์</p>');
            currentSelectedTopicForPerm = null;
        }
    });

    function loadUserPermissionsForTopic(topicId) {
        const container = $('#userPermissionsForTopicContainer');
        console.log("Admin.js: loadUserPermissionsForTopic called for topic ID:", topicId);
        container.html('<div class="text-center p-3"><div class="spinner-border spinner-border-sm text-primary" role="status"></div> <p>กำลังโหลดสิทธิ์...</p></div>');
        
        apiRequest(`/admin/topics/${topicId}`) 
            .then(data => {
                if (data.success && data.topic) {
                    console.log("Admin.js: Permissions for topic fetched:", data.topic);
                    currentSelectedTopicForPerm = data.topic; 
                    renderUserPermissionsList(data.topic);
                } else {
                    showAlert(data.message || `ไม่สามารถโหลดสิทธิ์สำหรับหัวข้อ ID ${topicId}`, 'danger');
                    container.html(`<p class="text-danger">เกิดข้อผิดพลาดในการโหลดสิทธิ์</p>`);
                }
            })
            .catch(error => {
                console.error("Admin.js: Error loading user permissions for topic:", error);
                showAlert(`ไม่สามารถโหลดสิทธิ์สำหรับหัวข้อ ID ${topicId}: ${error.message}`, 'danger');
                container.html(`<p class="text-danger">เกิดข้อผิดพลาดในการโหลดสิทธิ์</p>`);
            });
    }

    function renderUserPermissionsList(topicWithPerms) {
        console.log("Admin.js: renderUserPermissionsList for topic:", topicWithPerms.name);
        let html = `<div class="card mt-3">
                        <div class="card-header d-flex justify-content-between align-items-center">
                            สิทธิ์สำหรับหัวข้อ: <strong>${topicWithPerms.name}</strong>
                            <button class="btn btn-sm btn-success" id="addPermissionToTopicBtn" data-bs-toggle="modal" data-bs-target="#topicPermissionsModal"><i class="bi bi-person-plus-fill"></i> เพิ่ม/แก้ไขสิทธิ์ผู้ใช้</button>
                        </div>
                        <div class="card-body">`;
        if (topicWithPerms.userPermissions && topicWithPerms.userPermissions.length > 0) {
            html += `<ul class="list-group">`;
            topicWithPerms.userPermissions.forEach(perm => {
                html += `<li class="list-group-item d-flex justify-content-between align-items-center">
                            <div>
                                <strong>${perm.User ? perm.User.username : `User ID: ${perm.user_id}`}</strong><br>
                                <small>
                                    Import: <i class="bi ${perm.can_import ? 'bi-check-circle-fill text-success' : 'bi-x-circle-fill text-danger'}"></i> | 
                                    View: <i class="bi ${perm.can_view_data ? 'bi-check-circle-fill text-success' : 'bi-x-circle-fill text-danger'}"></i> | 
                                    Delete: <i class="bi ${perm.can_delete_data ? 'bi-check-circle-fill text-success' : 'bi-x-circle-fill text-danger'}"></i>
                                </small>
                            </div>
                            <div>
                                <button class="btn btn-sm btn-outline-warning editThisPermissionBtn me-1" data-user-id="${perm.user_id}" data-topic-id="${perm.topic_id}" data-bs-toggle="modal" data-bs-target="#topicPermissionsModal"><i class="bi bi-pencil"></i> แก้ไข</button>
                                <button class="btn btn-sm btn-outline-danger removePermissionBtn" data-user-id="${perm.user_id}" data-topic-id="${perm.topic_id}"><i class="bi bi-trash"></i> ลบ</button>
                            </div>
                         </li>`;
            });
            html += `</ul>`;
        } else {
            html += `<p class="text-muted">ยังไม่มีผู้ใช้ใดได้รับสิทธิ์สำหรับหัวข้อนี้</p>`;
        }
        html += `   </div>
                    </div>`;
        $('#userPermissionsForTopicContainer').html(html);
    }
    
    function setupAndShowPermissionsModal(topic, userToEditPerms = null) {
        if (!topic) {
            showAlert("ไม่พบข้อมูลหัวข้อสำหรับตั้งค่าสิทธิ์", "warning");
            return;
        }
        console.log("Admin.js: setupAndShowPermissionsModal for topic:", topic.name, "User to edit:", userToEditPerms);
        
        // Ensure modal HTML is in the DOM
        if ($('#topicPermissionsModal').length === 0) {
            permissionsTab.append(renderTopicPermissionsModal()); // Append if not found
        }

        $('#topicPermissionsModalLabel').text(`จัดการสิทธิ์สำหรับหัวข้อ: ${topic.name} (ID: ${topic.id})`);
        $('#permTopicIdField').val(topic.id);

        // Populate user dropdown
        const userSelect = $('#permUserIdSelect');
        userSelect.html('<option value="">-- เลือกผู้ใช้ --</option>'); // Clear previous options
        allUsersForPermissions.forEach(u => {
            userSelect.append(`<option value="${u.id}">${u.username} (ID: ${u.id})</option>`);
        });

        if (userToEditPerms) {
            userSelect.val(userToEditPerms.user_id).prop('disabled', true); // Disable user select when editing
            $('#permCanImport').prop('checked', userToEditPerms.can_import);
            $('#permCanViewData').prop('checked', userToEditPerms.can_view_data);
            $('#permCanDeleteData').prop('checked', userToEditPerms.can_delete_data);
        } else {
            userSelect.val('').prop('disabled', false); // Enable for new permission
            $('#permCanImport').prop('checked', true); // Defaults for new
            $('#permCanViewData').prop('checked', true);
            $('#permCanDeleteData').prop('checked', false);
        }
        
        // This event handler is now inside the modal setup to capture the correct context
        userSelect.off('change.loadPerms').on('change.loadPerms', function() {
            if (userToEditPerms) return; // Don't reload if editing a specific user's permission

            const selectedUserId = $(this).val();
            if (selectedUserId && topic && topic.userPermissions) {
                const existingPerm = topic.userPermissions.find(p => p.user_id == selectedUserId);
                if (existingPerm) {
                    $('#permCanImport').prop('checked', existingPerm.can_import);
                    $('#permCanViewData').prop('checked', existingPerm.can_view_data);
                    $('#permCanDeleteData').prop('checked', existingPerm.can_delete_data);
                } else { 
                    $('#permCanImport').prop('checked', true);
                    $('#permCanViewData').prop('checked', true);
                    $('#permCanDeleteData').prop('checked', false);
                }
            } else if (!selectedUserId) { // No user selected, reset to defaults
                 $('#permCanImport').prop('checked', true);
                 $('#permCanViewData').prop('checked', true);
                 $('#permCanDeleteData').prop('checked', false);
            }
        });
        // Trigger change if editing to load initial perms for that user
        if (userToEditPerms) userSelect.trigger('change.loadPerms');

        // Show the modal
        const permModal = bootstrap.Modal.getOrCreateInstance(document.getElementById('topicPermissionsModal'));
        permModal.show();
    }


    // Event for "จัดการสิทธิ์" button on the main topic accordion
    topicsTab.on('click', '.manageTopicPermissionsBtn', function() {
        const topicId = $(this).data('id');
        console.log("Admin.js: Manage Topic Permissions button clicked (from topic list) for topic ID:", topicId);
        currentSelectedTopicForPerm = currentTopics.find(t => t.id == topicId); 
        if (currentSelectedTopicForPerm) {
             // Fetch full topic details including permissions to ensure they are fresh
            apiRequest(`/admin/topics/${topicId}`)
            .then(data => {
                if (data.success && data.topic) {
                    currentSelectedTopicForPerm = data.topic; // Update with fresh data
                    setupAndShowPermissionsModal(currentSelectedTopicForPerm);
                } else {
                    showAlert("ไม่สามารถโหลดรายละเอียดหัวข้อสำหรับจัดการสิทธิ์ได้", "danger");
                }
            }).catch(err => showAlert("Error fetching topic details for permissions: " + err.message, "danger"));
        } else {
            showAlert("ไม่พบหัวข้อที่เลือก", "warning");
        }
    });

    // Event for "เพิ่ม/แก้ไขสิทธิ์ผู้ใช้" button within the permissions tab (after a topic is selected)
    permissionsTab.on('click', '#addPermissionToTopicBtn', function() {
        console.log("Admin.js: Add Permission to Topic button clicked (from permissions tab).");
        if (currentSelectedTopicForPerm) {
            setupAndShowPermissionsModal(currentSelectedTopicForPerm); // Open modal for new permission on current topic
        } else {
            showAlert('กรุณาเลือกหัวข้อก่อน', 'warning');
        }
    });
    
    // Event for "แก้ไข" button next to each user's permission entry
    permissionsTab.on('click', '.editThisPermissionBtn', function() {
        const userId = $(this).data('user-id');
        const topicId = $(this).data('topic-id');
        console.log("Admin.js: Edit This Permission button clicked for User ID:", userId, "Topic ID:", topicId);

        if (currentSelectedTopicForPerm && currentSelectedTopicForPerm.id == topicId && currentSelectedTopicForPerm.userPermissions) {
            const permToEdit = currentSelectedTopicForPerm.userPermissions.find(p => p.user_id == userId);
            if (permToEdit) {
                setupAndShowPermissionsModal(currentSelectedTopicForPerm, permToEdit);
            } else {
                showAlert("ไม่พบข้อมูลสิทธิ์ที่ต้องการแก้ไข", "warning");
            }
        } else {
            showAlert("กรุณาเลือกหัวข้อที่ถูกต้อง หรือข้อมูลสิทธิ์ไม่พร้อมใช้งาน", "warning");
        }
    });


    function renderTopicPermissionsModal() { 
        return `
        <div class="modal fade" id="topicPermissionsModal" tabindex="-1" aria-labelledby="topicPermissionsModalLabel" aria-hidden="true">
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title" id="topicPermissionsModalLabel">จัดการสิทธิ์สำหรับหัวข้อ</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        <form id="topicPermissionForm">
                            <input type="hidden" name="topicId" id="permTopicIdField">
                            <div class="mb-3">
                                <label for="permUserIdSelect" class="form-label">เลือกผู้ใช้งาน <span class="text-danger">*</span></label>
                                <select class="form-select" name="userId" id="permUserIdSelect" required>
                                    <option value="">-- เลือกผู้ใช้ --</option>
                                    </select>
                            </div>
                            <div class="mb-3"><strong>ตั้งค่าสิทธิ์:</strong></div>
                            <div class="form-check form-switch mb-2">
                                <input class="form-check-input" type="checkbox" role="switch" id="permCanImport" name="can_import">
                                <label class="form-check-label" for="permCanImport">สามารถ Import ข้อมูลได้</label>
                            </div>
                            <div class="form-check form-switch mb-2">
                                <input class="form-check-input" type="checkbox" role="switch" id="permCanViewData" name="can_view_data">
                                <label class="form-check-label" for="permCanViewData">สามารถดูข้อมูลที่ Import ได้</label>
                            </div>
                            <div class="form-check form-switch mb-3">
                                <input class="form-check-input" type="checkbox" role="switch" id="permCanDeleteData" name="can_delete_data">
                                <label class="form-check-label" for="permCanDeleteData">สามารถลบข้อมูลที่ Import ได้</label>
                            </div>
                            <button type="submit" class="btn btn-primary">บันทึกสิทธิ์</button>
                        </form>
                    </div>
                </div>
            </div>
        </div>`;
    }
    
    // Submit handler for the permissions form (delegated to body as modal is dynamic)
    $('body').on('submit', '#topicPermissionForm', function(e) {
        e.preventDefault();
        const formData = $(this).serializeObject(); // Gets userId from select
        formData.topicId = $('#permTopicIdField').val(); 
        formData.can_import = $('#permCanImport').is(':checked');
        formData.can_view_data = $('#permCanViewData').is(':checked');
        formData.can_delete_data = $('#permCanDeleteData').is(':checked');
        console.log("Admin.js: Topic Permission Form submitted. Data:", formData);

        if (!formData.userId || !formData.topicId) {
            showAlert('กรุณาเลือกผู้ใช้และตรวจสอบว่าเลือกหัวข้อถูกต้อง', 'warning');
            return;
        }
        const $submitBtn = $(this).find('button[type="submit"]');
        showSpinner($submitBtn);

        apiRequest('/admin/permissions', 'POST', formData)
            .then(response => {
                hideSpinner($submitBtn);
                if (response.success) {
                    showAlert('บันทึกสิทธิ์สำเร็จ', 'success');
                    $('#topicPermissionsModal').modal('hide');
                    if (currentSelectedTopicForPerm && currentSelectedTopicForPerm.id == formData.topicId) {
                        loadUserPermissionsForTopic(formData.topicId); // Refresh list in permissions tab
                    }
                    // No need to call loadTopics() unless it affects display in topics tab directly
                } else {
                    showAlert(response.message || 'เกิดข้อผิดพลาดในการบันทึกสิทธิ์', 'danger');
                }
            })
            .catch(error => {
                hideSpinner($submitBtn);
                // showAlert is handled by apiRequest
            });
    });

    permissionsTab.on('click', '.removePermissionBtn', function() {
        const userId = $(this).data('user-id');
        const topicId = $(this).data('topic-id');
        const username = $(this).closest('li').find('strong').text(); 
        console.log("Admin.js: Remove Permission button clicked for User ID:", userId, "Topic ID:", topicId);

        if (confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบสิทธิ์ทั้งหมดของ ${username || `User ID ${userId}`} สำหรับหัวข้อ ID ${topicId}?`)) {
            const $button = $(this);
            showSpinner($button, 'Deleting...');
            apiRequest(`/admin/permissions/${userId}/${topicId}`, 'DELETE')
                .then(response => {
                    // hideSpinner($button); // Spinner might be gone if list re-renders
                    if (response.success) {
                        showAlert('ลบสิทธิ์สำเร็จ', 'success');
                        if (currentSelectedTopicForPerm && currentSelectedTopicForPerm.id == topicId) {
                            loadUserPermissionsForTopic(topicId);
                        }
                    } else {
                        showAlert(response.message || 'เกิดข้อผิดพลาดในการลบสิทธิ์', 'danger');
                        hideSpinner($button);
                    }
                })
                .catch(error => {
                    // showAlert is handled by apiRequest
                    hideSpinner($button);
                });
        }
    });


    // --- 5. System Logs Section ---
    const systemLogsTab = $('#logs-system-tab-pane');
    function loadSystemLogs(page = 1, limit = 20, filters = {}) {
        console.log("Admin.js: loadSystemLogs called. Page:", page, "Filters:", filters);
        systemLogsTab.html('<div class="text-center p-5"><div class="spinner-border text-primary" role="status"></div> <p>กำลังโหลด System Logs...</p></div>');
        apiRequest('/admin/logs/system', 'GET', { page, limit, ...filters })
            .then(data => {
                console.log("Admin.js: System Logs API response:", data);
                // currentSystemLogs = data.logs; // Not strictly needed if not re-used
                systemLogPagination = { currentPage: data.currentPage, totalPages: data.totalPages, limit: parseInt(limit), total: data.count };
                renderSystemLogsTable(data.logs);
                const paginationContainer = systemLogsTab.find('.pagination-controls');
                if (paginationContainer.length) {
                    renderPaginationControls(paginationContainer, systemLogPagination, (newPage) => loadSystemLogs(newPage, systemLogPagination.limit, filters));
                }
            })
            .catch(error => {
                console.error("Admin.js: Error loading system logs:", error);
                showAlert('ไม่สามารถโหลด System Logs ได้: ' + error.message, 'danger');
                systemLogsTab.html('<p class="text-danger text-center mt-3">เกิดข้อผิดพลาดในการโหลด System Logs</p>');
            });
    }

    function renderSystemLogsTable(logs) {
        console.log("Admin.js: renderSystemLogsTable called with logs:", logs ? logs.length : 0);
        let tableHtml = `
            <div class="d-flex justify-content-between align-items-center mb-3">
                 <h4>System Logs (${systemLogPagination.currentPage}/${systemLogPagination.totalPages} - ทั้งหมด ${systemLogPagination.total || 0})</h4>
                 <div class="filters">
                    <input type="text" id="sysLogUserFilter" class="form-control form-control-sm d-inline-block" style="width: 120px;" placeholder="User ID...">
                    <input type="text" id="sysLogActionFilter" class="form-control form-control-sm d-inline-block ms-1" style="width: 150px;" placeholder="Action Type...">
                    <select id="sysLogStatusFilter" class="form-select form-select-sm d-inline-block ms-1" style="width: 120px;">
                        <option value="">ทุกสถานะ</option>
                        <option value="SUCCESS">Success</option>
                        <option value="FAILURE">Failure</option>
                    </select>
                    <label for="sysLogStartDateFilter" class="ms-1 form-label-sm">Start:</label>
                    <input type="date" id="sysLogStartDateFilter" class="form-control form-control-sm d-inline-block" style="width: 150px;">
                    <label for="sysLogEndDateFilter" class="ms-1 form-label-sm">End:</label>
                    <input type="date" id="sysLogEndDateFilter" class="form-control form-control-sm d-inline-block" style="width: 150px;">
                    <button id="sysLogApplyFilterBtn" class="btn btn-sm btn-info ms-2">Filter</button>
                 </div>
            </div>
            <div class="table-responsive">
                <table class="table table-sm table-striped">
                    <thead>
                        <tr>
                            <th>Timestamp</th>
                            <th>User</th>
                            <th>Action Type</th>
                            <th>Status</th>
                            <th>Details</th>
                            <th>IP Address</th>
                            <th>Error</th>
                        </tr>
                    </thead>
                    <tbody>`;
        if (logs && logs.length > 0) {
            logs.forEach(log => {
                tableHtml += `
                    <tr>
                        <td>${formatDate(log.created_at)}</td>
                        <td>${log.user ? `${log.user.username} (ID:${log.user_id})` : 'System/N/A'}</td>
                        <td>${log.action_type}</td>
                        <td><span class="badge bg-${log.status === 'SUCCESS' ? 'success' : 'danger'}">${log.status}</span></td>
                        <td><pre class="log-details">${log.details ? JSON.stringify(log.details, null, 2) : ''}</pre></td>
                        <td>${log.ip_address || 'N/A'}</td>
                        <td><small class="text-danger">${log.error_message || ''}</small></td>
                    </tr>`;
            });
        } else {
            tableHtml += '<tr><td colspan="7" class="text-center">ไม่พบ System Logs</td></tr>';
        }
        tableHtml += `
                    </tbody>
                </table>
            </div>
            <div class="pagination-controls mt-3"></div>`;
        systemLogsTab.html(tableHtml);
        console.log("Admin.js: System Logs table rendered.");

        // Re-bind filter button event
        systemLogsTab.off('click', '#sysLogApplyFilterBtn').on('click', '#sysLogApplyFilterBtn', function() {
            const filters = {
                userId: $('#sysLogUserFilter').val(),
                actionType: $('#sysLogActionFilter').val(),
                status: $('#sysLogStatusFilter').val(),
                startDate: $('#sysLogStartDateFilter').val(),
                endDate: $('#sysLogEndDateFilter').val(),
            };
            Object.keys(filters).forEach(key => { if (!filters[key]) delete filters[key];});
            console.log("Admin.js: Applying System Log filters:", filters);
            loadSystemLogs(1, systemLogPagination.limit, filters);
        });
    }

    // --- 6. Import Logs Section ---
    const importLogsTab = $('#logs-import-tab-pane');
     function loadImportLogs(page = 1, limit = 20, filters = {}) {
        console.log("Admin.js: loadImportLogs called. Page:", page, "Filters:", filters);
        importLogsTab.html('<div class="text-center p-5"><div class="spinner-border text-primary" role="status"></div> <p>กำลังโหลด Import Logs...</p></div>');
        apiRequest('/admin/logs/import', 'GET', { page, limit, ...filters })
            .then(data => {
                console.log("Admin.js: Import Logs API response:", data);
                // currentImportLogs = data.logs; // Not strictly needed
                importLogPagination = { currentPage: data.currentPage, totalPages: data.totalPages, limit: parseInt(limit), total: data.count };
                renderImportLogsTable(data.logs);
                const paginationContainer = importLogsTab.find('.pagination-controls');
                if (paginationContainer.length) {
                    renderPaginationControls(paginationContainer, importLogPagination, (newPage) => loadImportLogs(newPage, importLogPagination.limit, filters));
                }
            })
            .catch(error => {
                console.error("Admin.js: Error loading import logs:", error);
                showAlert('ไม่สามารถโหลด Import Logs ได้: ' + error.message, 'danger');
                importLogsTab.html('<p class="text-danger text-center mt-3">เกิดข้อผิดพลาดในการโหลด Import Logs</p>');
            });
    }

    function renderImportLogsTable(logs) {
        console.log("Admin.js: renderImportLogsTable called with logs:", logs ? logs.length : 0);
        let tableHtml = `
             <div class="d-flex justify-content-between align-items-center mb-3">
                 <h4>Import Logs (${importLogPagination.currentPage}/${importLogPagination.totalPages} - ทั้งหมด ${importLogPagination.total || 0})</h4>
                 <div class="filters">
                    <input type="text" id="importLogUserFilter" class="form-control form-control-sm d-inline-block" style="width: 120px;" placeholder="User ID...">
                    <input type="text" id="importLogTopicFilter" class="form-control form-control-sm d-inline-block ms-1" style="width: 120px;" placeholder="Topic ID...">
                    <select id="importLogStatusFilter" class="form-select form-select-sm d-inline-block ms-1" style="width: 150px;">
                        <option value="">ทุกสถานะ</option>
                        <option value="PENDING">Pending</option>
                        <option value="PROCESSING">Processing</option>
                        <option value="COMPLETED">Completed</option>
                        <option value="PARTIALLY_COMPLETED">Partially Completed</option>
                        <option value="FAILED">Failed</option>
                        <option value="CANCELLED">Cancelled</option>
                    </select>
                    <label for="importLogStartDateFilter" class="ms-1 form-label-sm">Start:</label>
                    <input type="date" id="importLogStartDateFilter" class="form-control form-control-sm d-inline-block" style="width: 150px;">
                    <label for="importLogEndDateFilter" class="ms-1 form-label-sm">End:</label>
                    <input type="date" id="importLogEndDateFilter" class="form-control form-control-sm d-inline-block" style="width: 150px;">
                    <button id="importLogApplyFilterBtn" class="btn btn-sm btn-info ms-2">Filter</button>
                 </div>
            </div>
            <div class="table-responsive">
                <table class="table table-sm table-striped">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>User</th>
                            <th>Topic</th>
                            <th>File Name</th>
                            <th>Status</th>
                            <th>Total Rec.</th>
                            <th>Success</th>
                            <th>Failed</th>
                            <th>Start Time</th>
                            <th>End Time</th>
                            <th>Errors</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>`;
        if (logs && logs.length > 0) {
            logs.forEach(log => {
                tableHtml += `
                    <tr>
                        <td>${log.id}</td>
                        <td>${log.importer ? `${log.importer.username} (ID:${log.user_id})` : 'N/A'}</td>
                        <td>${log.topic ? `${log.topic.name} (ID:${log.topic_id})` : 'N/A'}</td>
                        <td><small>${log.original_file_name || 'N/A'}</small></td>
                        <td><span class="badge bg-${getImportStatusColor(log.status)}">${log.status}</span></td>
                        <td>${log.total_records_in_file || 0}</td>
                        <td>${log.successfully_imported_records || 0}</td>
                        <td>${log.failed_records || 0}</td>
                        <td>${formatDate(log.start_time)}</td>
                        <td>${log.end_time ? formatDate(log.end_time) : 'N/A'}</td>
                        <td>${log.error_details ? `<small class="text-danger cursor-pointer" title="${typeof log.error_details === 'string' ? log.error_details : JSON.stringify(log.error_details.message || log.error_details)}">View</small>` : ''}</td>
                        <td>
                            ${(log.failed_records || (log.failedRows && log.failedRows.length > 0)) > 0 ? `<button class="btn btn-xs btn-outline-warning view-failed-rows-btn" data-log-id="${log.id}">ดูแถวที่ผิดพลาด</button>` : ''}
                        </td>
                    </tr>`;
            });
        } else {
            tableHtml += '<tr><td colspan="12" class="text-center">ไม่พบ Import Logs</td></tr>';
        }
        tableHtml += `
                    </tbody>
                </table>
            </div>
            <div class="pagination-controls mt-3"></div>
            <div id="failedRowsModalContainer"></div> 
            `;
        importLogsTab.html(tableHtml);
        console.log("Admin.js: Import Logs table rendered.");

        importLogsTab.off('click', '#importLogApplyFilterBtn').on('click', '#importLogApplyFilterBtn', function() {
            const filters = {
                userId: $('#importLogUserFilter').val(),
                topicId: $('#importLogTopicFilter').val(),
                status: $('#importLogStatusFilter').val(),
                startDate: $('#importLogStartDateFilter').val(),
                endDate: $('#importLogEndDateFilter').val(),
            };
            Object.keys(filters).forEach(key => { if (!filters[key]) delete filters[key];});
            console.log("Admin.js: Applying Import Log filters:", filters);
            loadImportLogs(1, importLogPagination.limit, filters);
        });
    }
    
    importLogsTab.off('click', '.view-failed-rows-btn').on('click', '.view-failed-rows-btn', function() {
        const importLogId = $(this).data('log-id');
        console.log("Admin.js: View Failed Rows button clicked for log ID:", importLogId);
        loadFailedRowsForImport(importLogId);
    });

    function loadFailedRowsForImport(importLogId, page = 1, limit = 100) { // Admin uses user route for this
        console.log("Admin.js: loadFailedRowsForImport for log ID:", importLogId, "Page:", page);
        // Show some loading state in the modal if it's already open, or before opening
        const modalContainer = $('#failedRowsModalContainer');
        if ($('#failedRowsModal').length === 0) { // If modal isn't in DOM yet, render its shell
            modalContainer.html(renderFailedRowsModalShell(importLogId));
        }
        $('#failedRowsModal .modal-body').html('<div class="text-center p-3"><div class="spinner-border spinner-border-sm"></div> Loading failed rows...</div>');
        const modalInstance = bootstrap.Modal.getOrCreateInstance(document.getElementById('failedRowsModal'));
        modalInstance.show();

        apiRequest(`/user/logs/import/${importLogId}/failed-rows`, 'GET', { page, limit }) 
            .then(data => {
                console.log("Admin.js: Failed rows API response for log ID", importLogId, ":", data);
                renderFailedRowsModalContent(importLogId, data.failedRows, data); // data includes pagination for failed rows
            })
            .catch(error => {
                console.error("Admin.js: Error loading failed rows for log ID", importLogId, ":", error);
                $('#failedRowsModal .modal-body').html(`<p class="text-danger">ไม่สามารถโหลดแถวที่ผิดพลาด: ${error.message}</p>`);
                showAlert(`ไม่สามารถโหลดแถวที่ผิดพลาดสำหรับ Log ID ${importLogId}: ${error.message}`, 'danger');
            });
    }
    
    function renderFailedRowsModalShell(importLogId) { // Renders only the modal structure
        return `
            <div class="modal fade" id="failedRowsModal" tabindex="-1" aria-labelledby="failedRowsModalLabel" aria-hidden="true">
                <div class="modal-dialog modal-xl modal-dialog-scrollable">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title" id="failedRowsModalLabel">แถวที่ Import ไม่สำเร็จ (Log ID: ${importLogId})</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                        </div>
                    </div>
                </div>
            </div>`;
    }


    function renderFailedRowsModalContent(importLogId, failedRows, paginationData) {
        console.log("Admin.js: renderFailedRowsModalContent for log ID:", importLogId, "with rows:", failedRows ? failedRows.length : 0);
        const modalBody = $('#failedRowsModal .modal-body');
        let contentHtml = '';
        if (failedRows && failedRows.length > 0) {
            contentHtml += `<p>พบ ${paginationData.count} แถวที่ผิดพลาด (แสดงหน้า ${paginationData.currentPage}/${paginationData.totalPages})</p>
                          <div class="table-responsive">
                          <table class="table table-sm table-bordered">
                            <thead><tr><th>Row in File</th><th>Data (JSON)</th><th>Error Message</th></tr></thead>
                            <tbody>`;
            failedRows.forEach(row => {
                contentHtml += `<tr>
                                <td>${row.row_number_in_file}</td>
                                <td><pre class="log-details">${row.row_data ? JSON.stringify(row.row_data, null, 2) : 'N/A'}</pre></td>
                                <td><small class="text-danger">${row.error_message}</small></td>
                              </tr>`;
            });
            contentHtml += `  </tbody></table></div>`;
            if (paginationData.totalPages > 1) {
                 contentHtml += `<div class="failed-rows-pagination-controls mt-3"></div>`;
            }
        } else {
            contentHtml += `<p>ไม่พบข้อมูลแถวที่ผิดพลาดสำหรับ Log นี้ หรือข้อมูลถูกโหลดไม่สำเร็จ</p>`;
        }
        modalBody.html(contentHtml);

        if (paginationData.totalPages > 1) {
             renderPaginationControls(
                $('#failedRowsModal .failed-rows-pagination-controls'), // Target pagination inside modal
                { currentPage: paginationData.currentPage, totalPages: paginationData.totalPages, limit: parseInt(paginationData.limit || 100) },
                (newPage) => loadFailedRowsForImport(importLogId, newPage, parseInt(paginationData.limit || 100)),
                'sm'
            );
        }
    }


    function getImportStatusColor(status) {
        switch (status) {
            case 'COMPLETED': return 'success';
            case 'PARTIALLY_COMPLETED': return 'warning';
            case 'FAILED': return 'danger';
            case 'PROCESSING': return 'info';
            case 'PENDING': return 'secondary';
            case 'CANCELLED': return 'dark';
            default: return 'light';
        }
    }

    // Ensure renderPaginationControls is available (ideally from common.js)
    if (typeof renderPaginationControls !== 'function') {
        console.warn("Admin.js: renderPaginationControls function is not globally available. Using local fallback.");
        window.renderPaginationControls = function(container, pagination, loadDataFunction, size = '') {
            if (!container || !container.length) {
                console.error("Pagination container not found.");
                return;
            }
            if (!pagination || pagination.totalPages <= 1) {
                container.html('');
                return;
            }
            let paginationHtml = `<nav aria-label="Page navigation"><ul class="pagination pagination-${size} justify-content-center">`;
            paginationHtml += `<li class="page-item ${pagination.currentPage === 1 ? 'disabled' : ''}"><a class="page-link" href="#" data-page="${pagination.currentPage - 1}">Previous</a></li>`;
            
            let startPage = Math.max(1, pagination.currentPage - 2);
            let endPage = Math.min(pagination.totalPages, pagination.currentPage + 2);
            if (pagination.currentPage <=3 && pagination.totalPages > 5) endPage = 5;
            if (pagination.currentPage >= pagination.totalPages - 2 && pagination.totalPages > 5) startPage = Math.max(1, pagination.totalPages - 4);

            if (startPage > 1) {
                paginationHtml += `<li class="page-item"><a class="page-link" href="#" data-page="1">1</a></li>`;
                if (startPage > 2) paginationHtml += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
            }
            for (let i = startPage; i <= endPage; i++) {
                paginationHtml += `<li class="page-item ${i === pagination.currentPage ? 'active' : ''}"><a class="page-link" href="#" data-page="${i}">${i}</a></li>`;
            }
            if (endPage < pagination.totalPages) {
                if (endPage < pagination.totalPages - 1) paginationHtml += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
                paginationHtml += `<li class="page-item"><a class="page-link" href="#" data-page="${pagination.totalPages}">${pagination.totalPages}</a></li>`;
            }
            paginationHtml += `<li class="page-item ${pagination.currentPage === pagination.totalPages ? 'disabled' : ''}"><a class="page-link" href="#" data-page="${pagination.currentPage + 1}">Next</a></li>`;
            paginationHtml += `</ul></nav>`;
            container.html(paginationHtml);

            container.find('.page-link').off('click').on('click', function(e) {
                e.preventDefault();
                const page = $(this).data('page');
                if (page && page !== pagination.currentPage && !$(this).parent().hasClass('disabled')) {
                    loadDataFunction(page);
                }
            });
        }
    }
    /*
     // Initial check for essential functions from common.js and auth.js
    if (typeof isLoggedIn !== 'function' || typeof getUserRole !== 'function' || typeof logoutUser !== 'function' || typeof getUsername !== 'function' || typeof apiRequest !== 'function' || typeof showAlert !== 'function' || typeof showSpinner !== 'function' || typeof hideSpinner !== 'function' || typeof formatDate !== 'function' || typeof populateForm !== 'function') {
        console.error('Admin.js: One or more essential functions from common.js or auth.js are not loaded. Halting further admin.js execution.');
        // Optionally, display a more prominent error on the page if this happens
        $('#myTabContent').html('<div class="alert alert-danger">Critical JavaScript error: Essential common functions are missing. Please contact support.</div>');
        return; // Stop further execution of admin.js
    }
*/



    if (typeof isLoggedIn === 'function' && typeof getUserRole === 'function' && typeof logoutUser === 'function') {
         if (!isLoggedIn() || getUserRole() !== 'admin') {
            logoutUser();
            return;
        }
    } else {
        console.error("Admin.js: Core login check functions (isLoggedIn, getUserRole, logoutUser) are missing! Halting.");
        $('body').html('<div class="alert alert-danger m-5" role="alert">เกิดข้อผิดพลาดรุนแรงในการตรวจสอบสิทธิ์ผู้ใช้ (Admin)</div>');
        return;
    }






    // Ensure renderPaginationControls is defined, if not from common.js, define it locally.
    if (typeof renderPaginationControls === 'undefined' && window.renderPaginationControls === undefined) {
        console.warn("Admin.js: renderPaginationControls is not defined globally. Defining a local version.");
        window.renderPaginationControls = function(container, pagination, loadDataFunction, size = '') {
            // ... (implementation as above)
             if (!container || !container.length) { console.error("Pagination container not found."); return; }
            if (!pagination || pagination.totalPages <= 1) { container.html(''); return; }
            let pgHtml = `<nav aria-label="Page navigation"><ul class="pagination pagination-${size} justify-content-center">`;
            pgHtml += `<li class="page-item ${pagination.currentPage === 1 ? 'disabled' : ''}"><a class="page-link" href="#" data-page="${pagination.currentPage - 1}">Previous</a></li>`;
            let sPage = Math.max(1, pagination.currentPage - 2), ePage = Math.min(pagination.totalPages, pagination.currentPage + 2);
            if (pagination.currentPage <=3 && pagination.totalPages > 5) ePage = 5;
            if (pagination.currentPage >= pagination.totalPages - 2 && pagination.totalPages > 5) sPage = Math.max(1, pagination.totalPages - 4);
            if (sPage > 1) { pgHtml += `<li class="page-item"><a class="page-link" href="#" data-page="1">1</a></li>`; if (sPage > 2) pgHtml += `<li class="page-item disabled"><span class="page-link">...</span></li>`; }
            for (let i = sPage; i <= ePage; i++) { pgHtml += `<li class="page-item ${i === pagination.currentPage ? 'active' : ''}"><a class="page-link" href="#" data-page="${i}">${i}</a></li>`; }
            if (ePage < pagination.totalPages) { if (ePage < pagination.totalPages - 1) pgHtml += `<li class="page-item disabled"><span class="page-link">...</span></li>`; pgHtml += `<li class="page-item"><a class="page-link" href="#" data-page="${pagination.totalPages}">${pagination.totalPages}</a></li>`; }
            pgHtml += `<li class="page-item ${pagination.currentPage === pagination.totalPages ? 'disabled' : ''}"><a class="page-link" href="#" data-page="${pagination.currentPage + 1}">Next</a></li>`;
            pgHtml += `</ul></nav>`;
            container.html(pgHtml);
            container.find('.page-link').off('click').on('click', function(e) { e.preventDefault(); const page = $(this).data('page'); if (page && page !== pagination.currentPage && !$(this).parent().hasClass('disabled')) { loadDataFunction(page); } });
        };
    }


});
