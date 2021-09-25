const VINREGEX = RegExp("^[A-HJ-NPR-Z0-9]{3}[A-HJ-NPR-Z0-9]{5}[0-9X][A-HJ-NPR-Z0-9][A-HJ-NPR-Z0-9][A-HJ-NPR-Z0-9]{6}$", "i");

/*----------------*\
  USER INTERACTION  
\*----------------*/
// MOUSE CLICKS
document.addEventListener("click", (event) =>{
    // check which element was clicked
    if (event.target.classList.contains('action-search')) {
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
            errorMessage = document.querySelector("#error-content")
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
    } else if (event.target.classList.contains('action-download')) {
        // DOWNLOAD BUTTON
        browser.runtime.sendMessage(
            { type: "popup-action",
            values: [{
                action: "download" }]}
        );
    };
});

// VIN TEXT ENTRY
window.onload = () => {
    // validate VIN and enable/disable search button
    let inputVin = document.getElementById('input-vin')
    let inputSearch = document.getElementById('input-search')
    inputVin.addEventListener('input', (event)=>{
        if (VINREGEX.test(inputVin.value)) {
            inputSearch.classList.remove('disabled')
        } else {
            inputSearch.classList.add('disabled')
        }
    });
}
// VIN AUTO-FILL
window.onfocus = async () => {
    // auto-fill VIN if clipboard matches
    let clipboardContents = await navigator.clipboard.readText() // TODO: to request access, we need to load actions.html in a new tab
    if (VINREGEX.test(clipboardContents)) {
        document.getElementById('input-vin').value = clipboardContents
        document.getElementById('input-search').classList.remove('disabled')
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
    }
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
        let button = document.getElementById("input-download")
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

console.log("popup action loaded!")


