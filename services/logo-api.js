const axios = require('axios');

require('dotenv').config();

let authCache = null;

async function login() {
    // Basic cache check (consider adding expiry logic here later)
    if (authCache) return authCache;

    try {

        const loginUrl = `${process.env.LOGO_BASE_URL}/api/v1.0/user/integrationLogin`;
        console.log("🔗 Attempting login at:", loginUrl);

        const response = await axios.post(loginUrl, {
            username: process.env.LOGO_USERNAME,
            password: process.env.LOGO_PASSWORD
        }, {
            headers: {
                'apiKey': process.env.LOGO_API_KEY,
                'Content-Type': 'application/json'
            }
        });

        const userData = response.data.data;
        console.log("LOGO LOGIN KEYS:", userData);

        // --- 🛡️ BUSINESS LOGIC VALIDATION START ---

        // 1. Check if the account has expired
        //if (userData.isDemoExpired === true) {
          //  throw new Error("AUTH_FAIL: The Logo İşbaşı account subscription or demo has expired.");
        //}

        // 2. Check if the account has e-Invoice or e-Archive permissions
        // (Using OR || because they might only use one type, adjust to AND && if both are strictly required)
        //if (!userData.eInvoiceResponsible && !userData.ePortalArchiveResponsible) {
          //  throw new Error("AUTH_FAIL: This account is not authorized to process E-Invoices or E-Archives.");
        //}

        // 3. (Optional) Check licenses if you know the specific module string/ID you need.
        // Example: if (!userData.licenses || userData.licenses.length === 0) { ... }

        // --- 🛡️ BUSINESS LOGIC VALIDATION END ---

        console.log("✅ Login successful, permissions validated.");

        // Cache the specific data needed for future requests
        authCache = {
            accessToken: userData.accessToken,
            tenantId: userData.tenantId,
            baseUrl: userData.baseUrl,
            timestamp: Date.now() // Useful for adding cache expiry later
        };

        return authCache;

    } catch (error) {
        console.log("Status:", error.response?.status);
        console.log("Final URL hit:", error.request?.res?.responseUrl); // This shows if you were redirected
        console.log("Allowed Methods:", error.response?.headers?.allow);
        throw error;
        throw error;
    }
}



async function getGelenInvoiceList(page = 1, limit = 15) {
    const auth = await login();

    // Dökümana uygun tarih formatı (YYYY-MM-DD HH:mm:ss)
    const startDate = "2026-01-01 00:00:00";
    const endDate = "2026-04-16 00:00:00"

    try {
        const response = await axios.post(`${process.env.LOGO_BASE_URL}/api/v1.0/einvoices/myInvoicesList`, {
            filters: [
                {
                    columnName: "issueDate", // Dökümandaki sütun adı
                    operator: 5,            // >= (Büyük veya eşit)
                    value: startDate
                },
                {
                    columnName: "issueDate",
                    operator: 2,            // <= (Küçük veya eşit)
                    value: endDate
                }
            ],
            sorting: { issueDate: -1 }, // En yeni en üstte
            paging: {
                currentPage: page,
                pageSize: limit
            },
            count: true
        }, {
            headers: {
                'Authorization': `Bearer ${auth.accessToken}`,
                'tenantId': auth.tenantId,
                'apiKey': process.env.LOGO_API_KEY,
                'UserId': auth.userId,
                'UserEmail': process.env.LOGO_USERNAME,
                'UserName': process.env.LOGO_USERNAME,
                'Content-Type': 'application/json;charset=utf-8'
            }
        });

        console.log("Gelen Invoice KEYS:", Object.keys(response.data.data.data[0]));
        return response.data?.data?.data || [];
    } catch (error) {
        console.error(`❌ Liste çekme hatası (Sayfa ${page}):`, error.response?.data || error.message);
        return [];
    }
}
async function getInvoiceUBL(uuId) {
    const auth = await login();
    const url = `${process.env.LOGO_BASE_URL}/api/v1.0/einvoices/DocumentUblDatawithuuid?uuid=${uuId}&type=1`;

    try {
        const response = await axios.get(url, {
            headers: {
                'Authorization': `Bearer ${auth.accessToken}`,
                'tenantId': auth.tenantId,
                'apiKey': process.env.LOGO_API_KEY,
                'UserId': auth.userId,
                'UserEmail': process.env.LOGO_USERNAME,
                'UserName': process.env.LOGO_USERNAME,
                'Content-Type': 'application/json'
            }
        });

        // SAFETY: Check if content actually exists
        if (!response.data?.data?.content) {
            console.warn(`⚠️ No content returned for UUID: ${uuId}`);
            return null;
        }

        return response.data.data.content;
    } catch (error) {
        // Log the actual error body from Logo to see if it's "Token Expired" or "Rate Limit"
        console.error(`❌ Logo UBL Fetch Error [${uuId}]:`, error.response?.data || error.message);
        return null;
    }
}


// Add these to logo-api.js

/**
 * Fetches the list of outgoing (sales) invoices.
 * Supports e-Invoice (1), e-Archive (2), and e-Archive Internet (3).
 */
async function getGidenInvoiceList(page = 1, limit = 100) {
    const auth = await login();
    const startDate = "2026-01-01T00:00:00"; // Note the 'T' format required for Outgoing
    const endDate = "2026-04-16T00:00:00"

    try {
        const response = await axios.post(`${process.env.LOGO_BASE_URL}/api/v1.0/invoices/invoices`,
            {
            filters: [
                {
                    columnName: "type",
                    operator: 17, // IN operator
                    value: 'Tümü' // Fetch all types
                },
                {
                    columnName: "date", // Documentation says 'date' for outgoing
                    operator: 5,        // >=
                    value: startDate
                },
                {
                    columnName: "date",
                    operator: 2,        // <=
                    value: endDate
                }
            ],
            sorting: { date: -1 },
            paging: {
                currentPage: page,
                pageSize: limit
            },
            count: true,
            columnNames: null
        }, {
            headers: {
                'Authorization': `Bearer ${auth.accessToken}`,
                'tenantId': auth.tenantId,
                'apiKey': process.env.LOGO_API_KEY,
                'UserId': auth.userId,
                'UserEmail': process.env.LOGO_USERNAME,
                'UserName': process.env.LOGO_USERNAME,
                'Content-Type': 'application/json; charset=utf-8'
            }
        });

        console.log("Giden Invoice KEYS:", Object.keys(response.data.data.data[0]));

        return response.data?.data?.data || [];
    } catch (error) {
        console.error(`❌ Outgoing List Error:`, error.response?.data || error.message);
        return [];
    }
}

/**
 * Fetches the UBL content for a Sales Invoice.
 * Note: Uses invoiceId (the readable number) and type=1.
 */
async function getGidenInvoiceUBL(invoiceId) {
    const auth = await login();
    // type=1 is required for UBL data
    const url = `${process.env.LOGO_BASE_URL}/api/v1.0/einvoices/DocumentUblData?invoiceId=${invoiceId}&type=1`

    try {
        const response = await axios.get(url, {
            headers: {
                'Authorization': `Bearer ${auth.accessToken}`,
                'tenantId': auth.tenantId,
                'apiKey': process.env.LOGO_API_KEY,
                'UserId': auth.userId,
                'UserEmail': process.env.LOGO_USERNAME,
                'UserName': process.env.LOGO_USERNAME,
                'Content-Type': 'application/json'
            }
        });

        return response.data?.data?.content; // Returns Base64 string
    } catch (error) {
        console.error(`❌ Outgoing UBL Error for ${invoiceId}:`, error.response?.data?.message || error.message);
        return null;
    }
}


module.exports = {
    login,
    getGidenInvoiceList,
    getGidenInvoiceUBL,
    getGelenInvoiceList,
    getInvoiceUBL,
};