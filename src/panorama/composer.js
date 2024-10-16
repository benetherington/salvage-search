/*-----------------------*\
  THUMBNAIL SAVE/DOWNLOAD
\*-----------------------*/
async function saveThumb() {
    // Get thumbnail
    let thumbnail = await document.querySelector("#stage").getThumbnail();

    // Listen for thumbnail removal and update scrollbar
    thumbnail
        .querySelector(".delete")
        .addEventListener("click", moveThumbsScrollbar);

    // Add thumbnail to tray
    document.querySelector("#thumbs").append(thumbnail);
    moveThumbsScrollbar();
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
            filename: `${folder}/interior360/interior-${idx}.jpg`,
            saveAs: false,
        });
    });
}

/*-------------------*\
  THUMBNAIL SCROLLBAR
\*-------------------*/
const moveThumbsScrollbar = () => {
    const thumbs = document.getElementById("thumbs");

    // Find out how far down we've scrolled
    const scrollMax = thumbs.scrollHeight - thumbs.clientHeight;
    const barPosition = thumbs.scrollTop / scrollMax;

    // Stop now if there's no need to scroll
    if (scrollMax <= 0) return thumbs.style.setProperty("--scroll-height", "0");

    // Figure out how tall the scrollbar should be
    const barHeight = thumbs.clientHeight / thumbs.scrollHeight;
    const barHeightPx = thumbs.clientHeight * barHeight;

    // Figure out how much whitespace there is, and how much should be above the
    // scrollbar
    const whitespace = thumbs.clientHeight - barHeightPx;
    const barTop = whitespace * barPosition;

    // Set properties, including margin and padding applied to #thumbs
    const thumbsContentTop = 15;
    thumbs.style.setProperty(
        "--scroll-height",
        barHeightPx - thumbsContentTop + "px",
    );
    thumbs.style.setProperty("--scroll-top", barTop + thumbsContentTop + "px");
};

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
    }
    // Assure that the popup isn't immediately closed
    e.stopImmediatePropagation();
};

/*--------------------*\
  BACKGROUND MESSAGING
\*--------------------*/
var salvageName, lotNumber;
async function messageHandler(message) {
    // Assign variables for naming the download folder later
    ({salvageName, lotNumber} = message);

    // load images to the stage
    const stage = document.querySelector("#stage");
    await stage.addPano(message.panoUrls);

    // Create premade thumbnails
    await stage.getPano().goToDriver().then(saveThumb());
    await stage.getPano().goToRear().then(saveThumb());
    await stage.getPano().goToPassenger().then(saveThumb());
    await stage.getPano().goToIp().then(saveThumb());
}
browser.runtime.onMessage.addListener(messageHandler);

/*---------------*\
  EVENT LISTENERS
\*---------------*/
window.addEventListener("load", () => {
    // FAKE LOADING FROM POPUP
    // messageHandler({
    //     faces: {
    //         pano_r: "images/pano_r.jpg",
    //         pano_l: "images/pano_l.jpg",
    //         pano_u: "images/pano_u.jpg",
    //         pano_d: "images/pano_d.jpg",
    //         pano_b: "images/pano_b.jpg",
    //         pano_f: "images/pano_f.jpg"
    //     }
    // })

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

    // THUMBS SCROLLING
    document
        .getElementById("thumbs")
        .addEventListener("scroll", moveThumbsScrollbar);
    window.addEventListener("resize", moveThumbsScrollbar);
});
