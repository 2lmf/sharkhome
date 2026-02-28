/**
 * SharkHome - Core Logic
 */

const state = {
    currentTab: 'shopping',
    shoppingList: [],
    expenses: [],
    recipes: [],
    config: {
        apiUrl: 'https://script.google.com/macros/s/AKfycbyQmtsILzYGXAPvPBFU5tvEObBnns3AFD4H9DLj20aYWXv7I_zJ3wpvuwbyuOa6Sr5R/exec',
        telegramToken: localStorage.getItem('hub_telegram_token') || ''
    }
};

// UI Elements
const views = document.querySelectorAll('.tab-view');
const tabBtns = document.querySelectorAll('.tab-btn');
const shoppingListContainer = document.getElementById('shopping-list-container');
const inputNewItem = document.getElementById('input-new-item');
const btnAddItem = document.getElementById('btn-add-item');

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    initShopping();
    initScanner();
    initAnalytics(); // For Chart.js

    // Load local state first for immediate feel
    loadLocalData();
    renderShoppingList();
    renderAnalytics();
});

// Tab Navigation
function initTabs() {
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.dataset.tab;
            switchTab(target);
        });
    });
}

function switchTab(tabId) {
    state.currentTab = tabId;

    // Update Buttons
    tabBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabId);
    });

    // Update Views
    views.forEach(view => {
        view.classList.toggle('active', view.id === `view-${tabId}`);
    });
}

// Shopping Logic
function initShopping() {
    btnAddItem.addEventListener('click', () => {
        const value = inputNewItem.value.trim();
        if (value) {
            addItemToShoppingList(value);
            inputNewItem.value = '';
        }
    });

    inputNewItem.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') btnAddItem.click();
    });

    initVoice();
}

function initVoice() {
    const btnVoice = document.getElementById('btn-voice');
    if (!btnVoice) return;

    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        btnVoice.style.display = 'none';
        return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'hr-HR';
    recognition.interimResults = false;

    btnVoice.addEventListener('click', () => {
        recognition.start();
        btnVoice.classList.add('recording-pulse');
        inputNewItem.placeholder = "Slušam...";
    });

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        inputNewItem.value = transcript;
        addItemToShoppingList(transcript);
        inputNewItem.value = '';
    };

    recognition.onend = () => {
        btnVoice.classList.remove('recording-pulse');
        inputNewItem.placeholder = "Doda nešto na popis...";
    };
}

function addItemToShoppingList(text) {
    const newItem = {
        id: Date.now(),
        text: text,
        completed: false,
        timestamp: new Date().toISOString()
    };

    state.shoppingList.unshift(newItem);
    saveLocalData();
    renderShoppingList();

    // Trigger sync
    syncWithBackend('updateShopping', state.shoppingList);
}

function renderShoppingList() {
    if (state.shoppingList.length === 0) {
        shoppingListContainer.innerHTML = `<div class="empty-state">Popis je prazan. Dodaj nešto!</div>`;
        return;
    }

    shoppingListContainer.innerHTML = state.shoppingList.map(item => `
        <div class="list-item" data-id="${item.id}">
            <div class="item-info">
                <span class="item-text ${item.completed ? 'checked' : ''}">${item.text}</span>
            </div>
            <div class="item-actions">
                <button class="check-btn" onclick="toggleItem('${item.id}')">${item.completed ? '↩️' : '✅'}</button>
                <button class="delete-btn" onclick="deleteItem('${item.id}')">🗑️</button>
            </div>
        </div>
    `).join('');
}

// Global scope for onclick handlers
window.toggleItem = (id) => {
    const item = state.shoppingList.find(i => i.id == id);
    if (item) {
        item.completed = !item.completed;
        saveLocalData();
        renderShoppingList();
        syncWithBackend('updateShopping', state.shoppingList);
    }
};

window.deleteItem = (id) => {
    state.shoppingList = state.shoppingList.filter(i => i.id != id);
    saveLocalData();
    renderShoppingList();
    syncWithBackend('updateShopping', state.shoppingList);
};

// Persistence
function saveLocalData() {
    localStorage.setItem('hub_state', JSON.stringify(state));
}

function loadLocalData() {
    const saved = localStorage.getItem('hub_state');
    if (saved) {
        const parsed = JSON.parse(saved);
        state.shoppingList = parsed.shoppingList || [];
        state.bills = parsed.bills || [];
        state.recipes = parsed.recipes || [];
    }
}

// Scanner Logic
function initScanner() {
    const btnScanProduct = document.getElementById('btn-scan-product');
    const btnScanBill = document.getElementById('btn-scan-bill');
    const overlay = document.getElementById('scanner-overlay');
    const btnClose = document.getElementById('btn-close-scanner');

    let html5QrCode;

    const startScanner = (mode) => {
        overlay.classList.remove('hidden');
        html5QrCode = new Html5Qrcode("reader");

        const config = { fps: 10, qrbox: { width: 250, height: 250 } };

        html5QrCode.start(
            { facingMode: "environment" },
            config,
            (decodedText) => {
                handleScanResult(decodedText, mode);
                stopScanner();
            }
        ).catch(err => {
            showToast("Greška s kamerom: " + err, "error");
            stopScanner();
        });
    };

    const stopScanner = () => {
        if (html5QrCode) {
            html5QrCode.stop().then(() => {
                overlay.classList.add('hidden');
            });
        }
    };

    btnScanProduct.addEventListener('click', () => startScanner('product'));
    btnScanBill.addEventListener('click', () => startScanner('bill'));
    btnClose.addEventListener('click', stopScanner);
}

function handleScanResult(text, mode) {
    if (mode === 'bill') {
        const decoded = parseHUB3(text);
        if (decoded) {
            addBill(decoded);
            showToast("Uplatnica uspješno skenirana!", "success");
            switchTab('bills');
        } else {
            showToast("Nevažeći HUB 3.0 kod.", "error");
        }
    } else {
        // Product scanning logic (EAN lookup)
        addItemToShoppingList("Skenirano: " + text);
        showToast("Proizvod dodan!", "success");
    }
}

function parseHUB3(raw) {
    // Basic HUB 3.0 parser logic (to be refined)
    // Format is usually HUB3\n...\n
    if (!raw.startsWith("HUB3")) return null;

    const lines = raw.split('\n');
    return {
        id: Date.now(),
        raw: raw,
        amount: lines[11] || '0,00',
        currency: lines[10] || 'EUR',
        iban: lines[13] || '',
        reference: lines[15] || '',
        payer: lines[4] || 'Nepoznato',
        timestamp: new Date().toISOString()
    };
}

function addBill(bill) {
    state.bills.unshift(bill);
    saveLocalData();
    // renderBills(); // To be implemented
}

// Sync Utility
async function syncWithBackend(action, data = null) {
    if (!state.config.apiUrl) return;

    const syncStatus = document.getElementById('sync-status');
    syncStatus.className = 'sync-working';

    try {
        const options = {
            method: 'POST',
            mode: 'no-cors', // Apps Script requires no-cors sometimes or handles redirects
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, data })
        };

        // Note: Apps Script POST with no-cors doesn't return body, 
        // we'll use a hybrid approach or just trust the send for now.
        await fetch(state.config.apiUrl, options);

        showToast("Sinkronizirano!", "success");
    } catch (err) {
        console.error("Sync error:", err);
        showToast("Greška pri sinkronizaciji.", "error");
    } finally {
        syncStatus.className = 'sync-idle';
    }
}

async function loadFromBackend() {
    if (!state.config.apiUrl) return;
    try {
        const resp = await fetch(`${state.config.apiUrl}?action=getShoppingList`);
        const data = await resp.json();
        if (Array.isArray(data)) {
            state.shoppingList = data;
            renderShoppingList();
        }

        const respEx = await fetch(`${state.config.apiUrl}?action=getExpenses`);
        const dataEx = await respEx.json();
        if (Array.isArray(dataEx)) {
            state.expenses = dataEx;
            // renderExpenses(); 
        }
    } catch (e) {
        console.log("Load error", e);
    }
}

function showToast(msg, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerText = msg;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}
