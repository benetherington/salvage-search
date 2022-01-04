/*----------*\
  PANO SETUP
\*----------*/

function createThumbnail(faces={}, name) {
    let panoContainer = document.createElement("pano-container");
    panoContainer.classList.add("thumbnail")
    panoContainer.addPano({faces, name})
    document.querySelector("#thumbs").append(panoContainer)
    return panoContainer;
}


/*------------------------*\
  THUMBNAIL PROMOTE/DEMOTE
\*------------------------*/
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
function cloneToMain(panoContainer) {
    // clone
    let newContainer = panoContainer.getClone();
    
    newContainer.classList.remove("thumbnail")
    newContainer.classList.remove("focused")
    document.querySelector("#stage").replaceChildren(newContainer)
    // style
    panoContainer.classList.add("focused")
}


/*---------------*\
  POPUP MESSAGING
\*---------------*/
let FACES;
let port = browser.runtime.connect({name:"panorama"});
port.onMessage.addListener(messageHandler)
function messageHandler(message) {
    // create thumbnail set, point them in the correct direction
    FACES = message.faces;
    ["driver","passenger","ip","rear"].forEach(view=>
        createThumbnail(message.faces, view).resetView()
    )
    // push first thumbnail up to main
    cloneToMain(document.querySelector("#thumbs .pano-container"))
    // add events
    document.querySelector("#thumbs").addEventListener("swap", swapThumb)
}

/*---------------*\
  EVENT LISTENERS
\*---------------*/
window.addEventListener("load", ()=>{
    // FAKE LOADING FROM POPUP
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
    
    // THUMBNAIL ECHOS STAGE
    document.querySelector("#stage").addEventListener("render", (e)=>{
        // get view attributes
        let panoViewer = e.target.getPano();
        let pitch = panoViewer.getAttribute("pitch");
        let yaw   = panoViewer.getAttribute("yaw");
        let zoom  = panoViewer.getAttribute("zoom");
        let fov   = panoViewer.getAttribute("fov");
        // update thumbnail
        let thumb = document.querySelector(".focused").getPano();
        thumb.setAttribute("pitch", pitch)
        thumb.setAttribute("yaw", yaw)
        thumb.setAttribute("zoom", zoom)
        thumb.setAttribute("fov", fov)
    })
    document.querySelector("#stage").addEventListener("namechange", (e)=>{
        // get name attribute
        let name = e.target.getAttribute("name");
        // update thumbnail
        document.querySelector(".focused")
                .setAttribute("name", name)
    })
    // TOOLBAR: DOWNLOAD
    document.querySelector("#dl-this").addEventListener("click", (e)=>{
        // send download event to staged PanoContainer
        document
            .querySelector("#stage pano-container")
            .dispatchEvent(new Event("download"))
    })
    document.querySelector("#dl-all").addEventListener("click", (e)=>{
        // send download event to all thumbnails
        document
            .querySelectorAll("#thumbs pano-container")
            .forEach(el=>{
                el.dispatchEvent(new Event("download"))
            })
    })
    
    // TOOLBAR: RESET
    document.querySelector("#rst-this").addEventListener("click", (e)=>{
        let target = document.querySelector("#thumbs .focused");
        // send reset event to focused thumbnail
        target.dispatchEvent(new Event("reset"))
        // replace the current staged image
        cloneToMain(target)
    })
    document.querySelector("#rst-all").addEventListener("click", (e)=>{
        // send reset event to all PanoContainers
        document
            .querySelectorAll("pano-container")
            .forEach(el=>{
                el.dispatchEvent(new Event("reset"))
            })
    })
    
    // TOOLBAR: VIEWS
    document.querySelector("#add-view").addEventListener("click", (e)=>{
        // add new thumbnail, swap it to stage
        let target = createThumbnail(FACES, "interior");
        swapThumb({target})
        // ensure remove button is enabled
        document.querySelector("#remove-view").disabled = false;
    })
    document.querySelector("#remove-view").addEventListener("click", (e)=>{
        let focused = document.querySelector("#thumbs .focused");
        let target =
               focused.nextElementSibling
            || focused.previousElementSibling;
        // send remove event to focused PanoContainer
        focused.dispatchEvent(new Event("remove"))
        // swap neighbor to stage
        swapThumb({target})
        // disable button if this is the last view
        if (document.querySelector("#thumbs").childElementCount<2) {
            e.target.disabled = true;
        }
    })
})