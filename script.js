(() => {
  "use strict";

  const STORAGE_KEY = "skillswap-demo-v1";
  const SESSION_KEY = `${STORAGE_KEY}-session-user`;
  const seedState = () => ({
    currentUserId: null,
    students: [
      { id: "student-1", name: "Alex Morgan", email: "alex.morgan@campus.edu", offered: ["JavaScript", "UI Design"], wanted: ["Video Editing", "Photography"], category: "Programming", campus: "Computer Science · Year 2" },
      { id: "student-2", name: "Jordan Rivera", email: "jordan.rivera@campus.edu", offered: ["Figma", "Brand Identity"], wanted: ["React", "Python"], category: "Design", campus: "Visual Arts · Year 3" },
      { id: "student-3", name: "Samira Khan", email: "samira.khan@campus.edu", offered: ["Premiere Pro", "Color Grading"], wanted: ["Illustration", "JavaScript"], category: "Video Editing", campus: "Media Studies · Year 2" },
      { id: "student-4", name: "Theo Bennett", email: "theo.bennett@campus.edu", offered: ["Python", "Data Visualization"], wanted: ["Public Speaking", "Figma"], category: "Programming", campus: "Data Science · Year 3" },
      { id: "student-5", name: "Priya Nair", email: "priya.nair@campus.edu", offered: ["Portrait Photography", "Lightroom"], wanted: ["Motion Graphics", "HTML"], category: "Other", campus: "Communications · Year 1" },
      { id: "student-6", name: "Eli Chen", email: "eli.chen@campus.edu", offered: ["After Effects", "Motion Graphics"], wanted: ["Photography", "Python"], category: "Video Editing", campus: "Digital Media · Year 2" }
    ],
    requests: [
      { id: "request-1", fromId: "student-2", toId: "student-1", status: "pending", createdAt: Date.now() - 86400000 },
      { id: "request-2", fromId: "student-4", toId: "student-1", status: "accepted", createdAt: Date.now() - 172800000 }
    ]
  });

  const elements = {
    grid: document.querySelector("#student-grid"),
    empty: document.querySelector("#explore-empty"),
    search: document.querySelector("#search-input"),
    profile: document.querySelector("#profile-panel"),
    requestList: document.querySelector("#requests-list"),
    requestCount: document.querySelector("#request-count"),
    authModal: document.querySelector("#auth-modal"),
    loginForm: document.querySelector("#login-form"),
    registerForm: document.querySelector("#register-form"),
    exchangeModal: document.querySelector("#exchange-modal"),
    exchangeDetails: document.querySelector("#exchange-details"),
    exchangePlanForm: document.querySelector("#exchange-plan-form"),
    chatModal: document.querySelector("#chat-modal"),
    chatTitle: document.querySelector("#chat-title"),
    chatDetails: document.querySelector("#chat-details"),
    chatMessages: document.querySelector("#chat-messages"),
    chatForm: document.querySelector("#chat-form"),
    chatMessage: document.querySelector("#chat-message"),
    inboxModal: document.querySelector("#inbox-modal"),
    inboxConversations: document.querySelector("#inbox-conversations"),
    inboxUnreadTotal: document.querySelector("#inbox-unread-total"),
    inboxChatPlaceholder: document.querySelector("#inbox-chat-placeholder"),
    inboxChatContent: document.querySelector("#inbox-chat-content"),
    inboxChatTitle: document.querySelector("#inbox-chat-title"),
    inboxChatDetails: document.querySelector("#inbox-chat-details"),
    inboxChatMessages: document.querySelector("#inbox-chat-messages"),
    inboxChatForm: document.querySelector("#inbox-chat-form"),
    inboxChatMessage: document.querySelector("#inbox-chat-message"),
    authTitle: document.querySelector("#auth-title"),
    authSwitch: document.querySelector("#auth-switch"),
    toastRegion: document.querySelector("#toast-region"),
    navLinks: document.querySelector("#nav-links"),
    menuToggle: document.querySelector("#menu-toggle"),
    navActions: document.querySelector("#nav-actions")
  };
  let activeCategory = "All";
  let toastTimer;
  let previousFocus;
  let activeExchangeRequestId = null;
  let exchangePreviousFocus;
  let activeChatRequestId = null;
  let activeChatSurface = "modal";
  let chatPreviousFocus;
  let inboxPreviousFocus;
  let state = loadState();

  function loadState() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return seedState();
      const parsed = JSON.parse(saved);
      if (!parsed || !Array.isArray(parsed.students) || !Array.isArray(parsed.requests)) throw new Error("Saved demo data is incomplete.");
      const categories = new Set(["Programming", "Design", "Video Editing", "Other"]);
      const studentIds = new Set();
      for (const student of parsed.students) {
        if (!student || typeof student !== "object"
          || typeof student.id !== "string" || !student.id
          || typeof student.name !== "string" || !student.name.trim()
          || typeof student.email !== "string" || !student.email.trim()
          || !Array.isArray(student.offered) || !student.offered.every(skill => typeof skill === "string")
          || !Array.isArray(student.wanted) || !student.wanted.every(skill => typeof skill === "string")
          || !categories.has(student.category)) {
          throw new Error("Saved demo profile data is invalid.");
        }
        if (studentIds.has(student.id)) throw new Error("Saved demo profiles contain duplicate IDs.");
        studentIds.add(student.id);
      }
      const statuses = new Set(["pending", "accepted", "rejected"]);
      const requestIds = new Set();
      const messageIds = new Set();
      for (const request of parsed.requests) {
        const validMessages = request?.messages === undefined
          || (Array.isArray(request.messages) && request.messages.every(message => {
            if (!message || typeof message !== "object"
              || typeof message.id !== "string" || !message.id
              || ![request.fromId, request.toId].includes(message.senderId)
              || typeof message.text !== "string"
              || !Number.isFinite(message.createdAt)) return false;
            const recipientId = message.senderId === request.fromId ? request.toId : request.fromId;
            return (message.requestId === undefined || message.requestId === request.id)
              && (message.recipientId === undefined || message.recipientId === recipientId)
              && (message.readBy === undefined || (Array.isArray(message.readBy)
                && message.readBy.every(userId => [request.fromId, request.toId].includes(userId))));
          }));
        if (!request || typeof request !== "object"
          || typeof request.id !== "string" || !request.id
          || !studentIds.has(request.fromId) || !studentIds.has(request.toId)
          || request.fromId === request.toId
          || !statuses.has(request.status)
          || !Number.isFinite(request.createdAt)
          || (request.offeredSkills !== undefined
            && (!Array.isArray(request.offeredSkills) || !request.offeredSkills.every(skill => typeof skill === "string")))
          || (request.wantedSkills !== undefined
            && (!Array.isArray(request.wantedSkills) || !request.wantedSkills.every(skill => typeof skill === "string")))
          || (request.exchangePlan !== undefined
            && (!request.exchangePlan || typeof request.exchangePlan !== "object"
              || typeof request.exchangePlan.notes !== "string"
              || typeof request.exchangePlan.preferredDateTime !== "string"
              || !Number.isFinite(request.exchangePlan.updatedAt)))
          || !validMessages) {
          throw new Error("Saved exchange request data is invalid.");
        }
        if (requestIds.has(request.id)) throw new Error("Saved exchange requests contain duplicate IDs.");
        requestIds.add(request.id);
        if (Array.isArray(request.messages)) {
          request.messages = request.messages.map(message => {
            const recipientId = message.senderId === request.fromId ? request.toId : request.fromId;
            if (messageIds.has(message.id)) throw new Error("Saved chat messages contain duplicate IDs.");
            messageIds.add(message.id);
            return {
              ...message,
              requestId: request.id,
              recipientId,
              readBy: Array.isArray(message.readBy)
                ? [...new Set(message.readBy)]
                : [message.senderId]
            };
          });
        }
      }
      let sessionUserId = null;
      try {
        sessionUserId = sessionStorage.getItem(SESSION_KEY);
        if (sessionUserId === null && typeof parsed.sessionUserId === "string"
          && parsed.students.some(student => student.id === parsed.sessionUserId)) {
          sessionUserId = parsed.sessionUserId;
          sessionStorage.setItem(SESSION_KEY, sessionUserId);
        }
      } catch (error) {
        console.error("Unable to access the SkillSwap browser session:", error);
        showToast("Your browser could not restore this tab's login session. Please log in again.", "error");
      }
      parsed.currentUserId = parsed.students.some(student => student.id === sessionUserId) ? sessionUserId : null;
      return parsed;
    } catch (error) {
      console.error("Unable to load SkillSwap demo data:", error);
      showToast("Saved demo data could not be loaded. Reset demo data to start fresh.", "error");
      return seedState();
    }
  }

  function saveState() {
    let previousSessionUserId = null;
    try {
      previousSessionUserId = sessionStorage.getItem(SESSION_KEY);
      if (state.currentUserId) sessionStorage.setItem(SESSION_KEY, state.currentUserId);
      else sessionStorage.removeItem(SESSION_KEY);
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        ...state,
        currentUserId: null,
        sessionUserId: null
      }));
      return true;
    } catch (error) {
      try {
        if (previousSessionUserId) sessionStorage.setItem(SESSION_KEY, previousSessionUserId);
        else sessionStorage.removeItem(SESSION_KEY);
      } catch (restoreError) {
        console.error("Unable to restore the previous SkillSwap tab session:", restoreError);
      }
      console.error("Unable to save SkillSwap demo data:", error);
      showToast("Your browser could not save this change. Check your storage settings.", "error");
      return false;
    }
  }

  function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, char => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[char]);
  }

  function initials(name) {
    return name.trim().split(/\s+/).slice(0, 2).map(part => part[0]?.toUpperCase() || "").join("");
  }

  function getCurrentUser() {
    return state.students.find(student => student.id === state.currentUserId) || null;
  }

  function refreshState() {
    state = loadState();
  }

  function showToast(message, type = "success") {
    if (!elements.toastRegion) return;
    clearTimeout(toastTimer);
    elements.toastRegion.replaceChildren();
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.textContent = message;
    elements.toastRegion.append(toast);
    toastTimer = setTimeout(() => toast.remove(), 3800);
  }

  function renderStudents() {
    const query = elements.search.value.trim().toLocaleLowerCase();
    const currentId = state.currentUserId;
    const matchingStudents = state.students.filter(student => {
      if (student.id === currentId) return false;
      const matchesCategory = activeCategory === "All" || student.category === activeCategory;
      const searchable = [student.name, student.campus, student.category, ...student.offered, ...student.wanted].join(" ").toLocaleLowerCase();
      return matchesCategory && searchable.includes(query);
    });

    elements.grid.innerHTML = matchingStudents.map((student, index) => {
      const offerTags = student.offered.map(skill => `<span class="skill-tag">${escapeHTML(skill)}</span>`).join("");
      const wantedTags = student.wanted.map(skill => `<span class="skill-tag wanted">${escapeHTML(skill)}</span>`).join("");
      return `<article class="student-card">
        <div class="student-top">
          <div class="student-avatar avatar-${index % 5}">${escapeHTML(initials(student.name))}</div>
          <div><h3 class="student-name">${escapeHTML(student.name)}</h3><div class="student-meta">${escapeHTML(student.campus)}</div></div>
          <span class="online-dot" title="Student profile" aria-label="Student profile"></span>
        </div>
        <div class="skill-row"><span class="skill-row-label">Can teach</span><div class="skill-tags">${offerTags}</div></div>
        <div class="skill-row"><span class="skill-row-label">Wants to learn</span><div class="skill-tags">${wantedTags}</div></div>
        <div class="student-footer"><span class="category-label">${escapeHTML(student.category)}</span><button class="button button-primary connect-button" type="button" data-connect="${escapeHTML(student.id)}">Connect <span aria-hidden="true">→</span></button></div>
      </article>`;
    }).join("");
    elements.empty.hidden = matchingStudents.length > 0;
    elements.grid.hidden = matchingStudents.length === 0;
  }

  function renderProfile() {
    const user = getCurrentUser();
    if (!user) {
      elements.profile.innerHTML = `<div class="profile-cover"></div><div class="profile-name">No active profile</div><p class="profile-note">Log in or create an account to manage your skills and exchange requests.</p><button class="button button-primary button-full" data-open-auth="login">Log in</button>`;
      return;
    }
    const offered = user.offered.map(skill => `<span class="skill-tag">${escapeHTML(skill)}</span>`).join("");
    const wanted = user.wanted.map(skill => `<span class="skill-tag wanted">${escapeHTML(skill)}</span>`).join("");
    elements.profile.innerHTML = `<div class="profile-cover"></div>
      <div class="dashboard-avatar">${escapeHTML(initials(user.name))}</div>
      <h3 class="profile-name">${escapeHTML(user.name)}</h3><div class="profile-email">${escapeHTML(user.email)}</div>
      <div class="profile-divider"></div><div class="profile-section-title">Skills I can teach</div><div class="skill-tags">${offered || '<span class="profile-email">Add a skill to get started.</span>'}</div>
      <div class="profile-section-title">Skills I want to learn</div><div class="skill-tags">${wanted || '<span class="profile-email">Add a learning goal.</span>'}</div>
      <p class="profile-note">Primary category · ${escapeHTML(user.category)}<br>${escapeHTML(user.campus || "Student community member")}</p>`;
  }

  function renderRequests() {
    const user = getCurrentUser();
    if (!user) {
      elements.requestCount.textContent = "0";
      elements.requestCount.dataset.unread = "0";
      elements.requestList.innerHTML = '<div class="requests-empty">Log in to view your exchange requests.</div>';
      return;
    }
    const received = state.requests.filter(request => request.toId === user.id)
      .sort((a, b) => b.createdAt - a.createdAt);
    const sent = state.requests.filter(request => request.fromId === user.id)
      .sort((a, b) => b.createdAt - a.createdAt);
    elements.requestCount.textContent = String(received.filter(request => request.status === "pending").length);
    const unreadCount = state.requests.reduce((total, request) =>
      total + (request.messages || []).filter(message =>
        message.recipientId === user.id && !message.readBy?.includes(user.id)).length, 0);
    elements.requestCount.dataset.unread = String(unreadCount);

    const renderGroup = (title, requests, incoming) => {
      const items = requests.map(request => {
        const sender = state.students.find(student => student.id === request.fromId);
        const recipient = state.students.find(student => student.id === request.toId);
        if (!sender || !recipient) return "";
        const offeredSkills = Array.isArray(request.offeredSkills) ? request.offeredSkills : sender.offered;
        const wantedSkills = Array.isArray(request.wantedSkills) ? request.wantedSkills : sender.wanted;
        const requestDate = new Date(request.createdAt);
        const formattedDate = Number.isNaN(requestDate.getTime())
          ? "Date unavailable"
          : new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(requestDate);
        const preferredDateTime = request.exchangePlan?.preferredDateTime
          ? new Date(request.exchangePlan.preferredDateTime)
          : null;
        const formattedPreferredDateTime = preferredDateTime && !Number.isNaN(preferredDateTime.getTime())
          ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(preferredDateTime)
          : "";
        const savedPlan = request.exchangePlan
          ? `<span class="request-plan-detail"><b>Exchange plan:</b> ${formattedPreferredDateTime ? `Meet ${escapeHTML(formattedPreferredDateTime)}` : "Date not set"}${request.exchangePlan.notes ? ` · ${escapeHTML(request.exchangePlan.notes)}` : ""}</span>`
          : "";
        const status = request.status;
        const statusLabel = status === "pending" ? "Pending" : escapeHTML(status[0].toUpperCase() + status.slice(1));
        const unread = (request.messages || []).filter(message =>
          message.requestId === request.id
          && message.recipientId === user.id
          && !message.readBy?.includes(user.id)).length;
        const unreadBadge = unread
          ? `<span class="chat-unread" aria-label="${unread} unread message${unread === 1 ? "" : "s"}">${unread}</span>`
          : "";
        const actions = status === "pending" && incoming
          ? `<div class="request-actions"><button class="request-action accept" type="button" data-request-action="accepted" data-request-id="${escapeHTML(request.id)}">Accept</button><button class="request-action reject" type="button" data-request-action="rejected" data-request-id="${escapeHTML(request.id)}">Reject</button></div>`
          : `<div class="request-actions"><span class="request-status ${escapeHTML(status)}">${statusLabel}</span>${status === "accepted" ? `<button class="request-action start-exchange" type="button" data-start-exchange="${escapeHTML(request.id)}">Start Exchange</button><button class="request-action chat-action" type="button" data-open-chat="${escapeHTML(request.id)}" aria-label="Chat with ${escapeHTML(incoming ? sender.name : recipient.name)}${unread ? `, ${unread} unread messages` : ""}">Chat${unreadBadge}</button>` : ""}</div>`;
        return `<article class="request-item">
          <div class="request-avatar">${escapeHTML(initials(incoming ? sender.name : recipient.name))}</div>
          <div class="request-copy">
            <strong>${incoming
              ? `${escapeHTML(sender.name)} sent you a request`
              : `To: ${escapeHTML(recipient.name)}`}</strong>
            <span><b>Sender:</b> ${escapeHTML(sender.name)} · <b>Recipient:</b> ${escapeHTML(recipient.name)}</span>
            <span><b>Skills offered:</b> ${escapeHTML(offeredSkills.join(", ") || "Not specified")}</span>
            <span><b>Skills wanted:</b> ${escapeHTML(wantedSkills.join(", ") || "Not specified")}</span>
            <span class="request-date">Sent ${escapeHTML(formattedDate)}</span>
            ${savedPlan}
          </div>
          ${actions}
        </article>`;
      }).join("");
      return `<section class="request-group" aria-label="${title}">
        <h4 class="request-group-title">${title}<span>${requests.length}</span></h4>
        ${items || `<div class="requests-empty">${incoming
          ? "No requests received yet."
          : "You have not sent any requests yet."}</div>`}
      </section>`;
    };

    elements.requestList.innerHTML = `${renderGroup("Received Requests", received, true)}${renderGroup("Sent Requests", sent, false)}`;
  }

  function render() {
    renderStudents();
    renderProfile();
    renderRequests();
    renderNavigation();
    document.querySelector("#hero-student-count").textContent = String(state.students.length);
    if (!elements.inboxModal.hidden) renderInbox();
  }

  function renderNavigation() {
    const user = getCurrentUser();
    if (!user) {
      elements.navActions.classList.remove("authenticated");
      elements.navActions.innerHTML = `
        <button class="button button-quiet" type="button" data-open-auth="login">Log in</button>
        <button class="button button-primary button-small" type="button" data-open-auth="register">Register <span aria-hidden="true">→</span></button>`;
      return;
    }
    elements.navActions.classList.add("authenticated");
    const unread = getUnreadMessageCount(user.id);
    elements.navActions.innerHTML = `
      <span class="nav-user-name">${escapeHTML(user.name)}</span>
      <button class="inbox-nav-button" type="button" data-open-inbox aria-label="Open chat inbox${unread ? `, ${unread} unread messages` : ""}" title="Chat inbox">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H5l1.8-3.1A7.5 7.5 0 1 1 20 11.5Z"></path><path d="M8.5 11.5h7"></path></svg>
        <span class="inbox-nav-badge"${unread ? "" : " hidden"}>${unread > 99 ? "99+" : unread}</span>
      </button>
      <a class="button button-quiet dashboard-link" href="#dashboard">Dashboard</a>
      <button class="button button-primary button-small" type="button" data-logout>Log out</button>`;
  }

  function navigateHome() {
    if (window.location.hash !== "#home") window.location.hash = "home";
    document.querySelector("#home").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function setAuthTab(tab) {
    const registering = tab === "register";
    elements.loginForm.hidden = registering;
    elements.registerForm.hidden = !registering;
    elements.loginForm.querySelector('input[type="password"]').value = "";
    elements.registerForm.querySelector('input[type="password"]').value = "";
    elements.authTitle.textContent = registering ? "Create your profile" : "Welcome to SkillSwap";
    document.querySelectorAll("[data-auth-tab]").forEach(button => {
      const selected = button.dataset.authTab === tab;
      button.classList.toggle("active", selected);
      if (button.getAttribute("role") === "tab") button.setAttribute("aria-selected", String(selected));
    });
    elements.authSwitch.innerHTML = registering
      ? 'Already have a profile? <button type="button" data-auth-tab="login">Log in</button>'
      : 'New to SkillSwap? <button type="button" data-auth-tab="register">Create an account</button>';
  }

  function openAuth(tab = "login") {
    previousFocus = document.activeElement;
    elements.authModal.hidden = false;
    setAuthTab(tab);
    const firstInput = (tab === "register" ? elements.registerForm : elements.loginForm).querySelector("input");
    firstInput?.focus();
    elements.navLinks.classList.remove("open");
    elements.menuToggle.setAttribute("aria-expanded", "false");
    elements.menuToggle.setAttribute("aria-label", "Open navigation menu");
  }

  function closeAuth() {
    elements.authModal.hidden = true;
    elements.loginForm.querySelector('input[type="password"]').value = "";
    elements.registerForm.querySelector('input[type="password"]').value = "";
    previousFocus?.focus();
  }

  function makeId(prefix) {
    let id;
    do {
      id = `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    } while (state && (
      state.students.some(student => student.id === id)
      || state.requests.some(request => request.id === id || request.messages?.some(message => message.id === id))
    ));
    return id;
  }

  document.addEventListener("click", event => {
    const authButton = event.target.closest("[data-open-auth]");
    if (authButton) openAuth(authButton.dataset.openAuth);

    const tabButton = event.target.closest("[data-auth-tab]");
    if (tabButton) setAuthTab(tabButton.dataset.authTab);

    if (event.target.closest("[data-close-modal]") || event.target === elements.authModal) closeAuth();

    const categoryButton = event.target.closest("[data-category]");
    if (categoryButton) {
      activeCategory = categoryButton.dataset.category;
      document.querySelectorAll(".filter-chip").forEach(button => {
        const selected = button === categoryButton;
        button.classList.toggle("active", selected);
        button.setAttribute("aria-pressed", String(selected));
      });
      renderStudents();
    }

    const connectButton = event.target.closest("[data-connect]");
    if (connectButton) {
      refreshState();
      const user = getCurrentUser();
      if (!user) {
        showToast("Log in to send a skill exchange request.", "error");
        openAuth("login");
        return;
      }
      const targetId = connectButton.dataset.connect;
      if (targetId === user.id) {
        showToast("You cannot send an exchange request to yourself.", "error");
        return;
      }
      const recipient = state.students.find(student => student.id === targetId);
      if (!recipient) {
        showToast("This student profile is no longer available.", "error");
        return;
      }
      const offeredSkills = [...user.offered];
      const wantedSkills = [...user.wanted];
      const existing = state.requests.find(request =>
        request.fromId === user.id
        && request.toId === targetId
        && request.status === "pending");
      if (existing) {
        showToast("You already have a pending request with this student.", "error");
        return;
      }
      const request = {
        id: makeId("request"),
        fromId: user.id,
        toId: targetId,
        offeredSkills,
        wantedSkills,
        status: "pending",
        createdAt: Date.now()
      };
      state.requests.push(request);
      if (saveState()) {
        render();
        showToast("Connection request sent. Happy skill swapping!");
      } else {
        state.requests = state.requests.filter(item => item.id !== request.id);
      }
    }

    const requestAction = event.target.closest("[data-request-action]");
    if (requestAction) {
      refreshState();
      const request = state.requests.find(item => item.id === requestAction.dataset.requestId);
      const user = getCurrentUser();
      const nextStatus = requestAction.dataset.requestAction;
      if (!user || !request || request.fromId === user.id || request.toId !== user.id || request.status !== "pending"
        || !["accepted", "rejected"].includes(nextStatus)) {
        render();
        showToast("This request is no longer available.", "error");
        return;
      }
      const previousStatus = request.status;
      request.status = nextStatus;
      if (saveState()) {
        render();
        showToast(request.status === "accepted"
          ? "Skill exchange request accepted successfully!"
          : "Skill exchange request rejected.");
      } else {
        request.status = previousStatus;
        render();
      }
    }

    const startExchangeButton = event.target.closest("[data-start-exchange]");
    if (startExchangeButton) {
      refreshState();
      const request = state.requests.find(item => item.id === startExchangeButton.dataset.startExchange);
      if (!request || request.status !== "accepted"
        || (request.fromId !== state.currentUserId && request.toId !== state.currentUserId)) {
        showToast("Only participants can start an accepted exchange.", "error");
        return;
      }
      openExchangePlan(request, startExchangeButton);
    }

    const chatButton = event.target.closest("[data-open-chat]");
    if (chatButton) {
      refreshState();
      const request = state.requests.find(item => item.id === chatButton.dataset.openChat);
      const user = getCurrentUser();
      if (!user || !request || request.status !== "accepted"
        || (request.fromId !== user.id && request.toId !== user.id)) {
        showToast("Chat is only available to participants in an accepted exchange.", "error");
        render();
        return;
      }
      openChat(request, chatButton);
    }

    const inboxButton = event.target.closest("[data-open-inbox]");
    if (inboxButton) openInbox(inboxButton);

    const inboxConversation = event.target.closest("[data-inbox-conversation]");
    if (inboxConversation) openInboxConversation(inboxConversation.dataset.inboxConversation);

    if (event.target.closest("[data-close-inbox]") || event.target === elements.inboxModal) {
      closeInbox();
    }

    if (event.target.closest("[data-close-chat]") || event.target === elements.chatModal) {
      closeChat();
    }

    if (event.target.closest("[data-close-exchange]") || event.target === elements.exchangeModal) {
      closeExchangePlan();
    }

    if (event.target.closest("#clear-search")) {
      elements.search.value = "";
      activeCategory = "All";
      document.querySelectorAll(".filter-chip").forEach(button => {
        const selected = button.dataset.category === "All";
        button.classList.toggle("active", selected);
        button.setAttribute("aria-pressed", String(selected));
      });
      renderStudents();
    }

    if (event.target.closest("#reset-demo")) {
      if (!window.confirm("Reset all SkillSwap demo profiles, skills and exchange requests to the original sample data? This cannot be undone.")) return;
      state = seedState();
      if (saveState()) {
        activeCategory = "All";
        elements.search.value = "";
        document.querySelectorAll(".filter-chip").forEach(button => {
          const selected = button.dataset.category === "All";
          button.classList.toggle("active", selected);
          button.setAttribute("aria-pressed", String(selected));
        });
        render();
        showToast("Demo data has been reset to the original sample profiles.");
      }
    }

    if (event.target.closest("#menu-toggle")) {
      const opened = elements.navLinks.classList.toggle("open");
      elements.menuToggle.setAttribute("aria-expanded", String(opened));
      elements.menuToggle.setAttribute("aria-label", opened ? "Close navigation menu" : "Open navigation menu");
    }
    if (event.target.closest("#nav-links a")) {
      elements.navLinks.classList.remove("open");
      elements.menuToggle.setAttribute("aria-expanded", "false");
      elements.menuToggle.setAttribute("aria-label", "Open navigation menu");
    }

    if (event.target.closest("[data-logout]")) {
      refreshState();
      state.currentUserId = null;
      if (saveState()) {
        if (!elements.chatModal.hidden) closeChat();
        elements.navLinks.classList.remove("open");
        elements.menuToggle.setAttribute("aria-expanded", "false");
        elements.menuToggle.setAttribute("aria-label", "Open navigation menu");
        render();
        navigateHome();
        showToast("You have been logged out. Your saved skills and requests are unchanged.");
      }
    }
  });

  elements.search.addEventListener("input", renderStudents);
  document.querySelector("#current-year").textContent = String(new Date().getFullYear());

  document.querySelector("#skill-form").addEventListener("submit", event => {
    event.preventDefault();
    const user = getCurrentUser();
    if (!user) {
      showToast("Log in to add skills to your profile.", "error");
      openAuth("login");
      return;
    }
    const formData = new FormData(event.currentTarget);
    const offered = String(formData.get("offered")).split(",").map(skill => skill.trim()).filter(Boolean);
    const wanted = String(formData.get("wanted")).split(",").map(skill => skill.trim()).filter(Boolean);
    if (!offered.length || !wanted.length) {
      showToast("Add at least one skill to teach and one skill to learn.", "error");
      return;
    }
    user.offered = [...new Set([...user.offered, ...offered])];
    user.wanted = [...new Set([...user.wanted, ...wanted])];
    user.category = String(formData.get("category"));
    if (saveState()) {
      event.currentTarget.reset();
      render();
      showToast("Your skills have been added to your profile.");
    }
  });

  elements.loginForm.addEventListener("submit", event => {
    event.preventDefault();
    refreshState();
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email")).trim().toLocaleLowerCase();
    const student = state.students.find(item => item.email.toLocaleLowerCase() === email);
    if (!student) {
      showToast("We couldn't find that demo profile. Register to create one.", "error");
      return;
    }
    state.currentUserId = student.id;
    if (saveState()) {
      closeAuth();
      render();
      navigateHome();
      showToast(`Welcome back, ${student.name.split(" ")[0]}!`);
    }
  });

  elements.registerForm.addEventListener("submit", event => {
    event.preventDefault();
    refreshState();
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email")).trim();
    if (state.students.some(student => student.email.toLocaleLowerCase() === email.toLocaleLowerCase())) {
      showToast("A profile with that email already exists. Log in instead.", "error");
      return;
    }
    const student = {
      id: makeId("student"),
      name: String(formData.get("name")).trim(),
      email,
      offered: String(formData.get("offered")).split(",").map(skill => skill.trim()).filter(Boolean),
      wanted: String(formData.get("wanted")).split(",").map(skill => skill.trim()).filter(Boolean),
      category: String(formData.get("category")),
      campus: "Student community member"
    };
    if (!student.name || !student.offered.length || !student.wanted.length) {
      showToast("Please enter your name and at least one skill to teach and learn.", "error");
      return;
    }
    state.students.push(student);
    state.currentUserId = student.id;
    if (saveState()) {
      event.currentTarget.reset();
      closeAuth();
      render();
      navigateHome();
      showToast(`Your profile is ready, ${student.name.split(" ")[0]}!`);
    }
  });

  function openExchangePlan(request, trigger) {
    const sender = state.students.find(student => student.id === request.fromId);
    const recipient = state.students.find(student => student.id === request.toId);
    if (!sender || !recipient || request.status !== "accepted") {
      showToast("This exchange is not available to start.", "error");
      return;
    }
    activeExchangeRequestId = request.id;
    exchangePreviousFocus = trigger;
    const offeredSkills = Array.isArray(request.offeredSkills) ? request.offeredSkills : sender.offered;
    const wantedSkills = Array.isArray(request.wantedSkills) ? request.wantedSkills : sender.wanted;
    elements.exchangeDetails.innerHTML = `
      <div class="exchange-participants"><span><b>Students</b>${escapeHTML(sender.name)} + ${escapeHTML(recipient.name)}</span></div>
      <div class="exchange-skill-grid">
        <div><b>Skills offered</b><span>${escapeHTML(offeredSkills.join(", ") || "Not specified")}</span></div>
        <div><b>Skills wanted</b><span>${escapeHTML(wantedSkills.join(", ") || "Not specified")}</span></div>
      </div>
      <p class="exchange-plan-hint">Plan a time to meet, decide what you’ll work on, and add any notes to share with each other.</p>`;
    elements.exchangePlanForm.elements.preferredDateTime.value = request.exchangePlan?.preferredDateTime || "";
    elements.exchangePlanForm.elements.notes.value = request.exchangePlan?.notes || "";
    elements.exchangeModal.hidden = false;
    elements.exchangePlanForm.elements.preferredDateTime.focus();
    showToast("Exchange details are ready. Add a date and notes to share your plan.");
  }

  function closeExchangePlan() {
    elements.exchangeModal.hidden = true;
    activeExchangeRequestId = null;
    exchangePreviousFocus?.focus();
  }

  elements.exchangePlanForm.addEventListener("submit", event => {
    event.preventDefault();
    refreshState();
    const request = state.requests.find(item => item.id === activeExchangeRequestId);
    if (!request || request.status !== "accepted"
      || (request.fromId !== state.currentUserId && request.toId !== state.currentUserId)) {
      closeExchangePlan();
      showToast("This exchange is no longer available to update.", "error");
      return;
    }
    const previousPlan = request.exchangePlan;
    request.exchangePlan = {
      preferredDateTime: elements.exchangePlanForm.elements.preferredDateTime.value,
      notes: elements.exchangePlanForm.elements.notes.value.trim(),
      updatedAt: Date.now()
    };
    if (saveState()) {
      render();
      closeExchangePlan();
      showToast("Exchange plan saved. Both students can see the updated details.");
    } else {
      request.exchangePlan = previousPlan;
    }
  });

  function renderChat(request, surface = activeChatSurface) {
    const user = getCurrentUser();
    const sender = state.students.find(student => student.id === request.fromId);
    const recipient = state.students.find(student => student.id === request.toId);
    if (!user || !sender || !recipient || request.status !== "accepted"
      || (request.fromId !== user.id && request.toId !== user.id)) {
      return false;
    }
    const otherStudent = request.fromId === user.id ? recipient : sender;
    const offeredSkills = Array.isArray(request.offeredSkills) ? request.offeredSkills : sender.offered;
    const wantedSkills = Array.isArray(request.wantedSkills) ? request.wantedSkills : sender.wanted;
    const target = surface === "inbox"
      ? { title: elements.inboxChatTitle, details: elements.inboxChatDetails, messages: elements.inboxChatMessages }
      : { title: elements.chatTitle, details: elements.chatDetails, messages: elements.chatMessages };
    target.title.textContent = `Chat with ${otherStudent.name}`;
    target.details.innerHTML = `
      <div class="exchange-participants"><span><b>Students</b>${escapeHTML(sender.name)} + ${escapeHTML(recipient.name)}</span></div>
      <div class="exchange-skill-grid">
        <div><b>Skills offered</b><span>${escapeHTML(offeredSkills.join(", ") || "Not specified")}</span></div>
        <div><b>Skills wanted</b><span>${escapeHTML(wantedSkills.join(", ") || "Not specified")}</span></div>
      </div>`;
    const messages = Array.isArray(request.messages)
      ? request.messages.filter(message =>
        message.requestId === request.id
        && [request.fromId, request.toId].includes(message.senderId)
        && message.recipientId === (message.senderId === request.fromId ? request.toId : request.fromId))
        .sort((a, b) => a.createdAt - b.createdAt)
      : [];
    target.messages.innerHTML = messages.length
      ? messages.map(message => {
        const author = state.students.find(student => student.id === message.senderId);
        const messageDate = new Date(message.createdAt);
        const time = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(messageDate);
        return `<article class="chat-message${message.senderId === user.id ? " own" : ""}">
          <span class="chat-message-author">${escapeHTML(author?.name || "Student")}</span>
          <div class="chat-message-text">${escapeHTML(message.text)}</div>
          <time class="chat-message-time" datetime="${escapeHTML(messageDate.toISOString())}">${escapeHTML(time)}</time>
        </article>`;
      }).join("")
      : '<p class="chat-empty">No messages yet. Start the conversation!</p>';
    if (surface === "inbox") {
      elements.inboxChatPlaceholder.hidden = true;
      elements.inboxChatContent.hidden = false;
    }
    scrollChatToLatest(surface);
    return true;
  }

  function scrollChatToLatest(surface = activeChatSurface) {
    const messages = surface === "inbox" ? elements.inboxChatMessages : elements.chatMessages;
    messages.scrollTop = messages.scrollHeight + 1;
  }

  function openChat(request, trigger) {
    refreshState();
    request = state.requests.find(item => item.id === request.id);
    const user = getCurrentUser();
    if (!request || !user || request.status !== "accepted"
      || (request.fromId !== user.id && request.toId !== user.id)) {
      render();
      showToast("This exchange chat is no longer available.", "error");
      return;
    }
    const changed = markChatRead(request, user.id);
    if (changed && !saveState()) {
      refreshState();
      request = state.requests.find(item => item.id === activeChatRequestId);
      render();
      showToast("The chat opened, but read status could not be saved.", "error");
    }
    if (!request) return;
    activeChatSurface = "modal";
    if (!renderChat(request, "modal")) {
      showToast("This exchange chat is no longer available.", "error");
      return;
    }
    render();
    activeChatRequestId = request.id;
    chatPreviousFocus = trigger;
    elements.chatModal.hidden = false;
    scrollChatToLatest("modal");
    requestAnimationFrame(() => {
      if (activeChatRequestId === request.id) scrollChatToLatest("modal");
    });
    elements.chatMessage.focus();
  }

  function getUnreadMessageCount(userId, requestId) {
    return state.requests
      .filter(request => request.status === "accepted"
        && (request.fromId === userId || request.toId === userId)
        && (!requestId || request.id === requestId))
      .reduce((total, request) => total + (Array.isArray(request.messages)
        ? request.messages.filter(message => message.requestId === request.id
          && message.recipientId === userId
          && !message.readBy.includes(userId)).length
        : 0), 0);
  }

  function formatChatDate(timestamp) {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(timestamp);
  }

  function renderInbox() {
    const user = getCurrentUser();
    if (!user) {
      elements.inboxModal.hidden = true;
      return;
    }
    const conversations = state.requests
      .filter(request => request.status === "accepted"
        && (request.fromId === user.id || request.toId === user.id))
      .sort((a, b) => {
        const latestA = (a.messages || []).reduce((latest, message) => Math.max(latest, message.createdAt), a.createdAt);
        const latestB = (b.messages || []).reduce((latest, message) => Math.max(latest, message.createdAt), b.createdAt);
        return latestB - latestA;
      });
    const unreadTotal = getUnreadMessageCount(user.id);
    elements.inboxUnreadTotal.textContent = unreadTotal > 99 ? "99+" : String(unreadTotal);
    elements.inboxUnreadTotal.hidden = unreadTotal === 0;
    elements.inboxConversations.innerHTML = conversations.length
      ? conversations.map(request => {
        const partnerId = request.fromId === user.id ? request.toId : request.fromId;
        const partner = state.students.find(student => student.id === partnerId);
        const messages = (request.messages || []).filter(message => message.requestId === request.id)
          .sort((a, b) => a.createdAt - b.createdAt);
        const latest = messages[messages.length - 1];
        const unread = getUnreadMessageCount(user.id, request.id);
        const latestTime = latest ? latest.createdAt : request.createdAt;
        return `<button class="inbox-conversation${activeChatRequestId === request.id ? " active" : ""}" type="button" data-inbox-conversation="${escapeHTML(request.id)}" aria-current="${activeChatRequestId === request.id ? "true" : "false"}">
          <span class="inbox-conversation-avatar">${escapeHTML(initials(partner?.name || "Student"))}</span>
          <span class="inbox-conversation-copy">
            <span class="inbox-conversation-top"><strong>${escapeHTML(partner?.name || "Student")}</strong><time datetime="${escapeHTML(new Date(latestTime).toISOString())}">${escapeHTML(formatChatDate(latestTime))}</time></span>
            <span class="inbox-conversation-preview">${escapeHTML(latest ? latest.text : "No messages yet — say hello!")}</span>
          </span>
          ${unread ? `<span class="inbox-conversation-unread" aria-label="${unread} unread messages">${unread > 99 ? "99+" : unread}</span>` : ""}
        </button>`;
      }).join("")
      : '<div class="inbox-empty"><span class="inbox-empty-icon" aria-hidden="true">☏</span><strong>No conversations yet</strong><p>A chat becomes available here after a skill exchange request is accepted.</p></div>';

    const selected = conversations.find(request => request.id === activeChatRequestId);
    if (selected && activeChatSurface === "inbox") {
      renderChat(selected, "inbox");
    } else {
      elements.inboxChatContent.hidden = true;
      elements.inboxChatPlaceholder.hidden = false;
      elements.inboxChatPlaceholder.textContent = conversations.length
        ? "Choose a conversation to view messages."
        : "Accept a skill exchange request to start chatting.";
    }
  }

  function openInbox(trigger) {
    refreshState();
    const user = getCurrentUser();
    if (!user) {
      showToast("Log in to open your chat inbox.", "error");
      openAuth("login");
      return;
    }
    activeChatRequestId = null;
    activeChatSurface = "inbox";
    inboxPreviousFocus = trigger;
    elements.inboxModal.hidden = false;
    renderInbox();
    requestAnimationFrame(() => elements.inboxModal.querySelector("[data-close-inbox]").focus());
  }

  function openInboxConversation(requestId) {
    refreshState();
    const user = getCurrentUser();
    const request = state.requests.find(item => item.id === requestId);
    if (!user || !request || request.status !== "accepted"
      || (request.fromId !== user.id && request.toId !== user.id)) {
      renderInbox();
      showToast("This accepted exchange conversation is no longer available.", "error");
      return;
    }
    activeChatSurface = "inbox";
    activeChatRequestId = request.id;
    if (markChatRead(request, user.id) && !saveState()) {
      refreshState();
      renderInbox();
      showToast("Conversation opened, but read status could not be saved.", "error");
      return;
    }
    render();
    elements.inboxChatMessage.focus();
  }

  function markChatRead(request, userId) {
    if (!Array.isArray(request.messages)) return false;
    let changed = false;
    for (const message of request.messages) {
      if (message.requestId === request.id && message.recipientId === userId
        && !message.readBy.includes(userId)) {
        message.readBy.push(userId);
        changed = true;
      }
    }
    return changed;
  }

  function closeChat() {
    elements.chatModal.hidden = true;
    activeChatRequestId = null;
    chatPreviousFocus?.focus();
  }

  function closeInbox() {
    elements.inboxModal.hidden = true;
    if (activeChatSurface === "inbox") activeChatRequestId = null;
    inboxPreviousFocus?.focus();
    renderNavigation();
  }

  function sendChatMessage(event, input, surface) {
    event.preventDefault();
    refreshState();
    const user = getCurrentUser();
    const request = state.requests.find(item => item.id === activeChatRequestId);
    if (!user || !request || request.status !== "accepted"
      || (request.fromId !== user.id && request.toId !== user.id)) {
      closeChat();
      closeInbox();
      render();
      showToast("This exchange chat is no longer available.", "error");
      return;
    }
    const text = input.value.trim();
    if (!text) {
      showToast("Enter a message before sending.", "error");
      input.focus();
      return;
    }
    const recipientId = request.fromId === user.id ? request.toId : request.fromId;
    const message = {
      id: makeId("message"),
      requestId: request.id,
      senderId: user.id,
      recipientId,
      text,
      createdAt: Date.now(),
      readBy: [user.id]
    };
    if (!Array.isArray(request.messages)) request.messages = [];
    request.messages.push(message);
    if (saveState()) {
      input.value = "";
      render();
      renderChat(request, surface);
      input.focus();
      showToast("Message sent.");
    } else {
      request.messages = request.messages.filter(item => item.id !== message.id);
    }
  }

  elements.chatForm.addEventListener("submit", event => sendChatMessage(event, elements.chatMessage, "modal"));
  elements.inboxChatForm.addEventListener("submit", event => sendChatMessage(event, elements.inboxChatMessage, "inbox"));

  [elements.chatMessage, elements.inboxChatMessage].forEach(input => input.addEventListener("keydown", event => {
    if (event.key === "Enter" && !event.isComposing) {
      event.preventDefault();
      input.form.requestSubmit();
    }
  }));

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !elements.authModal.hidden) closeAuth();
    if (event.key === "Escape" && !elements.exchangeModal.hidden) closeExchangePlan();
    if (event.key === "Escape" && !elements.chatModal.hidden) closeChat();
    if (event.key === "Escape" && !elements.inboxModal.hidden) closeInbox();
  });

  window.addEventListener("storage", event => {
    if (event.key !== STORAGE_KEY && event.key !== null) return;
    state = loadState();
    render();
    if (activeChatRequestId) {
      const request = state.requests.find(item => item.id === activeChatRequestId);
      const user = getCurrentUser();
      if (!request || !user || !renderChat(request)) {
        if (activeChatSurface === "inbox") closeInbox();
        else closeChat();
        return;
      }
      if (markChatRead(request, user.id)) {
        if (saveState()) render();
        else {
          refreshState();
          render();
          showToast("New chat messages arrived, but read status could not be saved.", "error");
          return;
        }
      }
      renderChat(request, activeChatSurface);
    }
  });

  render();
})();