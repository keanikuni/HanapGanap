const jwt = localStorage.getItem('token');
    const eventId = Number(new URLSearchParams(location.search).get('eventId'));

    if (eventId) {
    document.getElementById('backButtonUniversal').href = `event.html?id=${eventId}`;
    }

    const statusE1 = document.getElementById('status');
    let busy = false;

    if(!eventId){
        statusE1.textContent = 'No event selected';
    }

    async function displayEventName(){
        const ev = await (await fetch(`${API_URL}/events/${eventId}`)).json();
        document.getElementById('eventName').textContent = ev.title;
    }
    displayEventName();

    async function onScan(qrToken) {
        if (busy) return;
        busy = true;

        try{
            const res = await fetch(`${API_URL}/attendance/scan`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json',
                    Authorization: `Bearer ${jwt}`
                },
                body: JSON.stringify({eventId, qrToken})
            });
            const data = await res.json();
            const name = data.attendee?.fullName ?? ''; //from here on, name would be used to show the attendee's full name

            if(res.status === 201)
                statusE1.textContent = `${name} marked present`;
            else if(res.status === 409)
                statusE1.textContent = `${name}: ${data.message}`;
            else
                statusE1.textContent = `${data.message}`;
        }
        catch{
            statusE1.textContent = 'Network Error';
        }

        setTimeout(() => (busy = false), 2000); //cooldown before the next scan
    }

    new Html5QrcodeScanner('reader', { //Html5QrcodeScanner is a class in the js library
        fps: 10, 
        qrbox: 250
    }).render(onScan);