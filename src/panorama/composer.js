/*---------------------*\
  THUMBNAIL EDIT/DELETE
\*---------------------*/
async function saveThumb() {
    // get thumbnail
    let thumbnail = await document.querySelector("#stage").getThumbnail()
    // add thumbnail to tray
    document.querySelector("#thumbs").append(thumbnail)
}

function downloadImages() {
    // Name folder
    let folder;
    if (salvageName && lotNumber)      folder = `${salvageName}-${lotNumber}`;
    else if (salvageName || lotNumber) folder = lotNumber || salvageName;
    else                               folder = "salvage_photos";
    
    // Save images
    document.querySelectorAll("#thumbs img").forEach((img, idx)=>{
        browser.downloads.download({
            url:img.src,
            filename: `${folder}/interior360/interior-${idx}.jpg`,
            saveAs:false
        })
    })
}


/*-----------*\
  HELP BUTTON
\*-----------*/
const toggleHelpPopup = (e)=>{
    // Toggle popup visibility
    const nowVisible = document.getElementById("help-popup")
                            .classList.toggle("fade-out");
    
    // Add or remove "click anywhere to close" listener
    if (nowVisible) {
        document.body.removeEventListener("click", toggleHelpPopup)
    } else {
        document.body.addEventListener("click", toggleHelpPopup)
    }
    // Assure that the popup isn't immediately closed
    e.stopImmediatePropagation()
};


/*--------------------*\
  BACKGROUND MESSAGING
\*--------------------*/
var salvageName, lotNumber;
async function messageHandler(message) {
    // Assign variables for naming the download folder later
    ({salvageName, lotNumber} = message)
    
    // load images to the stage
    const stage = document.querySelector("#stage");
    await stage.addPano(message.panoUrls);
    
    // Create premade thumbnails
    await stage.getPano().goToDriver();    await saveThumb();
    await stage.getPano().goToRear();      await saveThumb();
    await stage.getPano().goToPassenger(); await saveThumb();
    await stage.getPano().goToIp();        await saveThumb();
}
browser.runtime.onMessage.addListener(messageHandler);

/*---------------*\
  EVENT LISTENERS
\*---------------*/
window.addEventListener("load", ()=>{
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
    document.querySelector("#save-view").addEventListener("click", saveThumb)
    document.querySelector("#dl-all").addEventListener("click", downloadImages)
    document.getElementById("help").addEventListener("click", toggleHelpPopup)
    
    // THUMBNAIL CREATION
    document.addEventListener("keydown", (e)=>{
        if (e.key==="Enter") saveThumb();
    })
    document.getElementById("stage").addEventListener("click", (e)=>{
        if (e.detail===2) saveThumb();
    })
})