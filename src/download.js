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
        sendNotification(`${imageUrls.length} images sent to downloads folder!`, {displayAs: "success"})
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
    sendNotification(`Copart: downloading images from lot #${lotNumbers.join(", ")},`)
    // GET URLS
    let hdUrls = await copartImageUrlsFromLot(lotNumbers);
    return hdUrls;
}
async function copartImageUrlsFromLot(lotNumberOrNumbers) { // => array of URLs
    // Accepts a single lot number, multiple lot numbers, or an array of lot numbers.
    let lotNumbers = Array.from(arguments).flat();
    if (!lotNumbers.length) {throw "no lot number provided.";}
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
                {throw `has no high resolution images.`}
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
    console.log("iaaiImageUrlsFromOpenTab()")
    try {
        // FIND TABS
        let iaaiTabs = await browser.tabs.query( {active:true, url:["*://*.iaai.com/*ehicle*etails*"]} );
        if (!iaaiTabs.length) {return [];} // no error thrown, as the user might be targeting a Copart tab.
        console.log(`Found ${iaaiTabs.length} tabs.`)
        // GET STOCK NUMBERS
        let stockNumbers = await iaaiStockNumbersFromTab(iaaiTabs)
        // GET DETAILS
        let lotDetails = await iaaiFetchLotDetails(stockNumbers)
        let imageCount = countImages(lotDetails)
        await sendNotification(`IAAI: processing ${imageCount} images.`)
        await sendProgress("download", "start", {total: imageCount})
        // FETCH IMAGES
        return iaaiImageUrlsFromDetails(lotDetails);
    } catch (error) {throw `IAAI: ${error}`}
}
async function iaaiImageUrlsFromStock(stockNumberOrNumbers) { // -> [objectURL]
    // Accepts a single stockNumber, multiple stockNumbers, or an array of stockNumbers.
    let stockNumbers = Array.from(arguments).flat();
    console.log(`iaaiImageUrlsFromStock(${stockNumbers})`)
    let imageUrls = [];
    try {
        // GET DETAILS
        let lotDetails = await iaaiFetchLotDetails(stockNumbers)
        let imageCount = countImages(lotDetails)
        await sendNotification(`IAAI: processing ${imageCount} images.`)
        await sendProgress("download", "start", {total:imageCount})
        // FETCH IMAGES
        imageUrls = await iaaiImageUrlsFromDetails(lotDetails);
    } catch (error) {throw `IAAI: ${error}`}
    return imageUrls
}
function countImages(imageDetailOrDetails){ // -> int
    let imageDetails = Array.from(arguments).flat()
    return imageDetails.reduce((total, details)=>{
        return total + details.keys.length
    }, initialValue=0)
}

// IMAGE DETAILS
// These send no notifications, but they do call image processors, which will
// send progressbar increments. Any errors are thrown without formatting.
async function iaaiStockNumbersFromTab(iaaiTabOrTabs) { // -> [string]
    // Gets image keys from the provided tab.
    let iaaiTabs = Array.from(arguments).flat();
    console.log(`iaaiStockNumbersFromTab(${iaaiTabs.map(t=>t.id)})`)
    try {
        let stockPromises = iaaiTabs.map(iaaiTab=>
            browser.tabs.executeScript(
                iaaiTab.id, {code:`document.querySelector("#ProductDetailsVM").innerText`}
            ).catch(()=>{ throw "there was an error communicating with the page."+
                                "Please reload the page and try again." })
            .then( lastEvaluated=>JSON.parse(lastEvaluated[0]) )
            .then( jsn=>jsn.VehicleDetailsViewModel.StockNo )
        )
        return Promise.all(stockPromises)
    } catch {
        throw "something went wrong getting this vehicle's stock number. Please reload the page and try again."
    }
}
async function iaaiFetchLotDetails(stockNumberOrNumbers) { //-> [ {keys:[]} ]
    let stockNumbers = Array.from(arguments).flat()
    // ENSURE TYPE
    stockNumbers = stockNumbers.map( stockNumber=>stockNumber.toString() );
    console.log(`iaaiFetchLotDetails(${stockNumbers})`)
    let lotPromises = stockNumbers.map( stockNumber=>{
        // BUILD REQUEST
        let getLotDetailsUrl = new URL("https://iaai.com/Images/GetJsonImageDimensions");
        getLotDetailsUrl.searchParams.append(
            'json', JSON.stringify({"stockNumber":stockNumber})
        )
        let headers = { "User-Agent": window.navigator.userAgent,
                        "Accept": "application/json, text/plain, */*" };
        // FETCH AND PARSE
        return fetch(getLotDetailsUrl, {headers})
            .then( response=> {
                if (response.ok) {return response}
                else {throw "server error"}
            }).then( response=> {
                if (response.headers.get("content-length") > '0')
                {return response.json()}
                {throw "no images found."}
            })
    })
    return Promise.all(lotPromises)
}
// FOR REFERENCE
// getJsonImageDimensions returns:
// {
//     DeepZoomInd: true
//     Image360Ind: true
//     Image360Url:                   "https://spins.spincar.com/iaa-rochester/000-31355822"
//                  https://cdn.spincar.com/swipetospin-viewers/iaa-rochester/000-31355822/2021 09 28 16 53 05.CUFD0VOL/ec/0-41.jpg
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

// IMAGE PROCESSING
// These send no notifications, but they do increment the progressbar. Any
// errors are thrown without formatting.
async function iaaiImageUrlsFromDetails(lotDetailOrDetails) { // -> [objectURL]
    // accepts a single imageDetails object, multiple imageDetails objects, or
    // an array of imageDetails objects
    let lotDetails = Array.from(arguments).flat()
    console.log("iaaiImageUrlsFromDetails(...)")
    console.log(lotDetails)
    if (!lotDetails.length){return []}
    // FETCH AND PROCESS
    let processedUrls = [];
    for (let lotDetail of lotDetails) {
        let dezoomed = await iaaiFetchAndDezoom(lotDetail.keys)
        processedUrls.push(...dezoomed)
        // let {walkaroundUrls, panoUrls} = await spincarFetchInfo(lotDetail.cdn_image_prefix)
        // processedUrls.push(...pano)
        // processedUrls.push(...walkaround)
    };
    // DONE
    return processedUrls
}
const TILE_SIZE = 250;
async function iaaiFetchAndDezoom(imageKeyOrKeys) { // -> [objectURL]
    // Accepts a single keys object, multiple keys objects, or an array of keys
    // objects.
    let imageKeys = Array.from(arguments).flat()
    console.log("iaaiFetchAndDezoom(...)")
    console.log(imageKeys)
    let canvas = document.createElement("canvas");
    let ctx = canvas.getContext("2d")
    let processedPromises = [];
    for (let key of imageKeys) {
        processedPromises.push(new Promise(async (resolve, reject)=>{
            // PLAN
            let tileUrl = (x, y)=>`https://anvis.iaai.com/deepzoom?imageKey=${key.K}&level=12&x=${x}&y=${y}&overlap=0&tilesize=${TILE_SIZE}`;
            canvas.width  = key.W;
            canvas.height = key.H;
            let xTiles = Math.ceil(key.W / TILE_SIZE);
            let yTiles = Math.ceil(key.H / TILE_SIZE);
            let xRange = [...Array(xTiles).keys()];
            let yRange = [...Array(yTiles).keys()];
            // FETCH
            let bitmapPromises = [];
            for (let x of xRange) { for (let y of yRange){
                bitmapPromises.push(
                    fetch(tileUrl(x,y))
                    .then(r => r.blob())
                    .then(createImageBitmap)
                    .then(bmp => new Object({x,y,bmp}))
                )
            }}
            let bmpDetails = await Promise.all(bitmapPromises)
            bmpDetails.forEach(bmpDetails=>{
                let {bmp,x,y} = bmpDetails;
                ctx.drawImage(bmp,x*TILE_SIZE,y*TILE_SIZE)
            })
            let dataURL = canvas.toDataURL("image/jpeg");
            let objectURL = dataURLtoObjectURL(dataURL);
            console.log(`${key.K} processed`)
            sendProgress("download", "increment")
            resolve(objectURL)
        }))
    }
    return Promise.all(processedPromises)
}
// for 10 images, got:
// average 461.7 ms from create to processed
// Total 79 ms from first processed to last
// Total 502ms from before loop to last processed

async function spincarFetchInfo(spinUrlOrUrls) {
    let spinUrls = Array.from(arguments).flat()
    let spinPromises = spinUrls.map( async spinUrl=>{
        let spinPath = /com\/(.*)/.exec(spinUrl)[1];
        let apiUrl = "https://api.spincar.com/spin/" + spinPath;
        let headers = { "User-Agent": window.navigator.userAgent,
                       "Accept": "application/json" };
        let jsn = await fetch( apiUrl, headers )
                        .then( r=>r.json() );
        let walkaroundCount = jsn.info.options.numImgEC;
        let walkaroundUrls = [...Array(walkaroundCount).keys()].map(
            idx=>`https:${jsn.cdn_image_prefix}ec/0-${idx}.jpg`
        );
        let panoUrls = ['f', 'l', 'b', 'r', 'u', 'd'].map(
            dir=>`https:${jsn.cdn_image_prefix}pano/pano_${dir}.jpg`
        );
        return {walkaroundUrls, panoUrls}
    })
    return Promise.all(spinPromises)
}
// FOR REFERENCE
// walkaround/pano URL format is:
// https://cdn.spincar.com/swipetospin-viewers/iaa-rochester/000-31355822/20210928165305.CUFD0VOL/ec/0-49.jpg
// https://cdn.spincar.com/swipetospin-viewers/iaa-rochester/000-31355822/20210928165305.CUFD0VOL/pano/pano_u.jpg
//
// api.spincar.com/spin returns:
// {
//     "cdn_image_prefix": "//cdn.spincar.com/swipetospin-viewers/iaa-rochester/000-31355822/20210928165305.CUFD0VOL/",
//     "customer": {...},
//     "customer_name": "IAA - Rochester",
//     "enable_auction_disclaimer": true,
//     "finance_insurance_products": null,
//     "ft_locale": "en-US",
//     "ga_tracking_id": "UA-6058889-4",
//     "info": {
//       "body_type": null,
//       "created_by": "adesa@spincar.com",
//       "factory_upgrades": null,
//       "ft_locale": "en-US",
//       "is_new": false,
//       "isdamage_tags": {},
//       "last_keywords_update": "2021-10-28 14:51:18.206559",
//       "make": "Mazda",
//       "model": "CX-7",
//       "options": {
//         "additional_videos": [],
//         "closeup_tags": {},
//         "disable_autoplay": false,
//         "disable_autospin": false,
//         "disable_vr_mode": false,
//         "enable_drag_to_view_overlay": false,
//         "enable_factory_upgrades": false,
//         "enable_photo_labels": false,
//         "features_translated": [],
//         "has_custom_pano_overlay": false,
//         "has_pano": true,
//         "has_raw_pano": true,
//         "has_thumbs": true,
//         "hide_carousel": true,
//         "hide_photos": false,
//         "hotspots": [{...}],
//         "needs_assessment_quiz": false,
//         "numImgEC": 64,
//         "s3_folder": "iaa-rochester",
//         "version": "20210928165305.CUFD0VOL"
//       },
//       "stock": null,
//       "video_tour_key": null,
//       "views": {
//         "closeup": {},
//         "exterior": {
//           "has_low_res": true,
//           "source": "app"
//         },
//         "interior": {},
//         "pano": {
//           "has_low_res": true,
//           "source": "app"
//         }
//       },
//       "vin": "000-31355822",
//       "year": "2009"
//     },
//     "partner_id": 15,
//     "perf": {
//       "customer_config_cache": 27,
//       "local_info:vin": 27,
//       "total": 54,
//       "vehicle_query": 12
//     },
//     "s3_folder": "iaa-rochester",
//     "s3_prefix": "s3://swipetospin-viewers/iaa-rochester/000-31355822/",
//     "show_feature_highlights": false,
//     "show_featuretour": true,
//     "show_finance_insurance_products": false,
//     "show_finance_insurance_quiz": false,
//     "show_spin": true,
//     "thumb": "//cdn.spincar.com/swipetospin-viewers/iaa-rochester/000-31355822/20210928165305.CUFD0VOL/thumb-sm.jpg",
//     "vin": "000-31355822",
//     "wa_products": {
//       "ft": true,
//       "wa_360": true
//     }
//   }


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