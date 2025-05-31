// At the very top of common.js
console.log("auth.js: Executing...");
/**
 * Logs in a user.
 * @param {string} username - The username.
 * @param {string} password - The password.
 * @param {'user'|'admin'} role - The role of the user trying to log in.
 * @param {function} onSuccess - Callback function on successful login (receives API response data).
 * @param {function} onError - Callback function on login failure (receives error message string).
 */
function loginUser(username, password, role, onSuccess, onError) {
    const $button = role === 'admin' ? $('#adminLoginForm button[type="submit"]') : $('#userLoginForm button[type="submit"]');
    showSpinner($button, 'กำลังเข้าสู่ระบบ...');

    apiRequest('/auth/login', 'POST', { username, password, role }, false)
        .then(data => {
            hideSpinner($button);
            if (data.success && data.token) {
                saveToken(data.token); // data.token should be "Bearer <actual_token>"
                saveUserRole(data.user.role);
                saveUsername(data.user.username);
                if (onSuccess) onSuccess(data);
            } else {
                // This case might not be hit if apiRequest throws for non-ok responses
                if (onError) onError(data.message || 'Login failed: Unexpected response from server.');
            }
        })
        .catch(error => {
            hideSpinner($button);
            // apiRequest already shows an alert for network/server errors.
            // Here, we handle specific login error messages for the form.
            if (onError) onError(error.message || 'Login request failed. Please try again.');
        });
}

/**
 * Checks authentication status and role, then redirects if necessary.
 * @param {string|null} requiredRole - The role required to access the current page ('user', 'admin'). If null, only checks if logged in.
 * @param {string} loginPath - The path to redirect to if not authenticated or role mismatch (e.g., '../admin/index.html').
 * @returns {boolean} - True if authenticated and (if specified) has the correct role, false otherwise.
 */
function checkAuthAndRedirect(requiredRole = null, loginPath = '../index.html') {
    const token = getAuthToken();
    const currentRole = getUserRole();

    if (!token) {
        logoutUser(); // Clears storage and redirects
        return false;
    }

    if (requiredRole && currentRole !== requiredRole) {
        // Logged in, but wrong role. Redirect to a generic page or their own dashboard.
        // For simplicity, redirecting to main index which then redirects based on stored role.
        showAlert(`Access denied: You do not have the required '${requiredRole}' role.`, 'warning');
        // logoutUser(); // Or redirect to their own dashboard if applicable
        if (currentRole === 'admin') window.location.href = '../admin/dashboard.html';
        else if (currentRole === 'user') window.location.href = '../user/dashboard.html';
        else logoutUser(); // Fallback
        return false;
    }
    return true; // User is authenticated and has the correct role (if specified)
}


// Global event listeners or setup related to authentication
$(document).ready(function() {
    // This logic is now more explicitly handled in dashboard.html and index.html files
    // Example: Auto-redirect from main index.html if already logged in
    // if (window.location.pathname === '/' || window.location.pathname === '/index.html') {
    //     if (isLoggedIn()) {
    //         const role = getUserRole();
    //         if (role === 'admin') {
    //             window.location.href = 'admin/dashboard.html';
    //         } else if (role === 'user') {
    //             window.location.href = 'user/dashboard.html';
    //         }
    //     }
    // }

    // Example: Attach to a global logout button if one exists in a shared navbar across all pages
    // This is now handled in specific dashboard JS
    // $('.logout-button-global').on('click', function(e) {
    //     e.preventDefault();
    //     logoutUser();
    // });
});


// ... rest of your common.js code ...

// At the very bottom of common.js
console.log("auth.js: Finished.");