const fs = require('fs');

// We simulate DOM elements
const mockStorage = { getItem: () => JSON.stringify({ expenses: [] }), setItem: () => { } };
global.localStorage = mockStorage;

const btnSave = { addEventListener: (event, cb) => { btnSave.click = cb; } };
const inputAmount = { value: '1,50' };
const inputDesc = { value: 'Test' };

// We want to test the click logic
btnSave.click = null;
btnSave.addEventListener('click', () => {
    try {
        const rawValue = inputAmount.value.replace(',', '.');
        const amount = parseFloat(rawValue);
        const desc = inputDesc ? inputDesc.value.trim() : "";
        if (!isNaN(amount) && amount > 0) {
            console.log("Success! Amount:", amount, "Desc:", desc);
        } else {
            console.log("Validation Failed");
        }
    } catch (e) {
        console.error("Crash:", e);
    }
});

btnSave.click();
