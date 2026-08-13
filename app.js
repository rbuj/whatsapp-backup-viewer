// App State
let allMessages = [];
let filteredMessages = [];
let statsData = {};
let activeMediaFilter = 'all';
let activeSenderFilter = null; // Filter by clicking a participant
let activeSearchQuery = '';

// Search Navigation State
let searchMatches = [];
let currentSearchMatchIndex = -1;

// Lightbox Playlist State
let lightboxPlaylist = [];
let currentLightboxIndex = -1;

// Audio Management
let currentlyPlayingAudio = null;
let currentlyPlayingBtn = null;

// DOM Elements
const messagesContainer = document.getElementById('messages-container');
const participantsList = document.getElementById('participants-list');
const participantsCount = document.getElementById('participants-count');
const headerSubtitle = document.getElementById('header-subtitle');
const chatHeaderSubtitle = document.getElementById('chat-header-subtitle');
const scrollBottomBtn = document.getElementById('scroll-bottom-btn');
const themeToggle = document.getElementById('theme-toggle');

// Search Elements
const searchChatToggle = document.getElementById('search-chat-toggle');
const chatSearchBar = document.getElementById('chat-search-bar');
const chatSearchInput = document.getElementById('chat-search-input');
const chatSearchResultsCount = document.getElementById('chat-search-results-count');
const chatSearchPrev = document.getElementById('chat-search-prev');
const chatSearchNext = document.getElementById('chat-search-next');
const chatSearchClose = document.getElementById('chat-search-close');
const participantSearch = document.getElementById('participant-search');

// Modal Elements
const statsModal = document.getElementById('stats-modal');
const statsToggle = document.getElementById('stats-toggle');
const statsCloseBtn = document.getElementById('stats-close-btn');

const lightboxModal = document.getElementById('lightbox-modal');
const lightboxMediaWrapper = document.getElementById('lightbox-media-wrapper');
const lightboxFilename = document.getElementById('lightbox-filename');
const lightboxInfo = document.getElementById('lightbox-info');
const lightboxPrev = document.getElementById('lightbox-prev');
const lightboxNext = document.getElementById('lightbox-next');
const lightboxClose = document.getElementById('lightbox-close');

// Init
window.addEventListener('DOMContentLoaded', () => {
  fetchData();
  setupEventListeners();
});

// Fetch messages and stats from APIs
async function fetchData() {
  try {
    const [messagesRes, statsRes] = await Promise.all([
      fetch('/api/messages'),
      fetch('/api/stats')
    ]);
    
    allMessages = await messagesRes.json();
    statsData = await statsRes.json();
    
    filteredMessages = allMessages;
    
    // Update headers
    const participantsListCount = statsData.userActivity ? statsData.userActivity.length : 0;
    participantsCount.textContent = participantsListCount;
    
    const countStr = `${allMessages.length} missatges`;
    headerSubtitle.textContent = countStr;
    chatHeaderSubtitle.textContent = `${countStr} • ${participantsListCount} participants`;
    
    renderParticipants(statsData.userActivity);
    renderMessages();
    
  } catch (error) {
    console.error('Error fetching chat data:', error);
    messagesContainer.innerHTML = `
      <div class="chat-loading">
        <span style="color:var(--danger); font-size:32px;">⚠️</span>
        <p>Error en carregar el xat. Revisa la consola o assegura't que el servidor funciona.</p>
      </div>
    `;
  }
}

// Setup global event listeners
function setupEventListeners() {
  // Theme Toggle
  themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('light-theme');
    updateThemeIcon();
  });
  
  // Stats Modal Toggle
  statsToggle.addEventListener('click', () => {
    statsModal.classList.add('active');
    populateStatsDashboard();
  });
  statsCloseBtn.addEventListener('click', () => statsModal.classList.remove('active'));
  statsModal.addEventListener('click', (e) => {
    if (e.target === statsModal) statsModal.classList.remove('active');
  });

  // Lightbox Close & Navigation
  lightboxClose.addEventListener('click', closeLightbox);
  lightboxModal.addEventListener('click', (e) => {
    if (e.target === lightboxModal) closeLightbox();
  });
  lightboxPrev.addEventListener('click', (e) => { e.stopPropagation(); navigateLightbox(-1); });
  lightboxNext.addEventListener('click', (e) => { e.stopPropagation(); navigateLightbox(1); });
  
  // Keyboard navigation
  document.addEventListener('keydown', (e) => {
    if (lightboxModal.classList.contains('active')) {
      if (e.key === 'ArrowLeft') navigateLightbox(-1);
      if (e.key === 'ArrowRight') navigateLightbox(1);
      if (e.key === 'Escape') closeLightbox();
    }
    if (statsModal.classList.contains('active') && e.key === 'Escape') {
      statsModal.classList.remove('active');
    }
  });

  // Scroll to bottom button
  messagesContainer.addEventListener('scroll', () => {
    const threshold = 300;
    const diff = messagesContainer.scrollHeight - messagesContainer.clientHeight - messagesContainer.scrollTop;
    if (diff > threshold) {
      scrollBottomBtn.classList.add('active');
    } else {
      scrollBottomBtn.classList.remove('active');
    }
  });
  scrollBottomBtn.addEventListener('click', scrollToBottom);

  // Chat Search Toggle
  searchChatToggle.addEventListener('click', () => {
    chatSearchBar.classList.toggle('active');
    if (chatSearchBar.classList.contains('active')) {
      chatSearchInput.focus();
    } else {
      clearSearchHighlights();
    }
  });
  
  chatSearchClose.addEventListener('click', () => {
    chatSearchBar.classList.remove('active');
    clearSearchHighlights();
  });

  // Chat Search input behavior
  chatSearchInput.addEventListener('input', debounce(() => {
    performChatSearch();
  }, 300));

  chatSearchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      navigateSearchMatches(e.shiftKey ? -1 : 1);
    }
  });

  chatSearchPrev.addEventListener('click', () => navigateSearchMatches(-1));
  chatSearchNext.addEventListener('click', () => navigateSearchMatches(1));

  // Sidebar Participant Search & text filter
  participantSearch.addEventListener('input', debounce(() => {
    const query = participantSearch.value.toLowerCase().trim();
    
    // Filter participants in the list
    const participantItems = document.querySelectorAll('.participant-item');
    participantItems.forEach(item => {
      const name = item.dataset.name.toLowerCase();
      if (name.includes(query)) {
        item.style.display = 'flex';
      } else {
        item.style.display = 'none';
      }
    });

    // Also trigger global text filter on chat if typing in sidebar
    if (query) {
      activeSearchQuery = query;
      filterAndRenderChat();
    } else {
      activeSearchQuery = '';
      filterAndRenderChat();
    }
  }, 300));

  // Media Tab Filters
  const tabs = document.querySelectorAll('.filter-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      activeMediaFilter = tab.dataset.filter;
      filterAndRenderChat();
    });
  });

  // Custom Audio Event Delegation
  messagesContainer.addEventListener('click', handleAudioInteraction);
}

// Update the theme toggle SVG icon
function updateThemeIcon() {
  const isLight = document.body.classList.contains('light-theme');
  themeToggle.innerHTML = isLight 
    ? `<svg class="moon-icon" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`
    : `<svg class="sun-icon" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`;
}

// Generate Sender Initials for Avatar
function getInitials(name) {
  if (!name) return '?';
  const parts = name.split(' ');
  if (parts.length > 1) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}

// Assign unique consistent text colors/avatar background classes for senders
function getSenderColorClass(sender) {
  let hash = 0;
  for (let i = 0; i < sender.length; i++) {
    hash = sender.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash % 12) + 1;
  return `sender-c${index}`;
}

// Render the sidebar participant items
function renderParticipants(users) {
  participantsList.innerHTML = '';
  
  if (!users || users.length === 0) {
    participantsList.innerHTML = '<div class="loading-spinner-sidebar">Cap participant actiu</div>';
    return;
  }

  // Create an "ALL" option at the top of participants
  const allItem = document.createElement('div');
  allItem.className = 'participant-item active';
  allItem.dataset.name = 'all';
  allItem.innerHTML = `
    <div class="avatar group-avatar">T</div>
    <div class="participant-info">
      <div class="participant-info-row">
        <span class="participant-name">Tots els missatges</span>
        <span class="participant-count">${allMessages.length}</span>
      </div>
      <p class="participant-last-msg">Mostra la conversa sencera</p>
    </div>
  `;
  allItem.addEventListener('click', () => selectSenderFilter(null, allItem));
  participantsList.appendChild(allItem);

  users.forEach(user => {
    const item = document.createElement('div');
    item.className = 'participant-item';
    item.dataset.name = user.name;
    
    // Find last message from this user to display as snippet
    const userMsgs = allMessages.filter(m => m.sender === user.name && !m.isSystem);
    const lastMsg = userMsgs[userMsgs.length - 1];
    let snippet = 'Arxiu adjunt';
    if (lastMsg) {
      if (lastMsg.attachment) {
        snippet = `📎 ${lastMsg.attachment.mediaType.toUpperCase()}`;
      } else {
        snippet = lastMsg.text.length > 30 ? lastMsg.text.substring(0, 30) + '...' : lastMsg.text;
      }
    }

    const initials = getInitials(user.name);
    const colorClass = getSenderColorClass(user.name);

    item.innerHTML = `
      <div class="avatar ${colorClass}">${initials}</div>
      <div class="participant-info">
        <div class="participant-info-row">
          <span class="participant-name">${user.name}</span>
          <span class="participant-count">${user.count}</span>
        </div>
        <p class="participant-last-msg">${snippet}</p>
      </div>
    `;

    item.addEventListener('click', () => selectSenderFilter(user.name, item));
    participantsList.appendChild(item);
  });
}

// Handle sidebar participant filter clicking
function selectSenderFilter(sender, element) {
  document.querySelectorAll('.participant-item').forEach(item => item.classList.remove('active'));
  element.classList.add('active');
  
  activeSenderFilter = sender;
  filterAndRenderChat();
}

// Filter the messages based on active sender, media type, and sidebar search
function filterAndRenderChat() {
  filteredMessages = allMessages;

  // Filter by sender
  if (activeSenderFilter) {
    filteredMessages = filteredMessages.filter(m => m.sender === activeSenderFilter);
  }

  // Filter by media tab
  if (activeMediaFilter !== 'all') {
    filteredMessages = filteredMessages.filter(m => m.attachment && m.attachment.mediaType === activeMediaFilter);
  }

  // Filter by text search query (if typing in sidebar search)
  const sidebarQuery = participantSearch.value.toLowerCase().trim();
  if (sidebarQuery && !activeSenderFilter) {
    // If typing query and not filtering a specific user, filter chat messages containing query
    filteredMessages = filteredMessages.filter(m => !m.isSystem && m.text.toLowerCase().includes(sidebarQuery));
  }

  renderMessages();
}

// Render messages to chat panel
function renderMessages() {
  // Pause any currently playing audio
  stopAudio();

  messagesContainer.innerHTML = '';
  
  if (filteredMessages.length === 0) {
    messagesContainer.innerHTML = `
      <div class="chat-loading">
        <p>No s'han trobat missatges amb els filtres actius.</p>
      </div>
    `;
    return;
  }

  let lastDate = '';
  
  // Rebuild the lightbox playlist for the currently visible items
  lightboxPlaylist = [];

  const fragment = document.createDocumentFragment();

  filteredMessages.forEach(msg => {
    // Inject date separator if day changes
    const msgDate = new Date(msg.timestamp.year, msg.timestamp.month - 1, msg.timestamp.day);
    const dateFormatted = msgDate.toLocaleDateString('ca-ES', { day: 'numeric', month: 'long', year: 'numeric' });
    
    if (dateFormatted !== lastDate) {
      const separator = document.createElement('div');
      separator.className = 'message-date-header';
      separator.textContent = dateFormatted;
      fragment.appendChild(separator);
      lastDate = dateFormatted;
    }

    if (msg.isSystem) {
      const sysBubble = document.createElement('div');
      sysBubble.className = 'system-msg-bubble';
      sysBubble.textContent = msg.text;
      fragment.appendChild(sysBubble);
      return;
    }

    const isUser = msg.sender === 'user';
    const bubble = document.createElement('div');
    bubble.className = `message-bubble ${isUser ? 'msg-outgoing' : 'msg-incoming'}`;
    bubble.dataset.id = msg.id;

    // Sender Label
    const senderColorClass = getSenderColorClass(msg.sender);
    const senderName = document.createElement('div');
    senderName.className = `msg-sender ${senderColorClass}`;
    senderName.textContent = msg.sender;
    senderName.addEventListener('click', () => {
      // Filter by this sender on click
      const item = document.querySelector(`.participant-item[data-name="${msg.sender}"]`);
      if (item) selectSenderFilter(msg.sender, item);
    });
    bubble.appendChild(senderName);

    // Message Body wrapper
    const bodyWrapper = document.createElement('div');
    bodyWrapper.className = 'msg-body-wrapper';

    // Render Media Attachment if present
    if (msg.attachment) {
      const media = msg.attachment;
      const mediaUrl = `/db/${encodeURIComponent(media.filename)}`;

      if (media.mediaType === 'image') {
        const imgDiv = document.createElement('div');
        imgDiv.className = 'media-attachment-image';
        
        const img = document.createElement('img');
        img.src = mediaUrl;
        img.loading = 'lazy';
        img.alt = media.filename;
        
        // Add to lightbox playlist
        const playlistIndex = lightboxPlaylist.length;
        lightboxPlaylist.push({
          url: mediaUrl,
          type: 'image',
          filename: media.filename,
          info: `Enviat per ${msg.sender} el ${msg.timestamp.day}/${msg.timestamp.month}/${msg.timestamp.year} a les ${msg.timeStr}`
        });

        imgDiv.addEventListener('click', () => openLightbox(playlistIndex));
        
        imgDiv.appendChild(img);
        bodyWrapper.appendChild(imgDiv);

      } else if (media.mediaType === 'video') {
        const vidDiv = document.createElement('div');
        vidDiv.className = 'media-attachment-video';
        
        const video = document.createElement('video');
        video.src = mediaUrl;
        video.preload = 'metadata';
        video.controls = true;
        
        // Add to lightbox playlist
        const playlistIndex = lightboxPlaylist.length;
        lightboxPlaylist.push({
          url: mediaUrl,
          type: 'video',
          filename: media.filename,
          info: `Enviat per ${msg.sender} el ${msg.timestamp.day}/${msg.timestamp.month}/${msg.timestamp.year} a les ${msg.timeStr}`
        });

        // Double click/click on video boundary opens lightbox
        video.addEventListener('dblclick', () => openLightbox(playlistIndex));

        vidDiv.appendChild(video);
        bodyWrapper.appendChild(vidDiv);

      } else if (media.mediaType === 'gif') {
        // GIF files are mp4 that loop autoplay
        const gifDiv = document.createElement('div');
        gifDiv.className = 'media-attachment-gif';
        
        const video = document.createElement('video');
        video.src = mediaUrl;
        video.preload = 'auto';
        video.autoplay = true;
        video.loop = true;
        video.muted = true;
        video.playsInline = true;

        const playlistIndex = lightboxPlaylist.length;
        lightboxPlaylist.push({
          url: mediaUrl,
          type: 'video',
          filename: media.filename,
          info: `Enviat per ${msg.sender} el ${msg.timestamp.day}/${msg.timestamp.month}/${msg.timestamp.year} a les ${msg.timeStr}`
        });

        gifDiv.addEventListener('click', () => openLightbox(playlistIndex));
        
        gifDiv.appendChild(video);
        bodyWrapper.appendChild(gifDiv);

      } else if (media.mediaType === 'audio') {
        // Render beautiful custom audio player
        const audioDiv = document.createElement('div');
        audioDiv.className = 'media-attachment-audio';
        audioDiv.innerHTML = `
          <button class="audio-play-btn" title="Reprodueix nota de veu">
            <svg class="play-svg" viewBox="0 0 24 24" width="16" height="16"><path d="M8 5v14l11-7z"/></svg>
            <svg class="pause-svg" viewBox="0 0 24 24" width="16" height="16" style="display:none;"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
          </button>
          <div class="audio-progress-container">
            <div class="audio-slider-wrapper">
              <div class="audio-slider-fill"></div>
              <div class="audio-slider-handle"></div>
            </div>
            <div class="audio-meta-row">
              <span class="audio-time">0:00</span>
              <button class="audio-speed-pill">1.0x</button>
            </div>
          </div>
          <audio src="${mediaUrl}" preload="none"></audio>
        `;
        bodyWrapper.appendChild(audioDiv);

      } else if (media.mediaType === 'sticker') {
        bubble.classList.add('sticker-bubble');
        const stickerDiv = document.createElement('div');
        stickerDiv.className = 'media-attachment-sticker';
        
        const img = document.createElement('img');
        img.src = mediaUrl;
        img.loading = 'lazy';
        img.alt = 'Sticker';
        
        stickerDiv.appendChild(img);
        bodyWrapper.appendChild(stickerDiv);

      } else {
        // Standard document/contact card
        const docDiv = document.createElement('div');
        docDiv.className = 'media-attachment-doc';
        
        const isVcard = media.mediaType === 'contact';
        const iconSVG = isVcard 
          ? `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`
          : `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>`;
        
        docDiv.innerHTML = `
          <div class="doc-icon-wrapper">${iconSVG}</div>
          <div class="doc-info">
            <span class="doc-name">${media.filename}</span>
            <span class="doc-ext-size">${media.ext.substring(1) || 'DOC'}</span>
          </div>
        `;
        docDiv.addEventListener('click', () => {
          window.open(mediaUrl, '_blank');
        });
        bodyWrapper.appendChild(docDiv);
      }
    }

    // Text Content
    if (msg.text) {
      const textDiv = document.createElement('div');
      textDiv.className = 'msg-text';
      // Store raw text in custom attribute for search highlighting
      textDiv.dataset.rawText = msg.text;
      textDiv.textContent = msg.text;
      bodyWrapper.appendChild(textDiv);
    }

    // Metadata footer (Time + Read receipts checkmarks)
    const metaDiv = document.createElement('div');
    metaDiv.className = 'msg-meta';
    
    const timeSpan = document.createElement('span');
    timeSpan.className = 'msg-time';
    timeSpan.textContent = msg.timeStr;
    metaDiv.appendChild(timeSpan);

    if (isUser) {
      const checkSVG = document.createElement('span');
      checkSVG.className = 'msg-checks';
      checkSVG.innerHTML = `<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M17.3,8.3L16,7L10.3,12.7L7.8,10.2L6.5,11.5L10.3,15.3L17.3,8.3z M21.3,8.3L20,7L14.3,12.7l-1-1l-1.3,1.3l2.3,2.3L21.3,8.3z"/></svg>`;
      metaDiv.appendChild(checkSVG);
    }

    bodyWrapper.appendChild(metaDiv);
    bubble.appendChild(bodyWrapper);
    fragment.appendChild(bubble);
  });

  messagesContainer.appendChild(fragment);
  
  // Keep scroll focused on bottom on load/render unless searching
  if (!chatSearchBar.classList.contains('active')) {
    scrollToBottom();
  } else {
    // If search active, re-highlight current match
    performChatSearch();
  }
}

function scrollToBottom() {
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Custom debounce
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// ==========================================================================
// FLOATING SEARCH & MATCH HIGHLIGHT NAVIGATION
// ==========================================================================

function clearSearchHighlights() {
  searchMatches = [];
  currentSearchMatchIndex = -1;
  chatSearchResultsCount.textContent = '0 de 0';
  chatSearchPrev.disabled = true;
  chatSearchNext.disabled = true;

  const highlightedElems = document.querySelectorAll('.msg-text');
  highlightedElems.forEach(elem => {
    if (elem.dataset.rawText) {
      elem.textContent = elem.dataset.rawText;
    }
  });
}

function performChatSearch() {
  clearSearchHighlights();
  
  const query = chatSearchInput.value.toLowerCase().trim();
  if (!query) return;

  const textElems = document.querySelectorAll('.msg-text');
  
  textElems.forEach(elem => {
    const rawText = elem.dataset.rawText;
    if (!rawText) return;

    const lowerText = rawText.toLowerCase();
    if (lowerText.includes(query)) {
      // Construct regex to find matches for splitting
      const escapedQuery = query.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const regex = new RegExp(`(${escapedQuery})`, 'gi');
      
      const parts = rawText.split(regex);
      elem.innerHTML = ''; // Clear text

      parts.forEach(part => {
        if (part.toLowerCase() === query) {
          const span = document.createElement('span');
          span.className = 'search-highlight';
          span.textContent = part;
          elem.appendChild(span);
          searchMatches.push(span); // Add matching span to global matches list
        } else {
          elem.appendChild(document.createTextNode(part));
        }
      });
    }
  });

  const count = searchMatches.length;
  if (count > 0) {
    currentSearchMatchIndex = 0;
    chatSearchPrev.disabled = false;
    chatSearchNext.disabled = false;
    highlightCurrentMatch();
  }
}

function highlightCurrentMatch() {
  searchMatches.forEach(span => span.classList.remove('current-match'));
  
  if (currentSearchMatchIndex >= 0 && currentSearchMatchIndex < searchMatches.length) {
    const match = searchMatches[currentSearchMatchIndex];
    match.classList.add('current-match');
    
    // Smooth scroll current match into center view
    match.scrollIntoView({ behavior: 'smooth', block: 'center' });
    
    // Update counter display
    chatSearchResultsCount.textContent = `${currentSearchMatchIndex + 1} de ${searchMatches.length}`;
  }
}

function navigateSearchMatches(direction) {
  if (searchMatches.length === 0) return;
  
  currentSearchMatchIndex += direction;
  
  // Loop around indices
  if (currentSearchMatchIndex < 0) {
    currentSearchMatchIndex = searchMatches.length - 1;
  } else if (currentSearchMatchIndex >= searchMatches.length) {
    currentSearchMatchIndex = 0;
  }
  
  highlightCurrentMatch();
}


// ==========================================================================
// CUSTOM AUDIO PLAYER CONTROLS (.opus files)
// ==========================================================================

function handleAudioInteraction(e) {
  const playBtn = e.target.closest('.audio-play-btn');
  const speedBtn = e.target.closest('.audio-speed-pill');
  const sliderWrapper = e.target.closest('.audio-slider-wrapper');

  if (playBtn) {
    const bubble = playBtn.closest('.message-bubble');
    const audio = bubble.querySelector('audio');
    
    if (audio.paused) {
      // Pause any other playing voice note
      stopAudio();
      
      // Play current audio
      audio.play();
      currentlyPlayingAudio = audio;
      currentlyPlayingBtn = playBtn;
      
      playBtn.querySelector('.play-svg').style.display = 'none';
      playBtn.querySelector('.pause-svg').style.display = 'block';

      // Attach timeline updates
      audio.ontimeupdate = () => updateAudioProgress(audio, bubble);
      audio.onended = () => {
        stopAudio();
      };
    } else {
      audio.pause();
      stopAudio();
    }
  }

  if (speedBtn) {
    const bubble = speedBtn.closest('.message-bubble');
    const audio = bubble.querySelector('audio');
    let currentSpeed = parseFloat(speedBtn.textContent);

    // Cycle playback rate: 1.0x -> 1.5x -> 2.0x -> 1.0x
    let nextSpeed = 1.0;
    if (currentSpeed === 1.0) nextSpeed = 1.5;
    else if (currentSpeed === 1.5) nextSpeed = 2.0;

    audio.playbackRate = nextSpeed;
    speedBtn.textContent = `${nextSpeed.toFixed(1)}x`;
  }

  if (sliderWrapper) {
    const bubble = sliderWrapper.closest('.message-bubble');
    const audio = bubble.querySelector('audio');
    
    const clickX = e.clientX - sliderWrapper.getBoundingClientRect().left;
    const width = sliderWrapper.clientWidth;
    const pct = clickX / width;
    
    // Seek audio
    if (audio.duration) {
      audio.currentTime = pct * audio.duration;
      updateAudioProgress(audio, bubble);
    }
  }
}

// Update the custom bar fill and timer
function updateAudioProgress(audio, bubble) {
  const fill = bubble.querySelector('.audio-slider-fill');
  const handle = bubble.querySelector('.audio-slider-handle');
  const timeDisplay = bubble.querySelector('.audio-time');
  
  if (audio.duration) {
    const pct = (audio.currentTime / audio.duration) * 100;
    fill.style.width = `${pct}%`;
    handle.style.left = `${pct}%`;

    // Format current time and total time
    const curMin = Math.floor(audio.currentTime / 60);
    const curSec = String(Math.floor(audio.currentTime % 60)).padStart(2, '0');
    
    const durMin = Math.floor(audio.duration / 60);
    const durSec = String(Math.floor(audio.duration % 60)).padStart(2, '0');
    
    timeDisplay.textContent = `${curMin}:${curSec} / ${durMin}:${durSec}`;
  }
}

// Pause and reset active audio element
function stopAudio() {
  if (currentlyPlayingAudio) {
    currentlyPlayingAudio.pause();
    
    if (currentlyPlayingBtn) {
      currentlyPlayingBtn.querySelector('.play-svg').style.display = 'block';
      currentlyPlayingBtn.querySelector('.pause-svg').style.display = 'none';
    }
  }
  currentlyPlayingAudio = null;
  currentlyPlayingBtn = null;
}


// ==========================================================================
// LIGHTBOX SYSTEM (IMAGE / VIDEO FULLSCREEN VIEW)
// ==========================================================================

function openLightbox(index) {
  if (index < 0 || index >= lightboxPlaylist.length) return;
  currentLightboxIndex = index;
  
  const item = lightboxPlaylist[index];
  
  lightboxMediaWrapper.innerHTML = '';
  
  if (item.type === 'image') {
    const img = document.createElement('img');
    img.src = item.url;
    img.alt = item.filename;
    lightboxMediaWrapper.appendChild(img);
  } else if (item.type === 'video') {
    const video = document.createElement('video');
    video.src = item.url;
    video.controls = true;
    video.autoplay = true;
    lightboxMediaWrapper.appendChild(video);
  }
  
  lightboxFilename.textContent = item.filename;
  lightboxInfo.textContent = item.info;
  
  lightboxModal.classList.add('active');
  
  // Enable navigation buttons if playlist > 1
  lightboxPrev.style.display = lightboxPlaylist.length > 1 ? 'flex' : 'none';
  lightboxNext.style.display = lightboxPlaylist.length > 1 ? 'flex' : 'none';
}

function navigateLightbox(direction) {
  if (lightboxPlaylist.length === 0) return;
  
  let nextIndex = currentLightboxIndex + direction;
  if (nextIndex < 0) nextIndex = lightboxPlaylist.length - 1;
  else if (nextIndex >= lightboxPlaylist.length) nextIndex = 0;
  
  openLightbox(nextIndex);
}

function closeLightbox() {
  lightboxModal.classList.remove('active');
  // Stop playing lightbox video if active
  const video = lightboxMediaWrapper.querySelector('video');
  if (video) video.pause();
  lightboxMediaWrapper.innerHTML = '';
}


// ==========================================================================
// STATS DASHBOARD (MODAL CONTENT & SVG CHARTS DRAWING)
// ==========================================================================

function populateStatsDashboard() {
  if (!statsData || Object.keys(statsData).length === 0) return;

  // Set card numbers
  document.getElementById('stat-total-messages').textContent = statsData.totalMessages.toLocaleString();
  document.getElementById('stat-total-participants').textContent = statsData.userActivity.length;
  
  // Calculate active days count
  const activeDays = Object.keys(statsData.dailyActivity).length;
  document.getElementById('stat-total-days').textContent = activeDays;

  // Total media count
  const mediaObj = statsData.mediaStats;
  const totalMediaCount = Object.entries(mediaObj)
    .filter(([key]) => key !== 'text')
    .reduce((sum, [, val]) => sum + val, 0);
  document.getElementById('stat-total-media').textContent = totalMediaCount.toLocaleString();

  // 1. Draw Senders Bar Graph (HTML/CSS Based)
  drawSendersActivityChart(statsData.userActivity);

  // 2. Draw Content Types distribution
  drawContentTypesChart(mediaObj);

  // 3. Draw Hourly Heatmap (SVG)
  drawHourlyActivityChart(statsData.hourlyActivity);

  // 4. Draw Timeline Activity (SVG)
  drawTimelineActivityChart(statsData.dailyActivity);
}

function drawSendersActivityChart(users) {
  const container = document.getElementById('chart-user-activity');
  container.innerHTML = '';
  
  if (!users || users.length === 0) {
    container.innerHTML = '<p>Sense dades suficients</p>';
    return;
  }

  // Find max message count for bar percentages
  const maxMessages = Math.max(...users.map(u => u.count));

  // Take top 8 users to keep dashboard compact
  const topUsers = users.slice(0, 8);

  topUsers.forEach(user => {
    const row = document.createElement('div');
    row.className = 'user-bar-row';

    const pct = maxMessages > 0 ? (user.count / maxMessages) * 100 : 0;

    row.innerHTML = `
      <span class="user-bar-name" title="${user.name}">${user.name}</span>
      <div class="user-bar-wrapper">
        <div class="user-bar-fill" style="width: 0%;"></div>
      </div>
      <span class="user-bar-value">${user.count}</span>
    `;

    container.appendChild(row);

    // Trigger bar fill animation (delayed slightly to allow DOM injection)
    setTimeout(() => {
      row.querySelector('.user-bar-fill').style.width = `${pct}%`;
    }, 100);
  });
}

function drawContentTypesChart(media) {
  const container = document.getElementById('chart-media-types');
  container.innerHTML = '';

  const listDiv = document.createElement('div');
  listDiv.className = 'media-type-bars';

  // Translate labels to Catalan
  const translations = {
    text: 'text',
    image: 'imatge',
    video: 'vídeo',
    audio: 'àudio',
    document: 'document',
    sticker: 'sticker',
    contact: 'contacte',
    gif: 'gif',
    unknown: 'altres'
  };

  Object.entries(media).forEach(([key, val]) => {
    if (val === 0) return; // Skip zero counts
    
    const pill = document.createElement('div');
    pill.className = 'media-type-pill';
    
    pill.innerHTML = `
      <span class="media-pill-val">${val}</span>
      <span class="media-pill-label">${translations[key] || key}</span>
    `;
    listDiv.appendChild(pill);
  });

  container.appendChild(listDiv);
}

function drawHourlyActivityChart(hourlyData) {
  const container = document.getElementById('chart-hourly-activity');
  container.innerHTML = '';

  if (!hourlyData || hourlyData.length === 0) {
    container.innerHTML = '<p>Sense dades d\'hores</p>';
    return;
  }

  const maxVal = Math.max(...hourlyData);
  const svgWidth = 400;
  const svgHeight = 160;
  const paddingLeft = 30;
  const paddingRight = 10;
  const paddingTop = 15;
  const paddingBottom = 25;
  
  const plotWidth = svgWidth - paddingLeft - paddingRight;
  const plotHeight = svgHeight - paddingTop - paddingBottom;
  
  const barWidth = plotWidth / 24;

  let barsSvgHtml = '';
  
  // Render Y axis ticks and guidelines
  const ticks = 3;
  for (let i = 0; i <= ticks; i++) {
    const ratio = i / ticks;
    const y = paddingTop + plotHeight * (1 - ratio);
    const labelVal = Math.round(maxVal * ratio);
    barsSvgHtml += `
      <line x1="${paddingLeft}" y1="${y}" x2="${svgWidth - paddingRight}" y2="${y}" stroke="var(--border-color)" stroke-width="0.5" stroke-dasharray="2,2" />
      <text x="${paddingLeft - 8}" y="${y + 4}" fill="var(--text-secondary)" font-size="9" text-anchor="end">${labelVal}</text>
    `;
  }

  // Draw 24 bars
  hourlyData.forEach((count, hour) => {
    const ratio = maxVal > 0 ? count / maxVal : 0;
    const barHeight = plotHeight * ratio;
    const x = paddingLeft + (hour * barWidth) + 1; // 1px margin
    const y = paddingTop + plotHeight - barHeight;

    // Show label for every 4th hour to prevent clutter
    const labelHtml = hour % 4 === 0 
      ? `<text x="${x + barWidth / 2}" y="${svgHeight - 10}" fill="var(--text-secondary)" font-size="8" text-anchor="middle">${hour}h</text>`
      : '';

    barsSvgHtml += `
      <!-- Bar with rounded top -->
      <rect x="${x}" y="${y}" width="${barWidth - 2}" height="${barHeight}" fill="var(--accent)" rx="2" ry="2" opacity="0.85">
        <title>Hora ${hour}:00: ${count} missatges</title>
      </rect>
      ${labelHtml}
    `;
  });

  container.innerHTML = `
    <svg class="hourly-svg" viewBox="0 0 ${svgWidth} ${svgHeight}">
      ${barsSvgHtml}
    </svg>
  `;
}

function drawTimelineActivityChart(dailyData) {
  const container = document.getElementById('chart-timeline-activity');
  container.innerHTML = '';

  if (!dailyData || Object.keys(dailyData).length === 0) {
    container.innerHTML = '<p>Sense dades de línia temporal</p>';
    return;
  }

  // Sort daily dates
  const sortedDates = Object.entries(dailyData)
    .map(([date, count]) => ({ date: new Date(date), count }))
    .sort((a, b) => a.date - b.date);

  const maxVal = Math.max(...sortedDates.map(d => d.count));
  const svgWidth = 800;
  const svgHeight = 180;
  const paddingLeft = 40;
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 30;

  const plotWidth = svgWidth - paddingLeft - paddingRight;
  const plotHeight = svgHeight - paddingTop - paddingBottom;

  const pointsCount = sortedDates.length;
  const stepX = plotWidth / (pointsCount - 1 || 1);

  let pathD = '';
  let areaD = '';
  let pointsHtml = '';
  let timelineTicksHtml = '';

  // Render horizontal grid lines
  const ticksCount = 4;
  for (let i = 0; i <= ticksCount; i++) {
    const ratio = i / ticksCount;
    const y = paddingTop + plotHeight * (1 - ratio);
    const labelVal = Math.round(maxVal * ratio);
    timelineTicksHtml += `
      <line x1="${paddingLeft}" y1="${y}" x2="${svgWidth - paddingRight}" y2="${y}" stroke="var(--border-color)" stroke-width="0.5" />
      <text x="${paddingLeft - 8}" y="${y + 4}" fill="var(--text-secondary)" font-size="9" text-anchor="end">${labelVal}</text>
    `;
  }

  sortedDates.forEach((pt, index) => {
    const x = paddingLeft + (index * stepX);
    const ratio = maxVal > 0 ? pt.count / maxVal : 0;
    const y = paddingTop + plotHeight - (plotHeight * ratio);

    if (index === 0) {
      pathD = `M ${x} ${y}`;
      areaD = `M ${x} ${paddingTop + plotHeight} L ${x} ${y}`;
    } else {
      pathD += ` L ${x} ${y}`;
      areaD += ` L ${x} ${y}`;
    }

    if (index === pointsCount - 1) {
      areaD += ` L ${x} ${paddingTop + plotHeight} Z`;
    }

    // Only draw circle points if not too cluttered
    if (pointsCount < 60) {
      pointsHtml += `
        <circle cx="${x}" cy="${y}" r="3" fill="var(--accent-light)" stroke="var(--accent)" stroke-width="1" class="timeline-point">
          <title>${pt.date.toLocaleDateString('ca-ES')}: ${pt.count} missatges</title>
        </circle>
      `;
    }

    // Date Labels at bottom (Draw ~6 labels evenly spaced)
    const labelFrequency = Math.ceil(pointsCount / 6);
    if (index % labelFrequency === 0 || index === pointsCount - 1) {
      const dateStr = pt.date.toLocaleDateString('ca-ES', { day: 'numeric', month: 'short' });
      timelineTicksHtml += `
        <line x1="${x}" y1="${paddingTop + plotHeight}" x2="${x}" y2="${paddingTop + plotHeight + 4}" stroke="var(--border-color)" />
        <text x="${x}" y="${svgHeight - 12}" fill="var(--text-secondary)" font-size="9" text-anchor="middle">${dateStr}</text>
      `;
    }
  });

  container.innerHTML = `
    <svg class="timeline-svg" viewBox="0 0 ${svgWidth} ${svgHeight}">
      ${timelineTicksHtml}
      <!-- Shaded Area Under Line -->
      <path d="${areaD}" fill="rgba(0, 168, 132, 0.08)" />
      <!-- Line path -->
      <path d="${pathD}" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
      ${pointsHtml}
    </svg>
  `;
}
