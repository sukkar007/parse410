! function() {
    var documentElement = document.documentElement;
    var resizeEvt = 'orientationchange' in window ? 'orientationchange' : 'resize';

    function resize() {
        var clientWidth = documentElement.clientWidth;
        clientWidth = clientWidth > 750 ? 750 : clientWidth;
        clientWidth = clientWidth <
            320 ? 320 : clientWidth;
        var a = clientWidth / 7.5;
        documentElement.style.fontSize = a + "px";
        var real = parseFloat(window.getComputedStyle(document.getElementsByTagName("html")[0]).fontSize);
        if (Math.abs(a - real) > 1) {
            documentElement.style.fontSize = a * (a / real) + "px";
        }
    }
    resize();
    window.addEventListener(resizeEvt, resize, false);
    document.addEventListener('DOMContentLoaded', resize, false);
}(window, document);