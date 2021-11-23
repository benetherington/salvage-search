class SearchVehicle extends BackgroundVehicle {
    // INPUT
    onMessage(message) {
        super.onMessage(message)
        if (message.search) {this.search()}
    }
    // OUTPUT
    async search() {
        let notify = notifyUntilSuccess();
        await Promise.any([
            this.ifSettingsCopart(notify),
            this.ifSettingsIaai(notify),
            this.ifSettingsRow52(notify)
        ]).catch(()=>
            // AggrigateError, no results
            Promise.any([
                this.ifSettingsPoctra(notify),
                this.ifSettingsBidfax(notify)
            ])
        ).catch(()=>{})
        this.reply({search:true})
    }
    
    // SETTINGS
    async ifSettingsCopart(notify) {
        let settings = await defaultedSettings()
        if (settings.searchCopart) {return COPART_S.search(this, notify)}
        else {return Promise.reject()}
    }
    async ifSettingsIaai(notify) {
        let settings = await defaultedSettings()
        if (settings.searchIaai) {return IAAI_S.search(this, notify)}
        else {return Promise.reject()}
    }
    async ifSettingsRow52(notify) {
        let settings = await defaultedSettings()
        if (settings.searchRow52) {return ROW52_S.search(this, notify)}
        else {return Promise.reject()}
    }
    async ifSettingsPoctra(notify) {
        let settings = await defaultedSettings()
        if (settings.searchPoctra) {return POCTRA_S.search(this, notify)}
        else {return Promise.reject()}
    }
    async ifSettingsBidfax(notify) {
        let settings = await defaultedSettings()
        if (settings.searchBidfax) {return BIDFAX_S.search(this, notify)}
        else {return Promise.reject()}
    }
}

let searchVehicle;
browser.runtime.onConnect.addListener( async port=>{
    if (port.name!=="search") {return}
    searchVehicle = new SearchVehicle
    searchVehicle.setPort(port)
})



/*------*\
  COPART  
\*------*/
const COPART_S = {
    __proto__: Salvage,
    NAME: "copart",
    PRETTY_NAME: "Copart",
    listingUrl: (lotNumber)=>`https://www.copart.com/lot/${lotNumber}`,
    search: (vinOrVehicle, notify=sendNotification)=>{
        let vin = vinOrVehicle.vin || vinOrVehicle;
        // TODO: handle new vehicle creation
        let vehicle = vinOrVehicle;
        return new Promise(async (resolve, reject) => {try {
            // perform query for VIN
            let searchUrl = "https://www.copart.com/public/lots/vin/search";
            let payload = {
                "filter": {
                    "MISC": [
                        `ps_vin_number:${vin}`,
                        "sold_flag:false"
            ]}};
            let response = await fetch(
                searchUrl,
                {
                    method: "POST",
                    headers: {
                        "User-Agent": window.navigator.userAgent,
                        "Accept": "application/json, text/plain, */*",
                        "Content-Type": "application/json;charset=utf-8"
                    },
                    body: JSON.stringify(payload)
                }
            )
            if (!response.ok) {throw `something went wrong on their end: ${response.status} error.`;}
            // parse response
            let jsn = await response.json()
            if (!jsn.data.hasOwnProperty("results")) {throw "something went wrong on their end...";}
            if (!jsn.data.results.content.length) {throw "query returned no results";}
            let lotNumbers = jsn.data.results.content.map( (vehicle)=>vehicle.lotNumberStr )
            
            // CREATE VEHICLE
            vehicle.lotNumber = lotNumbers.pop()
            vehicle.salvage = COPART_S;
            vehicle.listingUrl = COPART_S.listingUrl(vehicle.lotNumber);
            notify(`Copart: found a match: lot #${vehicle.lotNumber}!`, {displayAs:"success"})
            
            // HANDLE EXTRAS
            let extras = lotNumbers.map(lotNumber=>
                new BackgroundVehicle({
                    lotNumber: lotNumber,
                    salvage: COPART_S
                })
            )
            resolve({vehicle, extras})
        } catch (error) {
            console.log(`Copart rejecting: ${error}`)
            notify(`Copart: ${error}.`, {displayAs: "error"})
            reject()
        }})
    }
};


/*----*\
  IAAI  
\*----*/
const IAAI_S = {
    __proto__: Salvage,
    NAME: "iaai",
    PRETTY_NAME: "IAAI",
    search: (vinOrVehicle, notify=sendNotification)=>{
        let vin = vinOrVehicle.vin || vinOrVehicle;
        // TODO: handle new vehicle creation
        let vehicle = vinOrVehicle;
        return new Promise(async (resolve, reject)=>{try {
            // perform query for VIN
            let searchUrl = `https://www.iaai.com/Search?SearchVIN=${vin}`;
            let response = await fetch(
                searchUrl,
                {headers: {
                    "User-Agent": window.navigator.userAgent,
                    "Accept": "application/json, text/plain, */*"
                }}
            )
            if (!response.ok) {throw `something went wrong on their end: ${response.status} error.`;}
            if (!response.redirected) {throw "query returned no results.";}
            // open redirect URL in a new tab
            let redirectUrl = response.url;
            lotRe = /itemid=(\d{8})/
            if (!lotRe.test(redirectUrl)) {throw "query returned no results."}
            
            // CREATE VEHICLE
            let lotNumber = lotRe.exec(redirectUrl)[1];
            notify(`IAAI: found a match: lot #${lotNumber}!`, {displayAs:"success"})
            vehicle.lotNumber = lotNumber;
            vehicle.listingUrl = redirectUrl;
            vehicle.salvage = "iaai";
            
            resolve({vehicle})
        } catch (error) {
            console.log(`IAAI rejecting: ${error}`)
            notify(`IAAI: ${error}`, {displayAs: "error"})
            reject()
        }})
    }
};

/*-----*\
  ROW52  
\*-----*/
const ROW52_S = {
    __proto__: Salvage,
    NAME: "row52",
    search: (vinOrVehicle, notify=sendNotification)=>{
        let vin = vinOrVehicle.vin || vinOrVehicle;
        return new Promise(async (resolve, reject)=>{try {
            var searchUrl = 'https://row52.com/Search/?YMMorVin=VIN&Year=&'+
            'V1='   + vin[0] +
            '&V2='  + vin[1] +
            '&V3='  + vin[2] +
            '&V4='  + vin[3] +
            '&V5='  + vin[4] +
            '&V6='  + vin[5] +
            '&V7='  + vin[6] +
            '&V8='  + vin[7] +
            '&V9='  + vin[8] +
            '&V10=' + vin[9] +
            '&V11=' + vin[10] +
            '&V12=' + vin[11] +
            '&V13=' + vin[12] +
            '&V14=' + vin[13] +
            '&V15=' + vin[14] +
            '&V16=' + vin[15] +
            '&V17=' + vin[16] +
            '&ZipCode=&Page=1&ModelId=&MakeId=&LocationId=&IsVin=true&Distance=50';
            let response = await fetch(searchUrl);
            if (!response.ok) { throw "something went wrong on their end..." }
            let parser = new DOMParser();
            let vehiclePaths;
            let resultsNum;
            try { // parse the response HTML and catch any errors
                let doc = parser.parseFromString(await response.text(), "text/html");
                let resultCountElement = doc.querySelector("#results-header span");
                let yardNameElement = document.querySelector("span[itemprop] strong");
                vehiclePaths = Array.from( doc.querySelectorAll(".block-link").values() )
                                        .map(  el=>el.attributes.href.value );
                resultsNum = /\d+/.exec(resultCountElement.innerText)[0]
            } catch { throw "something looks wrong with this page, try searching by hand."}
            
            if (!vehiclePaths.length) {throw "query returned no results." }
            let yardName = yardNameElement.innerText.trim()
            
            // CREATE VEHICLE
            vehicle.salvage = ROW52_S;
            vehicle.listingUrl = "https://row52.com"+vehiclePaths.pop()
            notify(`Row52: Found a match at ${yardName}!`, {displayAs: "success"})
            
            // HANDLE EXTRAS
            let extras = vehiclePaths.map(path=>
                new BackgroundVehicle({
                    salvage: ROW52_S,
                    listingUrl: "https://row52.com"+path
                })
            )
            
            resolve({vehicle, extras})
        } catch (error) {
            console.log(`Row52 rejecting: ${error}`)
            notify(`Row52: ${error}`, {displayAs: "error"})
            reject()
        }})
    }
};





/*------*\
  POCTRA  
\*------*/
const POCTRA_S = {
    __proto__: Archive,
    NAME: "poctra",
    INFO_REGEX: /^(?<salvage>.*?) (Stock|Lot) No: (?<lotNumber>\d*)<br>.*<br>Location: (?<location>.*)$/,
    search: (vinOrVehicle, notify=sendNotification)=>{
        let vin = vinOrVehicle.vin || vinOrVehicle;
        // TODO: handle this too
        let vehicle = vinOrVehicle;
        return new Promise(async (resolve, reject)=>{
            try {
                // SEARCH
                let searchUrl = `https://poctra.com/search/ajax`;
                let body = `q=${vin}&by=&asc=&page=1`;
                let headers = {"Content-Type": "application/x-www-form-urlencoded; charset=UTF-8"};
                let response = await fetch( searchUrl, {method: "POST", headers, body} );
                if (!response.ok) { throw "something went wrong on their end..." }
                // CHECK FOR RESULTS
                let parser = new DOMParser();
                let doc = parser.parseFromString(await response.text(), "text/html");
                // set base URI so that relative links work
                let base = doc.createElement("base");
                base.href = searchUrl;
                doc.head.append(base)
                let searchResults = doc.querySelectorAll(".clickable-row");
                if (searchResults.length===0 || searchResults.length>3) {throw "search returned no results."}

                // TODO: handle multiple listings
                let searchResult = searchResults[0]
                // FIND PAGE LINK
                let lotLink = searchResult.querySelector("a");
                if (!lotLink) {console.log("POCTRA found results, but no lotLink");throw "search returned no results.";}
                vehicle.listingUrl = lotLink.href;
                // NOTIFY
                try {
                    let infoElement = searchResult.querySelector("p");
                    let infoParsed = POCTRA_S.INFO_REGEX.exec(infoElement.innerHTML.trim()).groups;
                    vehicle.lotNumber = infoParsed.lotNumber;
                    vehicle.location = infoParsed.location;
                    if (infoParsed.salvage.toLowerCase()==="iaai"  ) {vehicle.salvage=IAAI_S}
                    if (infoParsed.salvage.toLowerCase()==="copart") {vehicle.salvage=COPART_S}
                    notify( `Poctra: found a match at ${vehicle.salvage.PRETTY_NAME}! `+
                            `Lot ${vehicle.lotNumber}.`, {displayAs: "success"} )
                } catch {
                    notify( "Poctra: found a match!", {displayAs: "success"})
                }
                // SUCCESS!
                resolve(()=>{vehicle})
            } catch (error) {
                console.log(`Poctra rejecting: ${error}`)
                notify(`Poctra: ${error}`, {displayAs: "error"})
                reject()
            }
        })
    }
};


/*------*\
  BIDFAX  
\*------*/
const BIDFAX_S = {
    __proto__: Archive,
    NAME: "bidfax",
    search: (vinOrVehicle, notify=sendNotification)=>{
        let vin = vinOrVehicle.vin || vinOrVehicle;
        return new Promise(async (resolve, reject)=>{
            try {
                // FETCH GC TOKEN
                let homeUrl = "https://en.bidfax.info";
                let tokenTab = await browser.tabs.create({url:homeUrl, active:false})
                await browser.tabs.executeScript(tokenTab.id,{code:
                    `(()=>{
                        document.querySelector("#submit").click()
                    })()`
                })
                let token = await browser.tabs.executeScript(tokenTab.id, {code:
                    `(()=>{return (new URL(document.querySelector("link[rel=alternate]").href)).searchParams.get('token2');})()`
                })[0]
                browser.tabs.remove(tokenTab.id)
                
                // SEARCH
                let searchUrl = new URL("https://en.bidfax.info/")
                searchUrl.searchParams.append("do", "search")
                searchUrl.searchParams.append("subaction", "search")
                searchUrl.searchParams.append("story", vin)
                searchUrl.searchParams.append("token2", token)
                searchUrl.searchParams.append("action2", "search_action")
                let response = await fetch(searchUrl);
                if (!response.ok) { throw "something went wrong on their end..." }
                if (response.status === 301) {
                    // Moved Permanently is returned when the GC token is invalid or
                    // missing.
                    console.log("BidFax wants a CAPTCHA check")
                    browser.tabs.create({url:homeUrl})
                    throw "CAPTCHA failed. Please click on a listing before trying again."
                }
                // CHECK FOR RESULTS
                let parser = new DOMParser()
                let doc = parser.parseFromString(await response.text(), "text/html");
                let searchResults = doc.querySelectorAll(".thumbnail.offer");
                if (!searchResults.length)  {throw "search returned no results."}
                if (searchResults.length>3) {throw "search returned no results."}
                // PARSE RESULTS
                searchResult = searchResults[0]
                // FIND PAGE LINK
                let lotLinkElement = searchResult.querySelector(".caption a");
                if (!lotLinkElement) {throw "the website has changed. Please send Ben "+
                                            "your search terms so he can fix it."}
                let vehicle = {listingUrl: lotLinkElement.href}
                // NOTIFY
                try {
                    let yardNameElement = searchResult.querySelector(".short-storyup span");
                    let yardName = yardNameElement.innerText.trim();
                    if (yardName==="iaai"  ) {vehicle.salvage=IAAI_S}
                    if (yardName==="copart") {vehicle.salvage=COPART_S}
                    let lotNumberElement = searchResult.querySelector(".short-story span");
                    let lotNumber = stockNumberElement.innerText;
                    vehicle.lotNumber = lotNumber
                    notify( `BidFax: found a match at ${yardName}! `+
                            `Lot ${lotNumber}.`, {displayAs: "success"} )
                } catch {
                    notify( "BidFax: found a match!", {displayAs: "success"})
                }
                // SUCCESS!
                resolve(()=>{vehicle})
            } catch (error) {
                console.log(`BidFax rejecting: ${error}`)
                notify(`BidFax: ${error}`, {displayAs: "error"})
                reject()
            }
        })
    }
};

console.log("search loaded!")
