
const API = 'https://localhost:8000/api';
const TOKEN_KEY = "token";

// Get the account link
const accountLink = document.getElementById('accountLink');

accountLink.addEventListener('click', async (event) => {
    event.preventDefault();

    // Get the logged-in user's token
    const token = localStorage.getItem(TOKEN_KEY);

    // If there is no token, redirect to signup/login
    if (!token) {
        window.location.href = 'signup.html';
        return;
    }

    try {
        // Request the currently logged-in user's information
        const response = await fetch(`${API}/auth/me`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        // Token is invalid or expired
        if (response.status === 401) {
            localStorage.removeItem(TOKEN_KEY);
            window.location.href = 'signup.html';
            return;
        }

        if (!response.ok) {
            throw new Error('Failed to retrieve user information.');
        }

        // Convert the response into a JavaScript object
        const user = await response.json();

        // Redirect based on the user's role
        switch (user.role.toLowerCase()) {
            case 'student':
                window.location.href = 'student.html';
                break;

            case 'organizer':
                window.location.href = 'dashboard_organizer.html';
                break;

            case 'admin':
                window.location.href = 'admin-dashboard.html';
                break;

            case 'guest':
                // Change this to your guest page if you have one
                window.location.href = 'signup.html';
                break;

            default:
                alert('Your account has an unrecognized role.');
                break;

        }

    } catch (error) {
        console.error('Account navigation error:', error);
        alert('Unable to retrieve your account information. Please try again.');
    }
});
