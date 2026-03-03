let msalInstance = null;
let loggedInUser = null;
let userEmail = null;

function initAuth() {
    // If Azure AD is NOT configured — show email + password login (DB-backed)
    if (!CLIENT_ID || !TENANT_ID) {
        const fallbackLogin = document.getElementById('fallback-login');
        if (fallbackLogin) fallbackLogin.style.display = 'block';
        const msalLogin = document.getElementById('msal-login');
        if (msalLogin) msalLogin.style.display = 'none';
        // Hide "Back to Microsoft" link since Azure is not configured
        const backToMsal = document.getElementById('fallback-back-to-msal');
        if (backToMsal) backToMsal.style.display = 'none';
        return;
    }

    // Azure AD IS configured — use MSAL.js ONLY, no email+password option
    const msalLogin = document.getElementById('msal-login');
    if (msalLogin) msalLogin.style.display = 'block';
    const fallbackLogin = document.getElementById('fallback-login');
    if (fallbackLogin) fallbackLogin.style.display = 'none';
    const fallbackLink = document.getElementById('msal-fallback-link');
    if (fallbackLink) fallbackLink.style.display = 'none';

    const msalConfig = {
        auth: {
            clientId: CLIENT_ID,
            authority: "https://login.microsoftonline.com/" + TENANT_ID,
            redirectUri: REDIRECT_URI || window.location.origin
        },
        cache: {
            cacheLocation: "sessionStorage",
            storeAuthStateInCookie: false,
        }
    };

    msalInstance = new msal.PublicClientApplication(msalConfig);

    msalInstance.initialize().then(() => {
        msalInstance.handleRedirectPromise().then((response) => {
            if (response && response.account) {
                msalInstance.setActiveAccount(response.account);
            }

            const account = msalInstance.getActiveAccount();
            if (!account) {
                if (window.location.pathname === '/login' || window.location.pathname === '/') {
                    msalInstance.loginRedirect({ scopes: ["user.read"] });
                }
            } else {
                getUserName();
                if (window.location.pathname === '/login' || window.location.pathname === '/') {
                    sendUserToBackend();
                }
            }

        }).catch(err => {
            console.error("Auth Error", err);
        });
    }).catch(err => {
        console.error("MSAL Initialization Error", err);
    });
}

function getUserName() {
    try {
        let msalAccountKeys = JSON.parse(sessionStorage.getItem("msal.account.keys") || '["test"]');
        let firstKey = msalAccountKeys[0] || "test";
        let accountDataRaw = sessionStorage.getItem(firstKey);
        let accountData = accountDataRaw ? JSON.parse(accountDataRaw) : null;

        if (accountData) {
            userEmail = accountData.username;
            let accountName = accountData.name;
            accountName = accountName.replace("Ext-", "").trim();
            let parts = accountName.split(" ").reverse();
            let initials = parts[0][0] + (parts[1] ? parts[1][0] : '');
            loggedInUser = initials.toUpperCase();
        }
    } catch (error) {
        console.error("Error getting user info:", error);
    }
}

function sendUserToBackend() {
    const account = msalInstance.getActiveAccount();
    if (!account) {
        console.error("No active account found");
        return;
    }

    msalInstance.acquireTokenSilent({
        scopes: ["user.read"],
        account: account
    }).then(tokenResponse => {
        fetch('/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email: userEmail,
                name: loggedInUser,
                id_token: tokenResponse.idToken
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                window.location.href = "/dashboard";
            } else {
                console.error("Login failed:", data.message);
            }
        })
        .catch(error => {
            console.error("Error saving user:", error);
        });
    }).catch(err => {
        console.error("Token acquisition failed, attempting interactive:", err);
        msalInstance.acquireTokenRedirect({ scopes: ["user.read"] });
    });
}

function logout() {
    fetch('/api/auth/logout', { method: 'POST' })
    .then(() => {
        if (msalInstance) {
            msalInstance.logoutRedirect();
        } else {
            window.location.href = '/login';
        }
    });
}

initAuth();
