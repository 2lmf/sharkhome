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
        apiUrl: localStorage.getItem('shark_api_url') || 'https://script.google.com/macros/s/AKfycbyQmtsILzYGXAPvPBFU5tvEObBnns3AFD4H9DLj20aYWXv7I_zJ3wpvuwbyuOa6Sr5R/exec',
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
    // Register Service Worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js')
            .then(() => console.log("SW Registered"))
            .catch(err => console.log("SW Error", err));
    }

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

    // Show version in console for debugging
    console.log("SharkHome v1.8 Loaded");
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

    // Voice Dictation Auto-Correct Dictionary
    let correctedText = text;
    const dictionary = {
        "mljeko": "mlijeko",
        "mljeka": "mlijeka",
        "čevapi": "ćevapi",
        "kruč": "kruh"
    };

    // Apply corrections (case insensitive word boundary replacement)
    for (const [wrong, right] of Object.entries(dictionary)) {
        const regex = new RegExp(`\\b${wrong}\\b`, 'gi');
        correctedText = correctedText.replace(regex, right);
    }

    // Split by comma or the word "i" (case-insensitive)
    const items = correctedText.split(/\s*,\s*|\s+i\s+/i).filter(t => t.trim() !== "");

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

        let loadedExpenses = [];
        if (parsed.expenses && parsed.expenses.length > 0) {
            loadedExpenses = parsed.expenses;
        } else if (parsed.bills && parsed.bills.length > 0) {
            loadedExpenses = parsed.bills;
        } else {
            loadedExpenses = [];
        }

        state.expenses = loadedExpenses;
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
            if (btn.dataset.cat === 'Dodaj') {
                const customCat = prompt("Unesi naziv nove kategorije:");
                if (customCat && customCat.trim() !== "") {
                    selectedCategory = customCat.trim();
                    // Temporary visual feedback: change the button text
                    btn.innerText = `➕ ${selectedCategory}`;
                    btn.dataset.cat = selectedCategory;
                } else {
                    return; // Cancel
                }
            } else {
                selectedCategory = btn.dataset.cat;
            }

            catBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });

    const btnSave = document.getElementById('btn-save-expense');
    const inputAmount = document.getElementById('input-expense-amount');
    const inputDesc = document.getElementById('input-expense-desc');

    if (btnSave && inputAmount) {
        btnSave.addEventListener('click', () => {
            console.log("UPIŠI clicked! Raw:", inputAmount.value, "Desc:", inputDesc ? inputDesc.value : 'null');
            const amount = parseFloat(inputAmount.value);
            const desc = inputDesc ? inputDesc.value.trim() : "";
            console.log("Parsed Amount:", amount);

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

// Scanner (html5-qrcode)
let html5QrScanner = null;

function initScanner() {
    const btnOpenScanner = document.getElementById('btn-scan-bill'); // You'll need this button in index.html
    const btnCloseScanner = document.getElementById('btn-close-scanner');
    const overlay = document.getElementById('scanner-overlay');

    if (btnOpenScanner) {
        btnOpenScanner.addEventListener('click', () => {
            overlay.classList.remove('hidden');
            startScanner();
        });
    }

    if (btnCloseScanner) {
        btnCloseScanner.addEventListener('click', () => {
            overlay.classList.add('hidden');
            stopScanner();
        });
    }
}

function startScanner() {
    html5QrScanner = new Html5Qrcode("reader");
    const config = { fps: 10, qrbox: { width: 250, height: 150 } };

    html5QrScanner.start(
        { facingMode: "environment" },
        config,
        (decodedText) => {
            stopScanner();
            document.getElementById('scanner-overlay').classList.add('hidden');
            handleScanResult(decodedText, 'bill');
        },
        (errorMessage) => {
            // console.log(errorMessage);
        }
    ).catch(err => {
        showToast("Greška pri pokretanju kamere.", "error");
    });
}

function stopScanner() {
    if (html5QrScanner) {
        html5QrScanner.stop().then(() => {
            html5QrScanner = null;
        });
    }
}

// Analytics (Chart.js)
let expenseChart = null;

function initAnalytics() {
    const ctx = document.getElementById('expenseChart');
    if (!ctx) return;

    expenseChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: [],
            datasets: [{
                data: [],
                backgroundColor: [
                    '#E67E22', '#2ECC71', '#3498DB', '#9B59B6',
                    '#F1C40F', '#1ABC9C', '#E74C3C', '#95A5A6', '#34495E'
                ],
                borderWidth: 0,
                hoverOffset: 10
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'bottom',
                    labels: {
                        color: 'white',
                        font: { family: 'Orbitron', size: 10 },
                        padding: 15,
                        generateLabels: (chart) => {
                            const data = chart.data;
                            if (data.labels.length && data.datasets.length) {
                                return data.labels.map((label, i) => {
                                    const meta = chart.getDatasetMeta(0);
                                    const style = meta.controller.getStyle(i);
                                    const value = data.datasets[0].data[i];
                                    const total = data.datasets[0].data.reduce((a, b) => a + b, 0);
                                    const pct = total > 0 ? Math.round((value / total) * 100) : 0;
                                    return {
                                        text: `${label} (${pct}%)`,
                                        fillStyle: style.backgroundColor,
                                        strokeStyle: style.borderColor,
                                        lineWidth: style.borderWidth,
                                        hidden: chart.getDatasetMeta(0).data[i].hidden,
                                        index: i
                                    };
                                });
                            }
                            return [];
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const pct = total > 0 ? Math.round((context.raw / total) * 100) : 0;
                            return ` ${context.label}: ${formatHRNumber(context.raw)} (${pct}%)`;
                        }
                    }
                }
            },
            cutout: '65%'
        }
    });

    renderAnalytics();
}

function renderAnalytics() {
    if (!expenseChart) return;

    // Calculate totals by category
    const totals = {};
    state.expenses.forEach(ex => {
        const amount = typeof ex.amount === 'string' ? parseFloat(ex.amount.replace(',', '.')) : ex.amount;
        if (!isNaN(amount)) {
            totals[ex.category] = (totals[ex.category] || 0) + amount;
        }
    });

    const labels = Object.keys(totals);
    const data = Object.values(totals);

    expenseChart.data.labels = labels;
    expenseChart.data.datasets[0].data = data;
    expenseChart.update();

    // Render Breakdown List
    const breakdownContainer = document.getElementById('category-breakdown');
    if (breakdownContainer) {
        if (labels.length === 0) {
            breakdownContainer.innerHTML = '<div class="empty-state">Nema podataka za prikaz.</div>';
            return;
        }

        const totalSum = data.reduce((a, b) => a + b, 0);

        breakdownContainer.innerHTML = `
            <div class="total-spend-card">
                <span class="total-label">UKUPNO MJESEČNO</span>
                <span class="total-amount">${formatHRNumber(totalSum)}</span>
            </div>
            <div class="breakdown-grid">
                ${labels.map((cat, i) => {
            const percentage = totalSum > 0 ? Math.round((totals[cat] / totalSum) * 100) : 0;
            const color = expenseChart.data.datasets[0].backgroundColor[i % 9];
            return `
                    <div class="breakdown-item" style="border-left: 3px solid ${color};">
                        <div class="breakdown-info">
                            <span class="breakdown-name" style="color:${color}">${cat}</span>
                            <span class="breakdown-val" style="color:${color}">${formatHRNumber(totals[cat])}</span>
                        </div>
                        <span class="breakdown-pct" style="color:rgba(255,255,255,0.5)">${percentage}%</span>
                    </div>
                    `;
        }).join('')}
            </div>
        `;
    }
}

function addExpense(expense) {
    state.expenses.unshift(expense);
    saveLocalData();
    renderExpenses();
    syncWithBackend('updateExpenses', state.expenses);
}

// Format numbers specifically for Excel (e.g. 1.234,56 as string)
function formatForExcel(num) {
    return new Intl.NumberFormat('hr-HR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
        useGrouping: true
    }).format(num);
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
        syncWithBackend('updateExpenses', state.expenses);
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
            syncWithBackend('updateExpenses', state.expenses);
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

// Utility: Formatting
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
    if (!iso) return "";
    const date = new Date(iso);
    return date.toLocaleString('hr-HR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Reset Logic for Debugging
window.resetApp = () => {
    if (confirm("Ovo će obrisati sve lokalne podatke i cache. Jesi li siguran?")) {
        localStorage.clear();
        if ('serviceWorker' in navigator) {
            caches.keys().then(names => {
                for (let name of names) caches.delete(name);
            });
        }
        location.reload(true);
    }
};

window.updateApiUrl = () => {
    const newUrl = prompt("Unesi novi Google App Script URL:", state.config.apiUrl);
    if (newUrl && newUrl.startsWith('https://')) {
        state.config.apiUrl = newUrl.trim();
        localStorage.setItem('shark_api_url', state.config.apiUrl);
        showToast("URL spremljen! Osvježavam...", "success");
        setTimeout(() => location.reload(), 1000);
    }
};

function handleScanResult(text, mode) {
    if (mode === 'bill') {
        const decoded = parseHUB3(text);
        if (decoded) {
            // Map HUB 3.0 data to my expense structure
            const newExpense = {
                id: Date.now(),
                category: 'Ostalo', // Default category for scanned bills
                amount: decoded.amount,
                description: `Sken: ${decoded.payer}`,
                date: new Date().toISOString()
            };
            addExpense(newExpense);
            showToast("Uplatnica uspješno skenirana!", "success");
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
    if (!raw.startsWith("HUB3")) return null;

    const lines = raw.split('\n');
    // HUB 3.0 standard indices:
    // Amount is often in line 11 (if 0-indexed it depends on the raw string structure)
    // For standard HUB 3.0 (PDF417), indices are often:
    // 10: Valuta (EUR)
    // 11: Iznos (e.g. 0000000001235 -> 12.35)
    // 13: IBAN primatelja
    // 15: Poziv na broj

    let rawAmount = lines[11] || '0';
    let amountFloat = 0;

    if (rawAmount.length > 2) {
        amountFloat = parseFloat(rawAmount) / 100;
    } else {
        amountFloat = parseFloat(rawAmount);
    }

    return {
        id: Date.now(),
        amount: amountFloat,
        payer: lines[4] || 'Nepoznat platitelj',
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
