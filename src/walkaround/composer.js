/*------------------------*\
  THUMBNAIL PROMOTE/DEMOTE
\*------------------------*/
function saveThumb() {
    // get thumbnail
    let thumbnail = document.querySelector("#stage").getThumbnail();
    // add thumbnail to tray
    document.querySelector("#thumbs").append(thumbnail);
}

function downloadImages() {
    // Name folder
    let folder;
    if (salvageName && lotNumber) folder = `${salvageName}-${lotNumber}`;
    else if (salvageName || lotNumber) folder = lotNumber || salvageName;
    else folder = "salvage_photos";

    // Save images
    document.querySelectorAll("#thumbs img").forEach((img, idx) => {
        browser.downloads.download({
            url: img.src,
            filename: `${folder}/exterior360/exterior-${idx}.jpg`,
            saveAs: false,
        });
    });
}

/*-----------*\
  HELP BUTTON
\*-----------*/
const toggleHelpPopup = (e) => {
    // Toggle popup visibility
    const nowVisible = document
        .getElementById("help-popup")
        .classList.toggle("fade-out");

    // Add or remove "click anywhere to close" listener
    if (nowVisible) {
        document.body.removeEventListener("click", toggleHelpPopup);
    } else {
        document.body.addEventListener("click", toggleHelpPopup);
        // Assure that the popup isn't immediately closed
        e.stopImmediatePropagation();
    }
};

/*--------------------*\
  BACKGROUND MESSAGING
\*--------------------*/
var salvageName, lotNumber;
const messageHandler = (message) => {
    // Assign variables for naming the download folder later
    ({salvageName, lotNumber} = message);

    // Load images to the stage
    document.querySelector("#stage").setAngles(message.walkaroundUrls);
};
browser.runtime.onMessage.addListener(messageHandler);

/*---------------*\
  EVENT LISTENERS
\*---------------*/
window.addEventListener("load", () => {
    // FAKE LOADING FROM POPUP
    // let walkaroundUrls = Array.from(Array(64).keys()).map(idx=>
    //     "/walkaround/images/"+idx+".jpg"
    // )
    // messageHandler({walkaroundUrls})

    // BUTTONS
    document.querySelector("#save-view").addEventListener("click", saveThumb);
    document.querySelector("#dl-all").addEventListener("click", downloadImages);
    document.getElementById("help").addEventListener("click", toggleHelpPopup);

    // THUMBNAIL CREATION
    document.addEventListener("keydown", (e) => {
        if (e.key === "Enter") saveThumb();
    });
    document.getElementById("stage").addEventListener("click", (e) => {
        if (e.detail === 2) saveThumb();
    });
});
