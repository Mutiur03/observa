(function () {
  var script = document.currentScript;
  var apiKey = script && (script.dataset.apiKey || script.dataset.key);
  if (!apiKey) return;

  var endpoint = new URL(script.src, location.href).origin + "/v1";
  var userId = script.dataset.userId || null;
  var anonymousId = getOrCreate(localStorage, "observa_anonymous_id");
  var sessionId = getOrCreate(sessionStorage, "observa_session_id");
  var timer = null;

  function id() {
    return crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2);
  }

  function getOrCreate(storage, key) {
    var value = storage.getItem(key);
    if (value) return value;
    value = id();
    storage.setItem(key, value);
    return value;
  }

  function heartbeat() {
    if (document.visibilityState === "hidden") return;
    fetch(endpoint + "/presence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        user_id: userId,
        anonymous_id: anonymousId,
        session_id: sessionId,
        path: location.pathname,
        url: location.href,
        title: document.title,
      }),
      keepalive: true,
    }).catch(function () {});
  }

  function start() {
    if (timer) clearInterval(timer);
    heartbeat();
    timer = setInterval(heartbeat, 20000);
  }

  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") start();
  });
  ["pushState", "replaceState"].forEach(function (method) {
    var original = history[method];
    history[method] = function () {
      var result = original.apply(this, arguments);
      setTimeout(heartbeat, 0);
      return result;
    };
  });
  window.addEventListener("popstate", heartbeat);
  window.addEventListener("hashchange", heartbeat);

  window.ObservaPresence = {
    identify: function (value) {
      userId = value || null;
      heartbeat();
    },
    heartbeat: heartbeat,
  };

  start();
})();
