/*-----*\
  SETUP
\*-----*/

function createThumbnail(faces={}, name) {
    let panoContainer = document.createElement("pano-container");
    panoContainer.classList.add("thumbnail")
    panoContainer.addPano({faces, name})
    document.querySelector("#thumbs").append(panoContainer)
}

/*------------------------*\
  THUMBNAIL PROMOTE/DEMOTE
\*------------------------*/
function cloneToMain(panoContainer) {
    // clone
    let newContainer = panoContainer.getClone();
    
    newContainer.classList.remove("thumbnail")
    newContainer.classList.remove("focused")
    document.querySelector("#stage").replaceChildren(newContainer)
    // style
    panoContainer.classList.add("focused")
}
function swapThumb(e) {
    if (e.target.classList.contains("focused")) {
        // don't grab clicks on focused PanoContainers
        return
    }
    
    // pull demotedContainer out of stage, replace focusedContainer
    let focusedContainer = document.querySelector("#thumbs .focused");
    let demotedContainer = document.querySelector("#stage pano-container");
    demotedContainer.classList.add("thumbnail")
    focusedContainer.replaceWith(demotedContainer)
    // clone floter's container to stage
    cloneToMain(e.target)
}


/*---------------*\
  POPUP MESSAGING
\*---------------*/
let port = browser.runtime.connect({name:"panorama"});
port.onMessage.addListener(messageHandler)
function messageHandler(message) {
    // create thumbnail set
    createThumbnail(message.faces, "driver")
    createThumbnail(message.faces, "passenger")
    createThumbnail(message.faces, "ip")
    createThumbnail(message.faces, "rear")
    // push first thumbnail up to main
    cloneToMain(document.querySelector("#thumbs .pano-container"))
    // add events
    document.querySelector("#thumbs").addEventListener("swap", swapThumb)
}


// FAKE LOADING FROM POPUP
window.addEventListener("load", ()=>{
    messageHandler({
        faces: {
            pano_r: "images/pano_r.jpg",
            pano_l: "images/pano_l.jpg",
            pano_u: "images/pano_u.jpg",
            pano_d: "images/pano_d.jpg",
            pano_b: "images/pano_b.jpg",
            pano_f: "images/pano_f.jpg"
        }
    })
})