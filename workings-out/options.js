function saveOptions(e) {
  e.preventDefault();
  browser.storage.local.set({
    settings: {
      copart: document.querySelector("#copart").checked,
      iaai:   document.querySelector("#iaai").checked,
      row52:  document.querySelector("#row52").checked
    }
  });
}

function restoreOptions() {

  function setCurrentChoice(result) {
    if (typeof result.settings === 'undefined') {
      document.querySelector("#copart").checked = true;
      document.querySelector("#iaai").checked   = true;
      document.querySelector("#row52").checked  = true;
    } else {
      let settings = result.settings;
      document.querySelector("#copart").checked = settings.copart;
      document.querySelector("#iaai").checked   = settings.iaai;
      document.querySelector("#row52").checked  = settings.row52;
    }
  }

  function onError(error) {
    console.log(`Error: ${error}`);
  }

  let getting = browser.storage.local.get('settings');
  getting.then(setCurrentChoice, onError);
}

document.addEventListener("DOMContentLoaded", restoreOptions);
document.querySelector("form").addEventListener("submit", saveOptions);
