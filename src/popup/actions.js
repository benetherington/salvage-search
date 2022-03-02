/*-------*\
  TOOLBAR  
\*-------*/
// handle clicks
document.addEventListener("click", (event) =>{
    if (event.target.id === "button-settings"){
        // update pages active status
        document.querySelectorAll(".slider-page").forEach(el=>{el.classList.remove("active")})
        document.getElementById("settings").classList.add("active")
        // scroll the page
        document.getElementById("slider").scrollLeft = 310
        // update toolbar
        document.getElementById("button-settings").classList.add("hidden")
        document.getElementById("button-main").classList.remove("hidden")
        event.stopPropagation()
    } else if (event.target.id === "button-main"){
        // update pages active status
        document.querySelectorAll(".slider-page").forEach(el=>{el.classList.remove("active")})
        document.getElementById("main").classList.add("active")
        // scroll the page
        document.getElementById("slider").scrollLeft = 0
        // update toolbar
        document.getElementById("button-main").classList.add("hidden")
        document.getElementById("button-settings").classList.remove("hidden")
        event.stopPropagation()
    };
});



/*-----*\
  INPUT
\*-----*/
// Clipboard input
window.addEventListener("focus", async ()=>{
    // TODO: to request access in Chrome, we need to load a new tab

    // Skip if there's already something to search for
    const searchInput = document.getElementById("search-input").value;
    if (searchInput.value) return;
    
    // Request open tabs check
    downloadPort.postMessage({findTabs: true})
    
    // Grab clipboard
    clipboard = await navigator.clipboard.readText().then(s=>s.trim());
    
    // Load clipboard contents after a delay, allowing open tabs to load
    // instead. We could load immediately, but this might result in flickering.
    setTimeout(()=>{
        if (searchInput.value) return;
        searchInput.value = clipboard;
    }, 200)
});

// Typed input
document.addEventListener("DOMContentLoaded", ()=>{
    document
    .getElementById('search-input')
    .addEventListener('input', ()=>{
        const input = document.getElementById('search-input').value;
        
        // Validate VINs
        if (validateVin(input)) {
            console.log('VIN')
            document.getElementById("search-button").enable()
            return;
        } else {
            document.getElementById("search-button").disable()
        }
        
        // Validate lot numbers
        if (validateLot(input)) {
            console.log('lot number')
            document.getElementById("download-button").enable()
        } else {
            document.getElementById("download-button").disable()
        }
    })
})



/*---------*\
  MESSAGING
\*---------*/
// Connect messaging ports
let searchPort, downloadPort;
document.addEventListener("DOMContentLoaded", ()=>{
    searchPort = browser.runtime.connect({name:"search"});
    searchPort.onMessage.addListener(onSearchMessage)
    
    downloadPort = browser.runtime.connect({name:"download"});
    downloadPort.onMessage.addListener(onDownloadMessage)
})



/*------*\
  SEARCH
\*------*/
// Search Button
document.addEventListener("DOMContentLoaded", ()=>{
    document
    .getElementById("search-button")
    .addEventListener("click", ()=>{
        document.getElementById("search-button").start()
        const query = document.getElementById("search-input").value;
        const salvage = document.getElementById("salvage-input").value;
        searchPort.postMessage({query, salvage})
    })
})

// Handle search messages
const onSearchMessage = (message)=>{
    if (message.found) {
        // Flash the download button
        document.getElementById("download-button").attention();
        
        // Update salvage input (we already have a VIN/Lot)
        document.getElementById("salvage-input").value = message.salvage;
    }
    
    // Reset the search button
    if (message.complete) document.getElementById("search-button").enable();
    
    // Display feedback messages
    if (message.feedback) addFeedbackMessage(message.feedback);
};



/*--------*\
  DOWNLOAD
\*--------*/
// Download button
document.addEventListener("DOMContentLoaded", ()=>{
    document
    .getElementById("download-button")
    .addEventListener("click", ()=>{
        document.getElementById("download-button").start()
        const query = document.getElementById("search-input").value;
        downloadPort.postMessage(query)
    })
})

// Handle download messages
const onDownloadMessage = (message)=>{
    // Reset the download button
    if (message.download) document.getElementById("download-button").enable();
    
    // Update query fields from open tab
    if (message.lotNumber) {
        document.getElementById("search-input").value = message.lotNumber;
        document.getElementById("salvage-input").value = message.salvage;
    };
    
    // Display feedback messages
    if (message.feedback) addFeedbackMessage(message.feedback);
}



/*--------*\
  FEEDBACK  
\*--------*/
const addFeedbackMessage = (rawFeedback)=>{
    // PROCESS
    let feedback = {};
    // make sure there's a message
    if (rawFeedback.message) {
        // unpack with defaults
        let {
            message,
            duration = 5*1000,
            closeable = true,
            displayAs = "status"
        } = rawFeedback;
        // set processed values
        feedback.message   = message;
        feedback.duration  = duration;
        feedback.closeable = closeable;
        feedback.displayAs = displayAs;
        feedback.createdAt = performance.now().toString();
    } else {console.log("empty message");return;}

    // CREATE ELEMENT
    let notification = document.createElement("div");
    notification.classList.add("notification")
    notification.classList.add(feedback.displayAs)
    notification.innerText = feedback.message;
    // add it to the page
    let drawer = document.querySelector("#notification-drawer");
    drawer.appendChild(notification)


    // PREPARE FOR THE END
    closeUp = ()=>{

        // remove from drawer
        notification.remove()
        // close drawer
        if (drawer.childElementCount===0) {drawer.classList.add("hidden")}
    }
    // set removal conditions
    notification.addEventListener("click", closeUp)

    // show the drawer
    drawer.classList.remove("hidden")
}


/*----------------*\
  PREFERENCES PAGE  
\*----------------*/
const fetchStoredSettings = async ()=>{
    // Defined in shared-assets.js
    const settings = await defaultedSettings();
    
    document.querySelector(".settings-grid input#copart").checked = settings.searchCopart;
    document.querySelector(".settings-grid input#iaai"  ).checked = settings.searchIaai;
    document.querySelector(".settings-grid input#row52" ).checked = settings.searchRow52;
    document.querySelector(".settings-grid input#poctra").checked = settings.searchPoctra;
    document.querySelector(".settings-grid input#bidfax").checked = settings.searchBidfax;
};

const setStoredSettings = async ()=>{
    // Start with defaults from shared-assets.js
    const settings = await defaultedSettings();
    
    // Update defaults from the page
    settings.searchCopart   = preferences.copartCheckEl.checked;
    settings.searchIaai     = preferences.iaaiCheckEl.checked;
    settings.searchRow52    = preferences.row52CheckEl.checked;
    settings.searchPoctra   = preferences.poctraCheckEl.checked;
    settings.searchBidfax   = preferences.bidfaxCheckEl.checked;
    
    // Store settings
    browser.storage.local.set({settings})
};

const setElementCallbacks = ()=>{
    // When any toggle changes, update the local storage.
    document.querySelector(".settings-grid input#copart")
        .addEventListener("change", setStoredSettings)
    
    document.querySelector(".settings-grid input#iaai")
        .addEventListener("change", setStoredSettings)
    
    document.querySelector(".settings-grid input#row52")
        .addEventListener("change", setStoredSettings)
    
    document.querySelector(".settings-grid input#poctra")
        .addEventListener("change", setStoredSettings)
    
    document.querySelector(".settings-grid input#bidfax")
        .addEventListener("change", setStoredSettings)
};

window.addEventListener("load", async ()=>{
    // Set toggle elements to the values in local storage
    await fetchStoredSettings();
    
    // Add onChange callbacks
    setElementCallbacks()
    
    // Set version display
    let versionName = browser.runtime.getManifest().version
    document.querySelector("#version").textContent = 'v' + versionName;
})



console.log("popup action loaded!")
