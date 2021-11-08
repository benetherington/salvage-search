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
  MAIN PAGE  
\*---------*/
class ProgressButton {
    constructor () {
        this.el = undefined;
        this.status = "enabled";
        this.total = 1;
        this.progress = 1;
    }
    start(total=0) {
        this.el.className = this.el.dataset.styleOrig;
        this.el.classList.add("feedback-busy");
        this.total = total;
        // If we got a total, set progress at zero. If not, set it at 1 so that
        // we start full color, ie 100%
        this.progress = total?0:1;
        this.update()
    }
    increment() {
        this.el.className = this.el.dataset.styleOrig
        this.el.classList.add("feedback-progress")
        ++this.progress
        this.update()
    }
    update() {
        this.el.style.setProperty(
            "--progress-percentage",
            `${this.progress/this.total*100}%`
        )
    }
    enable() {
        this.el.className = this.el.dataset.styleOrig;
    }
    disable() {
        this.el.className = this.el.dataset.styleOrig;
        this.el.classList.add("disabled");
        this.total = this.progress = 1;
    }
    attention() {
        this.el.className = this.el.dataset.styleOrig;
        this.el.classList.add("success-attention");
        this.total = this.progress = 1;
    }
}

// SEARCH //
// Search textbox
window.addEventListener("load", ()=>{
    // validate VIN
    let inputSearch = document.querySelector('#search-input')
    inputSearch.addEventListener('input', ()=>{
        if (VINREGEX.test(inputSearch.value)) {
            searchProgressButton.enable()
        } else {
            searchProgressButton.disable()
        }
    });
})
window.addEventListener("focus", async ()=>{
    // auto-fill
    let clipboardContents = await navigator.clipboard.readText();
    // TODO: this fails on Chrome?
    // TODO: to request access, we need to load actions.html in a new tab
    if (VINREGEX.test(clipboardContents.trim())) {
        document.querySelector('#search-input').value = clipboardContents.trim()
        searchProgressButton.enable()
    }
})
// search ProgressButton
let searchProgressButton = new ProgressButton();
let onSearchClick = (event) => {
    let searchInput = document.querySelector("#search-input");
    if (VINREGEX.test(searchInput.value)) {
        // that VIN looks good, let's run a search
        browser.runtime.sendMessage(
            { type: "popup-action",
              values: [{
                action: "search",
                vin: searchInput.value }]}
        )
    } else {
        // that VIN looks bad, and somehow you were still able to click the button.
        // wiggle the text input
        vinField = document.querySelector("#input-vin")
        vinField.classList.remove("error-attention"); // in case it's already moving
        vinField.classList.add("error-attention");
        // hide the error message after 4 seconds
        addFeedbackMessage({message: "That VIN doesn't look right.", displayAs: "error"})
    };
    
    event.stopPropagation()
};
window.addEventListener("load", ()=>{
    let searchButton = document.querySelector("#search-button");
    searchProgressButton.el = searchButton;
    searchButton.addEventListener("click", onSearchClick)
})

// DOWNLOAD //
// download textbox
const downloadPort = browser.runtime.connect({name:"popup-seek"});
window.addEventListener('load', ()=>{
    let downloadInput = document.querySelector("#download-input");
    downloadInput.addEventListener('input', ()=>{
        if (STOCKREGEX.test(downloadInput.value)) {
            dlProgressButton.enable()
        } else {
            dlProgressButton.disable()
        }
    })
    downloadPort.onMessage.addListener(message=>{
        if (message.vehicleDatas) {
            bestVehicle = message.vehicleDatas[0];
            downloadInput.value = bestVehicle.lotNumber;
            dlProgressButton.enable()
        }
    })
})
window.addEventListener("focus", async ()=>{
    // auto-fill
    let clipboardContents = await navigator.clipboard.readText();
    // TODO: this fails on Chrome?
    // TODO: to request access, we need to load actions.html in a new tab
    if (STOCKREGEX.test(clipboardContents.trim())) {
        document.querySelector('#download-input').value = clipboardContents.trim()
        dlProgressButton.enable()
    }
})
// download ProgressButton
let dlProgressButton = new ProgressButton();
let onDownloadClick = (event) =>{
    dlProgressButton.start()
    downloadPort.postMessage({idx:0, action:"downloadImages", exec:true})
    event.stopPropagation()
};
window.addEventListener("load", async ()=>{
    let downloadButton = document.querySelector("#download-button");
    dlProgressButton.el = downloadButton;
    downloadButton.addEventListener("click", onDownloadClick)
})

/*--------*\
  FEEDBACK  
\*--------*/
// message handler
browser.runtime.onMessage.addListener((message)=>{
    if (message.type === "feedback") {
        for (value of message.values) {
            switch (value.action) {
                case "feedback-message":
                    addFeedbackMessage(value)
                    break;
                case "download-attention":
                    dlProgressButton.attention()
                    break;
                case "download-start":
                    dlProgressButton.start(value.total)
                    break;
                case "download-increment":
                    dlProgressButton.increment()
                    break;
                case "download-end":
                    dlProgressButton.enable()
                    break;
                case "download-abort":
                    dlProgressButton.disable()
                    break;
                case "search-start":
                    searchProgressButton.start(value.total)
                    break;
                case "search-increment":
                    searchProgressButton.increment()
                    break;
                case "search-end":
                    searchProgressButton.enable()
                    break;
            }
        }
        return Promise.resolve('done');
    };
    return false;
});

// drawer
var addFeedbackMessage = (rawFeedback)=>{
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
    // PERSIST
    if (feedback.duration === -1) {
        // copy object and add type property
        feedbackToStore = Object.assign(feedback, {type:"feedback-message"});
        // pack it for storage with a programmatic key
        storable = {};
        // time should be pretty unique
        storable[feedback.createdAt] = feedbackToStore;
        browser.storage.local.set(storable)
    }

    // PREPARE FOR THE END
    closeUp = ()=>{
        // remove this feedback object from persistance
        browser.storage.local.remove(feedback.createdAt)
        // remove from drawer
        notification.remove()
        // close drawer
        if (drawer.childElementCount===0) {drawer.classList.add("hidden")}
    }
    // set removal conditions
    if (feedback.duration !== -1) {setTimeout(closeUp, feedback.duration)}
    if (feedback.closeable)       {notification.addEventListener("click", closeUp)}

    // show the drawer
    drawer.classList.remove("hidden")
}
// restore persisted notifications
window.addEventListener("load", async ()=>{
    storage = await browser.storage.local.get();
    Object.entries(storage).forEach( ([key, value])=>{
        if (  value.hasOwnProperty("type")
           && value.type==="feedback-message" ) {
            browser.storage.local.remove(key)
            addFeedbackMessage(value);
        }
    })
})


/*----------------*\
  PREFERENCES PAGE  
\*----------------*/
var preferences = {
    copartCheckEl: undefined,
    iaaiCheckEl: undefined,
    row52CheckEl: undefined,
    poctraCheckEl: undefined,
    bidfaxCheckEl: undefined,
    fetchStoredSettings: async ()=>{
        let settings = await defaultedSettings() // defined in shared-assets.js
        
        preferences.copartCheckEl.checked   = settings.searchCopart;
        preferences.iaaiCheckEl.checked     = settings.searchIaai;
        preferences.row52CheckEl.checked    = settings.searchRow52;
        preferences.poctraCheckEl.checked    = settings.searchPoctra;
        preferences.bidfaxCheckEl.checked    = settings.searchBidfax;
    },
    setElementCallbacks: ()=>{
        [ preferences.copartCheckEl,
          preferences.iaaiCheckEl,
          preferences.row52CheckEl,
          preferences.poctraCheckEl,
          preferences.bidfaxCheckEl ]
        .forEach(element=>{
            element.addEventListener("change", preferences.setStoredSettings)
        })
    },
    setStoredSettings: async (event=null)=>{
        let settings = Object.assign(DEFAULT_SETTINGS);
        settings.searchCopart   = preferences.copartCheckEl.checked;
        settings.searchIaai     = preferences.iaaiCheckEl.checked;
        settings.searchRow52    = preferences.row52CheckEl.checked;
        settings.searchPoctra   = preferences.poctraCheckEl.checked;
        settings.searchBidfax   = preferences.bidfaxCheckEl.checked;
        browser.storage.local.set({settings})
    }
}
window.addEventListener("load", async ()=>{
    // store UI elements
    preferences.copartCheckEl   = document.querySelector(".settings-grid input#copart")
    preferences.iaaiCheckEl     = document.querySelector(".settings-grid input#iaai")
    preferences.row52CheckEl    = document.querySelector(".settings-grid input#row52")
    preferences.poctraCheckEl   = document.querySelector(".settings-grid input#poctra")
    preferences.bidfaxCheckEl   = document.querySelector(".settings-grid input#bidfax")
    // load and display stored preferences
    await preferences.fetchStoredSettings()
    preferences.setElementCallbacks()
    // set version display
    let versionName = browser.runtime.getManifest().version
    document.querySelector("#version").textContent = 'v' + versionName;
})

console.log("popup action loaded!")
