import { getApp, getApps, initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import {
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
  updateProfile
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import {
  arrayUnion,
  collection,
  doc,
  getFirestore,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

(() => {
  "use strict";

  const firebaseConfig = {
    apiKey: "AIzaSyBqme_aqSVYYEjz0tOMoR06t7G5HzkAN90",
    authDomain: "skillswap-2ef10.firebaseapp.com",
    projectId: "skillswap-2ef10",
    storageBucket: "skillswap-2ef10.firebasestorage.app",
    messagingSenderId: "525231633195",
    appId: "1:525231633195:web:6df083ad3fdf39d8954b6e",
    measurementId: "G-JCFZX12269"
  };
  const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
  const auth = getAuth(firebaseApp);
  const db = getFirestore(firebaseApp);

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
  let state = { currentUserId: null, students: [], requests: [] };
  let authUser = null;
  let profileUnsubscribe = null;
  let requestUnsubscribers = [];
  const messageUnsubscribers = new Map();
  const messagesByRequest = new Map();
  let sentRequests = new Map();
  let receivedRequests = new Map();

  function timestampToMillis(value) {
    if (value && typeof value.toMillis === "function") return value.toMillis();
    return Number.isFinite(value) ? value : Date.now();
  }

  function reportFirebaseError(action, error) {
    console.error(`SkillSwap ${action} failed:`, error);
    showToast(`${action} failed. ${error?.message || "Check your connection and Firebase setup."}`, "error");
  }

  function stopUserListeners() {
    requestUnsubscribers.forEach(unsubscribe => unsubscribe());
    requestUnsubscribers = [];
    messageUnsubscribers.forEach(unsubscribe => unsubscribe());
    messageUnsubscribers.clear();
    messagesByRequest.clear();
    sentRequests = new Map();
    receivedRequests = new Map();
    state.requests = [];
  }

  function updateRequestState() {
    const combined = new Map([...sentRequests, ...receivedRequests]);
    const presentIds = new Set(combined.keys());
    for (const [requestId, unsubscribe] of messageUnsubscribers) {
      if (!presentIds.has(requestId) || combined.get(requestId).status !== "accepted") {
        unsubscribe();
        messageUnsubscribers.delete(requestId);
        messagesByRequest.delete(requestId);
      }
    }
    for (const request of combined.values()) {
      if (request.status === "accepted" && !messageUnsubscribers.has(request.id)) {
        const unsubscribe = onSnapshot(collection(db, "requests", request.id, "messages"), snapshot => {
          const messages = snapshot.docs.map(messageDoc => {
            const data = messageDoc.data({ serverTimestamps: "estimate" });
            return {
              ...data,
              id: messageDoc.id,
              requestId: request.id,
              createdAt: timestampToMillis(data.createdAt),
              readBy: Array.isArray(data.readBy) ? data.readBy : []
            };
          }).sort((a, b) => a.createdAt - b.createdAt);
          messagesByRequest.set(request.id, messages);
          updateRequestState();
        }, error => reportFirebaseError("Loading exchange messages", error));
        messageUnsubscribers.set(request.id, unsubscribe);
      }
    }
    state.requests = [...combined.values()]
      .map(request => ({ ...request, messages: messagesByRequest.get(request.id) || [] }))
      .sort((a, b) => b.createdAt - a.createdAt);
    render();
  }

  function subscribeUserRequests(userId) {
    stopUserListeners();
    if (!userId) {
      render();
      return;
    }
    const requests = collection(db, "requests");
    requestUnsubscribers = [
      onSnapshot(query(requests, where("fromId", "==", userId)), snapshot => {
        sentRequests = new Map(snapshot.docs.map(requestDoc => {
          const data = requestDoc.data({ serverTimestamps: "estimate" });
          return [requestDoc.id, { ...data, id: requestDoc.id, createdAt: timestampToMillis(data.createdAt) }];
        }));
        updateRequestState();
      }, error => reportFirebaseError("Loading sent requests", error)),
      onSnapshot(query(requests, where("toId", "==", userId)), snapshot => {
        receivedRequests = new Map(snapshot.docs.map(requestDoc => {
          const data = requestDoc.data({ serverTimestamps: "estimate" });
          return [requestDoc.id, { ...data, id: requestDoc.id, createdAt: timestampToMillis(data.createdAt) }];
        }));
        updateRequestState();
      }, error => reportFirebaseError("Loading received requests", error))
    ];
  }

  profileUnsubscribe = onSnapshot(collection(db, "profiles"), snapshot => {
    state.students = snapshot.docs.map(profileDoc => {
      const data = profileDoc.data();
      return {
        id: profileDoc.id,
        name: data.name,
        offered: Array.isArray(data.offered) ? data.offered : [],
        wanted: Array.isArray(data.wanted) ? data.wanted : [],
        category: data.category,
        campus: data.campus || "Student community member"
      };
    }).filter(student => student.name && student.category);
    render();
  }, error => reportFirebaseError("Loading student profiles", error));

  function getCurrentUser() {
    const profile = state.students.find(student => student.id === state.currentUserId);
    if (!authUser || !state.currentUserId) return null;
    if (profile) {
      profile.email = authUser.email || "";
      return profile;
    }
    return {
        id: authUser.uid,
        name: authUser.displayName || authUser.email?.split("@")[0] || "Student",
        email: authUser.email || "",
        offered: [],
        wanted: [],
        category: "Other",
        campus: "Student community member"
      };
  }

  function profileDocument(student) {
    const profile = {
      name: student.name,
      offered: student.offered,
      wanted: student.wanted,
      category: student.category,
      campus: student.campus || "Student community member"
    };
    const categories = ["Programming", "Design", "Video Editing", "Other"];
    if (typeof profile.name !== "string" || !profile.name.trim() || profile.name.length > 50
      || !Array.isArray(profile.offered) || profile.offered.length > 30
      || !profile.offered.every(skill => typeof skill === "string")
      || !Array.isArray(profile.wanted) || profile.wanted.length > 30
      || !profile.wanted.every(skill => typeof skill === "string")
      || !categories.includes(profile.category)
      || typeof profile.campus !== "string" || profile.campus.length > 120) {
      throw new Error("Profile must have a name, valid category, and no more than 30 skills in each list.");
    }
    return profile;
  }

  function saveProfile(student) {
    return setDoc(doc(db, "profiles", student.id), profileDocument(student));
  }

  function requestDocument(request) {
    return {
      fromId: request.fromId,
      toId: request.toId,
      offeredSkills: request.offeredSkills,
      wantedSkills: request.wantedSkills,
      status: request.status,
      createdAt: request.createdAt,
      ...(request.exchangePlan ? { exchangePlan: request.exchangePlan } : {})
    };
  }

  function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, char => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[char]);
  }

  function initials(name) {
    return name.trim().split(/\s+/).slice(0, 2).map(part => part[0]?.toUpperCase() || "").join("");
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

  document.addEventListener("click", async event => {
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
      try {
        await setDoc(doc(db, "requests", request.id), requestDocument(request));
        state.requests.push({ ...request, messages: [] });
        render();
        showToast("Connection request sent. Happy skill swapping!");
      } catch (error) {
        reportFirebaseError("Sending exchange request", error);
      }
    }

    const requestAction = event.target.closest("[data-request-action]");
    if (requestAction) {
      const request = state.requests.find(item => item.id === requestAction.dataset.requestId);
      const user = getCurrentUser();
      const nextStatus = requestAction.dataset.requestAction;
      if (!user || !request || request.fromId === user.id || request.toId !== user.id || request.status !== "pending"
        || !["accepted", "rejected"].includes(nextStatus)) {
        render();
        showToast("This request is no longer available.", "error");
        return;
      }
      try {
        await updateDoc(doc(db, "requests", request.id), { status: nextStatus });
        request.status = nextStatus;
        render();
        showToast(request.status === "accepted"
          ? "Skill exchange request accepted successfully!"
          : "Skill exchange request rejected.");
      } catch (error) {
        render();
        reportFirebaseError("Updating exchange request", error);
      }
    }

    const startExchangeButton = event.target.closest("[data-start-exchange]");
    if (startExchangeButton) {
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
      const user = getCurrentUser();
      if (!user) {
        showToast("Log in to reset your profile skills.", "error");
        openAuth("login");
        return;
      }
      if (!window.confirm("Clear the skills on your own profile? Your exchange requests and chat history will remain.")) return;
      const previous = { offered: user.offered, wanted: user.wanted, category: user.category };
      user.offered = [];
      user.wanted = [];
      user.category = "Other";
      try {
        await saveProfile(user);
        if (!state.students.some(student => student.id === user.id)) state.students.push(user);
        activeCategory = "All";
        elements.search.value = "";
        document.querySelectorAll(".filter-chip").forEach(button => {
          const selected = button.dataset.category === "All";
          button.classList.toggle("active", selected);
          button.setAttribute("aria-pressed", String(selected));
        });
        render();
        showToast("Your profile skills were cleared. Requests and chats were preserved.");
      } catch (error) {
        Object.assign(user, previous);
        render();
        reportFirebaseError("Resetting profile skills", error);
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
      try {
        await signOut(auth);
        if (!elements.chatModal.hidden) closeChat();
        if (!elements.inboxModal.hidden) closeInbox();
        elements.navLinks.classList.remove("open");
        elements.menuToggle.setAttribute("aria-expanded", "false");
        elements.menuToggle.setAttribute("aria-label", "Open navigation menu");
        render();
        navigateHome();
        showToast("You have been logged out. Your saved data is unchanged.");
      } catch (error) {
        reportFirebaseError("Logging out", error);
      }
    }
  });

  elements.search.addEventListener("input", renderStudents);
  document.querySelector("#current-year").textContent = String(new Date().getFullYear());

  document.querySelector("#skill-form").addEventListener("submit", async event => {
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
    const updatedOffered = [...new Set([...user.offered, ...offered])];
    const updatedWanted = [...new Set([...user.wanted, ...wanted])];
    if (updatedOffered.length > 30 || updatedWanted.length > 30) {
      showToast("Profiles can list up to 30 skills in each list.", "error");
      return;
    }
    user.offered = updatedOffered;
    user.wanted = updatedWanted;
    user.category = String(formData.get("category"));
    try {
      await saveProfile(user);
      if (!state.students.some(student => student.id === user.id)) state.students.push(user);
      event.currentTarget.reset();
      render();
      showToast("Your skills have been added to your profile.");
    } catch (error) {
      reportFirebaseError("Saving skills", error);
    }
  });

  elements.loginForm.addEventListener("submit", async event => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email")).trim();
    const password = String(formData.get("password"));
    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      const name = credential.user.displayName || email.split("@")[0];
      closeAuth();
      navigateHome();
      showToast(`Welcome back, ${name.split(" ")[0]}!`);
    } catch (error) {
      reportFirebaseError("Logging in", error);
    }
  });

  elements.registerForm.addEventListener("submit", async event => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email")).trim();
    const student = {
      name: String(formData.get("name")).trim(),
      email,
      offered: String(formData.get("offered")).split(",").map(skill => skill.trim()).filter(Boolean),
      wanted: String(formData.get("wanted")).split(",").map(skill => skill.trim()).filter(Boolean),
      category: String(formData.get("category")),
      campus: "Student community member"
    };
    if (!student.name || student.name.length > 50 || !student.offered.length || !student.wanted.length
      || student.offered.length > 30 || student.wanted.length > 30
      || !["Programming", "Design", "Video Editing", "Other"].includes(student.category)) {
      showToast("Enter a name of up to 50 characters, choose a category, and list 1–30 skills to teach and learn.", "error");
      return;
    }
    try {
      const signedInUser = auth.currentUser?.email?.toLocaleLowerCase() === email.toLocaleLowerCase()
        ? auth.currentUser
        : null;
      const credential = signedInUser
        ? { user: signedInUser }
        : await createUserWithEmailAndPassword(auth, email, String(formData.get("password")));
      student.id = credential.user.uid;
      await updateProfile(credential.user, { displayName: student.name });
      await saveProfile(student);
      state.students = [...state.students.filter(profile => profile.id !== student.id), student];
      state.currentUserId = student.id;
      event.currentTarget.reset();
      closeAuth();
      render();
      navigateHome();
      showToast(`Your profile is ready, ${student.name.split(" ")[0]}!`);
    } catch (error) {
      reportFirebaseError("Creating account", error);
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

  elements.exchangePlanForm.addEventListener("submit", async event => {
    event.preventDefault();
    const request = state.requests.find(item => item.id === activeExchangeRequestId);
    if (!request || request.status !== "accepted"
      || (request.fromId !== state.currentUserId && request.toId !== state.currentUserId)) {
      closeExchangePlan();
      showToast("This exchange is no longer available to update.", "error");
      return;
    }
    const previousPlan = request.exchangePlan;
    const exchangePlan = {
      preferredDateTime: elements.exchangePlanForm.elements.preferredDateTime.value,
      notes: elements.exchangePlanForm.elements.notes.value.trim(),
      updatedAt: Date.now()
    };
    try {
      await updateDoc(doc(db, "requests", request.id), { exchangePlan });
      request.exchangePlan = exchangePlan;
      render();
      closeExchangePlan();
      showToast("Exchange plan saved. Both students can see the updated details.");
    } catch (error) {
      request.exchangePlan = previousPlan;
      reportFirebaseError("Saving exchange plan", error);
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

  async function openChat(request, trigger) {
    request = state.requests.find(item => item.id === request.id);
    const user = getCurrentUser();
    if (!request || !user || request.status !== "accepted"
      || (request.fromId !== user.id && request.toId !== user.id)) {
      render();
      showToast("This exchange chat is no longer available.", "error");
      return;
    }
    try {
      await markChatRead(request, user.id);
    } catch (error) {
      reportFirebaseError("Marking messages as read", error);
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

  async function openInboxConversation(requestId) {
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
    try {
      await markChatRead(request, user.id);
    } catch (error) {
      renderInbox();
      reportFirebaseError("Marking messages as read", error);
      return;
    }
    render();
    elements.inboxChatMessage.focus();
  }

  async function markChatRead(request, userId) {
    const unreadMessages = (request.messages || []).filter(message =>
      message.requestId === request.id
      && message.recipientId === userId
      && !message.readBy.includes(userId));
    if (!unreadMessages.length) return;
    await Promise.all(unreadMessages.map(message =>
      updateDoc(doc(db, "requests", request.id, "messages", message.id), { readBy: arrayUnion(userId) })));
    unreadMessages.forEach(message => message.readBy.push(userId));
    render();
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

  async function sendChatMessage(event, input, surface) {
    event.preventDefault();
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
    render();
    renderChat(request, surface);
    try {
      await setDoc(doc(db, "requests", request.id, "messages", message.id), {
        requestId: request.id,
        senderId: user.id,
        recipientId,
        text,
        createdAt: serverTimestamp(),
        readBy: [user.id]
      });
      input.value = "";
      render();
      renderChat(request, surface);
      input.focus();
      showToast("Message sent.");
    } catch (error) {
      request.messages = request.messages.filter(item => item.id !== message.id);
      render();
      reportFirebaseError("Sending message", error);
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

  setPersistence(auth, browserLocalPersistence).catch(error =>
    reportFirebaseError("Restoring sign-in", error));
  onAuthStateChanged(auth, user => {
    authUser = user;
    state.currentUserId = user?.uid || null;
    activeChatRequestId = null;
    stopUserListeners();
    subscribeUserRequests(user?.uid || null);
    render();
  }, error => reportFirebaseError("Checking sign-in", error));

  render();
})();