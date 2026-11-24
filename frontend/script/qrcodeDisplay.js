const jwt = localStorage.getItem('token');

    async function loadQR() {
        //bearer jwt is taking the json web token to confirm is the user is logged in? might omit if the qr is relocated to student dashboard
        const res = await fetch (`${API_URL}/auth/me`, {
            method: 'GET',
            headers: {
            Authorization: `Bearer ${jwt}`
            }
        })

        if (!res.ok) return (document.getElementById('msg').textContent = 'Please log in again');

        const me = await res.json();

        if (!me.student) return (document.getElementById('msg').textContent = 'Only students have QR Codes');

        new QRCode(document.getElementById('qrcode'),{
            text: me.student.qrToken,
            width: 240,
            height: 240
        })
    }
    loadQR();