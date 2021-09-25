/*----------------------*\
  CONTENT CODE INTERFACE  
\*----------------------*/
async function downloadImages() {
    // Called when the page action button is clicked. Retrieves local storage
    // values and hands them to the correct function to handle.
    console.log("Downloading images.");
    copartDownloadImages();
    iaaiDownloadImages();
};
// listen for messages from content code
browser.runtime.onMessage.addListener( (message, sender) => {
    if (message.type == "iaai") {
        // an IAAI tab has scraped page data and returned oSeaDragon URLs
        iaaiStoreImages(sender.tab.id, message)
        return Promise.resolve('done');
    }
    return false;
});

/*------*\
  COPART  
\*------*/
// Copart downloads begin here, in background.js. An onBeforeRequest event
// allows us to sniff server responses that have HD image URLs, and store those
// values in local storage. When the page action button is clicked, a message is
// sent to content code asking it to download those images.
async function copartDownloadImages() {
    // Checks active tabs for Copart lot pages, gathers data, including HD image
    // URLs, and sends a message with data.
    let copartTabs = await browser.tabs.query({active:true, url:"*://*.copart.com/lot/*"});
    for (tab of copartTabs) {
        let ymm = tab.title.match(/^(.*) for Sale/i)[1];
        let lotNumber = tab.url.match(/copart\.com\/lot\/(\d*)\//)[1];
        let hdUrls = await copartFetchLotData(lotNumber)
        console.log(tab)
        browser.tabs.sendMessage(
            tab.id,
            {
                type: "copart",
                values: [{ ymm:ymm,
                           lotNumber:lotNumber,
                           hdUrls:hdUrls }]
        });
    };
}
async function copartFetchLotData(lotNumber) {
    jsn = await fetch(`https://www.copart.com/public/data/lotdetails/solr/lotImages/${lotNumber}/USA`)
        .then(r=>r.json())
    return jsn.data.imagesList.HIGH_RESOLUTION_IMAGE
            .map( image => {return image.url} )
};

/*----*\
  IAAI  
\*----*/
// IMAGE PROCESSING
var isBlackish = (imageData) => {
    // used by iaaiTrimImage below
    // every fourth element will be full opacity
    alphaComponent = imageData.data.length/4 * 255
    // all other elements should be zero... ish
    ishComponent = 20 * imageData.data.length
    return alphaComponent + ishComponent >= imageData.data.reduce( (prev, curr) => {return prev+curr} )
};
async function iaaiStoreImages(tabId, data) {
    // called after message from content script
    imageData = data;
    imageData.tabId = tabId;
    browser.storage.local.set({imageData});
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
            browser.storage.local
            .set(obj)
        );
    };
    await Promise.all(largePromises)
}

// INITIATOR
async function iaaiDownloadImages() {
    console.log("iaaiDownloadImages beginning fetches")
    // find IAAI tabs
    let iaaiTabs = await browser.tabs.query({active:true, url:["*://*.iaai.com/Vehicledetails?*", "*://*.iaai.com/vehicledetails/*"]});
    // TOOD: send error feedback
    if (iaaiTabs.length) {
        await browser.runtime.sendMessage({
            type: "feedback",
            values: [{ action: "download-started", tabs:iaaiTabs.length }]
        });
    }
    for (iaaiTab of iaaiTabs) {
        await iaaiTabDownload(iaaiTab);
    }
}
async function iaaiTabDownload(iaaiTab) {
    console.log(`Requesting info from iaai tab #${iaaiTab.id}`)
    imageKeys = await browser.tabs.sendMessage(
        iaaiTab.id, {type: "iaai", values:["scrape-images"]}
    ).catch((error)=>{ abortDownload("There was an error communicating with the page.") });
    if (!imageKeys) { abortDownload("There was an error, and images could not be found.") }
    // TODO: send error feedback
    await browser.runtime.sendMessage({
        type: "feedback",
        values: [{ action: "download-tab", images: imageKeys.length }]
    });
    // go over each image and start trimming them down to size
    trimmedImages = []
    canvas = document.createElement("canvas")
    var processedImages = [];
    await Promise.all(
        imageKeys.map( async key => {
            var imageUrl = "https://anvis.iaai.com/deepzoom?imageKey=" + key + "&level=12&x=0&y=0&overlap=350&tilesize=1900";
            await fetch(imageUrl)
                .then(r => r.blob())
                .then(createImageBitmap)
                .then(img => iaaiTrimImage(canvas, img))
                .then(img => processedImages.push(img))
            await browser.runtime.sendMessage({type:'feedback', values:[{action: 'tab-increment'}]})
            console.log(`${key} processed`)
        })
    );
    // store trimmed images.. they're too big to pass in a message!
    await iaaiStoreImages(processedImages)
    // ask the content script to pull data from storage and download them
    browser.tabs.sendMessage(
        iaaiTab.id,
        { "type": "iaai",
          "values": ["storage-local"] }
    );
}
