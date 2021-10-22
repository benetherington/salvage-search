/*----------------------*\
  CONTENT CODE INTERFACE  
\*----------------------*/
async function downloadImages() {
    // Called when the page action button is clicked. Retrieves local storage
    // values and hands them to the correct function to handle.
    console.log("Fetching images.");
    copartDownloadImages();
    iaaiDownloadImages();
};
function createImageUrl(uri, name) {
    // CREATE BLOB https://stackoverflow.com/a/12300351
    let byteString = atob(uri.split(',')[1]);
    let mimeString = uri.split(',')[0].split(':')[1].split(';')[0]
    let ab = new ArrayBuffer(byteString.length);
    let ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
    }
    let blob = new Blob([ab], {type: mimeString});
    blob.name = name+".png "
    return URL.createObjectURL(blob)
};

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
    console.log("copartDownloadImages beginning fetches")
    let copartTabs = await browser.tabs.query({active:true, url:"*://*.copart.com/lot/*"});
    if ( copartTabs.length ) { sendNotification("Copart: searching for images.") }
    for (tab of copartTabs) {
        let ymm = tab.title.match(/^(.*) for Sale/i)[1];
        let lotNumber = tab.url.match(/copart\.com\/lot\/(\d*)/)[1];
        let hdUrls = await copartFetchLotData(lotNumber)
        // DOWNLOAD IMAGES
        hdUrls.map(url=>{
            browser.downloads.download({url:url, saveAs:false})
        })
        // When clicking on a Copart lot details page from the home page or
        // search results, the URL is updated, but a navigation event does not
        // occur. This means that until that details page is refreshed, our
        // content script will not be injected. Catch this by injecting the
        // script if the message fails to find a recipient.
        // messager = function() {
        //     return browser.tabs.sendMessage(
        //         tab.id,
        //         { type: "copart",
        //           values: [{ ymm:ymm,
        //                      lotNumber:lotNumber,
        //                      hdUrls:hdUrls }] }
        //     )
        // };
        // messager().then(null, async ()=>{ // messenger failed, load scripts and retry
        //     await browser.tabs.executeScript(tab.id, {file:"/shared-assets.js"});
        //     await browser.tabs.executeScript(tab.id, {file:"/download-copart.js"});
        //     messager();
        // });
    }
}
async function copartFetchLotData(lotNumber) {
    let jsn = await fetch(`https://www.copart.com/public/data/lotdetails/solr/lotImages/${lotNumber}/USA`)
        .then(r=>r.json())
    let imageUrls = [];
    try {
        if (jsn.data.imagesList.hasOwnProperty("HIGH_RESOLUTION_IMAGE")) {
            imageUrls = jsn.data.imagesList.HIGH_RESOLUTION_IMAGE
                            .map( image => {return image.url} )
        } else { throw "no images found"}
    } catch (error) {
        if (error instanceof TypeError) {
            messageText = "server error fetching images"
        } else { messageText = error }
        sendNotification(`Copart: ${messageText} for lot #${lotNumber}`, {displayAs: "error"})
    }
    return imageUrls
};


/*----*\
  IAAI  
\*----*/
// INITIATOR
async function iaaiDownloadImages(stockNumber=null) {
    // Downloads, processes, and displays IAAI images to the user. If
    // stockNumber is not provided, fetches images from the active tab.
    
    // GET IMAGE KEYS
    console.log("iaaiDownloadImages getting imageKeys")
    let downloadTab;
    let imageKeys = [];
    if (stockNumber) {
        // we can ignore any open tabs
        imageKeys = await iaaiImageKeysFromStock(stockNumber)
    } else {
        // find IAAI tabs
        let iaaiTabs = await browser.tabs.query( {active:true, url:["*://*.iaai.com/*ehicle*etails*"]} );
        // TOOD: send error feedback
        // fetch keys from tab
        let iaaiTab;
        for (iaaiTab of iaaiTabs) {
            imageKeys = await iaaiImageKeysFromTab(iaaiTab);
        }
    }
    if (imageKeys.length) {
        await browser.runtime.sendMessage({
            type: "feedback",
            values: [
                // We'll increment on processing, on storing, and we'll do one last chunk from content
                {action: "download-start", total: imageKeys.length*2+1},
                {action: "feedback-message", message: `IAAI: processing ${imageKeys.length} images.`}
            ]
        });
    }
    // PROCESS IMAGES
    let canvas = document.createElement("canvas");
    for (imageKey of imageKeys) {
        // FETCH AND PROCESS
        let imageUrl = "https://anvis.iaai.com/deepzoom?imageKey=" +
                        imageKey + "&level=12&x=0&y=0&overlap=350&tilesize=1900";
        let bitmap = await fetch(imageUrl)
                           .then(r => r.blob())
                           .then(createImageBitmap)
                           .catch(reason=>console.log(reason))
        let trimmedImage = await iaaiTrimImage(canvas, bitmap)
                                        .catch(reason=>console.log(reason))
        // DOWNLOAD
        if (trimmedImage) {
            let url = createImageUrl(trimmedImage);
            browser.downloads.download({url:url, saveAs:false, filename:imageKey+".png"})
        }
        console.log(`${imageKey} processed`)
        await browser.runtime.sendMessage({type:'feedback', values:[{action: 'download-increment'}]})
    };
    // DONE
    await browser.runtime.sendMessage({type:'feedback', values:[{action: 'download-end'}]})
}

async function iaaiImageKeysFromStock(stockNumber) {
    if (typeof(stockNumber) === "number") {stockNumber = stockNumber.toString()}
    let imageKeys = [];
    try {
        let getKeysUrl = new URL("https://iaai.com/Images/GetJsonImageDimensions");
        getKeysUrl.searchParams.append(
            'json',
            JSON.stringify({"stockNumber":stockNumber})
        );
        let response = await fetch(getKeysUrl);
        if (!response.ok) {throw "server error"}
        if (response.headers.get("content-length") == '0') {throw "no query results"}
        let jsn = await response.json();
        imageKeys = jsn.keys.map(i=>i.K);
        } catch (error) {
            console.log(error)
        }
        return imageKeys
}
async function iaaiImageKeysFromTab(iaaiTab) {
    // Fetches image IDs from the provided tab.
    let imageKeys = [];
    try {
        console.log(`Requesting imageKeys from tab #${iaaiTab.id}`)
        imageKeys = await browser.tabs.sendMessage(
            iaaiTab.id, {type: "iaai", values:["scrape-images"]}
        ).catch(()=>{ throw "there was an error communicating with the page. Try refreshing it?"; });
        if (!imageKeys.length) { throw "no images found!"; }
        // TODO: send error feedback
    } catch (error) {
        browser.runtime.sendMessage({
            type: "feedback",
            values: [
                {   action: "feedback-message",
                    message: "IAAI: something went wrong while processing images.",
                    displayAs: 'error'},
                {action: "download-abort"}
            ]
        })
    }
    return imageKeys
}
// used by iaaiTrimImage
var isBlackish = (imageData) => {
    // Detects if the imageData is close enough to black to be trimmed off.
    // every fourth element will be full opacity
    alphaComponent = imageData.data.length/4 * 255
    // all other elements should be zero... ish
    ishComponent = 20 * imageData.data.length
    return alphaComponent + ishComponent >= imageData.data.reduce( (prev, curr) => {return prev+curr} )
};
async function iaaiTrimImage(canvas, img) {
    // Uses a provided canvas to trim off the black borders of the provided image.
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
    var largePromises = []
    for (const [idx, image] of imageArray.entries()) {
        // store each image with indexes as keys
        console.log("storing image #"+idx);
        // JSON interpretation does not allow arbitrary key names unless you do it this way
        // TODO: fix type key.
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
console.log("download-background loaded")

// FOR REFERENCE
// getJsonImageDimensions returns:
// {
//     DeepZoomInd: true
//     Image360Ind: true
//     Image360Url: "https://spins.spincar.com/iaa-rochester/000-31355822"
//     UndercarriageInd: false
//     VRDUrl: "https://mediastorageaccountprod.blob.core.windows.net/media/31819854_VES-100_1"
//     Videos: [{…}]
//     keys: (11) [{
//         AR: 1.33
//         ART: 1.35
//         B: 671
//         H: 1944
//         I: 0
//         IN: 1
//         K: "31819854~SID~B671~S0~I1~RW2592~H1944~TH0"
//         S: 0
//         SID: 31819854
//         SN: 31355822
//         TH: 72
//         TW: 96
//         W: 2592
//     }, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}]
// }
