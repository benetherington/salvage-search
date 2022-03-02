/*------*\
  SEARCH  
\*------*/
const COPART_S = {
    __proto__: Salvage,
    NAME: "copart",
    PRETTY_NAME: "Copart",
    listingUrl: (lotNumber)=>`https://www.copart.com/lot/${lotNumber}`,
    search: (vin, notify=sendNotification)=>{
        return new Promise( async (resolve, reject)=>{
            try {
                const searchResults = await COPART_S.searcher(vin, notify);
                notify(
                    `Copart: found a match!`,
                    {displayAs:"success"}
                )
                resolve(searchResults)
            } catch (error) {
                console.log(`Copart rejecting: ${error}`)
                notify(`Copart: ${error}.`, {displayAs: "error"})
                reject()
            }
        })
    },
    searcher: async (vin, notify)=>{
        // Configure VIN search
        const searchUrl = "https://www.copart.com/public/lots/vin/search";
        const method = "POST";
        const headers = {
            "User-Agent":   window.navigator.userAgent,
            "Accept":       "application/json, text/plain, */*",
            "Content-Type": "application/json;charset=utf-8"
        };
        const body = JSON.stringify({
            "filter": {
                "MISC": [
                    `ps_vin_number:${vin}`,
                    "sold_flag:false"
                ]
            }
        });
        
        // Fetch search results
        let response = await fetch(searchUrl, {method, headers, body});
        
        // Check status
        if (!response.ok) throw `something went wrong on their end: ${response.status} error.`;
        
        // Check response content
        let jsn = await response.json();
        if (!jsn.data.results               ) throw "something went wrong on their end...";
        if (!jsn.data.results.content       ) throw "something went wrong on their end...";
        if (!jsn.data.results.content.length) throw "query returned no results";
        
        // Get listing URLs
        const lotNumbers = jsn.data.results.content.map(vehicle=>vehicle.lotNumberStr);
        const listingUrls = lotNumbers.map(lot=>COPART_S.listingUrl(lot));
        
        // split results
        const listingUrl = listingUrls.pop();
        const extras = listingUrls;
        
        // Send back results
        return {salvage: "copart", listingUrl, extras};
    }
};

/*--------*\
  DOWNLOAD
\*--------*/
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
    imageUrlsFromInfo: async function (imageInfoOrVehicle) {
        let imageInfo, vehicle;
        if (imageInfoOrVehicle instanceof DownloadableVehicle) {
            vehicle = imageInfoOrVehicle
            imageInfo = await vehicle.getImageInfo();
        } else {
            imageInfo = imageInfoOrVehicle;
        }
        if (!imageInfo) {throw "no lot number provided.";}
        
        // PROCESS
        let imageUrls = [];
        try {
            if (   !imageInfo.hasOwnProperty("returnCode")
                ||  imageInfo.returnCode!=1
                || !imageInfo.hasOwnProperty("data")
                || !imageInfo.data.hasOwnProperty("imagesList") )
            {throw "encountered a server error."}
            
            imageUrls = imageInfo.data.imagesList.FULL_IMAGE.map(full=>{
                if (full.highRes) { // this means "a high res is present"
                    let high = imageInfo.data.imagesList
                                .HIGH_RESOLUTION_IMAGE
                                .find(high=>high.sequenceNumber===full.sequenceNumber)
                    return high.url;
                } else {
                    return full.url;
                }
            })
                
        } catch (error) {throw `Copart: lot #${lotNumber} ${error}`}
        return {imageUrls}
    }
}