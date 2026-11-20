/* Compatibility for older Android browsers; kitchen data remains on this device. */
if (!Object.hasOwn) Object.hasOwn = function (value, key) { return Object.prototype.hasOwnProperty.call(value, key); };
if (typeof window.structuredClone !== 'function') window.structuredClone = function (value) { return JSON.parse(JSON.stringify(value)); };
/* Keep startup usable when a phone cannot load or execute the application. */
(function () {
  if (!Object.hasOwn) Object.hasOwn = function (object, key) { return Object.prototype.hasOwnProperty.call(object, key); };
  if (!window.structuredClone) window.structuredClone = function (value) { return JSON.parse(JSON.stringify(value)); };
  function ready() { return window.mealdayStarted === true; }
  function failed() {
    if (ready()) return;
    var screen = document.getElementById('screen'); if (!screen) return;
    screen.innerHTML = '<section style="max-width:480px;margin:60px auto;padding:24px;font-family:Arial,sans-serif;line-height:1.6"><h1>Let’s reopen your kitchen</h1><p>Mealday could not finish loading. Your saved kitchen has not been cleared.</p><button id="startup-retry" style="padding:14px 24px;background:#087c47;color:white;border:0;border-radius:8px;font-size:17px">Try again</button><p style="font-size:14px">If this continues, open this link in an updated Chrome browser.</p></section>';
    document.getElementById('startup-retry').onclick = function () { window.location.reload(); };
  }
  window.addEventListener('error', function (event) { if (event.target && event.target.tagName === 'SCRIPT' || event.error) failed(); }, true);
  window.addEventListener('unhandledrejection', failed);
  window.addEventListener('DOMContentLoaded', function () { setTimeout(failed, 15000); });
})();
