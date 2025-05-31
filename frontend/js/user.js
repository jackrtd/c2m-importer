// frontend/js/user.js

$(document).ready(function() {
    // --- Essential Function Checks & Auth ---
    if (typeof isLoggedIn !== 'function' || 
        typeof getUserRole !== 'function' || 
        typeof logoutUser !== 'function' || 
        typeof getUsername !== 'function' ||
        typeof apiRequest !== 'function' ||
        typeof showAlert !== 'function' ||
        typeof showSpinner !== 'function' ||
        typeof hideSpinner !== 'function' ||
        typeof formatDate !== 'function' ||
        typeof renderPaginationControls !== 'function' // Crucial: Must be in common.js
        ) {
        console.error('User.js: One or more essential functions from common.js or auth.js are not loaded. Halting user dashboard initialization.');
        $('body').html('<div class="alert alert-danger m-5" role="alert">เกิดข้อผิดพลาดในการโหลดสคริปต์สำคัญ กรุณาลองรีเฟรชหน้า หรือติดต่อผู้ดูแลระบบ (User Dashboard - JS Init Error)</div>');
        return;
    }

    if (!isLoggedIn() || getUserRole() !== 'user') {
        logoutUser(); // Redirects to login
        return;
    }
    console.log("User.js: Document ready and user authenticated.");

    // --- Define DOM Element Variables for Tabs FIRST ---
    const importDataTab = $('#import-data-tab-pane');
    const viewDataTab = $('#view-data-tab-pane');
    const myImportsTab = $('#my-imports-tab-pane');
    const deletionLogsTab = $('#deletion-logs-tab-pane'); // New tab element

    if (!importDataTab.length) console.error("User.js: #import-data-tab-pane not found!");
    if (!viewDataTab.length) console.error("User.js: #view-data-tab-pane not found!");
    if (!myImportsTab.length) console.error("User.js: #my-imports-tab-pane not found!");
    if (!deletionLogsTab.length) console.error("User.js: #deletion-logs-tab-pane not found!");


    // --- Global state for user section ---
    let availableTopics = []; 
    let currentSelectedTopicForImport = null;
    let currentSelectedTopicForView = null;
    let currentSelectedTopicForDeletionLogs = null; 
    let viewedDataPagination = { currentPage: 1, totalPages: 1, limit: 10, total: 0 };
    let myImportLogsPagination = { currentPage: 1, totalPages: 1, limit: 10, total: 0 };
    let deletionLogsPagination = { currentPage: 1, totalPages: 1, limit: 10, total: 0 }; 


    // --- Tab Navigation & Content Loading ---
    const initialActiveUserTab = $('#userTabContent .tab-pane.active').attr('id');
    console.log("User.js: Initial active tab ID:", initialActiveUserTab);

    if (initialActiveUserTab === 'import-data-tab-pane' || !initialActiveUserTab) {
        loadImportForm();
    } else if (initialActiveUserTab === 'view-data-tab-pane') {
        loadViewDataInterface();
    } else if (initialActiveUserTab === 'my-imports-tab-pane') {
        loadMyImportLogs();
    } else if (initialActiveUserTab === 'deletion-logs-tab-pane') { 
        loadDeletionLogsInterface();
    }


    $('a[data-bs-toggle="tab"]').on('shown.bs.tab', function (e) {
        const targetPaneId = $(e.target).data('bs-target'); 
        console.log("User.js: Tab shown - ", targetPaneId);
        $('#currentSectionTitleUser').text($(e.target).text().trim());

        switch (targetPaneId) {
            case '#import-data-tab-pane':
                loadImportForm();
                break;
            case '#view-data-tab-pane':
                loadViewDataInterface();
                break;
            case '#my-imports-tab-pane':
                loadMyImportLogs();
                break;
            case '#deletion-logs-tab-pane': // *** CORRECTED: Added case for deletion logs tab ***
                loadDeletionLogsInterface();
                break;
            default:
                console.warn("User.js: Unknown tab target:", targetPaneId);
        }
    });

    // --- 1. Import Data Section (Existing code - no changes here for this feature) ---
    function loadImportForm() {
        console.log("User.js: loadImportForm called.");
        if (!importDataTab.length) return;
        importDataTab.html('<div class="text-center p-5"><div class="spinner-border text-success" role="status"></div> <p>กำลังโหลดหัวข้อสำหรับ Import...</p></div>');
        
        apiRequest('/user/topics', 'GET') 
            .then(data => {
                if (data.success && data.topics) {
                    availableTopics = data.topics; 
                    renderImportForm(availableTopics);
                } else {
                    importDataTab.html('<p class="text-danger text-center mt-3">ไม่สามารถโหลดหัวข้อสำหรับ Import ได้</p>');
                    showAlert(data.message || 'ไม่สามารถโหลดหัวข้อสำหรับ Import', 'danger', 'globalAlertContainerUser');
                }
            })
            .catch(error => {
                importDataTab.html('<p class="text-danger text-center mt-3">เกิดข้อผิดพลาดในการโหลดหัวข้อสำหรับ Import</p>');
            });
    }

    function renderImportForm(topics) {
        console.log("User.js: renderImportForm called with topics:", topics ? topics.length : 0);
        let formHtml = `
            <h4><i class="bi bi-cloud-upload-fill me-2"></i>นำเข้าข้อมูลใหม่</h4>
            <form id="fileImportForm" enctype="multipart/form-data">
                <div class="mb-3">
                    <label for="importTopicSelect" class="form-label">เลือกหัวข้อที่จะนำเข้า <span class="text-danger">*</span></label>
                    <select class="form-select" id="importTopicSelect" name="topicId" required>
                        <option value="">-- กรุณาเลือกหัวข้อ --</option>`;
        if (topics && topics.length > 0) {
            topics.forEach(topic => {
                formHtml += `<option value="${topic.id}" data-topic-name="${topic.name}">${topic.name} (ตาราง: ${topic.target_table_name})</option>`;
            });
        } else {
            formHtml += `<option value="" disabled>ไม่พบหัวข้อที่คุณมีสิทธิ์นำเข้า</option>`;
        }
        formHtml += `
                    </select>
                </div>
                <div id="columnMappingPreview" class="mb-3" style="display:none;">
                    <h6>ตัวอย่างคอลัมน์ที่คาดหวังในไฟล์ (จาก Source Column):</h6>
                    <ul class="list-group list-group-flush" id="expectedColumnsList"></ul>
                </div>
                <div class="mb-3">
                    <label for="importFile" class="form-label">เลือกไฟล์ Excel (.xlsx, .xls) หรือ CSV (.csv) <span class="text-danger">*</span></label>
                    <input class="form-control" type="file" id="importFile" name="importFile" accept=".xlsx,.xls,.csv" required>
                </div>
                <button type="submit" class="btn btn-success"><i class="bi bi-arrow-bar-up"></i> เริ่มการนำเข้า</button>
            </form>
            <div id="importStatus" class="mt-3"></div>`;
        importDataTab.html(formHtml);
        console.log("User.js: Import form rendered.");

        $('#importTopicSelect').off('change').on('change', function() {
            const selectedTopicId = $(this).val();
            currentSelectedTopicForImport = null; 
            $('#columnMappingPreview').hide();
            $('#expectedColumnsList').html('');

            if (selectedTopicId) {
                currentSelectedTopicForImport = availableTopics.find(t => t.id == selectedTopicId);
                if (currentSelectedTopicForImport && currentSelectedTopicForImport.columnMappings) {
                    let columnsHtml = '';
                    if (currentSelectedTopicForImport.columnMappings.length > 0) {
                        currentSelectedTopicForImport.columnMappings.forEach(cm => {
                            columnsHtml += `<li class="list-group-item list-group-item-info py-1 px-2 fs-sm">${cm.source_column_name} ${cm.is_primary_key ? '<span class="badge bg-warning text-dark ms-1">PK</span>': ''}</li>`;
                        });
                    } else {
                        columnsHtml = '<li class="list-group-item list-group-item-warning py-1 px-2 fs-sm">ไม่มีการกำหนด Mapping คอลัมน์สำหรับหัวข้อนี้</li>';
                    }
                    $('#expectedColumnsList').html(columnsHtml);
                    $('#columnMappingPreview').show();
                }
            }
        });
    }

    importDataTab.on('submit', '#fileImportForm', function(e) {
        e.preventDefault();
        const topicId = $('#importTopicSelect').val();
        const fileInput = $('#importFile')[0];
        const importStatusDiv = $('#importStatus');
        importStatusDiv.html(''); 

        if (!topicId) {
            showAlert('กรุณาเลือกหัวข้อที่จะนำเข้า', 'warning', 'globalAlertContainerUser');
            return;
        }
        if (!fileInput.files || fileInput.files.length === 0) {
            showAlert('กรุณาเลือกไฟล์ที่จะนำเข้า', 'warning', 'globalAlertContainerUser');
            return;
        }

        const file = fileInput.files[0];
        const formData = new FormData();
        formData.append('importFile', file); 

        const $submitBtn = $(this).find('button[type="submit"]');
        showSpinner($submitBtn, 'กำลังอัปโหลดและประมวลผล...');
        const topicNameForStatus = $('#importTopicSelect option:selected').data('topic-name') || `หัวข้อ ID ${topicId}`;
        importStatusDiv.html(`<div class="alert alert-info" role="alert"><div class="spinner-border spinner-border-sm text-primary me-2" role="status"></div>กำลังดำเนินการนำเข้าไฟล์ <strong>${file.name}</strong> สำหรับหัวข้อ <strong>${topicNameForStatus}</strong>... กรุณารอสักครู่</div>`);

        apiRequest(`/import/topic/${topicId}`, 'POST', formData, true)
            .then(response => {
                hideSpinner($submitBtn);
                if (response.success || (response.successfullyImported !== undefined && response.failedCount !== undefined)) { 
                    let message = `<strong>${response.message || 'การนำเข้าเสร็จสิ้น'}</strong><br>
                                   Log ID: ${response.importLogId}<br>
                                   สำเร็จ: ${response.successfullyImported} รายการ<br>
                                   ไม่สำเร็จ: ${response.failedCount} รายการ`;
                    if (response.failedCount > 0 && response.failedSamples && response.failedSamples.length > 0) {
                        message += `<br><small class="text-muted">ตัวอย่างรายการที่ผิดพลาด (ดูรายละเอียดเพิ่มเติมได้ที่ "ประวัติการนำเข้าของฉัน"):</small><ul class="fs-sm">`;
                        response.failedSamples.forEach(sample => {
                            message += `<li>แถวที่ ${sample.row_number_in_file}: ${sample.error_message}</li>`;
                        });
                        message += `</ul>`;
                    }
                    const alertType = (response.failedCount > 0 && response.successfullyImported === 0) ? 'danger' : (response.failedCount > 0 ? 'warning' : 'success');
                    importStatusDiv.html(`<div class="alert alert-${alertType}" role="alert">${message}</div>`);
                    showAlert(response.message || 'การนำเข้าเสร็จสิ้น', alertType, 'globalAlertContainerUser');
                    if (alertType !== 'danger') { 
                        $('#fileImportForm').trigger('reset'); 
                        $('#columnMappingPreview').hide();
                        $('#expectedColumnsList').html('');
                        currentSelectedTopicForImport = null;
                    }
                } else {
                    importStatusDiv.html(`<div class="alert alert-danger" role="alert"><strong>การนำเข้าล้มเหลว:</strong> ${response.message || 'มีข้อผิดพลาดบางอย่างเกิดขึ้น'}</div>`);
                    showAlert(response.message || 'การนำเข้าล้มเหลว', 'danger', 'globalAlertContainerUser');
                }
            })
            .catch(error => {
                hideSpinner($submitBtn);
                importStatusDiv.html(`<div class="alert alert-danger" role="alert"><strong>เกิดข้อผิดพลาดร้ายแรง:</strong> ${error.message || 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้'}</div>`);
            });
    });


    // --- 2. View Imported Data Section (Existing code) ---
    function loadViewDataInterface() {
        console.log("User.js: loadViewDataInterface called.");
        if (!viewDataTab.length) return;
        viewDataTab.html('<div class="text-center p-5"><div class="spinner-border text-success" role="status"></div> <p>กำลังโหลดหัวข้อสำหรับดูข้อมูล...</p></div>');
        
        const topicsPromise = availableTopics.length > 0 ? Promise.resolve({ success: true, topics: availableTopics }) : apiRequest('/user/topics', 'GET');

        topicsPromise
            .then(data => {
                if (data.success && data.topics) {
                    if (availableTopics.length === 0) availableTopics = data.topics; 
                    renderViewDataTopicSelector(data.topics);
                } else {
                    viewDataTab.html('<p class="text-danger text-center mt-3">ไม่สามารถโหลดหัวข้อสำหรับดูข้อมูลได้</p>');
                }
            })
            .catch(error => {
                viewDataTab.html('<p class="text-danger text-center mt-3">เกิดข้อผิดพลาดในการโหลดหัวข้อ</p>');
            });
    }

    function renderViewDataTopicSelector(topics) {
        console.log("User.js: renderViewDataTopicSelector called.");
        let html = `
            <h4><i class="bi bi-table me-2"></i>ดูข้อมูลที่นำเข้า</h4>
            <div class="row mb-3 align-items-end">
                <div class="col-md-5">
                    <label for="viewDataTopicSelect" class="form-label">เลือกหัวข้อ:</label>
                    <select id="viewDataTopicSelect" class="form-select">
                        <option value="">-- กรุณาเลือกหัวข้อ --</option>`;
        if (topics && topics.length > 0) {
            topics.forEach(topic => {
                html += `<option value="${topic.id}" data-topic-name="${topic.name}">${topic.name} (ตาราง: ${topic.target_table_name})</option>`;
            });
        } else {
             html += `<option value="" disabled>ไม่พบหัวข้อที่คุณมีสิทธิ์ดูข้อมูล</option>`;
        }
        html += `   </select>
                </div>
                <div class="col-md-7" id="viewDataFilterControls" style="display:none;">
                </div>
            </div>
            <div id="viewDataTableContainer">
                <p class="text-muted">กรุณาเลือกหัวข้อเพื่อแสดงข้อมูล</p>
            </div>
            <div class="pagination-controls mt-3"></div>
            <div id="deleteConfirmationModalContainer"></div>`; 
        viewDataTab.html(html);
        console.log("User.js: View data topic selector rendered.");
    }

    viewDataTab.on('change', '#viewDataTopicSelect', function() {
        const topicId = $(this).val();
        console.log("User.js: Topic selected for viewing data:", topicId);
        $('#viewDataTableContainer').html('<div class="text-center p-3"><div class="spinner-border spinner-border-sm text-success"></div> <p>กำลังโหลดข้อมูล...</p></div>');
        viewDataTab.find('.pagination-controls').html('');
        $('#viewDataFilterControls').html('').hide();
        currentSelectedTopicForView = null;
        currentViewedDataTopicConfig = null;
        currentViewedDataMappings = [];


        if (topicId) {
            const selectedTopicFull = availableTopics.find(t => t.id == topicId);
            if (selectedTopicFull) {
                currentSelectedTopicForView = selectedTopicFull; 
                currentViewedDataTopicConfig = selectedTopicFull; 
                currentViewedDataMappings = selectedTopicFull.columnMappings || [];
                
                if (currentViewedDataMappings.length > 0) {
                    renderViewDataFilterControls(currentViewedDataMappings);
                    loadAndRenderViewedData(topicId, 1, viewedDataPagination.limit, {});
                } else {
                     $('#viewDataTableContainer').html('<p class="text-danger text-center mt-3">ไม่มี Column Mapping สำหรับหัวข้อนี้ ไม่สามารถแสดงข้อมูลได้</p>');
                }
            } else {
                 $('#viewDataTableContainer').html('<p class="text-danger text-center mt-3">ไม่พบข้อมูลการตั้งค่าสำหรับหัวข้อที่เลือก</p>');
                 console.warn("User.js: Selected topic ID", topicId, "not found in availableTopics cache for viewing.");
            }
        } else {
            $('#viewDataTableContainer').html('<p class="text-muted">กรุณาเลือกหัวข้อเพื่อแสดงข้อมูล</p>');
        }
    });
    
    function renderViewDataFilterControls(mappings) {
        let filterHtml = '<small class="me-2">ค้นหาในคอลัมน์ (พิมพ์แล้วกด Enter):</small><div class="d-flex flex-wrap">';
        let displayedFilters = 0;
        for (const mapping of mappings) {
            if (displayedFilters < 3 && (!mapping.data_type || mapping.data_type.toLowerCase().includes('char') || mapping.data_type.toLowerCase().includes('text'))) {
                 filterHtml += `<input type="text" class="form-control form-control-sm me-2 mb-1 data-filter-input" style="flex: 1 1 150px;" data-column="${mapping.target_column_name}" placeholder="${mapping.source_column_name}...">`;
                 displayedFilters++;
            }
        }
        if (displayedFilters === 0 && mappings.length > 0) { 
             filterHtml += `<input type="text" class="form-control form-control-sm me-2 mb-1 data-filter-input" style="flex: 1 1 150px;" data-column="${mappings[0].target_column_name}" placeholder="${mappings[0].source_column_name}...">`;
        }
        filterHtml += `</div><button id="applyViewDataFiltersBtn" class="btn btn-sm btn-outline-secondary mt-1 mb-2">ใช้ Filter</button> 
                       <button id="resetViewDataFiltersBtn" class="btn btn-sm btn-outline-light text-dark mt-1 mb-2 ms-1">ล้าง Filter</button>`;
        $('#viewDataFilterControls').html(filterHtml).show();

        $('#applyViewDataFiltersBtn').off('click').on('click', function() {
            applyAndLoadViewDataFilters();
        });
        $('#resetViewDataFiltersBtn').off('click').on('click', function() {
            $('.data-filter-input').val('');
            applyAndLoadViewDataFilters();
        });
        $('.data-filter-input').off('keypress').on('keypress', function(e) {
            if (e.which === 13) { 
                applyAndLoadViewDataFilters();
            }
        });
    }

    function applyAndLoadViewDataFilters(sortBy = null, sortOrder = 'ASC') {
        const filters = [];
        $('.data-filter-input').each(function() {
            const column = $(this).data('column');
            const value = $(this).val();
            if (value && column) { 
                filters.push({ column, value });
            }
        });
        if (currentSelectedTopicForView) {
            const queryParams = { filters: JSON.stringify(filters) };
            if (sortBy) queryParams.sortBy = sortBy;
            if (sortOrder) queryParams.sortOrder = sortOrder;
            loadAndRenderViewedData(currentSelectedTopicForView.id, 1, viewedDataPagination.limit, queryParams);
        }
    }

    function loadAndRenderViewedData(topicId, page = 1, limit = 10, queryParams = {}) {
        const container = $('#viewDataTableContainer');
        container.html('<div class="text-center p-3"><div class="spinner-border spinner-border-sm text-success"></div> <p>กำลังโหลดข้อมูล...</p></div>');

        apiRequest(`/user/topics/${topicId}/data`, 'GET', { page, limit, ...queryParams })
            .then(data => {
                if (data.success) {
                    viewedDataPagination = { currentPage: data.currentPage, totalPages: data.totalPages, limit: data.limit, total: data.total };
                    currentViewedDataMappings = data.columnMappings || currentViewedDataMappings; 
                    renderViewedDataTable(data.data, currentViewedDataMappings, queryParams.sortBy, queryParams.sortOrder);
                    
                    const paginationContainer = viewDataTab.find('.pagination-controls');
                    if(paginationContainer.length){
                        renderPaginationControls(paginationContainer, viewedDataPagination, (newPage) => {
                            loadAndRenderViewedData(topicId, newPage, viewedDataPagination.limit, queryParams); 
                        });
                    }
                } else {
                    container.html(`<p class="text-danger text-center mt-3">${data.message || 'ไม่สามารถโหลดข้อมูลได้'}</p>`);
                }
            })
            .catch(error => {
                container.html(`<p class="text-danger text-center mt-3">เกิดข้อผิดพลาดในการโหลดข้อมูล: ${error.message}</p>`);
            });
    }

    function renderViewedDataTable(records, mappings, currentSortBy = null, currentSortOrder = 'ASC') {
        const container = $('#viewDataTableContainer');
        console.log("User.js: renderViewedDataTable called.");
        if (!currentSelectedTopicForView) {
            container.html('<p class="text-muted">กรุณาเลือกหัวข้อ</p>');
            return;
        }
        const pkMapping = mappings.find(m => m.is_primary_key);

        let tableHtml = `
            <div class="d-flex justify-content-between align-items-center mb-2">
                <h5>ข้อมูลสำหรับ: ${currentSelectedTopicForView.name} (หน้า ${viewedDataPagination.currentPage}/${viewedDataPagination.totalPages} - ทั้งหมด ${viewedDataPagination.total || 0} รายการ)</h5>
                ${pkMapping ? '<button id="deleteSelectedRecordsBtn" class="btn btn-sm btn-outline-danger" disabled><i class="bi bi-trash2-fill"></i> ลบรายการที่เลือก</button>' : ''}
            </div>
            <div class="table-responsive">
                <table class="table table-bordered table-hover table-sm">
                    <thead><tr>`;
        if (pkMapping) {
             tableHtml += `<th><input type="checkbox" id="selectAllRecordsCheckbox" title="เลือกทั้งหมดในหน้านี้"></th>`;
        }
        mappings.forEach(mapping => {
            let sortIcon = '';
            if (mapping.target_column_name === currentSortBy) {
                sortIcon = currentSortOrder === 'ASC' ? '<i class="bi bi-sort-alpha-down ms-1"></i>' : '<i class="bi bi-sort-alpha-up ms-1"></i>';
            }
            tableHtml += `<th class="cursor-pointer sortable-header" data-column="${mapping.target_column_name}" title="Sort by ${mapping.source_column_name}">${mapping.source_column_name} <small class="text-muted">(${mapping.target_column_name})</small>${sortIcon}</th>`;
        });
        tableHtml += `</tr></thead><tbody>`;

        if (records && records.length > 0) {
            records.forEach(record => {
                tableHtml += `<tr>`;
                if (pkMapping) {
                    const pkValue = record[pkMapping.target_column_name];
                    tableHtml += `<td><input type="checkbox" class="record-checkbox" value="${String(pkValue).replace(/"/g, "&quot;")}"></td>`;
                }
                mappings.forEach(mapping => {
                    tableHtml += `<td>${record[mapping.target_column_name] !== null && record[mapping.target_column_name] !== undefined ? record[mapping.target_column_name] : '<em class="text-muted">N/A</em>'}</td>`;
                });
                tableHtml += `</tr>`;
            });
        } else {
            tableHtml += `<tr><td colspan="${mappings.length + (pkMapping ? 1:0)}" class="text-center">ไม่พบข้อมูลที่ตรงกับเงื่อนไขการค้นหา</td></tr>`;
        }
        tableHtml += `</tbody></table></div>`;
        container.html(tableHtml);
    }
    
    viewDataTab.on('click', '.sortable-header', function() {
        const newSortBy = $(this).data('column');
        let newSortOrder = 'ASC';
        const currentSortBy = viewDataTab.data('currentSortBy');
        const currentSortOrder = viewDataTab.data('currentSortOrder') || 'ASC';

        if (newSortBy === currentSortBy) {
            newSortOrder = currentSortOrder === 'ASC' ? 'DESC' : 'ASC';
        }
        viewDataTab.data('currentSortBy', newSortBy);
        viewDataTab.data('currentSortOrder', newSortOrder);

        applyAndLoadViewDataFilters(newSortBy, newSortOrder);
    });

    viewDataTab.on('change', '#selectAllRecordsCheckbox', function() {
        const isChecked = $(this).is(':checked');
        $('.record-checkbox').prop('checked', isChecked);
        $('#deleteSelectedRecordsBtn').prop('disabled', !isChecked && $('.record-checkbox:checked').length === 0);
    });

    viewDataTab.on('change', '.record-checkbox', function() {
        const anyChecked = $('.record-checkbox:checked').length > 0;
        $('#deleteSelectedRecordsBtn').prop('disabled', !anyChecked);
        if (!$(this).is(':checked') && $('#selectAllRecordsCheckbox').is(':checked')) {
            $('#selectAllRecordsCheckbox').prop('checked', false);
        }
    });

    viewDataTab.on('click', '#deleteSelectedRecordsBtn', function() {
        const selectedRecordIds = $('.record-checkbox:checked').map(function() {
            return $(this).val();
        }).get();

        if (selectedRecordIds.length === 0) {
            showAlert('กรุณาเลือกอย่างน้อยหนึ่งรายการเพื่อลบ', 'warning', 'globalAlertContainerUser');
            return;
        }
        if (!currentSelectedTopicForView) {
            showAlert('ไม่พบข้อมูลหัวข้อปัจจุบัน', 'danger', 'globalAlertContainerUser');
            return;
        }
        
        const bsModal = renderDeleteConfirmationModal(selectedRecordIds.length, () => {
            const $button = $('#deleteSelectedRecordsBtn'); 
            showSpinner($button, 'กำลังลบ...'); 
            
            apiRequest(`/user/topics/${currentSelectedTopicForView.id}/data/delete`, 'POST', { recordIds: selectedRecordIds })
                .then(response => {
                    hideSpinner($button);
                    if (response.success || (response.deletedCount !== undefined && response.deletedCount > 0)) {
                        showAlert(response.message || `ลบ ${response.deletedCount} รายการสำเร็จ`, 'success', 'globalAlertContainerUser');
                        const currentSortBy = viewDataTab.data('currentSortBy');
                        const currentSortOrder = viewDataTab.data('currentSortOrder') || 'ASC';
                        applyAndLoadViewDataFilters(currentSortBy, currentSortOrder);
                    } else {
                        showAlert(response.message || 'เกิดข้อผิดพลาดในการลบข้อมูล', 'danger', 'globalAlertContainerUser');
                    }
                })
                .catch(error => {
                    hideSpinner($button);
                });
        });
        if (bsModal) bsModal.show();
    });
    
    function renderDeleteConfirmationModal(count, confirmCallback) {
        const modalContainer = $('#deleteConfirmationModalContainer');
        modalContainer.empty();
        const modalHtml = `
            <div class="modal fade" id="deleteConfirmModal" tabindex="-1" aria-labelledby="deleteConfirmModalLabel" aria-hidden="true">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header bg-danger text-white">
                            <h5 class="modal-title" id="deleteConfirmModalLabel"><i class="bi bi-exclamation-triangle-fill me-2"></i>ยืนยันการลบข้อมูล</h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <p>คุณแน่ใจหรือไม่ว่าต้องการลบ <strong>${count}</strong> รายการที่เลือก? การกระทำนี้อาจสามารถกู้คืนได้ผ่านระบบ Rollback (หากมีการตั้งค่าไว้)</p>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">ยกเลิก</button>
                            <button type="button" class="btn btn-danger" id="confirmDeleteBtnModalAction">ยืนยันการลบ</button>
                        </div>
                    </div>
                </div>
            </div>`;
        modalContainer.html(modalHtml);

        const modalElement = document.getElementById('deleteConfirmModal');
        const bsModal = new bootstrap.Modal(modalElement);

        $('#confirmDeleteBtnModalAction').off('click').on('click', function() {
            confirmCallback();
            bsModal.hide();
        });
        
        $(modalElement).on('hidden.bs.modal', function () { $(this).remove(); });
        return bsModal;
    }
    

    // --- 3. My Import Logs Section (Existing code) ---
    function loadMyImportLogs(page = 1, limit = 10, filters = {}) {
        console.log("User.js: loadMyImportLogs called. Page:", page, "Filters:", filters);
        if (!myImportsTab.length) return;
        myImportsTab.html('<div class="text-center p-5"><div class="spinner-border text-success" role="status"></div> <p>กำลังโหลดประวัติการนำเข้า...</p></div>');
        
        apiRequest('/user/logs/import', 'GET', { page, limit, ...filters })
            .then(data => {
                if (data.success) {
                    myImportLogsPagination = { currentPage: data.currentPage, totalPages: data.totalPages, limit: data.limit, total: data.count };
                    
                    const logsToRender = data.logs.map(log => ({
                        ...log,
                        failedRowsCount: log.failed_records || (log.failedRows ? log.failedRows.length : 0)
                    }));

                    renderMyImportLogsTable(logsToRender); 
                    const paginationContainer = myImportsTab.find('.pagination-controls');
                    if (paginationContainer.length) {
                        renderPaginationControls(paginationContainer, myImportLogsPagination, (newPage) => loadMyImportLogs(newPage, myImportLogsPagination.limit, filters));
                    }
                } else {
                    myImportsTab.html(`<p class="text-danger text-center mt-3">ไม่สามารถโหลดประวัติการนำเข้าได้: ${data.message || 'Unknown error'}</p>`);
                }
            })
            .catch(error => {
                myImportsTab.html(`<p class="text-danger text-center mt-3">เกิดข้อผิดพลาดในการโหลดประวัติการนำเข้า: ${error.message}</p>`);
            });
    }

    function renderMyImportLogsTable(logs) {
        console.log("User.js: renderMyImportLogsTable called.");
        let tableHtml = `
            <h4><i class="bi bi-list-check me-2"></i>ประวัติการนำเข้าของฉัน (${myImportLogsPagination.currentPage}/${myImportLogsPagination.totalPages} - ทั้งหมด ${myImportLogsPagination.total || 0} รายการ)</h4>
            <div class="d-flex justify-content-end align-items-center mb-3 flex-wrap">
                 <div class="filters-container d-flex flex-wrap justify-content-end">
                    <select id="myImportLogTopicFilter" class="form-select form-select-sm me-2 mb-1" style="width: auto; min-width:150px;">
                        <option value="">ทุกหัวข้อ</option>
                        ${availableTopics.map(t => `<option value="${t.id}">${t.name}</option>`).join('')}
                    </select>
                    <select id="myImportLogStatusFilter" class="form-select form-select-sm me-2 mb-1" style="width: auto; min-width:150px;">
                        <option value="">ทุกสถานะ</option>
                        <option value="PENDING">Pending</option>
                        <option value="PROCESSING">Processing</option>
                        <option value="COMPLETED">Completed</option>
                        <option value="PARTIALLY_COMPLETED">Partially Completed</option>
                        <option value="FAILED">Failed</option>
                    </select>
                    <label for="myImportLogStartDateFilter" class="form-label-sm me-1 mb-1 align-self-center">Start:</label>
                    <input type="date" id="myImportLogStartDateFilter" class="form-control form-control-sm me-2 mb-1" style="width: auto;">
                    <label for="myImportLogEndDateFilter" class="form-label-sm me-1 mb-1 align-self-center">End:</label>
                    <input type="date" id="myImportLogEndDateFilter" class="form-control form-control-sm me-2 mb-1" style="width: auto;">
                    <button id="myImportLogApplyFilterBtn" class="btn btn-sm btn-outline-primary mb-1">Filter</button>
                 </div>
            </div>
            <div class="table-responsive">
                <table class="table table-sm table-hover">
                    <thead>
                        <tr>
                            <th>Log ID</th>
                            <th>หัวข้อ</th>
                            <th>ชื่อไฟล์</th>
                            <th>สถานะ</th>
                            <th>รวม</th>
                            <th>สำเร็จ</th>
                            <th>ผิดพลาด</th>
                            <th>เริ่มเมื่อ</th>
                            <th>สิ้นสุดเมื่อ</th>
                            <th>ดำเนินการ</th>
                        </tr>
                    </thead>
                    <tbody>`;
        if (logs && logs.length > 0) {
            logs.forEach(log => {
                tableHtml += `
                    <tr>
                        <td>${log.id}</td>
                        <td>${log.topic ? log.topic.name : 'N/A'}</td>
                        <td><small>${log.original_file_name || 'N/A'}</small></td>
                        <td><span class="badge bg-${getImportStatusColor(log.status)}">${log.status}</span></td>
                        <td>${log.total_records_in_file || 0}</td>
                        <td>${log.successfully_imported_records || 0}</td>
                        <td>${log.failed_records || 0}</td>
                        <td>${formatDate(log.start_time)}</td>
                        <td>${log.end_time ? formatDate(log.end_time) : 'N/A'}</td>
                        <td>
                            ${(log.failed_records || log.failedRowsCount || 0) > 0 ? `<button class="btn btn-xs btn-outline-info view-my-failed-rows-btn" data-log-id="${log.id}">ดูแถวที่ผิดพลาด</button>` : ''}
                        </td>
                    </tr>`;
            });
        } else {
            tableHtml += '<tr><td colspan="10" class="text-center">ไม่พบประวัติการนำเข้า</td></tr>';
        }
        tableHtml += `
                    </tbody>
                </table>
            </div>
            <div class="pagination-controls mt-3"></div>
            <div id="myFailedRowsModalContainer"></div>`; 
        myImportsTab.html(tableHtml);
        console.log("User.js: My Import Logs table rendered.");

        myImportsTab.off('click', '#myImportLogApplyFilterBtn').on('click', '#myImportLogApplyFilterBtn', function() {
            const filters = {
                topicId: $('#myImportLogTopicFilter').val(),
                status: $('#myImportLogStatusFilter').val(),
                startDate: $('#myImportLogStartDateFilter').val(),
                endDate: $('#myImportLogEndDateFilter').val(),
            };
            Object.keys(filters).forEach(key => { if (!filters[key]) delete filters[key]; });
            console.log("User.js: Applying My Import Log filters:", filters);
            loadMyImportLogs(1, myImportLogsPagination.limit, filters);
        });
    }
    
    myImportsTab.off('click', '.view-my-failed-rows-btn').on('click', '.view-my-failed-rows-btn', function() {
        const importLogId = $(this).data('log-id');
        console.log("User.js: View My Failed Rows clicked for log ID:", importLogId);
        loadFailedRowsForImport_User(importLogId);
    });

    function loadFailedRowsForImport_User(importLogId, page = 1, limit = 100) {
        console.log("User.js: loadFailedRowsForImport_User for log ID:", importLogId, "Page:", page);
        const modalContainer = $('#myFailedRowsModalContainer');
        if ($('#myFailedRowsModal').length === 0) { // Ensure modal shell is in DOM
            modalContainer.html(renderFailedRowsModalShell_User(importLogId));
        }
        // Show loading state inside modal body
        $('#myFailedRowsModal .modal-body').html('<div class="text-center p-3"><div class="spinner-border spinner-border-sm"></div> Loading failed rows...</div>');
        const modalInstance = bootstrap.Modal.getOrCreateInstance(document.getElementById('myFailedRowsModal'));
        modalInstance.show();


        apiRequest(`/user/logs/import/${importLogId}/failed-rows`, 'GET', { page, limit })
            .then(data => {
                console.log("User.js: Failed rows for user API response for log ID", importLogId, ":", data);
                renderFailedRowsModalContent_User(importLogId, data.failedRows, data); // data includes pagination for failed rows
            })
            .catch(error => {
                console.error("User.js: Error loading failed rows for user, log ID", importLogId, ":", error);
                $('#myFailedRowsModal .modal-body').html(`<p class="text-danger">ไม่สามารถโหลดแถวที่ผิดพลาด: ${error.message}</p>`);
                // showAlert is called by apiRequest
            });
    }
    
    function renderFailedRowsModalShell_User(importLogId) { // Renders only the modal structure
        return `
            <div class="modal fade" id="myFailedRowsModal" tabindex="-1" aria-labelledby="myFailedRowsModalLabel" aria-hidden="true">
                <div class="modal-dialog modal-xl modal-dialog-scrollable">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title" id="myFailedRowsModalLabel">แถวที่ Import ไม่สำเร็จ (Log ID: ${importLogId})</h5>
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


    function renderFailedRowsModalContent_User(importLogId, failedRows, paginationData) {
        console.log("User.js: renderFailedRowsModalContent_User for log ID:", importLogId);
        const modalBody = $('#myFailedRowsModal .modal-body');
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
                 contentHtml += `<div class="my-failed-rows-pagination-controls mt-3"></div>`;
            }
        } else {
            contentHtml += `<p>ไม่พบข้อมูลแถวที่ผิดพลาดสำหรับ Log นี้ หรือข้อมูลถูกโหลดไม่สำเร็จ</p>`;
        }
        modalBody.html(contentHtml);

        if (paginationData.totalPages > 1) {
             renderPaginationControls( 
                $('#myFailedRowsModalContainer .my-failed-rows-pagination-controls'), // Target pagination inside modal
                { currentPage: paginationData.currentPage, totalPages: paginationData.totalPages, limit: parseInt(paginationData.limit || 100) },
                (newPage) => loadFailedRowsForImport_User(importLogId, newPage, parseInt(paginationData.limit || 100)),
                'sm'
            );
        }
    }

    // --- 4. Deletion Logs / Rollback Section ---
    function loadDeletionLogsInterface() {
        console.log("User.js: loadDeletionLogsInterface called.");
        if (!deletionLogsTab.length) return;
        deletionLogsTab.html('<div class="text-center p-5"><div class="spinner-border text-success" role="status"></div> <p>กำลังโหลดหัวข้อ...</p></div>');

        const topicsPromise = availableTopics.length > 0 ? Promise.resolve({ success: true, topics: availableTopics }) : apiRequest('/user/topics', 'GET');
        topicsPromise.then(data => {
            if (data.success && data.topics) {
                if (availableTopics.length === 0) availableTopics = data.topics;
                renderDeletionLogsTopicSelector(data.topics);
            } else {
                deletionLogsTab.html('<p class="text-danger text-center mt-3">ไม่สามารถโหลดหัวข้อสำหรับดูประวัติการลบได้</p>');
            }
        }).catch(error => {
            deletionLogsTab.html('<p class="text-danger text-center mt-3">เกิดข้อผิดพลาดในการโหลดหัวข้อ</p>');
        });
    }

    function renderDeletionLogsTopicSelector(topics) {
        console.log("User.js: renderDeletionLogsTopicSelector called.");
        let html = `
            <h4><i class="bi bi-arrow-counterclockwise me-2"></i>ประวัติการลบข้อมูล และ Rollback</h4>
            <div class="row mb-3 align-items-end">
                <div class="col-md-5">
                    <label for="deletionLogTopicSelect" class="form-label">เลือกหัวข้อ:</label>
                    <select id="deletionLogTopicSelect" class="form-select">
                        <option value="">-- กรุณาเลือกหัวข้อ --</option>`;
        if (topics && topics.length > 0) {
            topics.forEach(topic => {
                html += `<option value="${topic.id}" data-topic-name="${topic.name}">${topic.name} (ตาราง: ${topic.target_table_name})</option>`;
            });
        } else {
             html += `<option value="" disabled>ไม่พบหัวข้อที่คุณมีสิทธิ์ดูประวัติการลบ</option>`;
        }
        html += `   </select>
                </div>
                <div class="col-md-7" id="deletionLogFilterControls" style="display:none;">
                    <small class="me-2">Filter by Rollback Status:</small>
                    <select id="rollbackStatusFilter" class="form-select form-select-sm d-inline-block" style="width: auto;">
                        <option value="">ทั้งหมด</option>
                        <option value="false">ยังไม่ได้ Rollback</option>
                        <option value="true">Rollback แล้ว</option>
                    </select>
                </div>
            </div>
            <div id="deletionLogsTableContainer">
                <p class="text-muted">กรุณาเลือกหัวข้อเพื่อแสดงประวัติการลบ</p>
            </div>
            <div class="pagination-controls mt-3"></div>
            <div id="rollbackConfirmationModalContainer"></div>
            <div id="deletedDataViewerModalContainer"></div>`; // Container for viewing deleted data
        deletionLogsTab.html(html);
        console.log("User.js: Deletion log topic selector rendered.");
    }

    deletionLogsTab.on('change', '#deletionLogTopicSelect, #rollbackStatusFilter', function() {
        const topicId = $('#deletionLogTopicSelect').val();
        console.log("User.js: Topic or filter changed for deletion logs. Topic ID:", topicId);
        $('#deletionLogsTableContainer').html('<div class="text-center p-3"><div class="spinner-border spinner-border-sm text-success"></div> <p>กำลังโหลดประวัติการลบ...</p></div>');
        deletionLogsTab.find('.pagination-controls').html('');
        currentSelectedTopicForDeletionLogs = null;
        
        if (topicId) {
            currentSelectedTopicForDeletionLogs = availableTopics.find(t => t.id == topicId);
            if (currentSelectedTopicForDeletionLogs) {
                $('#deletionLogFilterControls').show();
                const isRolledBackFilter = $('#rollbackStatusFilter').val();
                const filters = {};
                if (isRolledBackFilter !== "") {
                    filters.is_rolled_back = isRolledBackFilter;
                }
                loadAndRenderDeletionLogs(topicId, 1, deletionLogsPagination.limit, filters);
            } else {
                 $('#deletionLogsTableContainer').html('<p class="text-danger text-center mt-3">ไม่พบข้อมูลหัวข้อที่เลือก</p>');
            }
        } else {
            $('#deletionLogFilterControls').hide();
            $('#deletionLogsTableContainer').html('<p class="text-muted">กรุณาเลือกหัวข้อเพื่อแสดงประวัติการลบ</p>');
        }
    });

    function loadAndRenderDeletionLogs(topicId, page = 1, limit = 10, filters = {}) {
        const container = $('#deletionLogsTableContainer');
        container.html('<div class="text-center p-3"><div class="spinner-border spinner-border-sm text-success"></div> <p>กำลังโหลดประวัติการลบ...</p></div>');

        apiRequest(`/user/topics/${topicId}/deletion-logs`, 'GET', { page, limit, ...filters })
            .then(data => {
                if (data.success) {
                    deletionLogsPagination = { currentPage: data.currentPage, totalPages: data.totalPages, limit: data.limit, total: data.count };
                    renderDeletionLogsTable(data.deletionLogs);
                    const paginationContainer = deletionLogsTab.find('.pagination-controls');
                    if (paginationContainer.length) {
                        renderPaginationControls(paginationContainer, deletionLogsPagination, (newPage) => {
                            loadAndRenderDeletionLogs(topicId, newPage, deletionLogsPagination.limit, filters);
                        });
                    }
                } else {
                    container.html(`<p class="text-danger text-center mt-3">${data.message || 'ไม่สามารถโหลดประวัติการลบได้'}</p>`);
                }
            })
            .catch(error => {
                container.html(`<p class="text-danger text-center mt-3">เกิดข้อผิดพลาดในการโหลดประวัติการลบ: ${error.message}</p>`);
            });
    }

    function renderDeletionLogsTable(logs) {
        const container = $('#deletionLogsTableContainer');
        console.log("User.js: renderDeletionLogsTable called.");
        if (!currentSelectedTopicForDeletionLogs) {
            container.html('<p class="text-muted">กรุณาเลือกหัวข้อ</p>');
            return;
        }
        let tableHtml = `
            <h5>ประวัติการลบสำหรับ: ${currentSelectedTopicForDeletionLogs.name} (หน้า ${deletionLogsPagination.currentPage}/${deletionLogsPagination.totalPages} - ทั้งหมด ${deletionLogsPagination.total || 0})</h5>
            <div class="table-responsive">
                <table class="table table-sm table-hover">
                    <thead>
                        <tr>
                            <th>Log ID</th>
                            <th>Batch ID</th>
                            <th>PK ที่ถูกลบ</th>
                            <th>ผู้ลบ</th>
                            <th>เวลาที่ลบ</th>
                            <th>Rollback แล้ว?</th>
                            <th>เวลา Rollback</th>
                            <th>ดำเนินการ</th>
                        </tr>
                    </thead>
                    <tbody>`;
        if (logs && logs.length > 0) {
            logs.forEach(log => {
                tableHtml += `
                    <tr>
                        <td>${log.id}</td>
                        <td><small>${log.deletion_batch_id || 'N/A'}</small></td>
                        <td>${log.record_primary_key_value}</td>
                        <td>${log.deleter ? log.deleter.username : 'N/A'}</td>
                        <td>${formatDate(log.deleted_at)}</td>
                        <td><span class="badge bg-${log.is_rolled_back ? 'success' : 'secondary'}">${log.is_rolled_back ? 'ใช่' : 'ยัง'}</span></td>
                        <td>${log.is_rolled_back && log.rolled_back_at ? formatDate(log.rolled_back_at) : 'N/A'}</td>
                        <td>
                            ${!log.is_rolled_back ? `<button class="btn btn-xs btn-outline-warning rollback-btn" data-log-id="${log.id}" data-topic-id="${log.topic_id}" title="Rollback การลบนี้"><i class="bi bi-arrow-counterclockwise"></i> Rollback</button>` : ''}
                            <button class="btn btn-xs btn-outline-info view-deleted-data-btn ms-1" data-log-id="${log.id}" title="ดูข้อมูลที่ถูกลบ"><i class="bi bi-eye"></i> ดูข้อมูล</button>
                        </td>
                    </tr>`;
            });
        } else {
            tableHtml += `<tr><td colspan="8" class="text-center">ไม่พบประวัติการลบข้อมูลที่ตรงกับเงื่อนไข</td></tr>`;
        }
        tableHtml += `</tbody></table></div>`;
        container.html(tableHtml);
    }

    deletionLogsTab.on('click', '.rollback-btn', function() {
        const deletionLogId = $(this).data('log-id');
        const topicId = $(this).data('topic-id'); // This should be from currentSelectedTopicForDeletionLogs.id
        const currentTopicIdForRollback = currentSelectedTopicForDeletionLogs ? currentSelectedTopicForDeletionLogs.id : null;

        if (!currentTopicIdForRollback || !deletionLogId) {
            showAlert("ข้อมูลไม่เพียงพอสำหรับการ Rollback (missing topicId or logId)", 'danger', 'globalAlertContainerUser');
            return;
        }

        const bsModal = renderRollbackConfirmationModal(deletionLogId, () => {
            const $button = $(this); // `this` here refers to the button clicked
            showSpinner($button, 'กำลัง Rollback...');
            apiRequest(`/user/topics/${currentTopicIdForRollback}/data/rollback`, 'POST', { deletionLogIds: [deletionLogId] })
                .then(response => {
                    hideSpinner($button);
                    if (response.success) {
                        showAlert(response.message || `Rollback Log ID ${deletionLogId} สำเร็จ`, 'success', 'globalAlertContainerUser');
                        const isRolledBackFilter = $('#rollbackStatusFilter').val();
                        const filters = {};
                        if (isRolledBackFilter !== "") filters.is_rolled_back = isRolledBackFilter;
                        loadAndRenderDeletionLogs(currentTopicIdForRollback, deletionLogsPagination.currentPage, deletionLogsPagination.limit, filters);
                    } else {
                        showAlert(response.message || `Rollback Log ID ${deletionLogId} ล้มเหลว`, 'danger', 'globalAlertContainerUser');
                    }
                })
                .catch(error => {
                    hideSpinner($button);
                });
        });
        if (bsModal) bsModal.show();
    });
    
    function renderRollbackConfirmationModal(logId, confirmCallback) {
        const modalContainer = $('#rollbackConfirmationModalContainer');
        modalContainer.empty();
        const modalHtml = `
            <div class="modal fade" id="rollbackConfirmModal" tabindex="-1" aria-labelledby="rollbackConfirmModalLabel" aria-hidden="true">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header bg-warning text-dark">
                            <h5 class="modal-title" id="rollbackConfirmModalLabel"><i class="bi bi-exclamation-triangle-fill me-2"></i>ยืนยันการ Rollback</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <p>คุณแน่ใจหรือไม่ว่าต้องการ Rollback การลบข้อมูลสำหรับ Log ID: <strong>${logId}</strong>? ข้อมูลที่ถูกลบจะถูกนำกลับคืนสู่ตารางปลายทาง</p>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">ยกเลิก</button>
                            <button type="button" class="btn btn-warning" id="confirmRollbackBtnModalAction">ยืนยัน Rollback</button>
                        </div>
                    </div>
                </div>
            </div>`;
        modalContainer.html(modalHtml);
        const modalElement = document.getElementById('rollbackConfirmModal');
        const bsModal = new bootstrap.Modal(modalElement);

        $('#confirmRollbackBtnModalAction').off('click').on('click', function() {
            confirmCallback();
            bsModal.hide();
        });
        $(modalElement).on('hidden.bs.modal', function () { $(this).remove(); });
        return bsModal;
    }

    deletionLogsTab.on('click', '.view-deleted-data-btn', function() {
        const deletionLogId = $(this).data('log-id');
        const container = $('#deletionLogsTableContainer'); // Or a more specific cache if available
        let logEntry = null; 
        // This is inefficient if logs are not cached. Better to fetch the specific log.
        // For now, assume we need to fetch.
        
        if (!currentSelectedTopicForDeletionLogs) {
            showAlert("กรุณาเลือกหัวข้อก่อนดูรายละเอียด", "warning", 'globalAlertContainerUser');
            return;
        }

        const $button = $(this);
        showSpinner($button, "...");

        // API does not have a route for single deletion log by ID yet.
        // We will fetch all for current page and find it. This is not ideal for performance.
        // A better approach would be an API like /api/user/deletion-log/:logId
        // For now, we'll use the existing list if possible, or re-fetch current page of deletion logs.

        const isRolledBackFilter = $('#rollbackStatusFilter').val();
        const filters = {};
        if (isRolledBackFilter !== "") filters.is_rolled_back = isRolledBackFilter;

        apiRequest(`/user/topics/${currentSelectedTopicForDeletionLogs.id}/deletion-logs`, 'GET', { page: deletionLogsPagination.currentPage, limit: deletionLogsPagination.limit, ...filters })
            .then(data => {
                hideSpinner($button);
                if (data.success && data.deletionLogs) {
                    logEntry = data.deletionLogs.find(log => log.id == deletionLogId);
                    if (logEntry) {
                        renderDeletedDataViewerModal(logEntry);
                        const viewerModal = bootstrap.Modal.getOrCreateInstance(document.getElementById('deletedDataViewerModal'));
                        viewerModal.show();
                    } else {
                         showAlert('ไม่พบข้อมูล Log การลบที่ระบุในหน้านี้', 'warning', 'globalAlertContainerUser');
                    }
                } else {
                    showAlert('ไม่สามารถดึงข้อมูล Log การลบได้', 'danger', 'globalAlertContainerUser');
                }
            })
            .catch(err => {
                hideSpinner($button);
                showAlert('เกิดข้อผิดพลาดในการดึงข้อมูล Log: ' + err.message, 'danger', 'globalAlertContainerUser');
            });
    });

    function renderDeletedDataViewerModal(logEntry) {
        const modalContainer = $('#deletedDataViewerModalContainer');
        modalContainer.empty();
        const deletedDataHtml = logEntry.deleted_record_data ? 
            `<pre class="log-details" style="max-height: 400px;">${JSON.stringify(logEntry.deleted_record_data, null, 2)}</pre>` : 
            '<p class="text-muted">ไม่มีข้อมูล (อาจจะไม่ได้บันทึกไว้)</p>';
        
        const modalHtml = `
            <div class="modal fade" id="deletedDataViewerModal" tabindex="-1" aria-labelledby="deletedDataViewerModalLabel" aria-hidden="true">
                <div class="modal-dialog modal-lg modal-dialog-scrollable">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title" id="deletedDataViewerModalLabel">ข้อมูลที่ถูกลบ (Log ID: ${logEntry.id})</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <p><strong>PK Value:</strong> ${logEntry.record_primary_key_value}</p>
                            <p><strong>ตาราง:</strong> ${logEntry.target_table_name}</p>
                            <p><strong>เวลาที่ลบ:</strong> ${formatDate(logEntry.deleted_at)} โดย ${logEntry.deleter ? logEntry.deleter.username : 'N/A'}</p>
                            <hr>
                            <h6>ข้อมูล (JSON):</h6>
                            ${deletedDataHtml}
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">ปิด</button>
                        </div>
                    </div>
                </div>
            </div>`;
        modalContainer.html(modalHtml);
        const modalElement = document.getElementById('deletedDataViewerModal');
        $(modalElement).on('hidden.bs.modal', function () { $(this).remove(); }); // Clean up modal from DOM
    }


    // --- Helper for Import Status Color ---
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
    
    // --- Initial Username Display ---
    if (typeof getUsername === 'function') {
        const currentUsername = getUsername() || 'User';
        $('#regularUsername').text(currentUsername);
        $('#regularUsernameNav').text(currentUsername);
        $('#regularUsernameOffcanvas').text(currentUsername);
    } else {
        console.warn("User.js: getUsername function not available for initial display.");
    }
});
