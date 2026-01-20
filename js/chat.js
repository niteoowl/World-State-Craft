// World State Craft - Chat System
import auth from './auth.js';

class ChatSystem {
    constructor() {
        this.socket = null;
        this.serverUrl = 'https://world-state-craft.onrender.com'; // Production URL
        // this.serverUrl = 'http://localhost:3000'; // Dev URL
        this.connected = false;
        this.init();
    }

    async init() {
        // Load Socket.io client
        if (!window.io) {
            await this.loadScript('https://cdn.socket.io/4.7.4/socket.io.min.js');
        }

        this.connect();
        this.setupUI();
    }

    loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    connect() {
        try {
            this.socket = io(this.serverUrl);

            this.socket.on('connect', () => {
                console.log('Connected to chat server');
                this.connected = true;
                this.addSystemMessage('Connected to Global Chat');
            });

            this.socket.on('disconnect', () => {
                console.log('Disconnected from chat server');
                this.connected = false;
                this.addSystemMessage('Disconnected from chat');
            });

            this.socket.on('chatMessage', (data) => {
                this.addMessage(data);
            });

        } catch (e) {
            console.error('Chat connection failed:', e);
        }
    }

    sendMessage(text) {
        if (!this.connected || !text.trim()) return;

        const user = auth.getUser();
        const nation = auth.getNation();

        // Use nation name if available, otherwise email prefix or "Guest"
        let username = 'Guest';
        if (nation) username = nation.name;
        else if (user && user.email) username = user.email.split('@')[0];

        this.socket.emit('sendChat', {
            user: username,
            text: text.trim()
        });
    }

    addMessage(data) {
        const list = document.getElementById('chat-messages');
        if (!list) return;

        const isDiscord = data.source === 'discord';
        const msg = document.createElement('div');
        msg.className = `chat-message ${isDiscord ? 'discord' : ''}`;

        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        msg.innerHTML = `
            <span class="chat-time">${time}</span>
            <span class="chat-user ${isDiscord ? 'discord-user' : ''}">${isDiscord ? '[Discord] ' : ''}${data.user}:</span>
            <span class="chat-text">${this.escapeHtml(data.text)}</span>
        `;

        list.appendChild(msg);
        list.scrollTop = list.scrollHeight;
    }

    addSystemMessage(text) {
        const list = document.getElementById('chat-messages');
        if (!list) return;

        const msg = document.createElement('div');
        msg.className = 'chat-message system';
        msg.innerHTML = `<span class="chat-text" style="color: var(--text-muted); font-style: italic;">${text}</span>`;

        list.appendChild(msg);
        list.scrollTop = list.scrollHeight;
    }

    setupUI() {
        const input = document.getElementById('chat-input');
        const sendBtn = document.getElementById('chat-send-btn');
        const toggleBtn = document.getElementById('chat-toggle-btn');
        const container = document.getElementById('chat-container');

        if (input && sendBtn) {
            const send = () => {
                const text = input.value;
                if (text) {
                    this.sendMessage(text);
                    input.value = '';
                }
            };

            sendBtn.addEventListener('click', send);
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') send();
            });
        }

        if (toggleBtn && container) {
            toggleBtn.addEventListener('click', () => {
                container.classList.toggle('collapsed');
                toggleBtn.innerHTML = container.classList.contains('collapsed') ? '💬' : '▼';
            });
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

const chat = new ChatSystem();
export default chat;
