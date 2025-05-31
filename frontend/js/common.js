// At the very top of common.js
console.log("common.js: Executing...");

// Define API base URL. Adjust if your backend runs on a different port or domain.
// When running with docker-compose, frontend (nginx) might be on 8080, backend on 3000.
// The browser makes requests to the backend, so localhost:3000 is correct if backend is exposed there.
const API_BASE_URL = 'http://localhost:3000/api';

// เพิ่มฟังก์ชันนี้เข้าไปใน frontend/js/common.js (ถ้ายังไม่มี)
// หรือถ้ามีอยู่แล้ว ให้ตรวจสอบว่าเหมือนกับโค้ดนี้หรือไม่

// ควรอยู่ในไฟล์ frontend/js/common.js

function renderPaginationControls(container, pagination, loadDataFunction, size = '') {
    if (!container || !container.length) {
        console.error("Pagination container not found for renderPaginationControls. Target selector:", container ? container.selector : 'undefined');
        return;
    }
    if (!pagination || !pagination.totalPages || pagination.totalPages <= 1) {
        container.html(''); // Clear if no pagination needed
        return;
    }

    let paginationHtml = `<nav aria-label="Page navigation"><ul class="pagination pagination-${size} justify-content-center">`;

    // Previous button
    paginationHtml += `<li class="page-item ${pagination.currentPage === 1 ? 'disabled' : ''}">
                           <a class="page-link" href="#" data-page="${pagination.currentPage - 1}">Previous</a>
                       </li>`;

    // Page numbers logic
    let startPage = Math.max(1, pagination.currentPage - 2);
    let endPage = Math.min(pagination.totalPages, pagination.currentPage + 2);

    if (pagination.totalPages > 5) { // Ensure a window of about 5 pages
        if (pagination.currentPage <= 3) {
            endPage = 5;
        } else if (pagination.currentPage >= pagination.totalPages - 2) {
            startPage = pagination.totalPages - 4;
        }
    } else { // If less than 5 total pages, show all
        startPage = 1;
        endPage = pagination.totalPages;
    }

    if (startPage > 1) {
        paginationHtml += `<li class="page-item"><a class="page-link" href="#" data-page="1">1</a></li>`;
        if (startPage > 2) {
            paginationHtml += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
        }
    }

    for (let i = startPage; i <= endPage; i++) {
        paginationHtml += `<li class="page-item ${i === pagination.currentPage ? 'active' : ''}">
                               <a class="page-link" href="#" data-page="${i}">${i}</a>
                           </li>`;
    }

    if (endPage < pagination.totalPages) {
        if (endPage < pagination.totalPages - 1) {
            paginationHtml += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
        }
        paginationHtml += `<li class="page-item"><a class="page-link" href="#" data-page="${pagination.totalPages}">${pagination.totalPages}</a></li>`;
    }

    // Next button
    paginationHtml += `<li class="page-item ${pagination.currentPage === pagination.totalPages ? 'disabled' : ''}">
                           <a class="page-link" href="#" data-page="${pagination.currentPage + 1}">Next</a>
                       </li>`;
    
    paginationHtml += `</ul></nav>`; // Close ul and nav tags correctly

    container.html(paginationHtml);

    // Detach previous click handlers before attaching new ones to prevent multiple bindings
    container.find('.page-link').off('click').on('click', function(e) {
        e.preventDefault();
        if ($(this).parent().hasClass('disabled')) { // Prevent action on disabled links
            return;
        }
        const page = $(this).data('page');
        // Ensure page is a number and within valid range before calling loadDataFunction
        if (page && typeof page === 'number' && page >= 1 && page <= pagination.totalPages && page !== pagination.currentPage) {
            loadDataFunction(page);
        } else if (page && page === pagination.currentPage) {
            // Optionally do nothing or log if current page is clicked
            // console.log("Pagination: Clicked on current page.");
        }
    });
}






function getAuthToken() {
    return localStorage.getItem('authToken');
}

function saveToken(token) {
    localStorage.setItem('authToken', token);
}

function getUserRole() {
    return localStorage.getItem('userRole');
}

function saveUserRole(role) {
    localStorage.setItem('userRole', role);
}

function getUsername() {
    return localStorage.getItem('username');
}

function saveUsername(username) {
    localStorage.setItem('username', username);
}

function logoutUser() {
    const role = getUserRole(); // Get role before clearing
    localStorage.removeItem('authToken');
    localStorage.removeItem('userRole');
    localStorage.removeItem('username');
    // Redirect to appropriate login page or main page
    if (role === 'admin') {
        window.location.href = '../admin/index.html';
    } else if (role === 'user') {
        window.location.href = '../user/index.html';
    } else {
        window.location.href = '../index.html';
    }
}

function isLoggedIn() {
    return !!getAuthToken();
}

/**
 * Makes an API request.
 * @param {string} endpoint - The API endpoint (e.g., '/auth/login').
 * @param {string} method - HTTP method (GET, POST, PUT, DELETE).
 * @param {object|FormData|null} data - Data to send (for POST/PUT). For GET, it's converted to query params.
 * @param {boolean} requiresAuth - Whether the request requires an Authorization header. Default true.
 * @returns {Promise<any>} - The JSON response from the API.
 */
async function apiRequest(endpoint, method = 'GET', data = null, requiresAuth = true) {
    const headers = {};
    if (requiresAuth) {
        const token = getAuthToken();
        if (token) {
            headers['Authorization'] = token; // Assuming token is already "Bearer <token>"
        } else {
            console.warn('Auth token not found for a protected route. Request might fail.');
            // Optionally, redirect to login if a token is strictly required and missing.
            // if (window.location.pathname !== '/admin/index.html' && window.location.pathname !== '/user/index.html' && window.location.pathname !== '/index.html') {
            //     logoutUser(); // This will redirect
            //     return Promise.reject(new Error('No auth token, redirecting to login.'));
            // }
        }
    }

    const config = {
        method: method,
        headers: headers,
    };

    let url = `${API_BASE_URL}${endpoint}`;

    if (data) {
        if (method === 'GET' || method === 'DELETE') {
            // For GET/DELETE, data usually goes in query params if it's an object
            if (!(data instanceof FormData)) { // FormData not typical for GET/DELETE body
                const queryParams = new URLSearchParams(data).toString();
                if (queryParams) {
                    url = `${url}?${queryParams}`;
                }
            }
            // Note: DELETE can have a body, but it's less common. Adjust if needed.
        } else if (data instanceof FormData) {
            // For FormData (file uploads), let the browser set Content-Type
            config.body = data;
        } else {
            // For POST/PUT with JSON data
            headers['Content-Type'] = 'application/json';
            config.body = JSON.stringify(data);
        }
    }
    
    config.headers = headers; // Re-assign headers to config after potential modifications

    try {
        const response = await fetch(url, config);
        if (response.status === 204) { // No Content
            return null;
        }
        const responseData = await response.json(); // Try to parse JSON regardless of status for error messages

        if (!response.ok) {
            // Use message from responseData if available, otherwise default
            const errorMessage = responseData.message || `HTTP error! Status: ${response.status}`;
            console.error('API Error Response:', responseData);
            throw new Error(errorMessage);
        }
        return responseData; // This is usually { success: true, ...data } or just data
    } catch (error) {
        console.error('API Request Failed:', error.message);
        // Show a generic error to the user or a specific one if available
        showAlert(`API Request Error: ${error.message || 'Network error or server unavailable.'}`, 'danger', getCurrentPageAlertContainerId());
        throw error; // Re-throw to be caught by the calling function if needed
    }
}

// --- Utility functions for UI ---
function getCurrentPageAlertContainerId() {
    if (window.location.pathname.includes('/admin/')) {
        return 'globalAlertContainer';
    } else if (window.location.pathname.includes('/user/')) {
        return 'globalAlertContainerUser';
    }
    return 'globalAlertContainer'; // Fallback or for index.html
}


function showAlert(message, type = 'danger', containerId = null) {
    const alertContainerId = containerId || getCurrentPageAlertContainerId();
    const alertContainer = $(`#${alertContainerId}`);

    if (alertContainer.length === 0) {
        console.error(`Alert container #${alertContainerId} not found.`);
        // Fallback to a generic alert if container is missing, though ideally it should always exist
        // alert(message); // Avoid using native alert
        return;
    }
    const alertId = `alert-${new Date().getTime()}`;
    const alertHtml = `
        <div id="${alertId}" class="alert alert-${type} alert-dismissible fade show m-0 mb-2" role="alert">
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        </div>
    `;
    alertContainer.append(alertHtml);

    // Auto-dismiss after some time
    setTimeout(() => {
        $(`#${alertId}`).alert('close');
    }, 7000); // Increased time for better readability
}

function showSpinner(buttonElement, spinnerText = 'Loading...') {
    const $button = $(buttonElement);
    $button.prop('disabled', true);
    $button.data('original-text', $button.html());
    $button.html(`<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> ${spinnerText}`);
}

function hideSpinner(buttonElement) {
    const $button = $(buttonElement);
    $button.prop('disabled', false);
    if ($button.data('original-text')) {
        $button.html($button.data('original-text'));
    }
}

// Helper to populate form fields from an object (for editing)
function populateForm(formSelector, data) {
    const $form = $(formSelector);
    for (const key in data) {
        if (data.hasOwnProperty(key)) {
            const $field = $form.find(`[name="${key}"]`);
            if ($field.length) {
                if ($field.is(':checkbox')) {
                    $field.prop('checked', data[key]);
                } else if ($field.is(':radio')) {
                    $field.filter(`[value="${data[key]}"]`).prop('checked', true);
                } else {
                    $field.val(data[key]);
                }
            }
        }
    }
}

// Helper to serialize form to JSON object
$.fn.serializeObject = function() {
    var o = {};
    var a = this.serializeArray();
    $.each(a, function() {
        if (o[this.name]) {
            if (!o[this.name].push) {
                o[this.name] = [o[this.name]];
            }
            o[this.name].push(this.value || '');
        } else {
            o[this.name] = this.value || '';
        }
    });
    return o;
};

// Simple date formatter
function formatDate(dateString) {
    if (!dateString) return 'N/A';
    try {
        const date = new Date(dateString);
        return date.toLocaleString('th-TH', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (e) {
        return dateString; // Return original if parsing fails
    }
}

// ... rest of your common.js code ...

// At the very bottom of common.js
console.log("common.js: Finished.");