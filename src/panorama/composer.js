/*---------------------*\
  THUMBNAIL EDIT/DELETE
\*---------------------*/
async function saveThumb(e) {
    // get thumbnail
    let thumbnail = await document.querySelector("#stage").getThumbnail()
    // add thumbnail to tray
    document.querySelector("#thumbs").append(thumbnail)
}

function downloadImages(e) {
    document.querySelectorAll("#thumbs img").forEach((img, idx)=>{
        browser.downloads.download({
            url:img.src,
            filename: `${salvageName}-${lotNumber}/panorama/${idx}.jpg`,
            saveAs:false
        })
    })
}

/*--------------------*\
  BACKGROUND MESSAGING
\*--------------------*/
var salvageName, lotNumber;
async function messageHandler(message) {
    // Save variables for download folder
    salvageName = message.salvageName;
    lotNumber = message.lotNumber;
    
    // Load panorama
    let stage = document.querySelector("#stage");
    const {cubemap, faces, equirectangular, face} = message.panoImageInfo;
    if (cubemap) {
        await stage.addPano(faces);
    }
    
    // Create thumbnail set, point them in the correct direction
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
    
    // STAGE
    document.querySelector("#stage").addEventListener("click", (e)=>{
        if (e.detail===2) {saveThumb()}
    })
})