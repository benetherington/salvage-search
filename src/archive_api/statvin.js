const STATVIN_API = {
    NAME: "statvin",
    URL_PATTERN: "*://stat.vin/*",
    
    /*------*\
      SEARCH
    \*------*/
    search: (vin, notify=sendNotification)=>{
        return new Promise( async (resolve, reject)=>{
            try {
                const searchResults = await STATVIN_API.searcher(vin);
                notify("Stat.vin: found a match!", "success")
                resolve(searchResults)
            } catch (error) {
                console.log(`Statvin rejecting: ${error}`)
                const sent = notify(`Stat.vin: ${error}.`);
                // if (sent && error===captchaMessage) {
                //     // Captcha failed. Only notify if another searcher has not
                //     // yet been successful
                //     browser.tabs.create({url:"https://en.bidfax.info"})
                // }
                reject()
            }
        })
    },
    searcher: async (vin) =>{
        // Configure VIN search
        const searchUrl = new URL(`https://stat.vin/cars/${vin}`);
        
        // Fetch search results
        const response = await fetch(searchUrl);
        
        // Check response
        if (response.status===419) {
            // Token expired.
        };
        if (!response.ok) { throw "something went wrong on their end..." };
        
        // Parse response content
        const parser = new DOMParser();
        const doc = parser.parseFromString(await response.text(), "text/html");
        
        // Run each scraper strategy
        const scraped = {};
        Object.assign(scraped, STATVIN_API.salvageAndLotScraperLivewire(doc));
        Object.assign(scraped, STATVIN_API.salvageAndLotScraperGui(doc));
        Object.assign(scraped, STATVIN_API.lotNumberScraperMeta(doc));
        Object.assign(scraped, STATVIN_API.lotNumberScraperSeo(doc));
        Object.assign(scraped, STATVIN_API.salvageNameScraperDataset(doc));
        Object.assign(scraped, STATVIN_API.salvageNameScraperImages(doc));
        
    },
    lotNumberScraperMeta: (doc)=>{
        // Fetch all the strings that potentially contain the lotNumber
        const strings = [];
        try {strings.push(doc.querySelector("title").textContent)} catch {}
        try {strings.push(doc.querySelector("meta[name=title]").content)} catch {}
        try {strings.push(doc.querySelector("meta[name=description]").content)} catch {}
        try {strings.push(doc.querySelector("meta[property='og:title']").content)} catch {}
        try {strings.push(doc.querySelector("meta[property='og:description']").content)} catch {}
        try {strings.push(doc.querySelector("meta[property='twitter:title'").content)} catch {}
        try {strings.push(doc.querySelector("meta[itemprop=description]").content)} catch {}
        
        // Each string has a similar pattern to look for
        const lotNumberMatches = strings.map(
            string=>/(lot|stock)#? ?(\d{8})/i.exec(string)
        ).filter(el=>el);
        // Convert from match arrays to strings
        const lotNumbers = lotNumberMatches.map(el=>el[2]);
        
        // Return the first. Should we do consensus checking with reduce?
        const lotNumber = lotNumbers[0];
        return {lotNumber};
    },
    lotNumberScraperSeo: (doc)=>{
        // There's a giant SEO paragraph in the footer sometimes
        const carAboutParagraph = doc.querySelector(".car-about").innerText;
        let lotNumber;
        try {
            lotNumber = /(lot|stock) ?(number)? ?(\d{8})/i.exec(carAboutParagraph)[3];
        } catch {}
        return {lotNumber};
    },
    salvageAndLotScraperLivewire: (doc)=>{
        // Scrape the page looking for the right Livewire object
        let foundCar;
        try {
            // Fetch Livewire object
            const hasInitialData = Array.from(doc.querySelectorAll("div"))
            .filter(div=>div.hasAttribute("wire:initial-data"));
            
            // Convert from strings to objects
            const initialDatas = hasInitialData
            .map(div=>div.getAttribute("wire:initial-data"))
            .map(attr=>JSON.parse(attr));
            
            // Find a Livewire object that has the data we want
            const hasFoundCar = initialDatas.filter(data=>data.serverMemo.data.foundCar)[0];
            
            // Pull out the vehicle data
            foundCar = hasFoundCar.serverMemo.data.foundCar;
        } catch {}
        
        // Try pulling out the data we want
        let lotNumber, salvageName;
        try {lotNumber = foundCar.lot_number;} catch {}
        try {salvageName = foundCar.auction.auction_name;} catch {}
        
        // Done!
        return {lotNumber, salvageName};
    },
    salvageNameScraperDataset: (doc)=>{
        // salvageName is contained in a div attribute!
        let salvageName;
        try {
            salvageName = doc.querySelector("div[data-auction-name]").dataset.auctionName;
        } catch {}
        return {salvageName};
    },
    salvageNameScraperImages: (doc)=>{
        // Statvin stores their cached images in named directories. Fetch
        // potentially helpful elements
        let elements = [];
        doc.querySelectorAll("link[itemprop=image]").forEach(el=>elements.push(el))
        doc.querySelectorAll("img[data-src]").forEach(el=>elements.push(el))
        
        // Pull out urls
        const imageUrls = elements.map(el=>{
            try {return el.href;} catch {}
        });
        
        // Look for salvageName in urls
        const salvageNameMatches = imageUrls.map(url=>/(copart|iaai)/i.exec(url));
        const salvageNames = salvageNameMatches.filter(e=>e).map(match=>match[0]);
        
        // Return the first. Should we do consensus checking with reduce?
        const salvageName = salvageNames[0];
        return {salvageName};
    },
    salvageAndLotScraperGui: (doc)=>{
        // Both salvageName and lotNumber are displayed on the page in the lot
        // information box.
        let infoTitles, infoTexts;
        try {
            // Get names
            const infoTitleElements = doc.querySelectorAll(".car-info-title")
            infoTitles = Array.from(infoTitleElements).map(el=>el.textContent.trim())
            
            // Get values
            const infoTextElements = doc.querySelectorAll(".car-info-text")
            infoTexts = Array.from(infoTextElements).map(el=>el.textContent.trim())
        } catch {}
        
        // Find lotNumber title, then get associated value
        let lotNumber;
        try {
            const lotNumberIdx = infoTitles.findIndex((t)=>/(lot|stock)/i.exec(t));
            lotNumber = infoTexts[lotNumberIdx];
        } catch {}
        
        // Find salvageName title, then get associated value
        try {
            const salvageNameIdx = infoTitles.findIndex((t)=>/auction/i.exec(t));
            salvageName = infoTexts[salvageNameIdx];
        } catch {}
        
        return {lotNumber, salvageName};
    },
    fetchToken: ()=>{
        new URL(`https://stat.vin/cars/${vin}`);
        doc.querySelector("input[name=_token]").value
    }
}