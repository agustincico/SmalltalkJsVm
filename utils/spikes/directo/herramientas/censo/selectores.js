"use strict";
const os = require("os"), fs = require("fs"), path = require("path");
const REPO = "/Users/agustin/SqueakJS";
Object.assign(global, { self: new Proxy({}, { get: (o,p)=>global[p], set:(o,p,v)=>{global[p]=v;return true;} }) });
Object.assign(self, { localStorage: {}, WebSocket: null, sha1: require(REPO+"/lib/sha1"),
  btoa: s=>Buffer.from(s,"ascii").toString("base64"), atob: s=>Buffer.from(s,"base64").toString("ascii") });
["globals","vm","vm.object","vm.object.spur","vm.image","vm.interpreter","vm.interpreter.proxy",
 "vm.instruction.stream","vm.instruction.stream.sista","vm.instruction.printer","vm.primitives",
 "vm.display","vm.display.headless","vm.input","vm.input.headless","vm.plugins"].forEach(m=>require(REPO+"/"+m+".js"));
fs.readFile("Cuis7.8.image", function(e, data) {
    var image = new Squeak.Image("Cuis7.8.image");
    image.readFromBuffer(data.buffer, function() {
        var vm = new Squeak.Interpreter(image, { vmOptions: [], argv: [] });
        var ss = vm.specialSelectors, out = [];
        for (var i = 0; i < 32; i++) out.push(i + ":" + ss[2*i].bytesAsString() + "/" + ss[2*i+1]);
        console.log(out.join("  "));
        console.log("MaxSmallInt=" + Squeak.MaxSmallInt + " MinSmallInt=" + Squeak.MinSmallInt +
            " smallFrame=" + Squeak.Context_smallFrameSize + " largeFrame=" + Squeak.Context_largeFrameSize +
            " tempFrameStart=" + Squeak.Context_tempFrameStart);
        console.log("image spur=" + image.isSpur + " 64bit=" + !!image.is64Bit + " hasClosures=" + image.hasClosures);
        process.exit(0);
    });
});
