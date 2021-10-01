const VINREGEX = RegExp("^[A-HJ-NPR-Z0-9]{3}[A-HJ-NPR-Z0-9]{5}[0-9X][A-HJ-NPR-Z0-9][A-HJ-NPR-Z0-9][A-HJ-NPR-Z0-9]{6}$", "i");

/*----------------*\
  USER INTERACTION  
\*----------------*/
// MOUSE CLICKS
document.addEventListener("click", (event) =>{
    // check which element was clicked
    if (event.target.id === 'button-search') {
        // SEARCH BUTTON
        vinInput = document.getElementById("input-vin");
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
    } else if (event.target.id === "button-settings"){
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

/*-------------*\
  SETUP ON LOAD  
\*-------------*/
window.onload = () => {
    // validate VIN and enable/disable search button
    let inputVin = document.getElementById('input-vin')
    let inputSearch = document.getElementById('button-search')
    inputVin.addEventListener('input', (event)=>{
        if (VINREGEX.test(inputVin.value)) {
            inputSearch.classList.remove('disabled')
        } else {
            inputSearch.classList.add('disabled')
        }
    });
    // load preferences from storage and pre-set elements
    preferences.prepare()
    // enable/disable the ZIP field
    document.querySelector("input#iaai").addEventListener("change", (event)=>{
        if (event.target.checked) {
            document.querySelector("input#zip").classList.remove("disabled")
        } else {
            document.querySelector("input#zip").classList.add("disabled")
        }
    })
    
    // set version display
    let versionNumber = browser.runtime.getManifest().version
    document.querySelector("#version").textContent = 'v' + versionNumber;
}
window.onfocus = async () => {
    // auto-fill VIN if clipboard matches
    let clipboardContents = await navigator.clipboard.readText() // TODO: to request access, we need to load actions.html in a new tab
    if (VINREGEX.test(clipboardContents)) {
        document.getElementById('input-vin').value = clipboardContents
        document.getElementById('button-search').classList.remove('disabled')
    }
}


/*--------*\
  FEEDBACK  
\*--------*/
browser.runtime.onMessage.addListener((message)=>{
    if (message.type === "feedback") {
        for (value of message.values) {
            feedbackHandler(value)
        }
        return Promise.resolve('done');
    };
    return false;
});
function feedbackHandler(feedback) {
    switch (feedback.action) {
        case "download-started": // feedback.tabs
            downloadButton.update("downloading")
        // break; case "download-tab": // feedback.images
        // break; case "tab-increment":
        // break; case "download-nearly-finished":
        break; case "download-finished":
            downloadButton.update("enabled")
        break; case "download-abort": // feedback.display
            downloadButton.update("disabled")
        break; case "feedback-message":
            addFeedbackMessage(feedback)
    }
}

(async ()=>{
    // restore feedbackMessages
    storage = await browser.storage.local.get();
    Object.entries(storage).forEach( ([key, value])=>{
        if (  value.hasOwnProperty("type")
           && value.type==="feedback-message" ) {
            browser.storage.local.remove(key)
            addFeedbackMessage(value);
        }
    })
})()
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
        console.log("closing")
        console.log(feedback)
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

downloadButton = new class {
    constructor() {
        this.status = 'disabled'
        this.lookForSalvageTabs()
    }
    async lookForSalvageTabs() {
        console.log("looking for salvage tabs")
        let salvageTabs = await browser.tabs.query(
            {active: true,
                url: ["*://*.iaai.com/vehicledetails/*",
                      "*://*.iaai.com/Vehicledetails?*",
                      "*://*.copart.com/lot/*"]}
        )
        if (salvageTabs.length) {
            browser.runtime.sendMessage("found a tab!")
            this.update("enabled")
        } else {
            this.update("disabled")
        }
    }
    update(status=null) {
        let button = document.getElementById("button-download")
        this.status = status || this.status
        switch (this.status) {
            case "disabled":
                button.classList.add("disabled");
                button.classList.remove("feedback-download");
            break; case "enabled":
                button.classList.remove("disabled");
                button.classList.remove("feedback-download");
            break; case "downloading":
                button.classList.remove("disabled");
                button.classList.add("feedback-download");
        }
    }
}


/*--------*\
  SETTINGS
\*--------*/
const DEFAULT_SETTINGS = {
    searchCopart: true,
    searchIaai: true,
    searchRow52: true,
    zipCode: ""
}
var preferences  = new class {
    constructor() {
        this.copartCheck = null
        this.iaaiCheck = null
        this.zipText = null
        this.row52Check = null
    }
    async prepare() {
        this.getElements()
        this.fetchStoredSettings()
        this.setElementCallbacks()
    }
    getElements() {
        this.copartCheck = document.querySelector(".settings-grid input#copart")
        this.iaaiCheck =   document.querySelector(".settings-grid input#iaai")
        this.zipText =     document.querySelector(".settings-grid input#zip")
        this.row52Check =  document.querySelector(".settings-grid input#row52")
    }
    async fetchStoredSettings() {
        let storage = await browser.storage.local.get("settings")
        let settings = storage.settings || DEFAULT_SETTINGS

        this.copartCheck.checked = settings.searchCopart
        this.iaaiCheck.checked   = settings.searchIaai
        this.zipText.value       = settings.zipCode
        this.row52Check.checked  = settings.searchRow52
        // re-store settings in case defaults were used
        this.setStoredSettings()
    }
    setElementCallbacks() {
        for (let element of [this.copartCheck, this.iaaiCheck, this.zipText, this.row52Check]) {
            element.addEventListener("change", this.setStoredSettings.bind(this))
        }
    }
    async setStoredSettings(event=null) {
        let storage = await browser.storage.local.get("settings");
        let settings = storage.settings || DEFAULT_SETTINGS;
        settings.searchCopart = this.copartCheck.checked;
        settings.searchIaai   = this.iaaiCheck.checked;
        settings.zipCode      = this.zipText.value;
        settings.searchRow52  = this.row52Check.checked;
        browser.storage.local.set({settings})
    }
}
console.log("popup action loaded!")


