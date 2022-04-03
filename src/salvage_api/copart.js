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
                const searchResults = await COPART_S.searcher(vin);
                notify(
                    `Copart: found a match!`,
                    {displayAs:"success"}
                )
                resolve(searchResults)
            } catch (error) {
                console.log(`Copart rejecting: ${error}`)
                notify(`Copart: ${error}.`, {displayAs: "status"})
                reject()
            }
        })
    },
    searcher: async (vin)=>{
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
        const response = await fetch(searchUrl, {method, headers, body});
        
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
        const lotNumber = lotNumbers.pop();
        const extras = {listingUrls, lotNumbers};
        
        // Send back results
        return {salvage: "copart", listingUrl, lotNumber, extras};
    }
};

/*--------*\
  DOWNLOAD
\*--------*/
const COPART_D = {
    __proto__: Salvage,
    NAME: "copart",
    URL_PATTERN: "*://*.copart.com/lot/*",
    
    
    // Tabs
    lotNumberFromTab: async (tab)=>{
        const lotExecuting = browser.tabs.executeScript(
            tab.id, {code:`
                document
                    .querySelector("#lot-details .lot-number")
                    .lastChild
                    .textContent
                    .trim()`
            }
        );
        const lotNumber = (await lotExecuting)[0];
        const salvageName = "copart";
        return {lotNumber, salvageName};
    },
    
    
    // Image info
    imageInfoFromLotNumber: async (lotNumber)=>{
        // Configure image download
        const imagesUrl = `https://www.copart.com/public/data/lotdetails/solr/lotImages/${lotNumber}/USA`;
        const headers = {
            "User-Agent": window.navigator.userAgent,
            "Accept": "application/json, text/plain, */*"
        };
        
        // Fetch image info
        let response = await fetch(imagesUrl, {headers});

        // Check status
        if (!response.ok) throw `Copart encountered a server error: ${response.status} error.`;
        
        // Check response content
        if (!response.headers.get("content-type").startsWith("application/json")) {
            console.log("Copart wants a CAPTCHA check")
            browser.tabs.create({url:"https://www.copart.com"})
            throw "Please complete the CAPTCHA and try again."
        };
        
        // Get response content
        return await response.json();
    },
    
    
    // Image fetching
    imageUrlsFromInfo: async function (imageInfo) {
        // Validate imageInfo
        const nope = ()=>{throw "Copart encountered a server error."}
        if (!imageInfo.hasOwnProperty("returnCode")) nope();
        if ( imageInfo.returnCode!=1               ) nope();
        if (!imageInfo.data                        ) nope();
        if (!imageInfo.data.imagesList             ) nope();
        if (!imageInfo.data.imagesList.FULL_IMAGE  ) nope();
        
        // Process images
        const imageUrls = COPART_D.pickBestImages(imageInfo);
        const walkaroundUrls = [];
        const panoImageInfo = [];
        
        return {imageUrls, walkaroundUrls, panoImageInfo};
    },
    pickBestImages: (imageInfo)=>{
        // Grab image resolutions
        const highs = imageInfo.data.imagesList.HIGH_RESOLUTION_IMAGE;
        const fulls = imageInfo.data.imagesList.FULL_IMAGE;
        
        // Pick the highest resolution for each
        const bestUrls = [];
        for (let full of fulls) {
            // Use full_res_image if a high_res is not available
            if (!full.highRes) {
                bestUrls.push(full.url)
                continue;
            }
            
            // Get corresponding high_res_image
            const num = full.sequenceNumber;
            const high = highs.find(i=>i.sequenceNumber===num)
            
            // Check high_res_image
            if (!high) {bestUrls.push(full.url); continue}
            
            // Use high_res_image
            bestUrls.push(high.url)
        }
        
        return bestUrls;
    }
};

// ImageInfo looks like:
// {
//     returnCode: 1,
//     returnCodeDesc: "Success",
//     data: {
//         lotDetails: null,
//         imagesList: {
//             HIGH_RESOLUTION_IMAGE: [
//                 {
//                     url: "https://cs.copart.com/v1/AUTH_svc.pdoc00001/HPX93/f3aba7e6-f488-4fe4-aa47-11309988ced0.JPG",
//                     imageType: "H",
//                     sequenceNumber: 1,
//                     swiftFlag: false,
//                     frameCount: 0,
//                     status: "I",
//                     imageTypeDescription: "HIGH_RESOLUTION_IMAGE",
//                     highRes: false
//                 }
//             ],
//             FULL_IMAGE: [
//                 {
//                     url: "https://cs.copart.com/v1/AUTH_svc.pdoc00001/PIX450/dd68c0bd-4e50-42d6-a067-3b2e1ae5abdd.JPG",
//                     imageType: "F",
//                     sequenceNumber: 1,
//                     swiftFlag: false,
//                     frameCount: 0,
//                     status: "I",
//                     imageTypeDescription: "FULL_IMAGE",
//                     highRes: true
//                 }
//             ],
//             THUMBNAIL_IMAGE: [
//                 {
//                     url: "https://cs.copart.com/v1/AUTH_svc.pdoc00001/PIX450/3ab2c19a-b02d-489b-822d-080219171da5.JPG",
//                     imageType: "T",
//                     sequenceNumber: 1,
//                     swiftFlag: false,
//                     frameCount: 0,
//                     status: "I",
//                     imageTypeDescription: "THUMBNAIL_IMAGE",
//                     highRes: false
//                 }
//             ],
//             EXTERIOR_360: [
//                 {
//                     url: "https://c-static.copart.com/v1/AUTH_svc.pdoc00001/LPP236/eab3b74477b74d0e89e7a6210d2841a2_frames_0.jpg",
//                     imageType: "EXT360",
//                     sequenceNumber: 11,
//                     swiftFlag: false,
//                     frameCount: 55,
//                     status: "I",
//                     imageTypeDescription: "EXTERIOR_360",
//                     highRes: false
//                 }
//             ],
//             INTERIOR_360: [
//                 {
//                     url: "https://c-static.copart.com/v1/AUTH_svc.pdoc00001/LPP236/2c776bee45ed483cb9c102b465b7f8a5_O.jpeg",
//                     imageType: "INT360",
//                     sequenceNumber: 12,
//                     swiftFlag: false,
//                     frameCount: 0,
//                     status: "I",
//                     imageTypeDescription: "INTERIOR_360",
//                     highRes: false
//                 }
//             ]
//         }
//     }
// }