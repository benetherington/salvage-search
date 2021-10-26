/*---------------*\
  POPUP INTERFACE  
\*---------------*/
async function downloadImages() {
    // Called from popup via background.js message handler
    console.log("Fetching images.")
    try {
        sendProgress("download", "start")
        let imageUrls = [];
        imageUrls.push(... await copartImageUrlsFromOpenTab())
        imageUrls.push(... await iaaiImageUrlsFromOpenTab())
        imageUrls.push(... await poctraImageUrlsFromOpenTab())
        imageUrls.forEach( (url, idx) => {
            console.log(`downloading ${idx}`)
            browser.downloads.download({
                url: url,
                saveAs: false,
                filename: `${idx}.jpg`
            })
        })
        sendProgress("download", "end")
    } catch (error) {
        sendProgress("download", "abort")
        sendNotification(error, {displayAs: "error"})
    }
};


/*------*\
  COPART  
\*------*/
async function copartImageUrlsFromOpenTab() { // => array of URLs
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
    // Accepts a single lot number, multiple lot numbers, or an array of lot numbers.
    let lotNumbers = Array.from(arguments).flat();
    if (!lotNumbers.length) {throw "copartImageUrlsFromLot requires one or more lot numbers.";}
    // FETCH
    let jsons = await Promise.all(lotNumbers.map( lotNumber=>copartFetchLotData(lotNumber) ))
    // PROCESS
    let imageUrls = [];
    for (let jsn of jsons) {
        try {
            if (  !jsn.hasOwnProperty("returnCode")
               ||  jsn.returnCode!=1
               || !jsn.hasOwnProperty("data")
               || !jsn.data.hasOwnProperty("imagesList") )
                {throw "encountered a server error."}
            if (!jsn.data.imagesList.hasOwnProperty("HIGH_RESOLUTION_IMAGE"))
                {throw "returned no images.";}
            // TODO: sometimes, imagesList has more images in FULL_RESOLUTION
            // than in HIGH_RESOLUTION. We need to go over FULL and return HIGH
            // if present, FULL if not.
            let highResImages = jsn.data.imagesList.HIGH_RESOLUTION_IMAGE.map(image=>image.url)
                imageUrls.push( ...highResImages )
        } catch (error) {throw `Copart: lot #${jsn.lotNumber} ${error}`}
    }
    return imageUrls
};
async function copartFetchLotData(lotNumber) { // => JSON object
    let imagesUrl = `https://www.copart.com/public/data/lotdetails/solr/lotImages/${lotNumber}/USA`;
    let headers = { "User-Agent": window.navigator.userAgent,
                    "Accept": "application/json, text/plain, */*" }
    let response = await fetch(imagesUrl, headers)
    if (response.headers.get("content-type").startsWith("application/json")) {
        let jsn = await response.json();
        jsn.lotNumber = lotNumber;
        return jsn
    } else {
        console.log("Copart wants a CAPTCHA check")
        browser.tabs.create({url:"https://www.copart.com"})
        throw "please complete the CAPTCHA and try again."
    }
};


/*----*\
  IAAI  
\*----*/
// TOP-LEVEL INITIATORS
// These send notifications and progressbar starters, but no increments, nor
// errors. All errors are caught, formatted, and re-thrown.
async function iaaiImageUrlsFromOpenTab() { // -> [objectURL]
    let imageUrls = [];
    try {
        // FIND TABS
        let iaaiTabs = await browser.tabs.query( {active:true, url:["*://*.iaai.com/*ehicle*etails*"]} );
        if (!iaaiTabs.length) {return [];} // no error thrown, as the user might be targeting a Copart tab.
        // GET IMAGE DETAILS
        let stockNumbers = await Promise.all(
            iaaiTabs.map(iaaiTab=>iaaiStockNumberFromTab(iaaiTab))
        );
        let lotDetails = await Promise.all(
            stockNumbers.map(stockNumber=>iaaiFetchLotDetail(stockNumber))
        );
        await sendNotification(`IAAI: processing ${imageCount} images.`)
        await sendProgress("download", "start", {total:imageCount})
        // CREATE DATA URLS
        imageUrls = await Promise.all(
            lotDetails.map(
                async imageDetails=>await iaaiObjectUrlsFromDetails(imageDetails)
            )
        )
    } catch (error) {throw `IAAI: ${error}`}
    return imageUrls.flat()
}
async function iaaiImageUrlsFromStock(stockNumberOrNumbers) { // -> [dataUrl]
    // Accepts a single stockNumber, multiple stockNumbers, or an array of stockNumbers.
    let stockNumbers = Array.from(arguments).flat();
    let imageUrls = [];
    try {
        // GET IMAGE KEYS
        let imagesDetails = [];
        for (let stockNumber of stockNumbers) {
            let details = await iaaiImageKeysFromStock(stockNumber);
            imagesDetails.push(...details)
        }
        let imageCount = countImages(imagesDetails)
        await sendNotification(`IAAI: processing ${imageCount} images.`)
        await sendProgress("download", "start", {total:imageCount})
        // CREATE DATA URLS
        imageUrls = await iaaiImageUrlsFromKeys(imagesDetails);
    } catch (error) {throw `IAAI: ${error}`}
    return imageUrls
}
function countImages(imagesDetails){ // -> int
    return imagesDetails.reduce((total, details)=>{
        return total + details.keys.length
    }, initialValue=0)
}

// IMAGE DETAILS
// These send no notifications, but they do call image processors, which will
// send progressbar increments. Any errors are thrown without formatting.
async function iaaiStockNumberFromTab(iaaiTab) { // -> string
    // Gets image keys from the provided tab.
    console.log(`Requesting stockNumber from tab #${iaaiTab.id}`)
    let unparsedJson = await browser.tabs.executeScript(
        iaaiTab.id, {code:`document.querySelector("#ProductDetailsVM").innerText`}
    ).catch(()=>{ throw "there was an error communicating with the page. Please reload the page and try again." });
    try {
        let jsn = JSON.parse(unparsedJson[0]);
        let stockNumber = jsn.VehicleDetailsViewModel.StockNo;
        return stockNumber;
    } catch {
        throw "something went wrong getting this vehicle's stock number. Please reload the page and try again."
    }
}
async function iaaiFetchLotDetail(stockNumber) { //-> [ {keys:[]} ]
    if (typeof(stockNumber) === "number") {stockNumber = stockNumber.toString()}
    let getKeysUrl = new URL("https://iaai.com/Images/GetJsonImageDimensions");
    getKeysUrl.searchParams.append(
        'json',
        JSON.stringify({"stockNumber":stockNumber})
    );
    let headers = { "User-Agent": window.navigator.userAgent,
                    "Accept": "application/json, text/plain, */*" }
    let response = await fetch(getKeysUrl, {headers});
    if (!response.ok) {throw "server error"}
    if (response.headers.get("content-length") === '0') {throw "no query results"}
    let lotDetails = await response.json();
    return lotDetails
}

// IMAGE PROCESSING
// These send no notifications, but they do increment the progressbar. Any
// errors are thrown without formatting.
async function iaaiObjectUrlsFromDetails(imageOrImagesDetails) { // -> [objectURL]
    // accepts a single imageDetails object, multiple imageDetails objects, or
    // an array of imageDetails objects
    let imagesDetails = Array.from(arguments).flat()
    if (!imagesDetails.length){return []}
    // FETCH AND PROCESS
    let processedUrls = [];
    for (let imageDetails of imagesDetails) {
        let dezoomed = await iaaiImageUrlsFromImageKeys(imageDetails.keys)
        processedUrls.push(...dezoomed)
        // processedUrls.push(...pano)
        // processedUrls.push(...walkaround)
    };
    // DONE
    return processedUrls
}
const TILE_SIZE = 250;
var iaaiTiming = []
async function iaaiImageUrlsFromImageKeys(keyOrKeys) { // -> [objectURL]
    // Accepts a single keys object, multiple keys objects, or an array of keys
    // objects.
    keys = Array.from(arguments).flat()
    let canvas = document.createElement("canvas");
    let ctx = canvas.getContext("2d")
    let processedPromises = [];
                                                                        iaaiTiming.push({id:"main", action:"before loop", T:performance.now()})
    for (let key of keys) {
                                                                        iaaiTiming.push({id:key.K, action:"create", t:performance.now()})
        processedPromises.push(new Promise(async (resolve, reject)=>{
            // PLAN
            let tileUrl = (x, y)=>`https://anvis.iaai.com/deepzoom?imageKey=${key.K}&level=12&x=${x}&y=${y}&overlap=0&tilesize=${TILE_SIZE}`;
            // PICKUP: zoom 13 returns an image larger than W, H, but zoom 12
            // returns an image smaller.
            canvas.width  = key.W;
            canvas.height = key.H;
            let xTiles = Math.ceil(key.W / TILE_SIZE);
            let yTiles = Math.ceil(key.H / TILE_SIZE);
            let xRange = [...Array(xTiles).keys()];
            let yRange = [...Array(yTiles).keys()];
            // FETCH
            let bitmapPromises = [];
                                                                        iaaiTiming.push({id:key.K, action:"begin fetch", t:performance.now()})
            for (let x of xRange) { for (let y of yRange){
                bitmapPromises.push( fetch(tileUrl(x,y))
                                .then(r => r.blob())
                                .then(createImageBitmap)
                                .then(bmp => new Object({x,y,bmp}))
                )
            }}
                                                                        iaaiTiming.push({id:key.K, action:"between fetch and process", t:performance.now()})
            let bmpDetails = await Promise.all(bitmapPromises)
            bmpDetails.forEach(bmpDetails=>{
                let {bmp,x,y} = bmpDetails;
                ctx.drawImage(bmp,x*TILE_SIZE,y*TILE_SIZE)
            })
            let dataURL = canvas.toDataURL();
            let objectURL = dataURLtoObjectURL(dataURL);
                                                                        iaaiTiming.push({id:key.K, action:"processed", t:performance.now()})
            console.log(`${key.K} processed`)
            resolve(objectURL)
        }))
                                                                        iaaiTiming.push({id:key.K, action:"created", t:performance.now()})
    }
                                                                        iaaiTiming.push({id:"main", action:"after loop", T:performance.now()})
    return processedUrls
}
function dataURLtoObjectURL(uri, name) { // -> objectURL
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
//         AR: 1.33,
//         ART: 1.35,
//         B: 671,
//         H: 1944,
//         I: 0,
//         IN: 1,
//         K: "31819854~SID~B671~S0~I1~RW2592~H1944~TH0",
//         S: 0,
//         SID: 31819854,
//         SN: 31355822,
//         TH: 72,
//         TW: 96,
//         W: 2592,
//     }, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}]
// }




/*------*\
  POCTRA  
\*------*/

async function poctraImageUrlsFromOpenTab() {
    let imageUrls = [];
    try {
        // FIND TABS
        let poctraTabs = await browser.tabs.query( {active:true, url:["*://*.poctra.com/*/id-*/*"]} );
        if (!poctraTabs.length) {return [];}
        // DETERMINE SALVAGE
        let lotNumbers = Array.from(
            await Promise.all(
                poctraTabs.map(async poctraTab=>
                    await browser.tabs.executeScript(poctraTab.id, { code:`(${poctraGetLotNumber.toString()})()` })
                )
            )
        ).flat()
        console.log('lotNumbers:'); console.log(lotNumbers)
        if (!lotNumbers.some(ln=>ln.yard!="unknown")) // if we didn't get at least one solid hit
        {throw "is this a Copart or IAAI archive page? If so, please send Ben the URL. They've changed something."}
        for (let lotNumber of lotNumbers) {
            let urls;
            if (lotNumber.yard==="copart") {
                urls = await copartImageUrlsFromLot(lotNumber.number)
            } else if (lotNumber.yard==="iaai") {
                urls = await iaaiImageUrlsFromStock(lotNumber.number)
            } else { console.log('lotNumber:'); console.log(lotNumber) }
            imageUrls.push(...urls)
        }
    } catch (error) {throw `Poctra: ${error}`}
    return imageUrls
}

function poctraGetLotNumber() {
    let idElement = document.querySelector("h2");
    if (!idElement) {return null}
    let idString = idElement.innerText;
    let idMatches = /(?<type>Lot|Stock) no: (?<number>\d*)/.exec(idString);
    if (!idMatches) {return null}
    let type, number;
    ({type, number} = idMatches.groups);
    if (type==="Lot") {
        return {yard: "copart", number}
    } else if (type==="Stock") {
        return {yard: "iaai", number}
    } else {
        return {yard: "unknown"}
    }
}



console.log("download-background loaded")
