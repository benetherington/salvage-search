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
    } else if (event.target.id === "button-main"){
        // update pages active status
        document.querySelectorAll(".slider-page").forEach(el=>{el.classList.remove("active")})
        document.getElementById("main").classList.add("active")
        // scroll the page
        document.getElementById("slider").scrollLeft = 0
        // update toolbar
        document.getElementById("button-main").classList.add("hidden")
        document.getElementById("button-settings").classList.remove("hidden")
    };
});


/*---------*\
  MAIN PAGE  
\*---------*/
// handle clicks
document.addEventListener("click", (event) =>{
    // check which element was clicked
    if (event.target.id === 'button-search') {
        // SEARCH BUTTON
        let vinInput = document.getElementById("input-vin");
        if (VINREGEX.test(vinInput.value)) {
            // that VIN looks good, let's run a search
            browser.runtime.sendMessage(
                { type: "popup-action",
                  values: [{
                    action: "search",
                    vin: vinInput.value }]}
            );
        } else {
            // that VIN looks bad, and somehow you were still able to click the button.
            errorMessage = document.querySelector("#popup-error")
            vinField = document.getElementById("input-vin")
            // unhide error message
            errorMessage.classList.remove("hidden");
            // wiggle the text input
            vinField.classList.remove("error-attention"); // in case it's already moving
            vinField.classList.add("error-attention");
            // hide the error message after 4 seconds
            setTimeout( ()=>{
                errorMessage.classList.add("hidden");
                vinField.classList.remove("error-attention");
            }, 4*1000)
        };
    } else if (event.target.id === 'button-download') {
        // DOWNLOAD BUTTON
        browser.runtime.sendMessage(
            { type: "popup-action",
            values: [{
                action: "download" }]}
        );
    }
})
// set up enable/disable/validate mechanics
window.addEventListener("load", () => {
    // validate VIN
    let inputVin = document.getElementById('input-vin')
    let inputSearch = document.getElementById('button-search')
    inputVin.addEventListener('input', ()=>{
        if (VINREGEX.test(inputVin.value)) {
            inputSearch.classList.remove('disabled')
        } else {
            inputSearch.classList.add('disabled')
        }
    });
})
// auto-fill VIN field
window.addEventListener("focus", async () => {
    let clipboardContents = await navigator.clipboard.readText();
    // TODO: this fails on Chrome?
    // TODO: to request access, we need to load actions.html in a new tab
    if (VINREGEX.test(clipboardContents.trim())) {
        document.getElementById('input-vin').value = clipboardContents.trim()
        document.getElementById('button-search').classList.remove('disabled')
    }
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
                    addFeedbackMessage(value); break;

                case "download-start":
                    dlFeedback.progressStart(value.total); break;
                case "download-increment":
                    dlFeedback.increment(); break;
                case "download-end":
                    dlFeedback.update("enabled"); break;
                case "download-abort":
                    dlFeedback.update("disabled"); break;

                case "search-start":
                    console.log("search-start"); break;
                case "search-increment":
                    console.log("search-increment"); break;
                case "search-end":
                    console.log("search-end"); break;
            }
        }
        return Promise.resolve('done');
    };
    return false;
});

// feedback notification
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
        feedback.displayAs      = displayAs;
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
        browser.storage.local.set(storable);
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

// download button/progress bar
var dlFeedback = {
    el: undefined,
    status: 'disabled',
    total: 1,
    progress: 1, 
    start: (total=null)=>{
        dlFeedback.el.className = dlFeedback.el.dataset.styleOrig;
        dlFeedback.el.classList.add("feedback-download");
        dlFeedback.total = total || 1;
        // If we got a total, set progress at zero. If not, set it at 1 so that
        // we start full color, ie 100%
        dlFeedback.progress = total?0:1;
        dlFeedback.update()
    },
    increment: ()=>{
        dlFeedback.el.className = dlFeedback.el.dataset.styleOrig
        dlFeedback.el.classList.add("feedback-progress")
        ++dlFeedback.progress
        dlFeedback.update()
    },
    update: ()=>{
        dlFeedback.el.style.setProperty(
            "--progress-percentage",
            `${dlFeedback.progress/dlFeedback.total*100}%`
        )
    },
    disable: ()=>{
        dlFeedback.el.className = dlFeedback.el.dataset.styleOrig;
        dlFeedback.el.classList.add("disabled");
        dlFeedback.total = dlFeedback.progress = 1;
    },
}
window.addEventListener("load", async () => {
    dlFeedback.el = document.querySelector("#button-download");
    // look for salvage tabs to download from
    let salvageTabs = await browser.tabs.query(
        {active: true,
        url: ["*://*.iaai.com/*ehicle*etails*", // i miss blobs
        "*://*.copart.com/lot/*"]}
    )
    if (salvageTabs.length) {
        browser.runtime.sendMessage("found a tab!")
        dlFeedback.update("enabled")
    } else {
        dlFeedback.update("disabled")
    }
})


/*----------------*\
  PREFERENCES PAGE  
\*----------------*/
var preferences = {
    copartCheckEl: undefined,
    iaaiCheckEl: undefined,
    row52CheckEl: undefined,
    zipTextEl: undefined,
    fallbackCheckEl: undefined,
    fetchStoredSettings: async ()=>{
        let storage = await browser.storage.local.get("settings")
        let settings = storage.settings || DEFAULT_SETTINGS // defined in shared-assets.js

        preferences.copartCheckEl.checked   = settings.searchCopart;
        preferences.iaaiCheckEl.checked     = settings.searchIaai;
        preferences.row52CheckEl.checked    = settings.searchRow52;
        preferences.zipTextEl.value         = settings.fallbackZipCode;
        preferences.fallbackCheckEl.checked = settings.openFallbacks;
        console.log(`fetch sees checked: ${ preferences.fallbackCheckEl.checked}`)
        // re-store settings in case defaults were used
        preferences.setStoredSettings()
    },
    setElementCallbacks: ()=>{
        [ preferences.copartCheckEl,
          preferences.iaaiCheckEl,
          preferences.row52CheckEl,
          preferences.zipTextEl,
          preferences.fallbackCheckEl ]
        .forEach(element=>{
            element.addEventListener("change", preferences.setStoredSettings)
        })
        let enableZip = ()=>{
            if (preferences.fallbackCheckEl.checked) {
                preferences.zipTextEl.classList.remove("disabled")
            } else {
                preferences.zipTextEl.classList.add("disabled")
            }
        };
        enableZip()
        preferences.fallbackCheckEl.addEventListener("change", enableZip)
    },
    setStoredSettings: async (event=null)=>{
        let settings = Object.assign(DEFAULT_SETTINGS);
        settings.searchCopart    = preferences.copartCheckEl.checked;
        settings.searchIaai      = preferences.iaaiCheckEl.checked;
        settings.searchRow52     = preferences.row52CheckEl.checked;
        settings.fallbackZipCode = preferences.zipTextEl.value;
        settings.openFallbacks   = preferences.fallbackCheckEl.checked;
        browser.storage.local.set({settings})
    }
}
window.addEventListener("load", async ()=>{
    // store UI elements
    preferences.copartCheckEl   = document.querySelector(".settings-grid input#copart")
    preferences.iaaiCheckEl     = document.querySelector(".settings-grid input#iaai")
    preferences.row52CheckEl    = document.querySelector(".settings-grid input#row52")
    preferences.zipTextEl       = document.querySelector(".settings-grid input#zip")
    preferences.fallbackCheckEl = document.querySelector(".settings-grid input#fallback")
    // load and display stored preferences
    await preferences.fetchStoredSettings()
    preferences.setElementCallbacks()
    // set version display
    let versionName = browser.runtime.getManifest().version_name
    document.querySelector("#version").textContent = 'v' + versionName;
})

console.log("popup action loaded!")
