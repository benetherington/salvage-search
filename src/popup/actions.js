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



/*-----*\
  INPUT
\*-----*/
// Clipboard input
window.addEventListener("focus", async ()=>{
    // TODO: to request access in Chrome, we need to load a new tab

    // Skip if there's already something to search for
    const searchInput = document.getElementById("search-input");
    if (searchInput.value) return;
    
    // Request open tabs check
    downloadPort.postMessage({findTabs: true})
    
    // Grab clipboard
    const clipboard = await navigator.clipboard.readText().then(s=>s.trim());
    
    // Check clipboard contents
    if ( !(validateLot(clipboard)||validateVin(clipboard)) ) return;
    
    // Load clipboard contents after a delay, allowing open tabs to load
    // instead. We could load immediately, but this might result in flickering.
    setTimeout(()=>{
        if (searchInput.value) return;
        searchInput.value = clipboard;
        inputChanged()
        addFeedbackMessage({message:"Pasted value from clipbard."})
    }, 20)
});

// Typed input
document.addEventListener("DOMContentLoaded", ()=>{
    document
    .getElementById('search-input')
    .addEventListener('input', inputChanged)
})
const inputChanged = ()=>{
    const inputValue = document.getElementById('search-input').value;
    
    // Validate VINs, enable search
    if (validateVin(inputValue)) {
        document.getElementById("search-button").enable()
        return;
    } else {
        document.getElementById("search-button").disable()
    }
    
    // Validate lot numbers, enable download
    if (validateLot(inputValue) && getSalvageNameInput()) {
        // valid lot and salvage selected
        document.getElementById("download-button").enable()
    } else if (validateLot(inputValue) && !getSalvageNameInput()) {
        // valid lot but missing salvage
        document.querySelector("#salvage-selector .slider")
                .classList.add("error-attention")
        document.getElementById("download-button").disable()
    } else {
        document.getElementById("download-button").disable()
    }
}


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
        const salvageName = getSalvageNameInput();
        searchPort.postMessage({query, salvageName})
    })
})
// Salvage yard radio buttons
// Listen for slider change, validate input
document.addEventListener("DOMContentLoaded", ()=>{
    document.querySelector("#salvage-selector")
            .addEventListener("click", inputChanged)
})
// Slider getter and setter
const getSalvageNameInput = ()=>{
    const selected = document.querySelector("#salvage-selector input:checked").id;
    if (selected == "unknown-salvage") return;
    return selected;
}
const setSalvageNameInput = (salvageName)=>{
    if (!salvageName) {
        document.getElementById("unknown-salvage").checked = true;
    } else {
        document.getElementById(salvageName).checked = true;
    }
}

// Handle search messages
const onSearchMessage = (message)=>{
    // Flash the download button
    if (message.found) {
        document.getElementById("download-button").attention();
    }
    
    // Reset the search button
    if (message.complete) document.getElementById("search-button").enable();
    
    // Display feedback messages
    if (message.feedback) addFeedbackMessage(message.feedback);
    
    // Update salvage slider and lot number
    setSalvageNameInput(message.salvage);
    if (message.lotNumber) {
        document.getElementById("search-input").value = message.lotNumber;
    }
    
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
        const salvageName = getSalvageNameInput();
        downloadPort.postMessage({query, salvageName})
    })
})

// Handle download messages
const onDownloadMessage = (message)=>{
    // Reset the download button
    if (message.complete) document.getElementById("download-button").enable();
    
    // Update query fields from open tab
    if (message.lotNumber) {
        document.getElementById("search-input").value = message.lotNumber;
        setSalvageNameInput(message.salvageName);
        inputChanged()
        addFeedbackMessage({message: "Loaded lot number from open tab."})
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
    } else {console.debug("empty message");return;}

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
// Listen for messages from API interfaces. Messages are also passed over the
// two message ports.
browser.runtime.onMessage.addListener(addFeedbackMessage)

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
    settings.searchCopart   = document.getElementById("copart").checked;
    settings.searchIaai     = document.getElementById("iaai"  ).checked;
    settings.searchRow52    = document.getElementById("row52" ).checked;
    settings.searchPoctra   = document.getElementById("poctra").checked;
    settings.searchBidfax   = document.getElementById("bidfax").checked;
    
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
