// frontend/js/admin.js

$(document).ready(function() {
    // Check auth status on page load
    if (!isLoggedIn() || getUserRole() !== 'admin') {
        logoutUser(); // Redirects to login
        return;
    }

    // --- Tab Navigation & Content Loading ---
    // Store current data for editing to avoid re-fetching if not necessary
    let currentUsers = [];
    let currentTopics = [];
    let currentSystemLogs = [];
    let currentImportLogs = [];
    // Store pagination state
    let userPagination = { currentPage: 1, totalPages: 1, limit: 10 };
    let topicPagination = { currentPage: 1, totalPages: 1, limit: 10 }; // If topics become paginated
    let systemLogPagination = { currentPage: 1, totalPages: 1, limit: 20 };
    let importLogPagination = { currentPage: 1, totalPages: 1, limit: 20 };


    // Load initial content for the default active tab (Home/Overview)
    loadAdminOverview();

    $('a[data-bs-toggle="tab"]').on('shown.bs.tab', function (e) {
        const targetPaneId = $(e.target).data('bs-target');
        $('#currentSectionTitle').text($(e.target).text().trim()); // Update navbar title

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
        }
    });

    // --- 1. Overview Section ---
    function loadAdminOverview() {
        const overviewHtml = `
            <h4>ภาพรวมระบบ (Admin)</h4>
            <p>ยินดีต้อนรับสู่ส่วนควบคุมสำหรับผู้ดูแลระบบ ที่นี่คุณสามารถจัดการผู้ใช้งาน, หัวข้อการนำเข้าข้อมูล, สิทธิ์การเข้าถึง, และตรวจสอบประวัติการทำงานต่างๆ ของระบบได้</p>
            <div class="row">
                <div class="col-md-4">
                    <div class="card text-white bg-primary mb-3">
                        <div class="card-header">ผู้ใช้งานทั้งหมด</div>
                        <div class="card-body">
                            <h5 class="card-title" id="overviewUserCount">Loading...</h5>
                            <p class="card-text">จำนวนผู้ใช้งานในระบบ</p>
                        </div>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="card text-white bg-success mb-3">
                        <div class="card-header">หัวข้อ Import ทั้งหมด</div>
                        <div class="card-body">
                            <h5 class="card-title" id="overviewTopicCount">Loading...</h5>
                            <p class="card-text">จำนวนหัวข้อที่กำหนดค่าไว้</p>
                        </div>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="card text-white bg-info mb-3">
                        <div class="card-header">รายการ Import ล่าสุด</div>
                        <div class="card-body">
                            <h5 class="card-title" id="overviewRecentImports">Loading...</h5>
                            <p class="card-text">จำนวนการ Import ใน 24 ชม.</p>
                        </div>
                    </div>
                </div>
            </div>
            `;
        $('#home-tab-pane').html(overviewHtml);
        // Fetch actual data for overview
        apiRequest('/admin/users', 'GET', { limit: 1 })
            .then(data => $('#overviewUserCount').text(data.count || 0))
            .catch(err => $('#overviewUserCount').text('Error'));
        apiRequest('/admin/topics', 'GET', { limit: 1 }) // Assuming this endpoint can return total count or all topics
            .then(data => $('#overviewTopicCount').text(data.topics ? data.topics.length : (data.count || 0) ))
            .catch(err => $('#overviewTopicCount').text('Error'));
        // For recent imports, you might need a specific API endpoint or more complex query
        apiRequest('/admin/logs/import', 'GET', { limit: 1, startDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() })
             .then(data => $('#overviewRecentImports').text(data.count || 0))
             .catch(err => $('#overviewRecentImports').text('Error'));
    }


    // --- 2. User Management Section ---
    const usersTab = $('#users-tab-pane');
    function loadUsers(page = 1, limit = 10, searchParams = {}) {
        showSpinner(usersTab);
        apiRequest('/admin/users', 'GET', { page, limit, ...searchParams })
            .then(data => {
                currentUsers = data.users;
                userPagination = { currentPage: data.currentPage, totalPages: data.totalPages, limit: parseInt(limit) };
                renderUsersTable(currentUsers);
                renderPaginationControls(usersTab.find('.pagination-controls'), userPagination, (newPage) => loadUsers(newPage, userPagination.limit, searchParams));
                hideSpinner(usersTab);
            })
            .catch(error => {
                showAlert('ไม่สามารถโหลดข้อมูลผู้ใช้งานได้: ' + error.message, 'danger');
                usersTab.html('<p>เกิดข้อผิดพลาดในการโหลดข้อมูลผู้ใช้งาน</p>');
                hideSpinner(usersTab);
            });
    }

    function renderUsersTable(users) {
        let tableHtml = `
            <div class="d-flex justify-content-between align-items-center mb-3">
                <h4>รายการผู้ใช้งาน (${userPagination.currentPage}/${userPagination.totalPages})</h4>
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
        usersTab.html(tableHtml);

        // Attach event listeners for search/filter
        $('#userSearchInput, #userRoleFilter, #userStatusFilter').off('change keyup').on('change keyup', function(e) {
            if (e.type === 'keyup' && e.key !== 'Enter' && $(this).is('#userSearchInput')) return; // Search on enter or blur for input
            const search = $('#userSearchInput').val();
            const role = $('#userRoleFilter').val();
            const isActive = $('#userStatusFilter').val();
            loadUsers(1, userPagination.limit, { search, role, is_active: isActive });
        });
    }

    function renderUserModal(user = null) {
        const modalTitle = user ? 'แก้ไขผู้ใช้งาน' : 'เพิ่มผู้ใช้งานใหม่';
        const submitButtonText = user ? 'บันทึกการเปลี่ยนแปลง' : 'สร้างผู้ใช้';
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
                                    <label for="username" class="form-label">Username <span class="text-danger">*</span></label>
                                    <input type="text" class="form-control" name="username" value="${user ? user.username : ''}" required>
                                </div>
                                <div class="mb-3">
                                    <label for="email" class="form-label">Email <span class="text-danger">*</span></label>
                                    <input type="email" class="form-control" name="email" value="${user ? user.email : ''}" required>
                                </div>
                                <div class="mb-3">
                                    <label for="password" class="form-label">Password ${user ? '(ปล่อยว่างไว้หากไม่ต้องการเปลี่ยน)' : '<span class="text-danger">*</span>'}</label>
                                    <input type="password" class="form-control" name="password" ${user ? '' : 'required'}>
                                </div>
                                <div class="mb-3">
                                    <label for="role" class="form-label">Role <span class="text-danger">*</span></label>
                                    <select class="form-select" name="role" required>
                                        <option value="user" ${user && user.role === 'user' ? 'selected' : ''}>User</option>
                                        <option value="admin" ${user && user.role === 'admin' ? 'selected' : ''}>Admin</option>
                                    </select>
                                </div>
                                <div class="form-check mb-3">
                                    <input class="form-check-input" type="checkbox" name="is_active" id="isActiveCheck" ${user ? (user.is_active ? 'checked' : '') : 'checked'}>
                                    <label class="form-check-label" for="isActiveCheck">
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
        $('#userModalLabel').text('เพิ่มผู้ใช้งานใหม่');
        $('#userForm').trigger('reset').find('[name="id"]').val('');
        $('#userForm button[type="submit"]').text('สร้างผู้ใช้');
        $('#userForm [name="password"]').prop('required', true);
    });

    usersTab.on('click', '.editUserBtn', function() {
        const userId = $(this).data('id');
        const user = currentUsers.find(u => u.id === userId);
        if (user) {
            $('#userModalLabel').text('แก้ไขผู้ใช้งาน');
            populateForm('#userForm', user);
            $('#userForm [name="password"]').val('').prop('required', false); // Clear password, make it optional for edit
            $('#userForm button[type="submit"]').text('บันทึกการเปลี่ยนแปลง');
        }
    });

    usersTab.on('submit', '#userForm', function(e) {
        e.preventDefault();
        const formData = $(this).serializeObject();
        const userId = formData.id;
        const method = userId ? 'PUT' : 'POST';
        const endpoint = userId ? `/admin/users/${userId}` : '/admin/users';
        
        // Ensure boolean is sent for is_active
        formData.is_active = $('[name="is_active"]').is(':checked');
        if (!formData.password && userId) delete formData.password; // Don't send empty password on update

        const $submitBtn = $(this).find('button[type="submit"]');
        showSpinner($submitBtn);

        apiRequest(endpoint, method, formData)
            .then(response => {
                hideSpinner($submitBtn);
                if (response.success) {
                    showAlert(response.message || `ผู้ใช้งาน ${userId ? 'แก้ไข' : 'สร้าง'} สำเร็จ`, 'success');
                    $('#userModal').modal('hide');
                    loadUsers(userPagination.currentPage, userPagination.limit); // Refresh table
                } else {
                    showAlert(response.message || `เกิดข้อผิดพลาดในการ ${userId ? 'แก้ไข' : 'สร้าง'} ผู้ใช้งาน`, 'danger');
                }
            })
            .catch(error => {
                hideSpinner($submitBtn);
                showAlert(error.message || `เกิดข้อผิดพลาดรุนแรงในการ ${userId ? 'แก้ไข' : 'สร้าง'} ผู้ใช้งาน`, 'danger');
            });
    });

    usersTab.on('click', '.deleteUserBtn', function() {
        const userId = $(this).data('id');
        const username = $(this).data('username');
        if (confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบผู้ใช้งาน '${username}' (ID: ${userId})? การกระทำนี้ไม่สามารถย้อนกลับได้`)) {
            showSpinner(this, 'Deleting...');
            apiRequest(`/admin/users/${userId}`, 'DELETE')
                .then(response => {
                    // hideSpinner is not straightforward here as button might be removed
                    if (response.success) {
                        showAlert(`ผู้ใช้งาน '${username}' ถูกลบสำเร็จ`, 'success');
                        loadUsers(userPagination.currentPage, userPagination.limit); // Refresh table
                    } else {
                        showAlert(response.message || 'เกิดข้อผิดพลาดในการลบผู้ใช้งาน', 'danger');
                    }
                })
                .catch(error => {
                    showAlert(error.message || 'เกิดข้อผิดพลาดรุนแรงในการลบผู้ใช้งาน', 'danger');
                    loadUsers(userPagination.currentPage, userPagination.limit); // Refresh to hide spinner on button
                });
        }
    });

    // --- 3. Topic Management Section ---
    const topicsTab = $('#topics-tab-pane');
    let allUsersForPermissions = []; // Cache users for permission modal

    function loadTopics() { // Topics are not paginated for now, assuming not too many
        showSpinner(topicsTab);
        apiRequest('/admin/topics', 'GET')
            .then(data => {
                currentTopics = data.topics;
                renderTopicsTable(currentTopics);
                hideSpinner(topicsTab);
            })
            .catch(error => {
                showAlert('ไม่สามารถโหลดข้อมูลหัวข้อได้: ' + error.message, 'danger');
                topicsTab.html('<p>เกิดข้อผิดพลาดในการโหลดข้อมูลหัวข้อ</p>');
                hideSpinner(topicsTab);
            });
        // Fetch all users for permission assignment modal once
        if(allUsersForPermissions.length === 0) {
            apiRequest('/admin/users', 'GET', { limit: 1000 }) // Get a large number of users
                .then(data => allUsersForPermissions = data.users)
                .catch(err => console.error("Failed to fetch users for permissions", err));
        }
    }

    function renderTopicsTable(topics) {
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
        tableHtml += `</div> ${renderTopicModal()} ${renderTopicPermissionsModal()}`; // Add modals
        topicsTab.html(tableHtml);
    }
    
    function renderColumnMappingsTable(mappings, editable = false, topicId = null) {
        if (!mappings || mappings.length === 0) return '<p class="text-muted">ยังไม่มีการกำหนด Column Mappings</p>';
        let mappingsHtml = `<table class="table table-sm table-bordered table-striped ${editable ? 'column-mappings-table-editable' : ''}" ${editable ? `data-topic-id="${topicId}"` : ''}>
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
        const mappings = topic ? topic.columnMappings : [{ source_column_name: '', target_column_name: '', data_type: 'VARCHAR(255)', is_primary_key: false, is_index: false, allow_null: true, default_value: null }];

        return `
            <div class="modal fade" id="topicModal" tabindex="-1" aria-labelledby="topicModalLabel" aria-hidden="true">
                <div class="modal-dialog modal-xl"> <div class="modal-content">
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
                                        <input type="text" class="form-control" name="name" value="${topic ? topic.name : ''}" required>
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
                                <div id="columnMappingsContainer">
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
        $('#topicModalLabel').text('เพิ่มหัวข้อ Import ใหม่');
        $('#topicForm').trigger('reset').find('[name="id"]').val('');
        $('#topicForm [name="target_db_port"]').val('3306'); // Default port
        $('#topicForm button[type="submit"]').text('สร้างหัวข้อ');
        $('#topicForm [name="target_db_password"]').prop('required', true);
        // Render initial empty mapping row
        $('#columnMappingsContainer').html(renderColumnMappingsTable([{ source_column_name: '', target_column_name: '', data_type: 'VARCHAR(255)', is_primary_key: false, is_index: false, allow_null: true, default_value: null }], true, null));
    });

    topicsTab.on('click', '.editTopicBtn', function() {
        const topicId = $(this).data('id');
        const topic = currentTopics.find(t => t.id === topicId);
        if (topic) {
            $('#topicModalLabel').text(`แก้ไขหัวข้อ: ${topic.name}`);
            populateForm('#topicForm', topic);
            $('#topicForm [name="target_db_password"]').val('').prop('required', false);
            $('#topicForm button[type="submit"]').text('บันทึกการเปลี่ยนแปลง');
            $('#columnMappingsContainer').html(renderColumnMappingsTable(topic.columnMappings && topic.columnMappings.length > 0 ? topic.columnMappings : [{ source_column_name: '', target_column_name: '', data_type: 'VARCHAR(255)', is_primary_key: false, is_index: false, allow_null: true, default_value: null }], true, topic.id));
        }
    });
    
    // Handle adding/removing column mapping rows dynamically in the modal
    $('body').on('click', '#addMappingRowBtn', function() { // Attach to body because modal content is dynamic
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
        $('#columnMappingsContainer .column-mappings-table-editable tbody').append(newRowHtml);
    });

    $('body').on('click', '.remove-mapping-row', function() {
        $(this).closest('tr').remove();
    });


    topicsTab.on('submit', '#topicForm', function(e) {
        e.preventDefault();
        const rawFormData = $(this).serializeObject();
        const topicId = rawFormData.id;
        const method = topicId ? 'PUT' : 'POST';
        const endpoint = topicId ? `/admin/topics/${topicId}` : '/admin/topics';

        // Collect column mappings
        const column_mappings = [];
        $('#columnMappingsContainer .column-mappings-table-editable tbody tr').each(function() {
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
            // Only add if source and target names are provided (basic validation)
            if (mapping.source_column_name && mapping.target_column_name) {
                column_mappings.push(mapping);
            }
        });
        
        const finalFormData = {
            id: rawFormData.id,
            name: rawFormData.name,
            target_db_host: rawFormData.target_db_host,
            target_db_port: parseInt(rawFormData.target_db_port) || 3306,
            target_db_name: rawFormData.target_db_name,
            target_table_name: rawFormData.target_table_name,
            target_db_user: rawFormData.target_db_user,
            column_mappings: column_mappings
        };
        // Only include password if provided (for create, or for update if changing)
        if (rawFormData.target_db_password) {
            finalFormData.target_db_password = rawFormData.target_db_password;
        } else if (!topicId) { // Password is required for new topics
             showAlert('Password ฐานข้อมูลปลายทางเป็นสิ่งจำเป็นสำหรับหัวข้อใหม่', 'warning');
             return;
        }


        const $submitBtn = $(this).find('button[type="submit"]');
        showSpinner($submitBtn);

        apiRequest(endpoint, method, finalFormData)
            .then(response => {
                hideSpinner($submitBtn);
                if (response.success) {
                    showAlert(response.message || `หัวข้อ ${topicId ? 'แก้ไข' : 'สร้าง'} สำเร็จ`, 'success');
                    $('#topicModal').modal('hide');
                    loadTopics(); // Refresh topic list
                } else {
                    showAlert(response.message || `เกิดข้อผิดพลาดในการ ${topicId ? 'แก้ไข' : 'สร้าง'} หัวข้อ`, 'danger');
                }
            })
            .catch(error => {
                hideSpinner($submitBtn);
                 showAlert(error.message || `เกิดข้อผิดพลาดรุนแรงในการ ${topicId ? 'แก้ไข' : 'สร้าง'} หัวข้อ`, 'danger');
            });
    });
    
    topicsTab.on('click', '.deleteTopicBtn', function() {
        const topicId = $(this).data('id');
        const topicName = $(this).data('name');
        if (confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบหัวข้อ '${topicName}' (ID: ${topicId})? การกระทำนี้จะลบ Column Mappings และ Permissions ที่เกี่ยวข้องทั้งหมด และไม่สามารถย้อนกลับได้`)) {
            showSpinner(this, 'Deleting...');
            apiRequest(`/admin/topics/${topicId}`, 'DELETE')
                .then(response => {
                    if (response.success) {
                        showAlert(`หัวข้อ '${topicName}' ถูกลบสำเร็จ`, 'success');
                        loadTopics();
                    } else {
                         showAlert(response.message || 'เกิดข้อผิดพลาดในการลบหัวข้อ', 'danger');
                    }
                })
                .catch(error => {
                    showAlert(error.message || 'เกิดข้อผิดพลาดรุนแรงในการลบหัวข้อ', 'danger');
                    loadTopics(); // Refresh to hide spinner
                });
        }
    });

    // --- 4. Permissions Management Section ---
    const permissionsTab = $('#permissions-tab-pane');
    let currentSelectedTopicForPerm = null;

    function loadPermissionsManagement() {
        // This section will typically involve selecting a topic, then selecting a user,
        // then assigning permissions. Or list users and for each user, list topics they can access.
        // Let's try a topic-first approach.
        if (currentTopics.length === 0) { // Ensure topics are loaded
            apiRequest('/admin/topics', 'GET').then(data => {
                currentTopics = data.topics;
                renderPermissionsTopicSelector();
            }).catch(err => permissionsTab.html('<p>ไม่สามารถโหลดหัวข้อสำหรับจัดการสิทธิ์ได้</p>'));
        } else {
            renderPermissionsTopicSelector();
        }
         if(allUsersForPermissions.length === 0) { // Ensure users are loaded
            apiRequest('/admin/users', 'GET', { limit: 1000 })
                .then(data => allUsersForPermissions = data.users)
                .catch(err => console.error("Failed to fetch users for permissions tab", err));
        }
    }

    function renderPermissionsTopicSelector() {
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
                        </div>
                    ${renderTopicPermissionsModal()} `;
        permissionsTab.html(html);
    }
    
    permissionsTab.on('change', '#permTopicSelect', function() {
        const topicId = $(this).val();
        if (topicId) {
            currentSelectedTopicForPerm = currentTopics.find(t => t.id == topicId);
            loadUserPermissionsForTopic(topicId);
        } else {
            $('#userPermissionsForTopicContainer').html('');
            currentSelectedTopicForPerm = null;
        }
    });

    function loadUserPermissionsForTopic(topicId) {
        const container = $('#userPermissionsForTopicContainer');
        showSpinner(container);
        // Fetch current permissions for this topic
        apiRequest(`/admin/topics/${topicId}`) // This endpoint returns topic with userPermissions
            .then(data => {
                hideSpinner(container);
                const topicWithPerms = data.topic;
                currentSelectedTopicForPerm = topicWithPerms; // Update with full details
                renderUserPermissionsList(topicWithPerms);
            })
            .catch(error => {
                hideSpinner(container);
                showAlert(`ไม่สามารถโหลดสิทธิ์สำหรับหัวข้อ ID ${topicId}: ${error.message}`, 'danger');
                container.html(`<p>เกิดข้อผิดพลาดในการโหลดสิทธิ์</p>`);
            });
    }

    function renderUserPermissionsList(topicWithPerms) {
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
                                <strong>${perm.User ? perm.User.username : 'Unknown User'}</strong> (User ID: ${perm.user_id})<br>
                                <small>
                                    Import: <i class="bi ${perm.can_import ? 'bi-check-circle-fill text-success' : 'bi-x-circle-fill text-danger'}"></i> | 
                                    View: <i class="bi ${perm.can_view_data ? 'bi-check-circle-fill text-success' : 'bi-x-circle-fill text-danger'}"></i> | 
                                    Delete: <i class="bi ${perm.can_delete_data ? 'bi-check-circle-fill text-success' : 'bi-x-circle-fill text-danger'}"></i>
                                </small>
                            </div>
                            <button class="btn btn-sm btn-outline-danger removePermissionBtn" data-user-id="${perm.user_id}" data-topic-id="${perm.topic_id}"><i class="bi bi-trash"></i> ลบสิทธิ์</button>
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

    // Re-using the manageTopicPermissionsBtn click handler from topicsTab for the modal opening
    // This modal will be populated based on currentSelectedTopicForPerm
    topicsTab.on('click', '.manageTopicPermissionsBtn', function() {
        const topicId = $(this).data('id');
        const topicName = $(this).data('name');
        currentSelectedTopicForPerm = currentTopics.find(t => t.id == topicId); // Set context for modal
        $('#topicPermissionsModalLabel').text(`จัดการสิทธิ์สำหรับหัวข้อ: ${topicName} (ID: ${topicId})`);
        populatePermissionsModal();
    });
    permissionsTab.on('click', '#addPermissionToTopicBtn', function() {
        // currentSelectedTopicForPerm should be set by the dropdown change
        if (currentSelectedTopicForPerm) {
            $('#topicPermissionsModalLabel').text(`จัดการสิทธิ์สำหรับหัวข้อ: ${currentSelectedTopicForPerm.name} (ID: ${currentSelectedTopicForPerm.id})`);
            populatePermissionsModal();
        } else {
            showAlert('กรุณาเลือกหัวข้อก่อน', 'warning');
        }
    });


    function renderTopicPermissionsModal() { // This modal is for a specific topic
        // Users are populated dynamically
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
                                    ${allUsersForPermissions.map(u => `<option value="${u.id}">${u.username} (ID: ${u.id})</option>`).join('')}
                                </select>
                            </div>
                            <div class="mb-3"><strong>ตั้งค่าสิทธิ์:</strong></div>
                            <div class="form-check form-switch mb-2">
                                <input class="form-check-input" type="checkbox" role="switch" id="permCanImport" name="can_import" checked>
                                <label class="form-check-label" for="permCanImport">สามารถ Import ข้อมูลได้</label>
                            </div>
                            <div class="form-check form-switch mb-2">
                                <input class="form-check-input" type="checkbox" role="switch" id="permCanViewData" name="can_view_data" checked>
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
    
    function populatePermissionsModal() {
        if (!currentSelectedTopicForPerm) return;
        $('#permTopicIdField').val(currentSelectedTopicForPerm.id);
        // Reset user selection and checkboxes
        $('#permUserIdSelect').val('');
        $('#permCanImport').prop('checked', true);
        $('#permCanViewData').prop('checked', true);
        $('#permCanDeleteData').prop('checked', false);

        // If a user is selected, try to load their existing permissions for this topic
        $('#permUserIdSelect').off('change').on('change', function() {
            const selectedUserId = $(this).val();
            if (selectedUserId && currentSelectedTopicForPerm && currentSelectedTopicForPerm.userPermissions) {
                const existingPerm = currentSelectedTopicForPerm.userPermissions.find(p => p.user_id == selectedUserId);
                if (existingPerm) {
                    $('#permCanImport').prop('checked', existingPerm.can_import);
                    $('#permCanViewData').prop('checked', existingPerm.can_view_data);
                    $('#permCanDeleteData').prop('checked', existingPerm.can_delete_data);
                } else { // User not in existing perms, reset to default
                    $('#permCanImport').prop('checked', true);
                    $('#permCanViewData').prop('checked', true);
                    $('#permCanDeleteData').prop('checked', false);
                }
            }
        });
    }


    $('body').on('submit', '#topicPermissionForm', function(e) {
        e.preventDefault();
        const formData = $(this).serializeObject();
        formData.topicId = $('#permTopicIdField').val(); // Ensure topicId is from the hidden field
        formData.can_import = $('[name="can_import"]').is(':checked');
        formData.can_view_data = $('[name="can_view_data"]').is(':checked');
        formData.can_delete_data = $('[name="can_delete_data"]').is(':checked');

        if (!formData.userId || !formData.topicId) {
            showAlert('กรุณาเลือกผู้ใช้และหัวข้อ', 'warning');
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
                    // Refresh the displayed permissions for the current topic if it's selected
                    if (currentSelectedTopicForPerm && currentSelectedTopicForPerm.id == formData.topicId) {
                        loadUserPermissionsForTopic(formData.topicId);
                    }
                    loadTopics(); // Also refresh full topic list in case permissions are shown there too
                } else {
                    showAlert(response.message || 'เกิดข้อผิดพลาดในการบันทึกสิทธิ์', 'danger');
                }
            })
            .catch(error => {
                hideSpinner($submitBtn);
                showAlert(error.message || 'เกิดข้อผิดพลาดรุนแรงในการบันทึกสิทธิ์', 'danger');
            });
    });

    permissionsTab.on('click', '.removePermissionBtn', function() {
        const userId = $(this).data('user-id');
        const topicId = $(this).data('topic-id');
        const username = $(this).closest('li').find('strong').text(); // Attempt to get username for confirm message

        if (confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบสิทธิ์ทั้งหมดของ ${username} สำหรับหัวข้อ ID ${topicId}?`)) {
            showSpinner(this);
            apiRequest(`/admin/permissions/${userId}/${topicId}`, 'DELETE')
                .then(response => {
                    if (response.success) {
                        showAlert('ลบสิทธิ์สำเร็จ', 'success');
                        if (currentSelectedTopicForPerm && currentSelectedTopicForPerm.id == topicId) {
                            loadUserPermissionsForTopic(topicId);
                        }
                         loadTopics();
                    } else {
                        showAlert(response.message || 'เกิดข้อผิดพลาดในการลบสิทธิ์', 'danger');
                         hideSpinner(this);
                    }
                })
                .catch(error => {
                    showAlert(error.message || 'เกิดข้อผิดพลาดรุนแรงในการลบสิทธิ์', 'danger');
                    hideSpinner(this);
                });
        }
    });


    // --- 5. System Logs Section ---
    const systemLogsTab = $('#logs-system-tab-pane');
    function loadSystemLogs(page = 1, limit = 20, filters = {}) {
        showSpinner(systemLogsTab);
        apiRequest('/admin/logs/system', 'GET', { page, limit, ...filters })
            .then(data => {
                currentSystemLogs = data.logs;
                systemLogPagination = { currentPage: data.currentPage, totalPages: data.totalPages, limit: parseInt(limit) };
                renderSystemLogsTable(currentSystemLogs);
                renderPaginationControls(systemLogsTab.find('.pagination-controls'), systemLogPagination, (newPage) => loadSystemLogs(newPage, systemLogPagination.limit, filters));
                hideSpinner(systemLogsTab);
            })
            .catch(error => {
                showAlert('ไม่สามารถโหลด System Logs ได้: ' + error.message, 'danger');
                systemLogsTab.html('<p>เกิดข้อผิดพลาดในการโหลด System Logs</p>');
                hideSpinner(systemLogsTab);
            });
    }

    function renderSystemLogsTable(logs) {
        // Add filter controls: User, Action Type, Status, Date Range
        let tableHtml = `
            <div class="d-flex justify-content-between align-items-center mb-3">
                 <h4>System Logs (${systemLogPagination.currentPage}/${systemLogPagination.totalPages})</h4>
                 <div>
                    <input type="text" id="sysLogUserFilter" class="form-control form-control-sm d-inline-block" style="width: 120px;" placeholder="User ID...">
                    <input type="text" id="sysLogActionFilter" class="form-control form-control-sm d-inline-block" style="width: 150px;" placeholder="Action Type...">
                    <select id="sysLogStatusFilter" class="form-select form-select-sm d-inline-block" style="width: 120px;">
                        <option value="">ทุกสถานะ</option>
                        <option value="SUCCESS">Success</option>
                        <option value="FAILURE">Failure</option>
                    </select>
                    <input type="date" id="sysLogStartDateFilter" class="form-control form-control-sm d-inline-block" style="width: 150px;">
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
                        <td><pre style="max-height: 100px; overflow-y: auto; font-size: 0.8em;">${log.details ? JSON.stringify(log.details, null, 2) : ''}</pre></td>
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

        systemLogsTab.find('#sysLogApplyFilterBtn').on('click', function() {
            const filters = {
                userId: $('#sysLogUserFilter').val(),
                actionType: $('#sysLogActionFilter').val(),
                status: $('#sysLogStatusFilter').val(),
                startDate: $('#sysLogStartDateFilter').val(),
                endDate: $('#sysLogEndDateFilter').val(),
            };
            // Remove empty filters
            Object.keys(filters).forEach(key => filters[key] === '' && delete filters[key]);
            loadSystemLogs(1, systemLogPagination.limit, filters);
        });
    }

    // --- 6. Import Logs Section ---
    const importLogsTab = $('#logs-import-tab-pane');
     function loadImportLogs(page = 1, limit = 20, filters = {}) {
        showSpinner(importLogsTab);
        apiRequest('/admin/logs/import', 'GET', { page, limit, ...filters })
            .then(data => {
                currentImportLogs = data.logs;
                importLogPagination = { currentPage: data.currentPage, totalPages: data.totalPages, limit: parseInt(limit) };
                renderImportLogsTable(currentImportLogs);
                renderPaginationControls(importLogsTab.find('.pagination-controls'), importLogPagination, (newPage) => loadImportLogs(newPage, importLogPagination.limit, filters));
                hideSpinner(importLogsTab);
            })
            .catch(error => {
                showAlert('ไม่สามารถโหลด Import Logs ได้: ' + error.message, 'danger');
                importLogsTab.html('<p>เกิดข้อผิดพลาดในการโหลด Import Logs</p>');
                hideSpinner(importLogsTab);
            });
    }

    function renderImportLogsTable(logs) {
        // Add filter controls: User, Topic, Status, Date Range
        let tableHtml = `
             <div class="d-flex justify-content-between align-items-center mb-3">
                 <h4>Import Logs (${importLogPagination.currentPage}/${importLogPagination.totalPages})</h4>
                 <div>
                    <input type="text" id="importLogUserFilter" class="form-control form-control-sm d-inline-block" style="width: 120px;" placeholder="User ID...">
                    <input type="text" id="importLogTopicFilter" class="form-control form-control-sm d-inline-block" style="width: 120px;" placeholder="Topic ID...">
                    <select id="importLogStatusFilter" class="form-select form-select-sm d-inline-block" style="width: 150px;">
                        <option value="">ทุกสถานะ</option>
                        <option value="PENDING">Pending</option>
                        <option value="PROCESSING">Processing</option>
                        <option value="COMPLETED">Completed</option>
                        <option value="PARTIALLY_COMPLETED">Partially Completed</option>
                        <option value="FAILED">Failed</option>
                        <option value="CANCELLED">Cancelled</option>
                    </select>
                    <input type="date" id="importLogStartDateFilter" class="form-control form-control-sm d-inline-block" style="width: 150px;">
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
                        <td>${log.original_file_name || 'N/A'}</td>
                        <td><span class="badge bg-${getImportStatusColor(log.status)}">${log.status}</span></td>
                        <td>${log.total_records_in_file || 0}</td>
                        <td>${log.successfully_imported_records || 0}</td>
                        <td>${log.failed_records || 0}</td>
                        <td>${formatDate(log.start_time)}</td>
                        <td>${log.end_time ? formatDate(log.end_time) : 'N/A'}</td>
                        <td>${log.error_details ? `<small class="text-danger" title="${JSON.stringify(log.error_details.message || log.error_details)}">View Details</small>` : ''}</td>
                        <td>
                            ${log.failed_records > 0 ? `<button class="btn btn-xs btn-outline-warning view-failed-rows-btn" data-log-id="${log.id}">ดูแถวที่ผิดพลาด</button>` : ''}
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
            <div id="failedRowsModalContainer"></div> `;
        importLogsTab.html(tableHtml);

        importLogsTab.find('#importLogApplyFilterBtn').on('click', function() {
            const filters = {
                userId: $('#importLogUserFilter').val(),
                topicId: $('#importLogTopicFilter').val(),
                status: $('#importLogStatusFilter').val(),
                startDate: $('#importLogStartDateFilter').val(),
                endDate: $('#importLogEndDateFilter').val(),
            };
            Object.keys(filters).forEach(key => filters[key] === '' && delete filters[key]);
            loadImportLogs(1, importLogPagination.limit, filters);
        });
    }
    
    importLogsTab.on('click', '.view-failed-rows-btn', function() {
        const importLogId = $(this).data('log-id');
        loadFailedRowsForImport(importLogId);
    });

    function loadFailedRowsForImport(importLogId, page = 1, limit = 100) {
        const modalContainer = $('#failedRowsModalContainer');
        // Show a loading indicator inside modal or on button
        apiRequest(`/user/logs/import/${importLogId}/failed-rows`, 'GET', { page, limit }) // Using user route as it's generic
            .then(data => {
                renderFailedRowsModal(importLogId, data.failedRows, data);
                $('#failedRowsModal').modal('show');
            })
            .catch(error => showAlert(`ไม่สามารถโหลดแถวที่ผิดพลาดสำหรับ Log ID ${importLogId}: ${error.message}`, 'danger'));
    }

    function renderFailedRowsModal(importLogId, failedRows, paginationData) {
         let modalHtml = `
            <div class="modal fade" id="failedRowsModal" tabindex="-1" aria-labelledby="failedRowsModalLabel" aria-hidden="true">
                <div class="modal-dialog modal-xl modal-dialog-scrollable">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title" id="failedRowsModalLabel">แถวที่ Import ไม่สำเร็จ (Log ID: ${importLogId})</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">`;
        if (failedRows && failedRows.length > 0) {
            modalHtml += `<p>พบ ${paginationData.count} แถวที่ผิดพลาด (แสดงหน้า ${paginationData.currentPage}/${paginationData.totalPages})</p>
                          <table class="table table-sm table-bordered">
                            <thead><tr><th>Row in File</th><th>Data</th><th>Error Message</th></tr></thead>
                            <tbody>`;
            failedRows.forEach(row => {
                modalHtml += `<tr>
                                <td>${row.row_number_in_file}</td>
                                <td><pre style="max-height:100px; overflow-y:auto; font-size:0.8em;">${row.row_data ? JSON.stringify(row.row_data, null, 2) : 'N/A'}</pre></td>
                                <td><small class="text-danger">${row.error_message}</small></td>
                              </tr>`;
            });
            modalHtml += `  </tbody></table>`;
            // Add pagination for failed rows if totalPages > 1
            if (paginationData.totalPages > 1) {
                 modalHtml += `<div class="failed-rows-pagination-controls"></div>`;
            }
        } else {
            modalHtml += `<p>ไม่พบข้อมูลแถวที่ผิดพลาดสำหรับ Log นี้</p>`;
        }
        modalHtml += `      </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                        </div>
                    </div>
                </div>
            </div>`;
        $('#failedRowsModalContainer').html(modalHtml);
        if (paginationData.totalPages > 1) {
             renderPaginationControls(
                $('#failedRowsModalContainer .failed-rows-pagination-controls'),
                { currentPage: paginationData.currentPage, totalPages: paginationData.totalPages, limit: paginationData.limit },
                (newPage) => loadFailedRowsForImport(importLogId, newPage, paginationData.limit),
                'sm' // Smaller pagination for modal
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


    // --- Helper for Pagination ---
    function renderPaginationControls(container, pagination, loadDataFunction, size = '') {
        if (!pagination || pagination.totalPages <= 1) {
            container.html('');
            return;
        }
        let paginationHtml = `<nav aria-label="Page navigation"><ul class="pagination pagination-${size} justify-content-center">`;
        // Previous button
        paginationHtml += `<li class="page-item ${pagination.currentPage === 1 ? 'disabled' : ''}">
                            <a class="page-link" href="#" data-page="${pagination.currentPage - 1}">Previous</a>
                           </li>`;
        // Page numbers (simplified: show a few pages around current)
        let startPage = Math.max(1, pagination.currentPage - 2);
        let endPage = Math.min(pagination.totalPages, pagination.currentPage + 2);
        if (pagination.currentPage <=3) endPage = Math.min(pagination.totalPages, 5);
        if (pagination.currentPage >= pagination.totalPages - 2) startPage = Math.max(1, pagination.totalPages - 4);


        if (startPage > 1) {
            paginationHtml += `<li class="page-item"><a class="page-link" href="#" data-page="1">1</a></li>`;
            if (startPage > 2) paginationHtml += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
        }

        for (let i = startPage; i <= endPage; i++) {
            paginationHtml += `<li class="page-item ${i === pagination.currentPage ? 'active' : ''}">
                                <a class="page-link" href="#" data-page="${i}">${i}</a>
                               </li>`;
        }

        if (endPage < pagination.totalPages) {
            if (endPage < pagination.totalPages - 1) paginationHtml += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
            paginationHtml += `<li class="page-item"><a class="page-link" href="#" data-page="${pagination.totalPages}">${pagination.totalPages}</a></li>`;
        }

        // Next button
        paginationHtml += `<li class="page-item ${pagination.currentPage === pagination.totalPages ? 'disabled' : ''}">
                            <a class="page-link" href="#" data-page="${pagination.currentPage + 1}">Next</a>
                           </li>`;
        paginationHtml += `</ul></nav>`;
        container.html(paginationHtml);

        container.find('.page-link').on('click', function(e) {
            e.preventDefault();
            const page = $(this).data('page');
            if (page && page !== pagination.currentPage) {
                loadDataFunction(page);
            }
        });
    }

});
