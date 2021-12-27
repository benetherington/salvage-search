function addMain(faces={}, name) {
    let panoContainer = createPanoContainer(faces, name)
    document.querySelector("div #pano-active").append(panoContainer)
}

function addThumbnail(faces={}, name) {
    let panoContainer = createPanoContainer(faces, name)
    document.querySelector("#thumbs").append(panoContainer)
}

function createPanoContainer(faces={}, name) {
    let panoContainer = document.createElement("div", {is:"pano-container"});
    panoContainer.addPano({faces, name})
    switch (name) {
        case "driver":
            panoContainer.goToDriver()
            break;
        case "passenger":
            panoContainer.goToPassenger()
            break;
        case "ip":
            panoContainer.goToIp()
            break;
        case "rear":
            panoContainer.goToRear()
    }
    return panoContainer;
}

let port = browser.runtime.connect({name:"panorama"});

port.onMessage.addListener(messageHandler)

function messageHandler(message) {
    addMain(message.faces, "driver")
    addThumbnail(message.faces, "passenger")
    addThumbnail(message.faces, "ip")
    addThumbnail(message.faces, "rear")
    document
        .querySelectorAll(".icon-floater")
        .forEach(floater=>
            floater.addEventListener("click", swapThumb)
        )
}

function swapThumb(e) {
    let thumb = e.target.parentElement;
    let main = document.querySelector("#pano-active .pano-container");
    
    main.remove()
    thumb.remove()
    document.querySelector("#pano-active").append(thumb)
    document.querySelector("#thumbs").append(main)
}

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