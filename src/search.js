async function openSalvagePages(vinInput) {
    let storage = await browser.storage.local.get("settings")
    let settings = storage.settings || DEFAULT_SETTINGS

    // test the clipboard text out of an abundance of caution since we need to do code injection for Copart.
    vinInput = encodeURIComponent(vinInput).replace(/^\s+|\s+$/g, '');
    if (!VINREGEX.test(vinInput)) {
        sendNotification("That VIN doesn't look right...", {displayAs: "error"})
        return;
    };
    if (settings.searchCopart) {
        openCopart(vinInput);
    };
    if (settings.searchIaai) {
        openIaai(vinInput, settings.zipCode);
    };
    if (settings.searchRow52) {
        openRow52(vinInput);
    };

};


/*------*\
  COPART  
\*------*/
async function openCopart (vinInput) {
    try {
        // perform query for VIN
        let searchUrl = "https://www.copart.com/public/lots/vin/search";
        let payload = {
            "filter": {
                "MISC": [
                    `ps_vin_number:${vinInput}`,
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

        // open result tab
        if (jsn.data.results.content.length) {
            for (let vehicle of jsn.data.results.content) {
                let lotUrl = `https://www.copart.com/lot/${vehicle.lotNumberStr}`;
                sendNotification(`Copart: your vehicle is lot #${vehicle.lotNumberStr}!`, {displayAs:"success"})
                browser.tabs.create({url: lotUrl, active: false})
            }
        } else {throw "query returned no results";}
    } catch (error) {
        console.log(error)
        console.log("resorting to fallback url")
        sendNotification(`Copart: ${error}.`, {displayAs: "error"})
        let failureUrl = "https://www.copart.com/lotSearchResults/?free=true&query="+vinInput;
        browser.tabs.create({url: failureUrl, active: false})
    }
}


/*----*\
  IAAI  
\*----*/
async function openIaai (vinInput) {
    try {
        // perform query for VIN
        let searchUrl = `https://www.iaai.com/Search?SearchVIN=${vinInput}`;
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
        console.log(response.url)
        lotRe = /itemid=(\d{8})/
        if (lotRe.test(redirectUrl)){
            let lotNumber = lotRe.exec(redirectUrl)[1];
            sendNotification(`IAAI: your vehicle is lot #${lotNumber}!`, {displayAs:"success"})
        } else {
            throw "query returned no results."
        }
        browser.tabs.create({url: redirectUrl, active: false})
    } catch (error) {
        console.log(error)
        console.log("resorting to fallback url")
        sendNotification(`IAAI: ${error}`, {displayAs: "error"})
        let failureUrl = "https://www.iaai.com/Search?Keyword="+vinInput;
        browser.tabs.create({url: failureUrl, active: false})
    }
}
// vinDecoderUrl = vin=>`https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${vin}?format=json`;
// async function openIaai(vinInput, zipCode) {
//     // The big oof. Because IAAI no longer allows VIN searches without a buyer
//     // account, the most helpful thing we can do is do a YMM search. First, the
//     // VIN is decoded using NHTSA's API, then the make and model are selected
//     // using fuzzy magic, then IAAI's inventory is searched, and finally, the
//     // results are displayed to the user. The big issue here is that the final
//     // page we serve to the user is not an AcTuAl results page, but instead is a
//     // page with content injected. It kinda sucks, but A) its the best we can do
//     // without some majorly intensive script injection, B) at some point I want
//     // to agglomerate search results for the user instead of opening tabs, and
//     // C) it's good enough.

//     // open a new tab to provide feedback
//     let tab = await browser.tabs.create({url:"https://www.iaai.com/AdvancedSearch"});
//     let executing = browser.tabs.executeScript(
//         tab.id,
//         {code:  `browser.runtime.onMessage.addListener((message)=>{
//                     // display results
//                     document.getElementById("dvList").innerHTML = message.html;
//                     // load lazy images
//                     for (el of document.querySelectorAll(".lazy")) {el.src = el.dataset.original}
//                 })`}
//     )
//     // decode VIN, make "clean" versions of make and model
//     let vPicJson = await fetch(vinDecoderUrl(vinInput)).then(resp=>resp.json());
//     let vPicYmm = vPicJson.Results[0]
//     const ymm = {
//         year: vPicYmm.ModelYear,
//         make: vPicYmm.Make.toLowerCase().replaceAll(/\W/g, ""),
//         model: vPicYmm.Model.toLowerCase().replaceAll(/\W/g, "")
//     };
//     sendNotification(`Decoded VIN as: ${ymm.year} ${vPicYmm.Make} ${vPicYmm.Model}.`)
//     console.log(`decoded: ${JSON.stringify(ymm)}`)
//     let iaMakeId = await iaaiMatchMake(ymm);
//     let iaModelIds = await iaaiMatchModel(iaMakeId, ymm);
//     // construct and POST a new search request
//     let searchUrl = "https://iaai.com/AdvancedSearch/GetSearchResults";
//     let searchParams = iaaiSearchParams(ymm.year, iaMakeId, iaModelIds, zipCode);
//     let headers = { "User-Agent": window.navigator.userAgent,
//                     "Accept": "*/*",
//                     "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" };
//     searchResults = await fetch(searchUrl, {method:"POST", headers:headers, body:searchParams})
//                             .then(resp=>resp.text());
//     // send results to tab
//     await executing;
//     browser.tabs.sendMessage( tab.id, {html:searchResults} ) // TODO: display notification if page hasn't loaded yet
// }
// async function iaaiMatchMake(ymm) {
//     // get stored names/IDs (pre-cleaned)
//     const iaaiMakes = await fetch(browser.runtime.getURL("iaaiMakes.json"))
//                             .then(response=>response.json())
//     // score IAAI names against provided YMM
//     let selectedMake = {lev: 20, make: "", iaId: ""}
//     for (const [iaMake, iaId] of Object.entries(iaaiMakes)) {
//         // compare
//         let levDist = levenshtein(iaMake, ymm.make);
//         // keep if best so far
//         if (levDist < selectedMake.lev) {
//             selectedMake.lev = levDist;
//             selectedMake.make = iaMake;
//             selectedMake.iaId = iaId;
//         }
//     }
//     // return best fit
//     console.log(`IAAI: Selected ${selectedMake.make} with a score of ${selectedMake.lev}`)
//     sendNotification(`Searching IAAI for ${selectedMake.make}.`)
//     return selectedMake.iaId
// }
// async function iaaiMatchModel(makeId, ymm) {
//     // get this make's names/IDs from IAAI
//     const iaaiModels = await iaaiFetchModels(makeId)
//     // score IAAI model names
//     let iaModelFits = [];
//     for (const [iaModel, iaId] of Object.entries(iaaiModels)) {
//         // "clean"
//         let cleanIaModel = iaModel.toLowerCase().replaceAll(/\W/g, "");
//         // compare
//         // TODO add 0
//         if (cleanIaModel.includes(ymm.model)) {var score=1.5;}
//         else                                  {var score=levenshtein(cleanIaModel, ymm.model);}
//         iaModelFits.push({
//             score: score,
//             model: iaModel,
//             iaId: iaId
//         })
//     }
//     // pick a fit strategy
//     let perfectFits = iaModelFits.filter(m=>m.score<2);
//     let excellentFits = iaModelFits.filter(m=>m.score<3);
//     if (perfectFits.length>1)        {var selectedModels=perfectFits;}              // don't go with perfect fits unless there are three or more
//     else if (excellentFits.length>0) {var selectedModels=excellentFits;}            // go with reasonable fits if we have any
//     else {                                                                          // getting desparate...
//         iaModelFits.sort((a, b) => a.score-b.score)                                 // sort fits best to worst
//         let median50 = median( iaModelFits.map(m=>m.score) )*0.5;                   // calculate the median, cut in half
//         let reasonableFits = iaModelFits.filter(m => m.score<median50);
//         if (reasonableFits.length>1) {var selectedModels=reasonableFits;}           // go with half median or better if possible
//         else                         {var selectedModels = iaModelFits.slice(0,4);} // Total fallback: go with the top three
//     }
//     // return selected models
//     console.log(`selected: ${selectedModels.map(m=>m.model+" at "+m.score).join(", ")}`)
//     sendNotification(`Searching IAAI for ${selectedModels.map(m=>m.model.replaceAll(/^ *| *$/g, "")).join(", ")}.`)
//     return selectedModels.map(m=>m.iaId);
// }
// async function iaaiFetchModels(makeId) {
//     let searchUrl = "https://iaai.com/AdvancedSearch/GetVehicleModels";
//     let formData = `SelectedMakes%5B%5D=${makeId}&IsSelectedRunAndDrive=false`;
//     let headers = { "User-Agent": window.navigator.userAgent,
//                     "Accept": "application/json, text/plain, */*",
//                     "Content-Type": "application/x-www-form-urlencoded" };
//     let jsn = await fetch(searchUrl, {method: "POST", headers:headers, body:formData})
//                     .then(response=>response.json())
//     let iaaiModels = {};
//     jsn.forEach(model=>{
//         iaaiModels[model.AC_Model_Name] = model.Salvage_Model_ID;
//     })
//     return iaaiModels;
// }
// function median(values){
//     if(values.length ===0) throw new Error("No inputs");
//     values.sort(function(a,b){
//         return a-b;
//     });
//     var half = Math.floor(values.length / 2);
//     if (values.length % 2)
//         return values[half];
//     return (values[half - 1] + values[half]) / 2.0;
// }


/*-----*\
  ROW52  
\*-----*/
function openRow52 (vinInput) {
    var searchUrl = 'https://row52.com/Search/?YMMorVin=VIN&Year=&'+
        'V1='   + vinInput[0] +
        '&V2='  + vinInput[1] +
        '&V3='  + vinInput[2] +
        '&V4='  + vinInput[3] +
        '&V5='  + vinInput[4] +
        '&V6='  + vinInput[5] +
        '&V7='  + vinInput[6] +
        '&V8='  + vinInput[7] +
        '&V9='  + vinInput[8] +
        '&V10=' + vinInput[9] +
        '&V11=' + vinInput[10] +
        '&V12=' + vinInput[11] +
        '&V13=' + vinInput[12] +
        '&V14=' + vinInput[13] +
        '&V15=' + vinInput[14] +
        '&V16=' + vinInput[15] +
        '&V17=' + vinInput[16] +
        '&ZipCode=&Page=1&ModelId=&MakeId=&LocationId=&IsVin=true&Distance=50';
    browser.tabs.create({url: searchUrl, active: false});
};


console.log("search loaded!")
