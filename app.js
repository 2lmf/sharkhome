/**
 * SharkHome - Core Logic
 */

const state = {
    currentTab: 'shopping',
    shoppingList: [],
    expenses: [],
    recipes: [],
    customProducts: [],
    config: {
        apiUrl: 'https://script.google.com/macros/s/AKfycbyQmtsILzYGXAPvPBFU5tvEObBnns3AFD4H9DLj20aYWXv7I_zJ3wpvuwbyuOa6Sr5R/exec',
        telegramToken: localStorage.getItem('hub_telegram_token') || ''
    }
};

// UI Elements (Initialized in init functions)
let shoppingListContainer;
let inputNewItem;
let btnAddItem;

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    initShopping();
    initScanner();
    initAnalytics(); // For Chart.js
    initBills();

    // Load local state first for immediate feel
    loadLocalData();
    renderShoppingList();
    renderAnalytics();
});

// Tab Navigation
function initTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.dataset.tab;
            switchTab(target);
        });
    });
}

const seedProducts = [
    "Kruh", "Mlijeko", "Jaja", "Maslac", "Ulje", "Brašno", "Šećer", "Sol", "Papar", "Riža",
    "Tjestenina", "Krumpir", "Luk", "Češnjak", "Rajčica", "Paprika", "Krastavci", "Zelena salata", "Jabuke", "Banane",
    "Naranče", "Limun", "Mrkva", "Piletina", "Mljeveno meso", "Svinjetina", "Riba", "Tuna", "Sir", "Svježi sir",
    "Vrhnje za kuhanje", "Kiselo vrhnje", "Jogurt", "Kefir", "Čokolada", "Keksi", "Kava", "Čaj", "Sok", "Pivo",
    "Vino", "Mineralna voda", "Toaletni papir", "Papirnati ručnici", "Deterdžent za suđe", "Deterdžent za rublje", "Omekšivač", "Sapun", "Šampon", "Pasta za zube",
    "Četkica za zube", "Vlažne maramice", "Dezodorans", "Gel za tuširanje", "Vrećice za smeće", "Spužvice", "Aluminijska folija", "Papir za pečenje", "Pršut", "Šunka",
    "Panceta", "Hrenovke", "Kobasice", "Pašteta", "Majoneza", "Ketchup", "Senf", "Ocat", "Maslinovo ulje", "Grah",
    "Kukuruz", "Pelati", "Pasirana rajčica", "Gljive", "Vrhnje za šlag", "Puding", "Kocka za juhu", "Griz", "Zobene pahuljice", "Muesli",
    "Med", "Marmelada", "Lino Lada", "Nutella", "Smrznuti grašak", "Smrznuti špinat", "Sladoled", "Kvasac", "Prašak za pecivo",
    "Vanilin šećer", "Vegeta", "Ljuta paprika", "Slatka paprika", "Origano", "Bosiljak", "Čips", "Smoki", "Štapići", "Kikiriki"
];

function switchTab(tabId) {
    state.currentTab = tabId;

    // Update Buttons
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabId);
    });

    // Update Views
    const views = document.querySelectorAll('.tab-view');
    views.forEach(view => {
        view.classList.toggle('active', view.id === `view-${tabId}`);
    });

    if (tabId === 'stats') renderAnalytics();
    if (tabId === 'bills') renderExpenses();
}

// Shopping Logic
function initShopping() {
    shoppingListContainer = document.getElementById('shopping-list-container');
    inputNewItem = document.getElementById('input-new-item');
    btnAddItem = document.getElementById('btn-add-item');

    if (btnAddItem) {
        btnAddItem.addEventListener('click', () => {
            const value = inputNewItem.value.trim();
            if (value) {
                addItemToShoppingList(value);
                inputNewItem.value = '';
            }
        });
    }

    if (inputNewItem) {
        inputNewItem.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') btnAddItem.click();
        });

        // Populate Datalist with seed products and custom products
        const datalist = document.getElementById('product-suggestions');
        if (datalist && datalist.children.length === 0) {
            const allProducts = [...new Set([...seedProducts, ...(state.customProducts || [])])];
            allProducts.forEach(prod => {
                const option = document.createElement('option');
                option.value = prod;
                datalist.appendChild(option);
            });
        }
    }

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
    console.log("Splitting input:", text);
    // Split by comma or the word "i" (case-insensitive)
    const items = text.split(/\s*,\s*|\s+i\s+/i).filter(t => t.trim() !== "");

    items.forEach(itemText => {
        const itemName = itemText.trim();
        const newItem = {
            id: Date.now() + Math.random(), // Add random for bulk adds
            text: itemName,
            completed: false,
            timestamp: new Date().toISOString()
        };
        state.shoppingList.unshift(newItem);

        // Dynamically learn new product
        if (!seedProducts.some(p => p.toLowerCase() === itemName.toLowerCase()) &&
            (!state.customProducts || !state.customProducts.some(p => p.toLowerCase() === itemName.toLowerCase()))) {
            if (!state.customProducts) state.customProducts = [];
            state.customProducts.push(itemName);

            const datalist = document.getElementById('product-suggestions');
            if (datalist) {
                const option = document.createElement('option');
                option.value = itemName;
                datalist.appendChild(option);
            }
        }
    });

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
    const categories = ['Dućan', 'Struja', 'Plin', 'Mobitel', 'TV', 'Internet', 'Sport', 'Škola/Vrtić', 'Ostalo'];
    const saved = localStorage.getItem('hub_state');
    if (saved) {
        const parsed = JSON.parse(saved);
        state.shoppingList = parsed.shoppingList || [];
        state.expenses = parsed.expenses || parsed.bills || [];
        state.recipes = parsed.recipes || [];
        state.customProducts = parsed.customProducts || [];
    }
}

let selectedCategory = 'Dućan';

function initBills() {
    const catBtns = document.querySelectorAll('.cat-btn[data-cat]');

    // Set initial active state
    catBtns.forEach(btn => {
        if (btn.dataset.cat === selectedCategory) btn.classList.add('active');

        btn.addEventListener('click', () => {
            selectedCategory = btn.dataset.cat;
            catBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });

    const btnSave = document.getElementById('btn-save-expense');
    const inputAmount = document.getElementById('input-expense-amount');

    if (btnSave && inputAmount) {
        btnSave.addEventListener('click', () => {
            console.log("UPIŠI clicked!"); // Debug log
            const rawValue = inputAmount.value.replace(',', '.'); // Handle comma decimal separator
            const amount = parseFloat(rawValue);

            if (!isNaN(amount) && amount > 0) {
                addExpense({
                    id: Date.now(),
                    category: selectedCategory,
                    amount: amount, // Store as float
                    date: new Date().toISOString()
                });
                inputAmount.value = '';
                showToast(`${selectedCategory}: ${formatHRNumber(amount)} upisano!`, 'success');
            } else {
                showToast("Prvo upiši brojku!", "error");
            }
        });

        // Enter key support
        inputAmount.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') btnSave.click();
        });
    }
}

// Scanner Stub
function initScanner() {
    console.log("Scanner init (stub)");
}

// Analytics Stub (Chart.js)
function initAnalytics() {
    console.log("Analytics init (stub)");
}

function renderAnalytics() {
    console.log("Analytics render (stub)");
}

function addExpense(expense) {
    state.expenses.unshift(expense);
    saveLocalData();
    renderExpenses();
    syncWithBackend('addExpense', expense);
}

function renderExpenses() {
    const container = document.getElementById('expenses-list');
    if (!container) return;

    if (state.expenses.length === 0) {
        container.innerHTML = `<div class="empty-state">Nema zapisa.</div>`;
        return;
    }

    container.innerHTML = state.expenses.map(ex => {
        // Handle old string amounts safely
        const amountFloat = typeof ex.amount === 'string' ? parseFloat(ex.amount.replace(',', '.')) : ex.amount;
        return `
        <div class="expense-item" onclick="editExpense('${ex.id}')">
            <div class="expense-meta">
                <span class="expense-cat">${ex.category}</span>
                <span class="expense-date">${formatCroatianDate(ex.date)}</span>
            </div>
            <div class="expense-val">${formatHRNumber(amountFloat)}</div>
        </div>
    `}).join('');
}

function formatHRNumber(num) {
    if (isNaN(num)) return "0,00 €";
    return new Intl.NumberFormat('hr-HR', {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(num);
}

function formatCroatianDate(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString('hr-HR') + ' ' + d.toLocaleTimeString('hr-HR', { hour: '2-digit', minute: '2-digit' });
}

window.editExpense = (id) => {
    const ex = state.expenses.find(e => e.id == id);
    if (!ex) return;

    const newAmount = prompt(`Uredi iznos za ${ex.category} (${formatCroatianDate(ex.date)}):`, ex.amount);
    if (newAmount !== null) {
        ex.amount = newAmount;
        saveLocalData();
        renderExpenses();
        // Since we cleared and updated in GAS with syncWithBackend for shopping, 
        // for Expenses we might need a separate 'updateExpenses' but for now 
        // we append. Ideally we'd have update.
    }
}

// Global scope for onclick
window.addItemToShoppingList = addItemToShoppingList;

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
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, data })
        };

        // Note: fetch with no-cors always returns opaque response (status 0)
        await fetch(state.config.apiUrl, options);

        showToast("Zahtjev poslan!", "success");
    } catch (err) {
        console.error("Sync error:", err);
        showToast("Mrežna greška.", "error");
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
