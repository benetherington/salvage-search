const VINREGEX = RegExp("^[A-HJ-NPR-Z0-9]{3}[A-HJ-NPR-Z0-9]{5}[0-9X][A-HJ-NPR-Z0-9][A-HJ-NPR-Z0-9][A-HJ-NPR-Z0-9]{6}$", "i");

document.addEventListener("click", (event) =>{
    if (event.target.classList.contains('action-search')) {
        vinInput = document.getElementById("input-vin").value;
        console.log("search clicked! VIN is: "+vinInput);
        if (VINREGEX.test(vinInput)) {
            console.log("sending message")
            browser.runtime.sendMessage(
                { type: "popup-action",
                values: [{
                    action: "search",
                    vin: vinInput }]}
            );
        } else {
            errorMessage = document.querySelector("#error-content")
            vinField = document.getElementById("input-vin")
            errorMessage.classList.remove("hidden");
            vinField.classList.remove("error-attention");
            vinField.classList.add("error-attention");
            setTimeout( ()=>{
                errorMessage.classList.add("hidden");
                vinField.classList.remove("error-attention");
            }, 4*1000)
        };
    } else if (event.target.classList.contains('action-download')) {
        console.log("download clicked!");
        browser.runtime.sendMessage(
            { type: "popup-action",
            values: [{
                action: "download" }]}
        );
    };
});


// /**
// * Just log the error to the console.
// */
// function reportError(error) {
//     console.error(`Error in actions popup: ${error}`);
// }


// /**
// * There was an error executing the script.
// * Display the popup's error message, and hide the normal UI.
// */
// function reportExecuteScriptError(error) {
//     document.querySelector("#popup-content").classList.add("hidden");
//     document.querySelector("#error-content").classList.remove("hidden");
//     console.error(`Failed to execute beastify content script: ${error.message}`);
// }

// /**
// * When the popup loads, inject a content script into the active tab,
// * and add a click handler.
// * If we couldn't inject the script, handle the error.
// */
// // browser.tabs.executeScript({file: "/content_scripts/beastify.js"})
// // .then(listenForClicks)
// // .catch(reportExecuteScriptError);

console.log("popup action loaded!")


