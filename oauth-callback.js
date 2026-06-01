(function () {
  var title = document.getElementById("title");
  var message = document.getElementById("message");
  var spinner = document.getElementById("spinner");
  var params = new URLSearchParams(window.location.search);
  var code = params.get("code");
  var state = params.get("state");
  var error = params.get("error");

  if (error || (!code && !state)) {
    spinner.style.display = "none";
    title.textContent = "Sign-in cancelled";
    title.classList.add("error");
    message.textContent = error
      ? "Google returned an error: " + error + ". You can close this tab."
      : "No authorization data was received. You can close this tab and try again.";
    return;
  }

  try {
    chrome.runtime.sendMessage(
      { type: "tabsetu:oauth-callback", redirectUrl: window.location.href },
      function (response) {
        spinner.style.display = "none";
        if (response && response.ok) {
          title.textContent = "Signed in!";
          title.classList.add("done");
          message.textContent = "You can close this tab now.";
        } else {
          title.textContent = "Something went wrong";
          title.classList.add("error");
          message.textContent =
            "TabSetu could not complete the sign-in. Please close this tab and try again.";
        }
      }
    );
  } catch {
    spinner.style.display = "none";
    title.textContent = "Connection error";
    title.classList.add("error");
    message.textContent =
      "Could not communicate with the TabSetu extension. Please close this tab and try again.";
  }
})();
