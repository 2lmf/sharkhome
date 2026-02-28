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
// UI Elements (Initialized in init functions)
let shoppingListContainer;
let inputNewItem;
let btnAddItem;

// Recipe Draft State
let currentRecipeDraft = {
    name: '',
    ingredients: []
};

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    initShopping();
    initScanner();
    initAnalytics(); // For Chart.js
    initBills();
    initRecipes();

    // Load local state first for immediate feel
    loadLocalData();
    renderShoppingList();
    renderAnalytics();
    renderRecipes();
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
    const inputDesc = document.getElementById('input-expense-desc');

    if (btnSave && inputAmount) {
        btnSave.addEventListener('click', () => {
            console.log("UPIŠI clicked!"); // Debug log
            const rawValue = inputAmount.value.replace(',', '.'); // Handle comma decimal separator
            const amount = parseFloat(rawValue);
            const desc = inputDesc ? inputDesc.value.trim() : "";

            if (!isNaN(amount) && amount > 0) {
                addExpense({
                    id: Date.now(),
                    category: selectedCategory,
                    description: desc,
                    amount: amount, // Store as float
                    date: new Date().toISOString()
                });
                inputAmount.value = '';
                if (inputDesc) inputDesc.value = '';

                const title = desc ? `${selectedCategory} (${desc})` : selectedCategory;
                showToast(`${title}: ${formatHRNumber(amount)} upisano!`, 'success');
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
        const descText = ex.description ? ` - ${ex.description}` : '';

        return `
        <div class="expense-item">
            <div class="expense-item-top">
                <div class="expense-meta">
                    <span class="expense-cat">${ex.category}${descText}</span>
                    <span class="expense-date">${formatCroatianDate(ex.date)}</span>
                </div>
                <div class="expense-val">${formatHRNumber(amountFloat)}</div>
            </div>
            <div class="expense-actions-bar">
                <button class="btn-expense-action" style="color:var(--accent);" onclick="editExpense('${ex.id}')">
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                    Uredi
                </button>
                <button class="btn-expense-action" style="color:var(--accent-red);" onclick="deleteExpense('${ex.id}')">
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    Obriši
                </button>
            </div>
        </div>
    `}).join('');
}

window.deleteExpense = (id) => {
    if (confirm("Želiš li zaista obrisati ovaj trošak?")) {
        state.expenses = state.expenses.filter(e => e.id != id);
        saveLocalData();
        renderExpenses();
    }
};

window.editExpense = (id) => {
    const ex = state.expenses.find(e => e.id == id);
    if (!ex) return;

    const newDesc = prompt(`Uredi opis za ${ex.category}:`, ex.description || '');
    if (newDesc === null) return; // User cancelled

    // Convert float back to string with comma for prompting just in case
    const amountStr = typeof ex.amount === 'number' ? ex.amount.toString() : ex.amount;
    const newAmount = prompt(`Uredi iznos za ${ex.category} (${formatCroatianDate(ex.date)}):`, amountStr);

    if (newAmount !== null) {
        const rawValue = newAmount.replace(',', '.');
        const amountFloat = parseFloat(rawValue);
        if (!isNaN(amountFloat)) {
            ex.amount = amountFloat;
            ex.description = newDesc.trim();
            saveLocalData();
            renderExpenses();
        } else {
            alert("Neispravan iznos!");
        }
    }
}

// ==========================================
// RECIPES LOGIC
// ==========================================

function initRecipes() {
    const btnToggle = document.getElementById('btn-toggle-recipe-form');
    const formContainer = document.getElementById('recipe-form');
    const inputName = document.getElementById('input-recipe-name');
    const inputIng = document.getElementById('input-recipe-ingredient');
    const btnAddIng = document.getElementById('btn-add-ingredient');
    const btnSaveRecipe = document.getElementById('btn-save-recipe');

    if (!btnToggle) return;

    btnToggle.addEventListener('click', () => {
        formContainer.classList.toggle('hidden');
        if (!formContainer.classList.contains('hidden')) {
            inputName.focus();
        }
    });

    btnAddIng.addEventListener('click', () => {
        const ing = inputIng.value.trim();
        if (ing) {
            // Split by comma or 'i' just like shopping list
            const items = ing.split(/\s*,\s*|\s+i\s+/i).filter(t => t.trim() !== "");
            items.forEach(item => {
                currentRecipeDraft.ingredients.push({ id: Date.now() + Math.random(), text: item });
            });
            inputIng.value = '';
            renderDraftIngredients();
        }
    });

    inputIng.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') btnAddIng.click();
    });

    btnSaveRecipe.addEventListener('click', () => {
        const name = inputName.value.trim();
        if (!name) {
            showToast("Unesi ime recepta!", "error");
            return;
        }
        if (currentRecipeDraft.ingredients.length === 0) {
            showToast("Dodaj barem jedan sastojak!", "error");
            return;
        }

        const newRecipe = {
            id: Date.now().toString(),
            name: name,
            ingredients: [...currentRecipeDraft.ingredients],
            timestamp: new Date().toISOString()
        };

        state.recipes.unshift(newRecipe);
        saveLocalData();
        renderRecipes();
        showToast("Recept spremljen!", "success");

        // Reset form
        inputName.value = '';
        currentRecipeDraft.ingredients = [];
        renderDraftIngredients();
        formContainer.classList.add('hidden');
    });
}

function renderDraftIngredients() {
    const container = document.getElementById('draft-ingredients-list');
    if (!container) return;

    container.innerHTML = currentRecipeDraft.ingredients.map(ing => `
        <div class="draft-item">
            <span>• ${ing.text}</span>
            <span onclick="removeDraftIngredient(${ing.id})" style="color:var(--accent-red); cursor:pointer;">✖</span>
        </div>
    `).join('');
}

window.removeDraftIngredient = (id) => {
    currentRecipeDraft.ingredients = currentRecipeDraft.ingredients.filter(i => i.id !== id);
    renderDraftIngredients();
}

function renderRecipes() {
    const grid = document.getElementById('recipes-grid');
    if (!grid) return;

    if (state.recipes.length === 0) {
        grid.innerHTML = `<div class="empty-state">Ovdje će biti tvoji recepti.</div>`;
        return;
    }

    grid.innerHTML = state.recipes.map(recipe => {
        const ingList = recipe.ingredients.map(i => `
            <li class="recipe-ingredient-item">
                <span class="recipe-ingredient-text">• ${i.text}</span>
                <button class="btn-edit-ingredient" onclick="editRecipeIngredient('${recipe.id}', ${i.id})">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                </button>
            </li>
        `).join('');
        const shareText = encodeURIComponent(`Novi recept: *${recipe.name}*\nSastojci:\n${recipe.ingredients.map(i => '- ' + i.text).join('\n')}`);

        return `
        <div class="recipe-card">
            <div class="recipe-card-header">
                <div class="recipe-card-title">${recipe.name}</div>
                <div class="recipe-card-actions">
                    <button class="recipe-icon-btn btn-share-wa" onclick="window.open('https://api.whatsapp.com/send?text=${shareText}', '_blank')">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
                    </button>
                    <button class="recipe-icon-btn" style="color:var(--accent-red); border-color:var(--accent-red);" onclick="deleteRecipe('${recipe.id}')">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                </div>
            </div>
            <ul class="recipe-ingredients-list">
                ${ingList}
            </ul>
            <div class="recipe-add-all-btn" onclick="addRecipeToShoppingList('${recipe.id}')">
                DODAJ SVE NA POPIS 🛒
            </div>
        </div>
    `}).join('');
}

window.deleteRecipe = (id) => {
    if (confirm("Obriši ovaj recept?")) {
        state.recipes = state.recipes.filter(r => r.id !== id);
        saveLocalData();
        renderRecipes();
    }
}

window.editRecipeIngredient = (recipeId, ingredientId) => {
    const recipe = state.recipes.find(r => r.id === recipeId);
    if (!recipe) return;

    const ingredient = recipe.ingredients.find(i => i.id == ingredientId);
    if (!ingredient) return;

    const newText = prompt(`Uredi sastojak:`, ingredient.text);
    if (newText !== null && newText.trim() !== '') {
        ingredient.text = newText.trim();
        saveLocalData();
        renderRecipes();
    }
}

window.addRecipeToShoppingList = (id) => {
    const recipe = state.recipes.find(r => r.id === id);
    if (recipe) {
        recipe.ingredients.forEach(ing => {
            const newItem = {
                id: Date.now() + Math.random(),
                text: ing.text,
                completed: false,
                timestamp: new Date().toISOString()
            };
            state.shoppingList.unshift(newItem);
        });
        saveLocalData();
        renderShoppingList();
        syncWithBackend('updateShopping', state.shoppingList);
        showToast(`Sastojci za ${recipe.name} dodani na popis!`, "success");
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
