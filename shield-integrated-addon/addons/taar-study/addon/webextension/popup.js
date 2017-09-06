document.addEventListener("click", (e) => {
  if (e.target.id == "browse-addons-button") {
    console.log("routing to about:addons...")
    browser.runtime.sendMessage({"clicked-disco-button": true})
  } else if (e.target.id == "close-button") {
    browser.runtime.sendMessage({"clicked-close-button": true})
  }
});