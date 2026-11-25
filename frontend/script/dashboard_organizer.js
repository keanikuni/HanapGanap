(() => {
    "use strict";

    // ==========================================
    // CONFIGURATION
    // ==========================================

    const API_BASE = window.API_URL || "https://localhost:8000/api";
    const FILES_BASE = API_BASE.replace(/\/api\/?$/, "");
    const TOKEN_KEY = "token";

    const token = localStorage.getItem(TOKEN_KEY);

    let currentUser = null;
    let organizerEvents = [];
    let currentParticipants = [];

    const $ = selector => document.querySelector(selector);

    const elements = {
        events: $("#events"),
        loading: $("#loading"),
        error: $("#error-message"),
        empty: $("#empty-events"),
        search: $("#event-search"),
        filter: $("#status-filter"),
        count: $("#event-count")
    };

    // ==========================================
    // API HELPER
    // ==========================================

    async function apiFetch(path, options = {}) {
        const response = await fetch(API_BASE + path, {
            ...options,
            headers: {
                Authorization: `Bearer ${token}`,
                ...options.headers
            }
        });

        if (!response.ok) {
            let message = `Request failed (${response.status})`;

            try {
                const data = await response.json();
                message = data.message || message;
            } catch {}

            const error = new Error(message);
            error.status = response.status;
            throw error;
        }

        if (response.status === 204) return null;

        const contentType = response.headers.get("content-type");

        if (contentType?.includes("application/json")) {
            return response.json();
        }

        return response;
    }

    // ==========================================
    // UTILITIES
    // ==========================================

    function escapeHTML(value = "") {
        return String(value).replace(/[&<>"']/g, char => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"
        })[char]);
    }

    function formatDate(value) {
        if (!value) return "Not specified";

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) return "Invalid date";

        return date.toLocaleString("en-PH", {
            dateStyle: "medium",
            timeStyle: "short"
        });
    }

    function toLocalInput(value) {
        if (!value) return "";

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) return "";

        const offset = date.getTimezoneOffset() * 60000;

        return new Date(date.getTime() - offset)
            .toISOString()
            .slice(0, 16);
    }

    function showError(message) {
        elements.error.textContent = message;
        elements.error.hidden = false;
    }

    function clearError() {
        elements.error.hidden = true;
        elements.error.textContent = "";
    }

    function openModal(id) {
        document.getElementById(id).hidden = false;
    }

    function closeModal(id) {
        document.getElementById(id).hidden = true;
    }

    function findEvent(id) {
        return organizerEvents.find(item => String(item.id) === String(id));
    }

    // ==========================================
    // ORGANIZER PROFILE
    // ==========================================

    async function loadProfile() {
        // /auth/me returns: { id, fullName, email, role, profile }
        currentUser = await apiFetch("/auth/me");

        if (currentUser.role !== "organizer") {
            throw new Error("This dashboard is only available to organizers.");
        }

        const profile = currentUser.profile || {};
        const university = profile.university || {};

        const fields = {
            name: currentUser.fullName,
            university: university.name || "No university assigned",
            email: currentUser.email
        };

        document.querySelectorAll("[data-field]").forEach(element => {
            element.textContent =
                fields[element.dataset.field] || "Not available";
        });

        $("#profile-avatar").textContent =
            (currentUser.fullName || "O").charAt(0).toUpperCase();
    }

    // ==========================================
    // ORGANIZER OWNERSHIP
    // ==========================================
    // NOTE: Ideally the API returns only this organizer's events
    // (e.g. GET /events?mine=true) and enforces ownership on
    // start/end/edit/delete. This client-side filter is only a
    // convenience, not a security measure.
    // Once you know which field your API really returns, trim
    // these lists down to that single field.

    function getOwnerIds(event) {
        const organizer = event.organizer || {};
        const organizerUser = organizer.user || {};

        return [
            event.organizerId,
            event.organizer_id,
            organizer.id,
            organizer.userId,
            organizer.user_id,
            organizerUser.id,
            organizerUser.userId,
            typeof event.createdBy === "object"
                ? event.createdBy?.id
                : event.createdBy
        ]
            .filter(value => value != null)
            .map(String);
    }

    function getCurrentOrganizerIds() {
        const profile = currentUser.profile || {};

        return [
            currentUser.id,
            profile.id,
            profile.userId,
            profile.user_id
        ]
            .filter(value => value != null)
            .map(String);
    }

    function isMyEvent(event) {
        const myIds = getCurrentOrganizerIds();
        return getOwnerIds(event).some(id => myIds.includes(id));
    }

    // ==========================================
    // LOAD EVENTS
    // ==========================================

    async function loadEvents() {
        clearError();

        elements.loading.hidden = false;
        elements.events.innerHTML = "";
        elements.empty.hidden = true;

        try {
            const response = await apiFetch("/events");

            const allEvents = Array.isArray(response)
                ? response
                : response.events || [];

            organizerEvents = allEvents.filter(isMyEvent);

            updateStatistics();
            renderEvents();
        } catch (error) {
            showError(error.message);
        } finally {
            elements.loading.hidden = true;
        }
    }

    // ==========================================
    // STATISTICS
    // ==========================================

    function updateStatistics() {
        const countBy = status =>
            organizerEvents.filter(event => event.status === status).length;

        $("#total-events").textContent = organizerEvents.length;
        $("#upcoming-events").textContent = countBy("upcoming");
        $("#ongoing-events").textContent = countBy("ongoing");
        $("#completed-events").textContent = countBy("completed");
    }

    // ==========================================
    // RENDER EVENT CARDS
    // ==========================================

    function renderEvents() {
        const search = elements.search.value.trim().toLowerCase();
        const status = elements.filter.value;

        const filtered = organizerEvents.filter(event => {
            const matchesSearch =
                (event.title || "").toLowerCase().includes(search);

            const matchesStatus =
                status === "all" || event.status === status;

            return matchesSearch && matchesStatus;
        });

        filtered.sort((a, b) =>
            new Date(a.startDatetime) - new Date(b.startDatetime)
        );

        elements.events.innerHTML = "";

        elements.count.textContent =
            `${filtered.length} event${filtered.length !== 1 ? "s" : ""}`;

        elements.empty.hidden = filtered.length !== 0;

        filtered.forEach(event => {
            elements.events.appendChild(createEventCard(event));
        });
    }

    function createEventCard(event) {
        const card = document.createElement("article");

        const status = event.status || "upcoming";
        const id = escapeHTML(event.id);

        card.className = `event-card event-card--${status}`;

        const registrations = event._count?.registrations ?? 0;
        const limit = event.participantLimit ?? "Unlimited";
        const category = event.category?.name || "Uncategorized";
        const image = event.images?.[0]?.filePath;

        const imageHTML = image
            ? `<img class="event-image"
                   src="${escapeHTML(FILES_BASE + image)}"
                   alt="${escapeHTML(event.title)}">`
            : "";

        const button = (cls, action, label) => `
            <button class="btn ${cls}" data-action="${action}" data-id="${id}">
                ${label}
            </button>
        `;

        let actionButtons =
            button("btn-blue", "images", "Images") +
            button("btn-secondary", "participants", `Participants (${registrations})`);

        if (status === "upcoming") {
            actionButtons += button("btn-primary", "start", "Start Event");
        }

        if (status === "ongoing") {
            // Opens the scanner for THIS event (QRScanner.html reads ?eventId=)
            actionButtons += `
                <a class="btn btn-blue"
                   href="QRScanner.html?eventId=${encodeURIComponent(event.id)}">
                    Scan QR
                </a>
            `;
            actionButtons += button("btn-primary", "end", "End Event");
        }

        if (status === "upcoming" || status === "ongoing") {
            actionButtons += button("btn-secondary", "edit", "Edit");
        }

        if (status !== "completed" && status !== "cancelled") {
            actionButtons += button("btn-danger", "delete", "Cancel / Delete");
        }

        card.innerHTML = `
            ${imageHTML}

            <div class="event-card__top">
                <h3>
                    <a href="event.html?id=${encodeURIComponent(event.id)}">
                        ${escapeHTML(event.title)}
                    </a>
                </h3>

                <span class="badge badge--${escapeHTML(status)}">
                    ${escapeHTML(status)}
                </span>
            </div>

            <p class="event-meta">Category: ${escapeHTML(category)}</p>
            <p class="event-meta">Venue: ${escapeHTML(event.venue || "Not specified")}</p>
            <p class="event-meta">Starts: ${escapeHTML(formatDate(event.startDatetime))}</p>
            <p class="event-meta">Ends: ${escapeHTML(formatDate(event.endDatetime))}</p>

            <p class="event-description">
                ${escapeHTML(event.description || "No description provided.")}
            </p>

            <div class="event-progress">
                <span>Registrations</span>
                <strong>${registrations} / ${escapeHTML(limit)}</strong>
            </div>

            <div class="event-actions">
                ${actionButtons}
            </div>
        `;

        return card;
    }

    // ==========================================
    // EVENT ACTIONS (single delegated listener)
    // ==========================================

    elements.events.addEventListener("click", async clickEvent => {
        const button = clickEvent.target.closest("[data-action]");

        if (!button) return;

        const { action, id } = button.dataset;
        const selectedEvent = findEvent(id);

        if (!selectedEvent) return;

        try {
            button.disabled = true;

            switch (action) {
                case "start":
                    await startEvent(id);
                    break;
                case "end":
                    await endEvent(id);
                    break;
                case "edit":
                    openEditModal(selectedEvent);
                    break;
                case "delete":
                    await deleteEvent(selectedEvent);
                    break;
                case "images":
                    openImagesModal(selectedEvent);
                    break;
                case "participants":
                    await openParticipants(selectedEvent);
                    break;
            }
        } catch (error) {
            alert(error.message);
        } finally {
            // The card may have been re-rendered; only touch it if still in the DOM.
            if (button.isConnected) button.disabled = false;
        }
    });

    // ==========================================
    // PARTICIPANTS
    // ==========================================

    async function openParticipants(event) {
        currentParticipants = [];

        $("#participants-event-title").textContent = event.title;
        $("#participants-search").value = "";
        $("#participants-filter").value = "all";
        $("#participants-total").textContent = "0";
        $("#participants-attended").textContent = "0";
        $("#participants-rows").innerHTML = "";
        $("#participants-error").hidden = true;
        $("#participants-empty").hidden = true;
        $("#participants-loading").hidden = false;

        openModal("participants-modal");

        try {
            const result = await apiFetch(
                `/events/${encodeURIComponent(event.id)}/participants`
            );

            if (!Array.isArray(result.participants)) {
                throw new Error("The participant list response was invalid.");
            }

            currentParticipants = result.participants;

            $("#participants-total").textContent =
                String(result.total ?? currentParticipants.length);

            $("#participants-attended").textContent = String(
                currentParticipants.filter(p => p.attendance?.isConfirm).length
            );

            renderParticipants();
        } catch (error) {
            $("#participants-error").textContent = error.message;
            $("#participants-error").hidden = false;
        } finally {
            $("#participants-loading").hidden = true;
        }
    }

    function renderParticipants() {
        const search = $("#participants-search").value.trim().toLowerCase();
        const filter = $("#participants-filter").value;

        const filtered = currentParticipants.filter(participant => {
            const user = participant.user || {};
            const attended = !!participant.attendance?.isConfirm;
            const studentNumber = user.student?.studentNumber || "";

            const matchesSearch = [user.fullName, user.email, studentNumber]
                .some(value => String(value || "").toLowerCase().includes(search));

            const matchesFilter =
                filter === "all" ||
                (filter === "attended" ? attended : !attended);

            return matchesSearch && matchesFilter;
        });

        $("#participants-rows").innerHTML = filtered.map(participant => {
            const user = participant.user || {};
            const student = user.student;
            const guest = user.guest;
            const attended = !!participant.attendance?.isConfirm;

            const details = student
                ? [
                    student.studentNumber,
                    student.courseProgram,
                    student.yearLevel && `Year ${student.yearLevel}`
                ].filter(Boolean).join(" · ")
                : guest?.schoolOrAffiliation ||
                  (user.role === "guest" ? "Guest" : user.role || "Participant");

            const checkInTime = attended && participant.attendance?.inTime
                ? `<small>${escapeHTML(formatDate(participant.attendance.inTime))}</small>`
                : "";

            return `
                <tr>
                    <td>${escapeHTML(user.fullName || "Unnamed participant")}</td>
                    <td>${escapeHTML(user.email || "Not provided")}</td>
                    <td>${escapeHTML(details)}</td>
                    <td>${escapeHTML(formatDate(participant.registeredAt))}</td>
                    <td>
                        <span class="attendance-badge ${attended ? "attendance-badge--attended" : ""}">
                            ${attended ? "Attended" : "Not checked in"}
                        </span>
                        ${checkInTime}
                    </td>
                </tr>
            `;
        }).join("");

        $("#participants-empty").hidden = filtered.length !== 0;
    }

    $("#participants-search").addEventListener("input", renderParticipants);
    $("#participants-filter").addEventListener("change", renderParticipants);

    // ==========================================
    // START / END / DELETE EVENT
    // ==========================================

    async function startEvent(id) {
        if (!confirm("Are you sure you want to start this event? Registration will close.")) return;

        await apiFetch(`/events/${encodeURIComponent(id)}/start`, { method: "POST" });

        alert("Event successfully started!");
        await loadEvents();
    }

    async function endEvent(id) {
        if (!confirm(
            "Are you sure you want to end this event? Check-in will close and certificates will become available to confirmed attendees."
        )) return;

        await apiFetch(`/events/${encodeURIComponent(id)}/end`, { method: "POST" });

        alert("Event successfully completed!");
        await loadEvents();
    }

    async function deleteEvent(event) {
        if (!confirm(
            `Are you sure you want to delete "${event.title}"?\n\nEvents with registrants will be marked as cancelled instead.`
        )) return;

        const result = await apiFetch(`/events/${encodeURIComponent(event.id)}`, {
            method: "DELETE"
        });

        alert(result?.message || "Event successfully processed.");
        await loadEvents();
    }

    // ==========================================
    // EDIT EVENT
    // ==========================================

    function openEditModal(event) {
        $("#edit-id").value = event.id;
        $("#edit-title").value = event.title || "";
        $("#edit-description").value = event.description || "";
        $("#edit-venue").value = event.venue || "";
        $("#edit-category").value = event.category?.id || event.categoryId || "";
        $("#edit-start").value = toLocalInput(event.startDatetime);
        $("#edit-end").value = toLocalInput(event.endDatetime);
        $("#edit-deadline").value = toLocalInput(event.registrationDeadline);
        $("#edit-limit").value = event.participantLimit ?? "";

        openModal("edit-modal");
    }

    $("#edit-form").addEventListener("submit", async submitEvent => {
        submitEvent.preventDefault();

        const id = $("#edit-id").value;

        const start = new Date($("#edit-start").value);
        const end = new Date($("#edit-end").value);
        const deadline = new Date($("#edit-deadline").value);
        const limit = Number($("#edit-limit").value);

        if ([start, end, deadline].some(date => Number.isNaN(date.getTime()))) {
            alert("Please provide valid dates.");
            return;
        }

        if (end <= start) {
            alert("The end date must be after the start date.");
            return;
        }

        if (deadline > start) {
            alert("The registration deadline must be on or before the event start.");
            return;
        }

        if (!Number.isInteger(limit) || limit <= 0) {
            alert("Participant limit must be a positive whole number.");
            return;
        }

        const payload = {
            title: $("#edit-title").value.trim(),
            description: $("#edit-description").value.trim(),
            venue: $("#edit-venue").value.trim(),
            categoryId: Number($("#edit-category").value),
            startDatetime: start.toISOString(),
            endDatetime: end.toISOString(),
            registrationDeadline: deadline.toISOString(),
            participantLimit: limit
        };

        if (
            !payload.title ||
            !payload.venue ||
            !Number.isInteger(payload.categoryId) ||
            payload.categoryId <= 0
        ) {
            alert("Please complete all required fields.");
            return;
        }

        const submitButton = submitEvent.submitter;
        submitButton.disabled = true;

        try {
            await apiFetch(`/events/${encodeURIComponent(id)}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            closeModal("edit-modal");
            alert("Event successfully updated!");
            await loadEvents();
        } catch (error) {
            alert(error.message);
        } finally {
            submitButton.disabled = false;
        }
    });

    // ==========================================
    // EVENT IMAGE MANAGEMENT
    // ==========================================

    function openImagesModal(event) {
        $("#images-event-id").value = event.id;
        $("#image-upload").value = "";

        renderImageGallery(event);
        openModal("images-modal");
    }

    function renderImageGallery(event) {
        const gallery = $("#image-gallery");

        gallery.innerHTML = "";

        if (!event.images?.length) {
            gallery.innerHTML = `<p class="empty">No images uploaded yet.</p>`;
            return;
        }

        event.images.forEach(image => {
            const item = document.createElement("div");
            item.className = "image-item";

            const img = document.createElement("img");
            img.src = FILES_BASE + image.filePath;
            img.alt = "Event image";

            const button = document.createElement("button");
            button.type = "button";
            button.textContent = "Delete Image";

            button.addEventListener("click", async () => {
                if (!confirm("Are you sure you want to delete this image?")) return;

                try {
                    button.disabled = true;

                    await apiFetch(
                        `/events/${encodeURIComponent(event.id)}/images/${encodeURIComponent(image.id)}`,
                        { method: "DELETE" }
                    );

                    await loadEvents();

                    const updatedEvent = findEvent(event.id);
                    if (updatedEvent) renderImageGallery(updatedEvent);
                } catch (error) {
                    alert(error.message);
                    button.disabled = false;
                }
            });

            item.append(img, button);
            gallery.appendChild(item);
        });
    }

    $("#upload-images").addEventListener("click", async () => {
        const id = $("#images-event-id").value;
        const input = $("#image-upload");
        const files = Array.from(input.files);

        if (!files.length) {
            alert("Please select at least one image.");
            return;
        }

        const event = findEvent(id);

        if (!event) return;

        if (files.length > 5) {
            alert("You can upload up to 5 images per request.");
            return;
        }

        if ((event.images?.length || 0) + files.length > 10) {
            alert("An event can have a maximum of 10 images.");
            return;
        }

        const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

        for (const file of files) {
            if (!allowedTypes.includes(file.type)) {
                alert(`${file.name} is not a supported image format.`);
                return;
            }

            if (file.size > 5 * 1024 * 1024) {
                alert(`${file.name} exceeds the 5 MB limit.`);
                return;
            }
        }

        const formData = new FormData();
        files.forEach(file => formData.append("images", file));

        const button = $("#upload-images");
        button.disabled = true;

        try {
            // No Content-Type header: the browser sets the multipart boundary.
            await apiFetch(`/events/${encodeURIComponent(id)}/images`, {
                method: "POST",
                body: formData
            });

            alert("Images uploaded successfully!");
            input.value = "";

            await loadEvents();

            const updatedEvent = findEvent(id);
            if (updatedEvent) renderImageGallery(updatedEvent);
        } catch (error) {
            alert(error.message);
        } finally {
            button.disabled = false;
        }
    });

    // ==========================================
    // SEARCH AND FILTER
    // ==========================================

    elements.search.addEventListener("input", renderEvents);
    elements.filter.addEventListener("change", renderEvents);

    // ==========================================
    // MODAL CONTROLS
    // ==========================================

    document.querySelectorAll("[data-close]").forEach(button => {
        button.addEventListener("click", () => closeModal(button.dataset.close));
    });

    document.querySelectorAll(".modal").forEach(modal => {
        modal.addEventListener("click", event => {
            if (event.target === modal) closeModal(modal.id);
        });
    });

    document.addEventListener("keydown", event => {
        if (event.key !== "Escape") return;

        document.querySelectorAll(".modal:not([hidden])").forEach(modal => {
            closeModal(modal.id);
        });
    });

    // ==========================================
    // CREATE EVENT / LOG OUT
    // ==========================================

    $("#create-event").addEventListener("click", () => {
        location.href = "create_eventpage.html";
    });

    $("#logout-button").addEventListener("click", () => {
        if (!confirm("Are you sure you want to log out?")) return;

        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem("user");

        location.href = "login.html";
    });

    // ==========================================
    // NAVIGATION (hamburger menu)
    // ==========================================
    // Only defined here if main.js hasn't already provided it.

    if (typeof window.toggleMenu !== "function") {
        window.toggleMenu = function () {
            const menu = document.getElementById("NAVMenu");
            const toggle = document.getElementById("NAVmenuToggle");

            if (!menu || !toggle) return;

            const isOpen = menu.classList.toggle("active");
            toggle.setAttribute("aria-expanded", String(isOpen));
        };
    }

    // ==========================================
    // INITIALIZATION
    // ==========================================

    function redirectToLogin() {
        localStorage.removeItem(TOKEN_KEY);
        location.href = "login.html";
    }

    async function init() {
        if (!token) {
            location.href = "login.html";
            return;
        }

        try {
            await loadProfile();
            await loadEvents();
        } catch (error) {
            console.error("Organizer dashboard failed:", error);

            showError(error.message);

            const message = error.message.toLowerCase();

            if (
                error.status === 401 ||
                message.includes("unauthorized") ||
                message.includes("token") ||
                message.includes("authentication")
            ) {
                redirectToLogin();
            }
        }
    }

    init();
})();