const VINREGEX = RegExp("^[A-HJ-NPR-Z0-9]{3}[A-HJ-NPR-Z0-9]{5}[0-9X][A-HJ-NPR-Z0-9][A-HJ-NPR-Z0-9][A-HJ-NPR-Z0-9]{6}$", "i");
const DEFAULT_SETTINGS = {
    searchCopart: true,
    searchIaai: true,
    searchRow52: true
}

async function openSalvagePages(vinInput) {
    let storage = await browser.storage.local.get("settings")
    let settings = storage.settings || DEFAULT_SETTINGS

    // test the clipboard text out of an abundance of caution since we need to do code injection for Copart.
    vinInput = encodeURIComponent(vinInput).replace(/^\s+|\s+$/g, '');
    if (!VINREGEX.test(vinInput)) {
        console.log("Heyyyy, how did this bad input get through?")
        return;
    };
    if (settings.searchCopart) {
        openCopart(vinInput);
    };
    if (settings.searchIaai) {
        openIaai(vinInput);
    };
    if (settings.searchRow52) {
        openRow52(vinInput);
    };

};

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
        if (!response.ok) {throw `fetch failed with status code: ${response.status}`;}

        // parse response
        let jsn = await response.json()
        if (!jsn.data.hasOwnProperty("results")) {throw "failed with no results property";}

        // open result tab
        if (jsn.data.results.content.length) {
            for (let vehicle of jsn.data.results.content) {
                let lotUrl = `https://www.copart.com/lot/${vehicle.lotNumberStr}`;
                browser.tabs.create({url: lotUrl})
            }
        } else {throw "query returned no results";}
    } catch (error) {
        console.log(error)
        console.log("resorting to fallback url")
        let failureUrl = "https://www.copart.com/lotSearchResults/?free=true&query="+vinInput;
        browser.tabs.create({url: failureUrl})
    }
}

function openIaai (vinInput) {
    let searchUrl = "https://www.iaai.com/VehicleSearch/SearchDetails?Keyword="+vinInput
    browser.tabs.create({url: searchUrl});
};

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
    browser.tabs.create({url: searchUrl});
};

console.log("search loaded!")
