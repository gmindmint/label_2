// DOM Elements
const optionsList = document.getElementById('options-list');
const addTermBtn = document.getElementById('add-term-btn');
const newTermInput = document.getElementById('new-term-input');
const errorDisplay = document.getElementById('error-display');
const statusDisplay = document.getElementById('status-display');

// --- Google Apps Script URL ---
// This is your specific URL
const G_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzyrpiOkADt6xKE0ltX3Qxo2f3YzFhv84U8R3WcEt9F4bqtk5BmyBQHkkPXAyVd0cJm6Q/exec';

// --- Utility functions for feedback ---
function showError(message) {
    errorDisplay.textContent = `Error: ${message}`;
    errorDisplay.style.display = 'block';
    statusDisplay.style.display = 'none'; // Hide status on error
}

function showStatus(message) {
    statusDisplay.textContent = message;
    statusDisplay.style.display = 'block';
    errorDisplay.style.display = 'none'; // Hide error on status update
    // Optionally hide status message after a delay
    setTimeout(() => { statusDisplay.style.display = 'none'; statusDisplay.textContent = ''; }, 3000);
}

function clearFeedback() {
    errorDisplay.style.display = 'none';
    errorDisplay.textContent = '';
    statusDisplay.style.display = 'none';
    statusDisplay.textContent = '';
}

// --- Function to Render the List ---
function renderOptionsList(options) {
    optionsList.innerHTML = ''; // Clear current list
    if (!options || !Array.isArray(options)) {
         optionsList.innerHTML = '<li>Error: Invalid data received.</li>';
         console.error("RenderOptionsList received invalid data:", options);
         return;
    }
    if (options.length === 0) {
        optionsList.innerHTML = '<li>No options defined yet.</li>';
        return;
    }
    options.forEach(term => {
        const li = document.createElement('li');

        const termSpan = document.createElement('span');
        termSpan.textContent = term; // Display the term text

        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Delete';
        deleteBtn.classList.add('delete-btn');
        deleteBtn.dataset.term = term; // Store the term to delete
        deleteBtn.addEventListener('click', handleDeleteTerm);

        li.appendChild(termSpan);
        li.appendChild(deleteBtn);
        optionsList.appendChild(li);
    });
}

// --- Function to Fetch Options using Google Apps Script ---
async function loadOptions() {
    clearFeedback();
    optionsList.innerHTML = '<li>Loading...</li>'; // Show loading indicator

    if (!G_SCRIPT_URL || G_SCRIPT_URL === 'PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE') { // Safety check
        showError("Google Apps Script URL is not configured correctly in settings.js.");
        optionsList.innerHTML = '<li>Configuration Error</li>';
        return;
    }

    try {
        // GET request to the Apps Script URL
        const response = await fetch(G_SCRIPT_URL); // Simple GET
        if (!response.ok) {
             let errorMsg = `HTTP error! status: ${response.status}`;
             try {
                 const errorData = await response.json();
                 errorMsg = errorData.error || errorData.message || errorMsg;
             } catch(e){ /* Ignore parsing error */ }
             throw new Error(errorMsg);
        }
        const options = await response.json(); // Expecting an array of strings directly from doGet

        // Handle potential error structure returned even with 200 OK
        if (typeof options === 'object' && options !== null && options.error) {
            throw new Error(options.error);
        }
        if (!Array.isArray(options)) {
             console.error("Received non-array data:", options);
             throw new Error("Invalid data format received from backend.");
         }

        renderOptionsList(options);

    } catch (error) {
        console.error("Failed to load options:", error);
        showError(`Could not load options. (${error.message})`);
        optionsList.innerHTML = '<li>Failed to load options.</li>'; // Show error in list area too
    }
}

// --- Function to Handle Adding a Term using Google Apps Script ---
async function handleAddTerm() {
    clearFeedback();
    const termText = newTermInput.value.trim();
    if (!termText) {
        showError("Please enter a term.");
        return;
    }

    if (!G_SCRIPT_URL || G_SCRIPT_URL === 'PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE') { // Safety check
        showError("Google Apps Script URL is not configured.");
        return;
    }

    // Disable button temporarily to prevent double clicks
    addTermBtn.disabled = true;
    addTermBtn.textContent = 'Adding...';

    try {
        const payload = {
            action: 'add',
            term: termText
        };

        // POST request to the Apps Script URL
        const response = await fetch(G_SCRIPT_URL, {
            method: 'POST',
            headers: {
                // Sending as text/plain might sometimes be simpler for Apps Script
                // but our script expects JSON, so stick with application/json
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
            // Apps Script doPost handles CORS via ContentService, so mode:'cors' (default) is needed.
            // Don't use mode: 'no-cors' as you won't get the response back.
        });

         // Check response status first
         if (!response.ok) {
             let errorMsg = `Request failed (Status: ${response.status})`;
             try {
                 const errorData = await response.json(); // Try to parse error message
                 errorMsg = errorData.message || errorMsg;
             } catch(e){ /* Ignore if body isn't JSON */ }
             throw new Error(errorMsg);
         }

        const responseData = await response.json(); // Expecting { success: boolean, message: string, terms: array }

        if (!responseData.success) {
            // Use the message from the Apps Script response
            throw new Error(responseData.message || 'Add operation reported failure from script.');
        }

        // Success
        newTermInput.value = ''; // Clear input field
        showStatus(responseData.message);
        renderOptionsList(responseData.terms); // Re-render list with updated data from response

    } catch (error) {
        console.error("Error adding term:", error);
        showError(error.message);
    } finally {
        // Re-enable button
        addTermBtn.disabled = false;
        addTermBtn.textContent = 'Add Term';
    }
}

// --- Function to Handle Deleting a Term using Google Apps Script ---
async function handleDeleteTerm(event) {
    clearFeedback();
    const termToDelete = event.target.dataset.term;
    const deleteButton = event.target; // Reference to the button clicked

    if (!termToDelete) {
        console.error("Could not find term to delete from button dataset.");
        showError("Internal error: Cannot identify term to delete.");
        return;
    }

    if (!G_SCRIPT_URL || G_SCRIPT_URL === 'PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE') { // Safety check
        showError("Google Apps Script URL is not configured.");
        return;
    }

    if (!confirm(`Are you sure you want to delete "${termToDelete}"?`)) {
        return; // User cancelled
    }

    // Disable button clicked
    deleteButton.disabled = true;
    deleteButton.textContent = 'Deleting...';

    try {
        const payload = {
            action: 'delete',
            term: termToDelete
        };

        // POST request for deletion
        const response = await fetch(G_SCRIPT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

         if (!response.ok) {
             let errorMsg = `Request failed (Status: ${response.status})`;
             try { const errorData = await response.json(); errorMsg = errorData.message || errorMsg; } catch(e){}
             throw new Error(errorMsg);
         }

        const responseData = await response.json(); // Expecting { success: boolean, message: string, terms: array }

        if (!responseData.success) {
            // Use the message from the Apps Script response
             throw new Error(responseData.message || 'Delete operation reported failure from script.');
        }

        // Success
        showStatus(responseData.message);
        renderOptionsList(responseData.terms); // Re-render list with updated data

    } catch (error) {
        console.error("Error deleting term:", error);
        showError(error.message);
        // Re-enable button only on error, because on success the button is removed by renderOptionsList
        deleteButton.disabled = false;
        deleteButton.textContent = 'Delete';
    }
    // No finally block needed here as the button might be gone on success
}

// --- Event Listeners ---
addTermBtn.addEventListener('click', handleAddTerm);
newTermInput.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
        // Optionally prevent default form submission if it were inside a <form>
        // event.preventDefault();
        handleAddTerm();
    }
});

// --- Initial Load ---
document.addEventListener('DOMContentLoaded', loadOptions);