/*--------*\
  MESSAGES  
\*--------*/
browser.runtime.onMessage.addListener( (message) => {
    console.log("iaai content got message")
    if (message.type == 'iaai' && message.values.includes("scrape-images")) {
        // DATA COLLECTION
        return new Promise((resolve, reject)=>{
            let imageKeys;
            try {
                imageKeys = getImageKeys();
                if (imageKeys) { resolve(imageKeys) };
            }
            catch {console.log("uh-oh")};
            reject("Something went wrong fetching imageKeys.");
        });
    } else if (message.type == 'iaai' && message.values.includes("storage-local")) {
        // DOWNLOAD
        console.log("iaai downloading from storage");
        downloadFromStorage()
        return Promise.resolve('done');
        };
    console.log("message wasn't for iaai")
    return false;
});


/*---------------*\
  DATA COLLECTION  
\*---------------*/
function getImageKeys() {
    dimensionsString = document.getElementById("fullViewImg").attributes['dimensionsallimagekeys'].nodeValue;
    keysIter = dimensionsString.matchAll(/K":"(.*?)",/g);
    imageKeys = Array.from(keysIter, (item) => item[1]);
    return imageKeys;
}


/*---------*\
  DOWNLOADS  
\*---------*/
async function downloadFromStorage() {
    console.log("click drag invoked")
    // Update loadingBar. Start at 50%. Max will be twice the number of images
    // we have to handle, so that we hit 100% after iterating once for each
    // image.
    await browser.runtime.sendMessage({ type: "feedback", values: [{ action: "download-nearly-finished" }] })
    storage = await browser.storage.local.get() // TODO: pass in storage keys from background
    // go over each value in storage, looking for large images
    for ( [key, value] of Object.entries(storage) ) {
        console.log(key)
        if (parseInt(key)+1) { // add to avoid falsy zero
            // that's a large image
            downloadUri(value, key);
            try {browser.storage.local.remove(key.toString());}
            catch (err) {console.log(err)};
        };
    };
    browser.runtime.sendMessage({ type: "feedback", values: [{ action: "download-finished" }] })
    console.log("click drag done!")
};
async function downloadUri(uri, name) {
    // Opens a single URI in a new tab for click-drop downloading
    var link = document.createElement("a");
    link.text = name+".png ";
    link.download = name;
    link.href = uri;
    link.target = "_blank";
    console.log(`I would have downloaded ${link.text}`)
    // link.click()
};


/*-----*\
  SETUP  
\*-----*/
console.log("download-iaai loaded!")

//-url:https://cdn.spincar.com/spincar-static/ana2/client_id.html?_=c14713aa64cab8 -url:https://nebula-cdn.kampyle.com/wu/653475/onsite/embed.js -url:https://spins.spincar.com/iaa-avanel/000-31168924 -url:https://iaai.com/bundles/coreJS?v=y9T2fhLkDxs26cv9yrT4QDRjWuXWqqp7Q7D0HXpkMGs1 -url:https://cdn.adpushup.com/38903/adpushup.js -url:https://iaai.com/dist/js/vendors/gauge.js?v=20201015 -url:https://iaai.com/vehicledetails/41483004 -url:chrome-extension://gfhcppdamigjkficnjnhmnljljhagaha/content.js
