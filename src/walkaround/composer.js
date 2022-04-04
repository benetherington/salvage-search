/*------------------------*\
  THUMBNAIL PROMOTE/DEMOTE
\*------------------------*/
function saveThumb(e) {
    // get thumbnail
    let thumbnail = document.querySelector("#stage").getThumbnail()
    // add thumbnail to tray
    document.querySelector("#thumbs").append(thumbnail)
}
// function cloneToMain(panoContainer) {
//     // clone
//     let newContainer = panoContainer.getClone();
    
//     newContainer.classList.remove("thumbnail")
//     newContainer.classList.remove("focused")
//     document.querySelector("#stage").replaceChildren(newContainer)
//     // style
//     panoContainer.classList.add("focused")
// }
function downloadAll() {
    document.querySelectorAll("#thumbs img")
    .forEach((img, idx)=>{
        download(img, idx)
    })
}
function download(img, idx) {
    browser.downloads.download({
        url:img.src,
        filename:`${salvageName}-${lotNumber}/walkaround/${idx}.jpg`,
        saveAs: false
    })
}


/*--------------------*\
  BACKGROUND MESSAGING
\*--------------------*/
var salvageName, lotNumber;
browser.runtime.onMessage.addListener(message=>{
    salvageName = message.salvageName;
    lotNumber = message.lotNumber;
    document.querySelector("#stage").setAngles(message.walkaroundUrls)
})

/*---------------*\
  EVENT LISTENERS
\*---------------*/
window.addEventListener("load", ()=>{
    // FAKE LOADING FROM POPUP
    // let angles = Array.from(Array(64).keys()).map(idx=>
    //     "/walkaround/images/"+idx+".jpg"
    // )
    // messageHandler({angles})
    
    // TOOLBAR: DOWNLOAD
    document.querySelector("#dl-all").addEventListener("click", downloadAll)
    
    // TOOLBAR: VIEWS
    document.querySelector("#save-view").addEventListener("click", saveThumb)
    document.addEventListener("keydown", (e)=>{
        if (e.key==="Enter") {saveThumb()}
    })
    // WALKAROUND: VIEWS
    document.querySelector("#stage").addEventListener("click", (e)=>{
        if (e.detail===2){saveThumb()}
    })
})
