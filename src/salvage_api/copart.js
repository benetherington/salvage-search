
const copartWorkers = [];
const stopCopartWorkers = ()=>copartWorkers.forEach(w=>w.terminate());

const COPART_API = {
    NAME: "copart",
    PRETTY_NAME: "Copart",
    
    
    /*------*\
      SEARCH  
    \*------*/
    listingUrl: (lotNumber)=>`https://www.copart.com/lot/${lotNumber}`,
    search: (vin, notify=sendNotification)=>{
        return new Promise( async (resolve, reject)=>{
            try {
                const searchResults = await COPART_API.searcher(vin);
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
        const listingUrls = lotNumbers.map(lot=>COPART_API.listingUrl(lot));
        
        // split results
        const listingUrl = listingUrls.pop();
        const lotNumber = lotNumbers.pop();
        const extras = {listingUrls, lotNumbers};
        
        // Send back results
        return {salvage: "copart", listingUrl, lotNumber, extras};
    },
    
    
    /*------*\
      SCRAPE
    \*------*/
    URL_PATTERN: "*://*.copart.com/lot/*",
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
    
    
    /*--------*\
      DOWNLOAD
    \*--------*/
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
    
    
    // Hero images
    heroImages: async (imageInfo)=>{
        console.log("Copart downloading images.")
        
        // Validate imageInfo
        const nope = ()=>{throw "Copart encountered a server error."}
        if (!imageInfo.hasOwnProperty("returnCode")) nope();
        if ( imageInfo.returnCode!=1               ) nope();
        if (!imageInfo.data                        ) nope();
        if (!imageInfo.data.imagesList             ) nope();
        if (!imageInfo.data.imagesList.FULL_IMAGE  ) nope();
        
        // Notify user
        notify(`Processing ${imageInfo.data.imagesList.FULL_IMAGE.length} high-res images.`)
        
        // Process images
        const heroImages = COPART_API.pickBestImages(imageInfo);
        
        // Done!
        return heroImages;
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
        
        // Done!
        return bestUrls;
    },
    
    
    // Panorama/walkaround
    bonusImages: async (imageInfo)=>{
        // TODO: Validate imageInfo
        
        let walkaroundUrls, panoUrls;
        
        // Fetch images
        try {
            walkaroundUrls = await COPART_API.walkaroundObjectUrls(imageInfo);
        } catch {}
        
        try {
            panoUrls = await COPART_API.panoramaObjectUrls(imageInfo);
        } catch {}
        
        // Do some logging
        console.log(`Fetched/processed bonusImages. Walk: ${walkaroundUrls.length}. Pano: ${!!panoUrls}.`)
        
        // Done!
        return {walkaroundUrls, panoUrls};
    },
    walkaroundObjectUrls: async (imageInfo) =>{
        // Validate imageInfo (we're guaranteed to have imagesList)
        if (!imageInfo.data.imagesList.EXTERIOR_360       ) return;
        if (!imageInfo.data.imagesList.EXTERIOR_360.length) return;
        
        // Extract, format data
        const {url, frameCount} = imageInfo.data.imagesList.EXTERIOR_360[0];
        const frameUrl = (frame)=>url.replace(/(?<=frames_)\d+/, frame);
        const walkaroundIndexes = Array(frameCount).keys();
        
        // Notify user
        notify(`Downloading ${frameCount+1} exterior 360 images.`)
        
        // Build a list of all URLs
        const walkaroundUrls = [];
        for (idx of walkaroundIndexes) {
            walkaroundUrls.push(frameUrl(idx))
        }
        
        // Fetch image data, convert object URLs
        let walkPromises = walkaroundUrls.map(fetchObjectUrl);
        let walkSettled = await Promise.allSettled(walkPromises);
        
        // Check for errors, hand back object URLs
        return walkSettled.map(p=>p.value||"TODO: add rejected image")
    },
    panoramaObjectUrls: async (imageInfo) =>{
        // Validate imageInfo (we're guaranteed to have imagesList)
        if (!imageInfo.data.imagesList.INTERIOR_360       ) return;
        if (!imageInfo.data.imagesList.INTERIOR_360.length) return;
        if (!imageInfo.data.imagesList.INTERIOR_360[0].url) return;
        
        // Notify user
        notify("Processing interior 360. Please wait...")
        
        // Extract data
        const equirectangularUrl = imageInfo.data.imagesList.INTERIOR_360[0].url;
        
        // Fetch image
        const equirectangularImage = await fetchImageData(equirectangularUrl);
        
        // Start workers to convert this equirectangular projection
        // into six faces of a cubemap
        let panoUrls;
        try {
            const faceImageDataEntries = await COPART_API.convertEquirectangular(equirectangularImage);
            const facesUrlsEntries = faceImageDataEntries.map(([f, iD])=>[f, urlFromImageData(iD)]);
            const facesUrls = Object.fromEntries(facesUrlsEntries);
            panoUrls = facesUrls;
        } catch (e) {console.log(e)}
        finally {
            // Make sure all copartWorkers are shut down!
            // stopCopartWorkers();
            return panoUrls;
        }
    },
    convertEquirectangular: (imageData)=>{
        const workerPromises = [
            COPART_API.extractCubemapFace(imageData, "pano_r", "px"),
            COPART_API.extractCubemapFace(imageData, "pano_l", "nx"),
            COPART_API.extractCubemapFace(imageData, "pano_u", "py"),
            COPART_API.extractCubemapFace(imageData, "pano_d", "ny"),
            COPART_API.extractCubemapFace(imageData, "pano_f", "pz"),
            COPART_API.extractCubemapFace(imageData, "pano_b", "nz")
        ];
        return Promise.all(workerPromises)
    },
    extractCubemapFace: async (imageData, key, direction)=>{
        // Create worker
        const worker = new Worker('./salvage_api/copart-pano-worker.js');
        copartWorkers.push(worker)
        
        // Listen to error events
        worker.onerror = (error=>console.log(error));
        worker.onmessageerror = (error=>console.log(error));
        
        // Start worker
        const extractionPromise = new Promise(resolve=>{
            // Start at the end
            worker.onmessage = (message)=>{
                const {imageData, percentDone} = message.data;
                if (percentDone) console.log(`dir ${percentDone}%"`);
                if (imageData) resolve([key, imageData]);
            };
            
            // Send worker data to work on
            worker.postMessage({
                data: imageData,
                face: direction,
                rotation: 0,
                interpolation: "lanczos"
            })
        });
        
        // Hand control back. Promise resolves to [key, imageData]
        return extractionPromise;
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