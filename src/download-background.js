/*---------------*\
  POPUP INTERFACE  
\*---------------*/
async function downloadImages() {
    // Called from popup via background.js message handler
    console.log("Fetching images.")
    try {
        sendProgress("download", "start")
        let imageUrls = [];
        imageUrls.push(... await copartImageUrlsFromTab())
        imageUrls.push(... await iaaiImageUrlsFromTab())
        for (let idx=0; idx<imageUrls.length; idx++) {
            let url = imageUrls[idx];
            let filename = `${idx}.jpg`;
            console.log(`downloading ${filename}`)
            browser.downloads.download({
                url: url,
                saveAs: false,
                filename: filename
            })
        }
        sendProgress("download", "end")
    } catch (error) {
        sendProgress("download", "abort")
        sendNotification(error, {displayAs: "error"})
    }
};


/*------*\
  COPART  
\*------*/
async function copartImageUrlsFromTab() { // => array of URLs
    // Checks active tabs for Copart lot pages, gathers data, including HD image
    // URLs, and sends a message with data.
    
    // FIND TABS
    console.log("copartDownloadImages getting imageKeys")
    let copartTabs = await browser.tabs.query({active:true, url:"*://*.copart.com/lot/*"});
    if (!copartTabs.length) {return [];}
    // FIND LOTS
    let lotNumbers = copartTabs.map(tab=>{
        // let ymm = tab.title.match(/^(.*) for Sale/i)[1];
        return tab.url.match(/copart\.com\/lot\/(\d*)/)[1]
    })
    if (!lotNumbers.length) {return [];}
    sendNotification("Copart: searching for images.")
    // GET URLS
    let hdUrls = await copartImageUrlsFromLot(lotNumbers);
    return hdUrls;
}
async function copartImageUrlsFromLot(lotNumberOrNumbers) { // => array of URLs
    // Pass in a single lot number, multiple lot numbers, or arrays of lot numbers.
    let lotNumbers = Array.from(arguments).flat();
    if (!lotNumbers.length) {throw "copartImageUrlsFromLot requires one or more lot numbers.";}
    // FETCH
    let jsons = await Promise.all(lotNumbers.map( lotNumber=>copartFetchLotData(lotNumber) ))
    // PROCESS
    let imageUrls = [];
    for (jsn of jsons) {
        try {
            if (  !jsn.hasOwnProperty("returnCode")
               ||  jsn.returnCode!=1
               || !jsn.hasOwnProperty("data")
               || !jsn.data.hasOwnProperty("imagesList") )
                {throw "encountered a server error."}
            if (!jsn.data.imagesList.hasOwnProperty("HIGH_RESOLUTION_IMAGE"))
                {throw "returned no images.";}
            let highResImages = jsn.data.imagesList.HIGH_RESOLUTION_IMAGE.map(image=>image.url)
                imageUrls.push( ...highResImages )
        } catch (error) {throw `Copart: lot #${jsn.lotNumber} ${error}`}
    }
    return imageUrls
};
async function copartFetchLotData(lotNumber) { // => JSON object
    let imagesUrl = `https://www.copart.com/public/data/lotdetails/solr/lotImages/${lotNumber}/USA`;
    let jsn = await fetch(imagesUrl).then(r=>r.json())
    jsn.lotNumber = lotNumber
    return jsn
};


/*----*\
  IAAI  
\*----*/
// TOP-LEVEL INITIATORS
// These send notifications and progressbar starters, but no increments, nor
// errors. All errors are caught, formatted, and re-thrown.
async function iaaiImageUrlsFromTab() { // => array of dataURLs
    let imageUrls = [];
    try {
        // FIND TABS
        let iaaiTabs = await browser.tabs.query( {active:true, url:["*://*.iaai.com/*ehicle*etails*"]} );
        if (!iaaiTabs.length) {return [];} // no error thrown, as the user might be targeting a Copart tab.
        // GET IMAGE KEYS
        let imageKeys = Array.from(await Promise.all(
            iaaiTabs.map(iaaiTab=>iaaiImageKeysFromTab(iaaiTab))
        )).flat();
        await sendNotification(`IAAI: processing ${imageKeys.length} images.`)
        await sendProgress("download", "start", {total:imageKeys.length})
        // CREATE DATA URLS
        imageUrls = await iaaiImageUrlsFromKeys(imageKeys)
    } catch (error) {throw `IAAI: ${error}`}
    return imageUrls
}
async function iaaiImageUrlsFromStock(stockNumberOrNumbers) { // => array of dataUrls
    let stockNumbers = Array.from(arguments).flat();
    let imageUrls = [];
    try {
        // GET IMAGE KEYS
        let imageKeys = await iaaiImageKeysFromStock(stockNumbers);
        await sendNotification(`IAAI: processing ${imageKeys.length} images.`)
        await sendProgress("download", "start", {total:imageKeys.length})
        // CREATE DATA URLS
        imageUrls = await iaaiImageUrlsFromKeys(imageKeys);
    } catch (error) {throw `IAAI: ${error}`}
    return imageUrls
}

// IMAGE KEYS
// These send no notifications, but they do call image processors, which will
// send progressbar increments. Any errors are thrown without formatting.
async function iaaiImageKeysFromTab(iaaiTab) {
    // Fetches image keyss from the provided tab.
    console.log(`Requesting imageKeys from tab #${iaaiTab.id}`)
    let imageKeys = [];
    imageKeys = await browser.tabs.sendMessage(
        iaaiTab.id, {type: "iaai", values:["scrape-images"]}
    ).catch(()=>{ throw "there was an error communicating with the page. Try refreshing it?"; });
    if (!imageKeys.length) {throw "no images found."}
    return imageKeys
}
async function iaaiImageKeysFromStock(stockNumber) {
    if (typeof(stockNumber) === "number") {stockNumber = stockNumber.toString()}
    let getKeysUrl = new URL("https://iaai.com/Images/GetJsonImageDimensions");
    getKeysUrl.searchParams.append(
        'json',
        JSON.stringify({"stockNumber":stockNumber})
    );
    let response = await fetch(getKeysUrl);
    if (!response.ok) {throw "server error"}
    if (response.headers.get("content-length") == '0') {throw "no query results"}
    let jsn = await response.json();
    let imageKeys = jsn.keys.map(i=>i.K);
    return imageKeys
}

// IMAGE PROCESSING
// These send no notifications, but they do increment the progressbar. Any
// errors are thrown without formatting.
async function iaaiImageUrlsFromKeys(imageKeys) { // => array of objectURLs
    // SEND NOTIFICATION
    if (!imageKeys.length){return []}
    // FETCH AND PROCESS
    let processedUrls = [];
    let canvas = document.createElement("canvas");
    for (imageKey of imageKeys) {
        // FETCH
        let imageUrl = "https://anvis.iaai.com/deepzoom?imageKey=" +
                        imageKey + "&level=12&x=0&y=0&overlap=350&tilesize=1900";
        let bitmap = await fetch(imageUrl)
                           .then(r => r.blob())
                           .then(createImageBitmap)
        // TRIM
        let trimmedImage = await trimImage(canvas, bitmap)
        // CREATE URL
        if (trimmedImage) {
            let url = dataURLtoObjectURL(trimmedImage);
            processedUrls.push(url)
        }
        console.log(`${imageKey} processed`)
        await sendProgress("download", "increment")
    };
    // DONE
    return processedUrls
}

// PROCESSING HELPERS
async function trimImage(canvas, img) { // => dataURL
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
    return Promise.resolve(canvas.toDataURL({type:"image/jpeg"}))
};
function dataURLtoObjectURL(uri, name) {
    // Takes a dataURL and turns it into a temporary object URL. This makes it
    // easier to pass around. See: https://stackoverflow.com/a/12300351
    let byteString = atob(uri.split(',')[1]);
    let mimeString = uri.split(',')[0].split(':')[1].split(';')[0]
    let ab = new ArrayBuffer(byteString.length);
    let ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
    }
    let blob = new Blob([ab], {type: mimeString});
    blob.name = name+".jpg"
    return URL.createObjectURL(blob)
};
function isBlackish(imageData) {
    // Detects if the imageData is close enough to black to be trimmed off.
    // every fourth element will be full opacity
    alphaComponent = imageData.data.length/4 * 255
    // all other elements should be zero... ish
    ishComponent = 20 * imageData.data.length
    return alphaComponent + ishComponent >= imageData.data.reduce( (prev, curr) => {return prev+curr} )
}
// async function iaaiStoreImages(imageArray) {
//     var largePromises = []
//     for (const [idx, image] of imageArray.entries()) {
//         // store each image with indexes as keys
//         console.log("storing image #"+idx);
//         // JSON interpretation does not allow arbitrary key names unless you do it this way
//         // TODO: fix type key.
//         var obj = {}
//         obj[idx] = image
//         obj['type'] = 'large_image'
//         largePromises.push(
//             browser.storage.local
//             .set(obj)
//         );
//     };
//     await Promise.all(largePromises)
// }
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




console.log("download-background loaded")
