/*---------------*\
  POPUP INTERFACE  
\*---------------*/
const DownloadableVehicle = class extends BackgroundVehicle {
    constructor(data={}) {
        super()
        if (data) {this.setData(data)}
    }
    
    // INPUT
    setData(values) {
        // sort of an override for super.onMessage
        if      (values.salvage==="copart") {values.salvage=COPART_D}
        else if (values.salvage==="iaai"  ) {values.salvage=IAAI_D}
        Object.assign(this, values)
    }
    async onMessage(message) {
        this.setData(message.values)
        if      (message.confirmExits) {await this.getSalvage()}
        else if (message.download    ) {await this.getImageUrls()}
        else if (message.findTabs    ) {await this.findTabs()}
        else {return}
        delete message.values
        this.reply(message)
    }
    
    // OUTPUT
    async findTabs() {
        // get all salvage tabs
        let salvageTabs = await browser.tabs.query({
            url: [COPART_D.URL_PATTERN, IAAI_D.URL_PATTERN, POCTRA_D.URL_PATTERN, BIDFAX_D.URL_PATTERN]
        });
        // if any are active, discard all others
        let activeTabs = salvageTabs.filter(t=>t.active);
        if (activeTabs.length) { salvageTabs = activeTabs; }
        // sort decending by ID, first element will be most recently opened
        let tabIds = salvageTabs.map(t=>t.id).sort( (a, b)=>a-b )
        this.tabId = tabIds.pop()
        // TODO handle extras
        try {
            await this.getSalvage()
            await this.getLotNumber()
        } catch (error) {
            if (error!=="not enough information to find salvage yard") {throw error}
        }
    }
    async getSalvage() {
        // This begins a cascade string of functions that allow us to jump in
        // and fetch new data, no matter how much or how little we know about
        // the vehicle.
        if (Salvage.isPrototypeOf(this.salvage)) {return this.salvage}
        if (typeof this.salvage==="string"){
            if      (this.salvage==="copart") {this.salvage = COPART_D;}
            else if (this.salvage==="iaai"  ) {this.salvage = IAAI_D;}
        } else if (this.tabId) {
            let tab = await this.getTab()
            if      (/copart\.com/i .test(tab.url)) {this.salvage = COPART_D;}
            else if (/iaai\.com/i   .test(tab.url)) {this.salvage = IAAI_D;}
            else if (/poctra\.com/i .test(tab.url)) {this.setData(await POCTRA_D.lotNumbersFromTab(tab))}
            else if (/bidfax\.info/i.test(tab.url)) {this.setData(await BIDFAX_D.lotNumbersFromTab(tab))}
        } else if (this.lotNumber) {
            if (await COPART_D.lotNumberValid(this.lotNumber)   ) {this.salvage=COPART_D;}
            else if (await IAAI_D.lotNumberValid(this.lotNumber)) {this.salvage=IAAI_D;}
        } else {throw "not enough information to find salvage yard"}
        return this.salvage;
    }
    async getLotNumber() {
        if (this.lotNumber&&await this.getSalvage()) {return this.lotNumber}
        let values = await this.salvage.lotNumberFromTab(this);
        this.setData(values)
        return this.lotNumber;
    }
    async getImageInfo() {
        if (this.imageInfo) {return this.imageInfo}
        await this.getLotNumber()
        let values = await this.salvage.imageInfoFromLotNumber(this)
        this.setData(values)
        return this.imageInfo;
    }
    async getImageUrls() {
        if (this.imageUrls) {return this.imageUrls}
        await this.getImageInfo()
        let values = await this.salvage.imageUrlsFromInfo(this)
        this.setData(values)
        return this.imageUrls;
    }
}

var downloadVehicle;
browser.runtime.onConnect.addListener( async port=>{
    if (port.name!=="download") {return}
    downloadVehicle = new DownloadableVehicle
    downloadVehicle.setPort(port)
})


/*------*\
  COPART  
\*------*/
const COPART_D = {
    __proto__: Salvage,
    NAME: "copart",
    URL_PATTERN: "*://*.copart.com/lot/*",
    lotNumberFromTab: async (tabOrVehicle)=>{
        let tabId;
        if (tabOrVehicle.tabId)   {tabId = tabOrVehicle.tabId;}
        else if (tabOrVehicle.id) {tabId = tabOrVehicle.id;}
        else                      {tabId = tabOrVehicle;}
        
        let lotMatch = await browser.tabs.get(tabId)
                            .then(t=>t.title.match(/^(.*) for Sale/i))
        let lotNumber;
        if (lotMatch) { lotNumber = lotMatch[0] }
        else {
            let framesResponses = await browser.tabs.executeScript(
                tabId, {code:`document.querySelector("#lot-details .lot-number").lastChild.textContent.trim()`}
            )
            lotNumber = framesResponses[0]
        }
        return {lotNumber}
    },
    lotNumberValid: async (lotNumberOrVehicle)=>{
        let imageInfo = await COPART_D.imageInfoFromLotNumber(lotNumberOrVehicle);
        return Object.entries(imageInfo.imageInfo.data.imagesList).length;
    },
    imageInfoFromLotNumber: async (lotNumberOrVehicle)=>{
        let lotNumber;
        if (lotNumberOrVehicle instanceof DownloadableVehicle) {
            lotNumber = await lotNumberOrVehicle.getLotNumber();
        } else { lotNumber = lotNumberOrVehicle; }
        let imagesUrl = `https://www.copart.com/public/data/lotdetails/solr/lotImages/${lotNumber}/USA`;
        let headers = { "User-Agent": window.navigator.userAgent,
                        "Accept": "application/json, text/plain, */*" }
        let response = await fetch(imagesUrl, headers)
        let imageInfo;
        if (response.headers.get("content-type").startsWith("application/json")) {
            imageInfo = await response.json();
        } else {
            console.log("Copart wants a CAPTCHA check")
            browser.tabs.create({url:"https://www.copart.com"})
            throw "please complete the CAPTCHA and try again."
        }
        return {imageInfo};
    },
    imageUrlsFromInfo: async function (...imageInfosOrVehicle) {
        // Accepts a single lot number, multiple lot numbers, or an array of lot numbers.
        let imageInfos, lotNumber;
        if (imageInfosOrVehicle[0] instanceof DownloadableVehicle) {
            imageInfos = [await imageInfosOrVehicle[0].getImageInfo()]
            lotNumber = imageInfosOrVehicle[0].lotNumber;
        } else { imageInfos = imageInfosOrVehicle.flat(); }
        if (!imageInfos.length) {throw "no lot number provided.";}
        sendNotification(`Copart: downloading images from lot #${lotNumber},`)
        // PROCESS
        let imageUrls = [];
        for (let jsn of imageInfos) {
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
            } catch (error) {throw `Copart: lot #${lotNumber} ${error}`}
        }
        return {imageUrls}
    }
}


/*----*\
  IAAI  
\*----*/
const IAAI_D = {
    __proto__: Salvage,
    NAME: "iaai",
    URL_PATTERN: "*://*.iaai.com/*ehicle*etails*",
    lotNumberFromTab: async (tabOrVehicle)=>{
        let tabId;
        if (tabOrVehicle.tabId)   {tabId = tabOrVehicle.tabId;}
        else if (tabOrVehicle.id) {tabId = tabOrVehicle.id;}
        else                      {tabId = tabOrVehicle;}
        
        try {
            let lotNumber = await browser.tabs.executeScript(
                    tabId, {code:`document.querySelector("#ProductDetailsVM").innerText`}
                ).catch(()=>{ throw "there was an error communicating with the page."+
                                    "Please reload the page and try again." })
                .then( lastEvaluated=>JSON.parse(lastEvaluated[0]) )
                .then( jsn=>jsn.VehicleDetailsViewModel.StockNo );
            return {lotNumber}
        } catch {
            throw "something went wrong getting this vehicle's stock number. Please reload the page and try again."
        }
    },
    lotNumberValid: async (stockNumberOrVehicle)=>{
        try {
            let imageInfo = await IAAI_D.imageInfoFromLotNumber(stockNumberOrVehicle)
            return imageInfo.imageInfo.keys.length;
        } catch (error) {if (error==="no images found.") {
            return 0;
        }}
    },
    imageInfoFromLotNumber: async (stockNumberOrVehicle)=>{
        let vehicle, stockNumber;
        if (stockNumberOrVehicle instanceof DownloadableVehicle) {
            vehicle = stockNumberOrVehicle
            stockNumber = await vehicle.getLotNumber()
        } else {
            stockNumber = stockNumberOrVehicle;
        }
        // ENSURE TYPE
        stockNumber = stockNumber.toString();
        console.log(`iaaiFetchImageInfoFromLotNumber(${stockNumber})`)
        // BUILD REQUEST
        let getLotDetailsUrl = new URL("https://iaai.com/Images/GetJsonImageDimensions");
        getLotDetailsUrl.searchParams.append(
            'json', JSON.stringify({"stockNumber":stockNumber})
        )
        let headers = { "User-Agent": window.navigator.userAgent,
                        "Accept": "application/json, text/plain, */*" };
        // FETCH AND PARSE
        let imageInfo = await fetch(getLotDetailsUrl, {headers})
            .then( response=> {
                if (response.ok) {return response}
                else {throw "server error"}
            }).then( response=> {
                if (response.headers.get("content-length") > '0') {
                    return response.json()
                } else {throw "no images found."}
            })
        return {imageInfo}
    },
    imageUrlsFromInfo: async function (...lotInfosOrVehicle) {
        // accepts a single imageDetails object, multiple imageDetails objects, or
        // an array of imageDetails objects
        let lotDetails;
        if (lotInfosOrVehicle[0] instanceof DownloadableVehicle) {
            lotDetails = [await lotInfosOrVehicle[0].getImageInfo()];
        } else {
            lotDetails = lotInfosOrVehicle.flat();
        }
        console.log("iaaiImageUrlsFromImageInfo(...)")
        console.log(lotDetails)
        if (!lotDetails.length){return []}
        // FETCH AND PROCESS
        let processedUrls = [];
        for (let lotDetail of lotDetails) {
            let dezoomed = await IAAI_D.fetchAndDezoom(lotDetail.keys)
            processedUrls.push(...dezoomed)
            // let {walkaroundUrls, panoUrls} = await SpinCar.fetchDetails(lotDetail.cdn_image_prefix)
            // processedUrls.push(...pano)
            // processedUrls.push(...walkaround)
        };
        // DONE
        return {imageUrls: processedUrls}
    },
    countImages: function (...imageDetails) {
        imageDetails = imageDetails.flat()
        return imageDetails.reduce((total, details)=>{
            return total + details.keys.length
        }, initialValue=0)
    },
    TILE_SIZE: 250,
    fetchAndDezoom: async function (...imageKeys) {
        // Accepts a single keys object, multiple keys objects, or an array of keys
        // objects.
        imageKeys = imageKeys.flat()
        console.log("iaaiFetchAndDezoom(...)")
        console.log(imageKeys)
        let canvas = document.createElement("canvas");
        let ctx = canvas.getContext("2d")
        let processedPromises = [];
        for (let key of imageKeys) {
            processedPromises.push(new Promise(async (resolve, reject)=>{
                // PLAN
                let tileUrl = (x, y)=>`https://anvis.iaai.com/deepzoom?imageKey=${key.K}`+
                                      `&level=12&x=${x}&y=${y}&overlap=0&tilesize=${IAAI_D.TILE_SIZE}`;
                canvas.width  = key.W;
                canvas.height = key.H;
                let xTiles = Math.ceil(key.W / IAAI_D.TILE_SIZE);
                let yTiles = Math.ceil(key.H / IAAI_D.TILE_SIZE);
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
                    ctx.drawImage(bmp,x*IAAI_D.TILE_SIZE,y*IAAI_D.TILE_SIZE)
                })
                let dataURL = canvas.toDataURL("image/jpeg");
                let objectURL = IAAI_D.dataURLtoObjectURL(dataURL);
                console.log(`${key.K} processed`)
                sendProgress("download", "increment")
                resolve(objectURL)
            }))
        }
        return Promise.all(processedPromises)
    },
    dataURLtoObjectURL: (uri, name)=>{
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
    }
}
let SPINCAR_D = {
    __proto__: Salvage,
    fetchDetails: function (...spinUrls) {
        spinUrls = spinUrls.flat()
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
//
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



/*------*\
  POCTRA  
\*------*/
const POCTRA_D = {
    URL_PATTERN: "*://*.poctra.com/*/id-*/*",
    lotNumbersFromTab: async (poctraTab)=>{
        try {
            let framesResults = await browser.tabs.executeScript(poctraTab.id, { code:`(${POCTRA_D.getLotNumber.toString()})()` });
            return framesResults[0]
        } catch (error) {throw `Poctra: ${error}`}
    },
    getLotNumber: ()=>{
        let idElement = document.querySelector("h2");
        if (!idElement) {return null}
        let idString = idElement.innerText;
        let idMatches = /(?<type>Lot|Stock) no: (?<lotNumber>\d*)/.exec(idString);
        let type, salvageName, lotNumber;
        if (idMatches) {
            ({type, lotNumber} = idMatches.groups);
            salvageName = {lot:"copart", stock:"iaai"}[type];
        } else {salvageName = "unknown";}
        return {salvageName, lotNumber}
    }
}


/*------*\
  BIDFAX  
\*------*/
const BIDFAX_D = {
    URL_PATTERN: "*://en.bidfax.info/*",
    lotNumbersFromTab: async (bidfaxTab)=>{
        let framesResults = await browser.tabs.executeScript(bidfaxTab.id, { code:`(${BIDFAX_D.getLotNumber.toString()})()` });
        return framesResults[0]
    },
    getLotNumber: ()=>{
        // GET LOT INFO
        let infoElement = document.querySelector("#aside")
        if (!infoElement) {return null}
        // LOOK FOR CORRECT INFO
        // we're looking for bits of text like: "Auction:  IAAI_D" and "Lot number: 31451264"
        let yardRe = /(?<=auction:.*)iaai|copart/i;
        let yardMatch = yardRe.exec(infoElement.innerText) || ["unknown"];
        let salvageName = yardMatch[0].toLowerCase();
        
        let numberRe = /(?<=lot.*:\D*)\d+/i;
        let numberMatch = numberRe.exec(infoElement.innerText) || [undefined];
        let lotNumber = numberMatch[0]
        
        return {salvageName, lotNumber};
    }
}


console.log("download-background loaded")
