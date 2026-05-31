const vtt = "WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nTest\n\n";
const b64 = btoa(unescape(encodeURIComponent(vtt)));
console.log(b64);
