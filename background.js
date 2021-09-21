/*------------------------*\
  CONTENT SCRIPT INJECTION
\*------------------------*/
browser.contentScripts.register({
    "matches": ["*://www.copart.com/lot/*"],
    "js": [
        {file: "/download-copart.js"}
    ]
});
browser.contentScripts.register({
    "matches": ["*://www.iaai.com/vehicledetails/*"],
    "js": [
        {file: "/download-iaai.js"}
    ]
});


/*----------------------*\
  CONTENT CODE INTERFACE  
\*----------------------*/
async function pageActionHandler (tab, clickData) {
    // Called when the page action button is clicked. Retrieves local storage
    // values and hands them to the correct function to handle.
    console.log("page action handler fired")
    browser.storage.local
        .get("imageData")
        .then( (storage) => {
            console.log("page action handler succeeded!")
            if (storage.imageData.type == "copart")    { downloadCopartImages(storage.imageData); }
            else if (storage.imageData.type == "iaai") { downloadIaaiImages(storage.imageData);   };
        }, (error) => {console.log("page action handler failed."); console.log(error)}); 
};
function contentMessage(data, sender) {
    // Called on incoming message and calls the appropriate function.
    if (data.type == "iaai") {
        storeIaaiData(sender.tab.id, data)
    }
}

/*------*\
  COPART  
\*------*/
// Copart downloads begin here, in background.js. An onBeforeRequest event
// allows us to sniff server responses that have HD image URLs, and store those
// values in local storage. When the page action button is clicked, a message is
// sent to content code asking it to download those images.
function downloadCopartImages(imageData) {
    // called after page action button is clicked
    browser.tabs.sendMessage(
        imageData.tabId,
        imageData
    );
}
function copartParseHdResponse(data) {
    // called when copartHdImgRequestListener's request filter is all done
    // data.tabId contains the tab that recieved the lotImages response
    // data.values is an array of strings to JSON-ify
    valuesString = data.values.join("")
    try { valuesJson = JSON.parse(valuesString); }
    catch(err) {
        console.log("Error decoding Copart HD images JSON!");
        console.log(valuesString);
        console.log(data);
        console.log(err.message);
        return;
    }
    urlArray = valuesJson.data.imagesList.HIGH_RESOLUTION_IMAGE
        .map( image => {
            return image.url;
        });
    let imageData = {
        "tabId": data.tabId,
        "type": "copart",
        "values": urlArray
    };
    browser.storage.local.set({imageData});
};
function copartHdImgRequestListener(details) {
    // When a request is made to copart.com/.../lotImages, this function is
    // called before the request goes out. We set up a request filter that will
    // let us sniff the response before handing it to the requesting script.
    let filter = browser.webRequest.filterResponseData(details.requestId);
    let decoder = new TextDecoder("utf-8");
    var responseData = {
        "tabId": details.tabId,
        "type": "copart",
        "values": []
    };
    // we'll set up two events to handle the incoming data
    filter.ondata = event => {
        // called as each packet comes in
        let str = decoder.decode(event.data, {stream: true});
        responseData.values.push(str);
        filter.write(event.data); // pass the data on
    };
    filter.onstop = event => {
        // called when all the data is recieved
        filter.disconnect(); // prevent timeout
        copartParseHdResponse(responseData); // store the data
    };
    return {};
};

/*----*\
  IAAI  
\*----*/
// UTILITIES
var incrementProgressBar = ()=>{
    // used by download... and store... below
    console.log("increment background")
    browser.tabs.sendMessage(
        imageData.tabId,
        {type: "loading_bar", action: "increment"}
    )
};
var isBlackish = (imageData) => {
    // used by iaaiTrimImage below
    // every fourth element will be full opacity
    alphaComponent = imageData.data.length/4 * 255
    // all other elements should be zero... ish
    ishComponent = 20 * imageData.data.length
    return alphaComponent + ishComponent >= imageData.data.reduce( (prev, curr) => {return prev+curr} )
};

// IMAGE PROCESSING
async function storeIaaiData(tabId, data) {
    // called after message from content script
    imageData = data;
    imageData.tabId = tabId;
    browser.storage.local.set({imageData});
}
async function downloadIaaiImages(imageData) {
    // called after page action button
    console.log("downloadIaaiImages beginning fetches")
    // Configure progress bar. We want to be at 50% after processing images (ie
    // at the end of this function), so we want to set the max to double the
    // number of increments we'll do.
    browser.tabs.sendMessage(
        imageData.tabId,
        {type: "loading_bar", action: "configure", max: imageData.values.length*2 }
    );
    // go over each image and start trimming them down to size
    trimmedImages = []
    canvas = document.createElement("canvas")
    var processPromises = [];
    var processedImages = [];
    imageData.values.forEach( key => {
        var imageUrl = "https://anvis.iaai.com/deepzoom?imageKey=" + key + "&level=12&x=0&y=0&overlap=350&tilesize=1900";
        processPromises.push(fetch(imageUrl)
            .then(r => r.blob())
            .then(createImageBitmap)
            .then(img => iaaiTrimImage(canvas, img))
            .then(img => processedImages.push(img))
            .then(()=>{ incrementProgressBar(); })
        )
    });
    // wait for work to complete
    console.log("built "+processPromises.length+" promises. Loading...")
    await Promise.all(processPromises)
    console.log("promises awaited.")
    // store trimmed images.. they're too big to pass in a message!
    await iaaiStoreImages(processedImages)
    // ask the content script to pull data from storage and download them
    browser.tabs.sendMessage(
        imageData.tabId,
        { "type": "iaai",
          "values": "storage-local" }
    );
}
async function iaaiTrimImage(canvas, img) {
    // Uses the canvas to operate on the provided image. Trims off the black borders
    canvas.width = img.width;
    canvas.height = img.height;
    ctx = canvas.getContext('2d');
    ctx.drawImage(img,0,0);
    // number of pixels to trim
    trimLeft   = 0;
    trimRight  = img.width-1;
    trimTop    = 0;
    trimBottom = img.height-1;
    // center lines to check for black
    centerX    = Math.round(img.width /2);
    centerY    = Math.round(img.height/2);
    // find trim values
    sampleWidth = 50 // the number of pixels to sample while finding black(ish) area
    await Promise.all([
        new Promise(resolve => {while (isBlackish( ctx.getImageData(trimLeft,centerY,   1,sampleWidth) )) { trimLeft++;   }; resolve()}),
        new Promise(resolve => {while (isBlackish( ctx.getImageData(trimRight,centerY,  1,sampleWidth) )) { trimRight--;  }; resolve()}),
        new Promise(resolve => {while (isBlackish( ctx.getImageData(centerX,trimTop,    sampleWidth,1) )) { trimTop++;    }; resolve()}),
        new Promise(resolve => {while (isBlackish( ctx.getImageData(centerX,trimBottom, sampleWidth,1) )) { trimBottom--; }; resolve()})
    ]);
    // re-size the canvas and re-place the image to execute the crop
    [trimLeft,trimRight,trimTop,trimBottom]
    canvas.width  = trimRight-trimLeft;
    canvas.height = trimBottom-trimTop;
    ctx.drawImage(img, -trimLeft, -trimTop);
    return Promise.resolve(canvas.toDataURL())
};
async function iaaiStoreImages(imageArray) {
    console.log("iaaiStoreImages invoked")
    // we'll await storage set operations... they can take a while
    var largePromises = []
    for (const [idx, image] of imageArray.entries()) {
        // store each image with indexes as keys
        console.log("storing image #"+idx);
        // JSON interpretation does not allow arbitrary key names unless you do it this way
        var obj = {}
        obj[idx] = image
        obj['type'] = 'large_image'
        largePromises.push(
            browser.storage.local.set(obj)
        );
    };
    await Promise.all(largePromises)
    console.log("iaaiStoreImages complete")
}


/*---------------*\
  EVENT LISTENERS
\*---------------*/

// intercept image URL requests from Copart
browser.webRequest.onBeforeRequest.addListener(
    copartHdImgRequestListener,
    {urls: ["https://www.copart.com/public/data/lotdetails/solr/lotImages/*/USA"]},
    ["blocking"]
);
// button actions
browser.browserAction.onClicked.addListener(openSalvagePages); // defined in search.js
browser.pageAction.onClicked.addListener(pageActionHandler);      // defined above
// listen for messages from content code
browser.runtime.onMessage.addListener(contentMessage)

console.log("background loaded!")
