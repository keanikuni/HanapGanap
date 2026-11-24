
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
        const headers = {
            Authorization: `Bearer ${token}`,
            ...options.headers
        };

        const response = await fetch(API_BASE + path, {
            ...options,
            headers
        });

        if (!response.ok) {
            let message = `Request failed (${response.status})`;

            try {
                const data = await response.json();
                message = data.message || message;
            } catch {}

            throw new Error(message);
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

    // ==========================================
    // AUTHENTICATION / ORGANIZER PROFILE
    // ==========================================

    async function loadProfile() {
        const data = await apiFetch("/auth/me");

        // Your /auth/me response:
        // { id, fullName, email, role, profile }

        currentUser = data;

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

            event.createdBy,
            event.createdBy?.id
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
        const ownerIds = getOwnerIds(event);

        return ownerIds.some(id => myIds.includes(id));
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

            // Only events belonging to this organizer.
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
        const total = organizerEvents.length;

        const upcoming = organizerEvents.filter(
            event => event.status === "upcoming"
        ).length;

        const ongoing = organizerEvents.filter(
            event => event.status === "ongoing"
        ).length;

        const completed = organizerEvents.filter(
            event => event.status === "completed"
        ).length;

        $("#total-events").textContent = total;
        $("#upcoming-events").textContent = upcoming;
        $("#ongoing-events").textContent = ongoing;
        $("#completed-events").textContent = completed;
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

        elements.events.innerHTML = "";

        elements.count.textContent =
            `${filtered.length} event${filtered.length !== 1 ? "s" : ""}`;

        elements.empty.hidden = filtered.length !== 0;

        filtered.sort((a, b) =>
            new Date(a.startDatetime) - new Date(b.startDatetime)
        );

        filtered.forEach(event => {
            const card = createEventCard(event);
            elements.events.appendChild(card);
        });
    }

    function createEventCard(event) {
        const card = document.createElement("article");

        const status = event.status || "upcoming";

        card.className = `event-card event-card--${status}`;

        const registrations = event._count?.registrations ?? 0;
        const limit = event.participantLimit ?? "Unlimited";

        const category =
            event.category?.name || "Uncategorized";

        const image = event.images?.[0]?.filePath;

        const imageHTML = image
            ? `<img class="event-image"
                   src="${escapeHTML(FILES_BASE + image)}"
                   alt="${escapeHTML(event.title)}">`
            : "";

        let actionButtons = `
            <button class="btn btn-blue"
                data-action="images" data-id="${event.id}">
                Images
            </button>
        `;

        if (status === "upcoming") {
            actionButtons += `
                <button class="btn btn-primary"
                    data-action="start" data-id="${event.id}">
                    Start Event
                </button>
            `;
        }

        if (status === "ongoing") {
            actionButtons += `
                <button class="btn btn-primary"
                    data-action="end" data-id="${event.id}">
                    End Event
                </button>
            `;
        }

        if (status === "upcoming") {
            actionButtons += `
                <button class="btn btn-secondary"
                    data-action="edit" data-id="${event.id}">
                    Edit
                </button>
            `;
        }

        if (status === "ongoing") {
            actionButtons += `
                <button class="btn btn-secondary"
                    data-action="edit" data-id="${event.id}">
                    Edit
                </button>
            `;
        }

        if (status !== "completed" && status !== "cancelled") {
            actionButtons += `
                <button class="btn btn-danger"
                    data-action="delete" data-id="${event.id}">
                    Cancel / Delete
                </button>
            `;
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

            <p class="event-meta">
                Category: ${escapeHTML(category)}
            </p>

            <p class="event-meta">
                Venue: ${escapeHTML(event.venue || "Not specified")}
            </p>

            <p class="event-meta">
                Starts: ${escapeHTML(formatDate(event.startDatetime))}
            </p>

            <p class="event-meta">
                Ends: ${escapeHTML(formatDate(event.endDatetime))}
            </p>

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
    // EVENT ACTIONS
    // ==========================================

    elements.events.addEventListener("click", async event => {
        const button = event.target.closest("[data-action]");

        if (!button) return;

        const action = button.dataset.action;
        const id = button.dataset.id;

        const selectedEvent = organizerEvents.find(
            item => String(item.id) === String(id)
        );

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
            }

        } catch (error) {
            alert(error.message);
        } finally {
            button.disabled = false;
        }
    });

    // ==========================================
    // START EVENT
    // ==========================================

    async function startEvent(id) {
        const confirmed = confirm(
            "Are you sure you want to start this event? Registration will close."
        );

        if (!confirmed) return;

        await apiFetch(`/events/${id}/start`, {
            method: "POST"
        });

        alert("Event successfully started!");

        await loadEvents();
    }

    // ==========================================
    // END EVENT
    // ==========================================

    async function endEvent(id) {
        const confirmed = confirm(
            "Are you sure you want to end this event? Check-in will close and certificates will become available to confirmed attendees."
        );

        if (!confirmed) return;

        await apiFetch(`/events/${id}/end`, {
            method: "POST"
        });

        alert("Event successfully completed!");

        await loadEvents();
    }

    // ==========================================
    // DELETE / CANCEL EVENT
    // ==========================================

    async function deleteEvent(event) {
        const confirmed = confirm(
            `Are you sure you want to delete "${event.title}"?\n\nEvents with registrants will be marked as cancelled instead.`
        );

        if (!confirmed) return;

        const result = await apiFetch(`/events/${event.id}`, {
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

        $("#edit-deadline").value =
            toLocalInput(event.registrationDeadline);

        $("#edit-limit").value = event.participantLimit || "";

        openModal("edit-modal");
    }

    $("#edit-form").addEventListener("submit", async event => {
        event.preventDefault();

        const id = $("#edit-id").value;

        const start = new Date($("#edit-start").value);
        const end = new Date($("#edit-end").value);
        const deadline = new Date($("#edit-deadline").value);

        const limit = Number($("#edit-limit").value);

        if (
            Number.isNaN(start.getTime()) ||
            Number.isNaN(end.getTime()) ||
            Number.isNaN(deadline.getTime())
        ) {
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

        if (!payload.title || !payload.venue ||
            !Number.isInteger(payload.categoryId) ||
            payload.categoryId <= 0) {
            alert("Please complete all required fields.");
            return;
        }

        const submitButton = event.submitter;
        submitButton.disabled = true;

        try {
            await apiFetch(`/events/${id}`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json"
                },
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
            gallery.innerHTML = `
                <p class="empty">No images uploaded yet.</p>
            `;
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
                const confirmed = confirm(
                    "Are you sure you want to delete this image?"
                );

                if (!confirmed) return;

                try {
                    button.disabled = true;

                    await apiFetch(
                        `/events/${event.id}/images/${image.id}`,
                        { method: "DELETE" }
                    );

                    await loadEvents();

                    const updatedEvent = organizerEvents.find(
                        item => String(item.id) === String(event.id)
                    );

                    if (updatedEvent) {
                        renderImageGallery(updatedEvent);
                    }

                } catch (error) {
                    alert(error.message);
                } finally {
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

        const event = organizerEvents.find(
            item => String(item.id) === String(id)
        );

        if (!event) return;

        if (files.length > 5) {
            alert("You can upload up to 5 images per request.");
            return;
        }

        if ((event.images?.length || 0) + files.length > 10) {
            alert("An event can have a maximum of 10 images.");
            return;
        }

        const allowedTypes = [
            "image/jpeg",
            "image/png",
            "image/webp"
        ];

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

        files.forEach(file => {
            formData.append("images", file);
        });

        const button = $("#upload-images");
        button.disabled = true;

        try {
            await apiFetch(`/events/${id}/images`, {
                method: "POST",
                body: formData
            });

            alert("Images uploaded successfully!");

            input.value = "";

            await loadEvents();

            const updatedEvent = organizerEvents.find(
                item => String(item.id) === String(id)
            );

            if (updatedEvent) {
                renderImageGallery(updatedEvent);
            }

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
        button.addEventListener("click", () => {
            closeModal(button.dataset.close);
        });
    });

    document.querySelectorAll(".modal").forEach(modal => {
        modal.addEventListener("click", event => {
            if (event.target === modal) {
                closeModal(modal.id);
            }
        });
    });

    // ==========================================
    // CREATE EVENT
    // ==========================================

    $("#create-event").addEventListener("click", () => {
        location.href = "create_eventpage.html";
    });

    // ==========================================
    // NAVIGATION AND FOOTER
    // ==========================================

    async function loadPlaceholder(elementId, file) {
        const element = document.getElementById(elementId);

        if (!element) return;

        try {
            const response = await fetch(file);

            if (!response.ok) {
                throw new Error(`Could not load ${file}`);
            }

            element.innerHTML = await response.text();

        } catch (error) {
            console.error(error);
        }
    }

    window.toggleMenu = function () {
        const menu = document.getElementById("NAVMenu");
        const toggle = document.getElementById("NAVmenuToggle");

        if (!menu || !toggle) return;

        const isOpen = menu.classList.toggle("active");

        toggle.setAttribute("aria-expanded", String(isOpen));
    };

    // ==========================================
    // INITIALIZATION
    // ==========================================

    async function init() {
        if (!token) {
            location.href = "login.html";
            return;
        }

        try {
            await loadProfile();

            await Promise.all([
                loadEvents(),
                loadPlaceholder("nav-placeholder", "navPlaceholder.html"),
                loadPlaceholder("footer-placeholder", "footerPlaceholder.html")
            ]);

        } catch (error) {
            console.error("Organizer dashboard failed:", error);

            showError(error.message);

            if (
                error.message.toLowerCase().includes("unauthorized") ||
                error.message.toLowerCase().includes("token") ||
                error.message.toLowerCase().includes("authentication")
            ) {
                localStorage.removeItem(TOKEN_KEY);
                location.href = "login.html";
            }
        }
    }

    init();

})();

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

        const headers = {
            Authorization: `Bearer ${token}`,
            ...options.headers
        };

        const response = await fetch(API_BASE + path, {
            ...options,
            headers
        });

        if (!response.ok) {

            let message = `Request failed (${response.status})`;

            try {
                const data = await response.json();
                message = data.message || message;
            } catch {}

            throw new Error(message);
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

        if (Number.isNaN(date.getTime())) {
            return "Invalid date";
        }

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


    // ==========================================
    // AUTHENTICATION / ORGANIZER PROFILE
    // ==========================================

    async function loadProfile() {

        const data = await apiFetch("/auth/me");

        currentUser = data;

        if (currentUser.role !== "organizer") {

            throw new Error(
                "This dashboard is only available to organizers."
            );

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

            event.createdBy,
            event.createdBy?.id

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
        const ownerIds = getOwnerIds(event);

        return ownerIds.some(id => myIds.includes(id));

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

        const total = organizerEvents.length;

        const upcoming = organizerEvents.filter(
            event => event.status === "upcoming"
        ).length;

        const ongoing = organizerEvents.filter(
            event => event.status === "ongoing"
        ).length;

        const completed = organizerEvents.filter(
            event => event.status === "completed"
        ).length;

        $("#total-events").textContent = total;
        $("#upcoming-events").textContent = upcoming;
        $("#ongoing-events").textContent = ongoing;
        $("#completed-events").textContent = completed;

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

        elements.events.innerHTML = "";

        elements.count.textContent =
            `${filtered.length} event${filtered.length !== 1 ? "s" : ""}`;

        elements.empty.hidden = filtered.length !== 0;

        filtered.sort((a, b) =>
            new Date(a.startDatetime) - new Date(b.startDatetime)
        );

        filtered.forEach(event => {

            elements.events.appendChild(createEventCard(event));

        });

    }


    function createEventCard(event) {

        const card = document.createElement("article");

        const status = event.status || "upcoming";

        card.className = `event-card event-card--${status}`;

        const registrations = event._count?.registrations ?? 0;

        const limit = event.participantLimit ?? "Unlimited";

        const category =
            event.category?.name || "Uncategorized";

        const image = event.images?.[0]?.filePath;

        const imageHTML = image
            ? `<img class="event-image"
                   src="${escapeHTML(FILES_BASE + image)}"
                   alt="${escapeHTML(event.title)}">`
            : "";

        let actionButtons = `
            <button class="btn btn-blue"
                data-action="images"
                data-id="${escapeHTML(event.id)}">
                Images
            </button>
        `;

        if (status === "upcoming") {

            actionButtons += `
                <button class="btn btn-primary"
                    data-action="start"
                    data-id="${escapeHTML(event.id)}">
                    Start Event
                </button>
            `;

        }

        if (status === "ongoing") {

            actionButtons += `
                <button class="btn btn-primary"
                    data-action="end"
                    data-id="${escapeHTML(event.id)}">
                    End Event
                </button>
            `;

        }

        if (status === "upcoming" || status === "ongoing") {

            actionButtons += `
                <button class="btn btn-secondary"
                    data-action="edit"
                    data-id="${escapeHTML(event.id)}">
                    Edit
                </button>
            `;

        }

        if (status !== "completed" && status !== "cancelled") {

            actionButtons += `
                <button class="btn btn-danger"
                    data-action="delete"
                    data-id="${escapeHTML(event.id)}">
                    Cancel / Delete
                </button>
            `;

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

            <p class="event-meta">
                Category: ${escapeHTML(category)}
            </p>

            <p class="event-meta">
                Venue: ${escapeHTML(event.venue || "Not specified")}
            </p>

            <p class="event-meta">
                Starts: ${escapeHTML(formatDate(event.startDatetime))}
            </p>

            <p class="event-meta">
                Ends: ${escapeHTML(formatDate(event.endDatetime))}
            </p>

            <p class="event-description">
                ${escapeHTML(event.description || "No description provided.")}
            </p>

            <div class="event-progress">
                <span>Registrations</span>
                <strong>
                    ${registrations} / ${escapeHTML(limit)}
                </strong>
            </div>

            <div class="event-actions">
                ${actionButtons}
            </div>
        `;

        return card;

    }


    // ==========================================
    // EVENT ACTIONS
    // ==========================================

    elements.events.addEventListener("click", async event => {

        const button = event.target.closest("[data-action]");

        if (!button) return;

        const action = button.dataset.action;
        const id = button.dataset.id;

        const selectedEvent = organizerEvents.find(
            item => String(item.id) === String(id)
        );

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

            }

        } catch (error) {

            alert(error.message);

        } finally {

            button.disabled = false;

        }

    });


    // ==========================================
    // START EVENT
    // ==========================================

    async function startEvent(id) {

        const confirmed = confirm(
            "Are you sure you want to start this event? Registration will close."
        );

        if (!confirmed) return;

        await apiFetch(`/events/${id}/start`, {
            method: "POST"
        });

        alert("Event successfully started!");

        await loadEvents();

    }


    // ==========================================
    // END EVENT
    // ==========================================

    async function endEvent(id) {

        const confirmed = confirm(
            "Are you sure you want to end this event? Check-in will close and certificates will become available to confirmed attendees."
        );

        if (!confirmed) return;

        await apiFetch(`/events/${id}/end`, {
            method: "POST"
        });

        alert("Event successfully completed!");

        await loadEvents();

    }


    // ==========================================
    // DELETE / CANCEL EVENT
    // ==========================================

    async function deleteEvent(event) {

        const confirmed = confirm(
            `Are you sure you want to delete "${event.title}"?\n\nEvents with registrants will be marked as cancelled instead.`
        );

        if (!confirmed) return;

        const result = await apiFetch(`/events/${event.id}`, {
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

        $("#edit-category").value =
            event.category?.id || event.categoryId || "";

        $("#edit-start").value =
            toLocalInput(event.startDatetime);

        $("#edit-end").value =
            toLocalInput(event.endDatetime);

        $("#edit-deadline").value =
            toLocalInput(event.registrationDeadline);

        $("#edit-limit").value =
            event.participantLimit ?? "";

        openModal("edit-modal");

    }


    $("#edit-form").addEventListener("submit", async event => {

        event.preventDefault();

        const id = $("#edit-id").value;

        const start = new Date($("#edit-start").value);
        const end = new Date($("#edit-end").value);
        const deadline = new Date($("#edit-deadline").value);

        const limit = Number($("#edit-limit").value);

        if (
            Number.isNaN(start.getTime()) ||
            Number.isNaN(end.getTime()) ||
            Number.isNaN(deadline.getTime())
        ) {

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

        const submitButton = event.submitter;

        submitButton.disabled = true;

        try {

            await apiFetch(`/events/${id}`, {

                method: "PATCH",

                headers: {
                    "Content-Type": "application/json"
                },

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

            gallery.innerHTML = `
                <p class="empty">No images uploaded yet.</p>
            `;

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

                const confirmed = confirm(
                    "Are you sure you want to delete this image?"
                );

                if (!confirmed) return;

                try {

                    button.disabled = true;

                    await apiFetch(
                        `/events/${event.id}/images/${image.id}`,
                        {
                            method: "DELETE"
                        }
                    );

                    await loadEvents();

                    const updatedEvent = organizerEvents.find(
                        item => String(item.id) === String(event.id)
                    );

                    if (updatedEvent) {
                        renderImageGallery(updatedEvent);
                    }

                } catch (error) {

                    alert(error.message);

                } finally {

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

        const event = organizerEvents.find(
            item => String(item.id) === String(id)
        );

        if (!event) return;

        if (files.length > 5) {

            alert("You can upload up to 5 images per request.");
            return;

        }

        if ((event.images?.length || 0) + files.length > 10) {

            alert("An event can have a maximum of 10 images.");
            return;

        }

        const allowedTypes = [
            "image/jpeg",
            "image/png",
            "image/webp"
        ];

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

        files.forEach(file => {
            formData.append("images", file);
        });

        const button = $("#upload-images");

        button.disabled = true;

        try {

            await apiFetch(`/events/${id}/images`, {

                method: "POST",

                body: formData

            });

            alert("Images uploaded successfully!");

            input.value = "";

            await loadEvents();

            const updatedEvent = organizerEvents.find(
                item => String(item.id) === String(id)
            );

            if (updatedEvent) {
                renderImageGallery(updatedEvent);
            }

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

        button.addEventListener("click", () => {

            closeModal(button.dataset.close);

        });

    });


    document.querySelectorAll(".modal").forEach(modal => {

        modal.addEventListener("click", event => {

            if (event.target === modal) {
                closeModal(modal.id);
            }

        });

    });


    // ==========================================
    // CREATE EVENT
    // ==========================================

    $("#create-event").addEventListener("click", () => {

        location.href = "create_eventpage.html";

    });


    // ==========================================
    // LOG OUT
    // ==========================================

    $("#logout-button").addEventListener("click", () => {

        const confirmed = confirm(
            "Are you sure you want to log out?"
        );

        if (!confirmed) return;

        localStorage.removeItem("token");
        localStorage.removeItem("user");

        location.href = "login.html";

    });


    // ==========================================
    // NAVIGATION AND FOOTER
    // ==========================================

    async function loadPlaceholder(elementId, file) {

        const element = document.getElementById(elementId);

        if (!element) return;

        try {

            const response = await fetch(file);

            if (!response.ok) {
                throw new Error(`Could not load ${file}`);
            }

            element.innerHTML = await response.text();

        } catch (error) {

            console.error(error);

        }

    }


    window.toggleMenu = function () {

        const menu = document.getElementById("NAVMenu");

        const toggle = document.getElementById("NAVmenuToggle");

        if (!menu || !toggle) return;

        const isOpen = menu.classList.toggle("active");

        toggle.setAttribute("aria-expanded", String(isOpen));

    };


    // ==========================================
    // INITIALIZATION
    // ==========================================

    async function init() {

        if (!token) {

            location.href = "login.html";
            return;

        }

        try {

            await loadProfile();

            await Promise.all([

                loadEvents(),

                loadPlaceholder(
                    "nav-placeholder",
                    "navPlaceholder.html"
                ),

                loadPlaceholder(
                    "footer-placeholder",
                    "footerPlaceholder.html"
                )

            ]);

        } catch (error) {

            console.error(
                "Organizer dashboard failed:",
                error
            );

            showError(error.message);

            if (
                error.message.toLowerCase().includes("unauthorized") ||
                error.message.toLowerCase().includes("token") ||
                error.message.toLowerCase().includes("authentication")
            ) {

                localStorage.removeItem(TOKEN_KEY);

                location.href = "login.html";

            }

        }

    }


    init();

})();
