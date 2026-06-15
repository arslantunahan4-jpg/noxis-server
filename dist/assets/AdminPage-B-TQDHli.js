import{j as l}from"./vendor-animation-CpW_UvHy.js";import{r as $,a as g,L as mr,i as gr,j as Ke}from"./vendor-react-CXEqBMpp.js";import{ad as xr,d as ve,ae as E,q as yr,m as Ie,af as W,B as br,ag as wr,ah as Sr}from"./vendor-mui-core-CEUGoG4w.js";import{S as jr,D as kr,L as Cr,N as Or,a as Bn,P as Ar,M as Qt,H as Pr,b as Er,c as Mr,d as Rr,e as Jt,R as Ir,f as Tr,T as Dr,g as Nr,A as $r,h as Lr,i as Br}from"./vendor-mui-icons-bAq7nk7C.js";import{M as Wr}from"./vendor-charts-B7AXeswn.js";import{D as zr,G as Fr}from"./vendor-datagrid-C9H69YUD.js";const _=e=>({...e==="dark"?{grey:{100:"#e0e0e0",200:"#c2c2c2",300:"#a3a3a3",400:"#858585",500:"#666666",600:"#4d4d4d",700:"#333333",800:"#1a1a1a",900:"#141414"},primary:{100:"#d0d1d5",200:"#a1a4ab",300:"#727681",400:"#1F2A40",500:"#141b2d",600:"#101624",700:"#0c101b",800:"#080b12",900:"#040509"},greenAccent:{100:"#db4f4a",200:"#dec4c4",300:"#c97c7c",400:"#68c281",500:"#4cceac",600:"#3da58a",700:"#2e7c67",800:"#1e5245",900:"#0f2922"},redAccent:{100:"#f8dcdb",200:"#f1b9b7",300:"#e99592",400:"#e2726e",500:"#db4f4a",600:"#af3f3b",700:"#832f2c",800:"#58201e",900:"#2c100f"},blueAccent:{100:"#e1e2fe",200:"#c3c4fd",300:"#a5a6fc",400:"#8789fb",500:"#6870fa",600:"#535ac8",700:"#3e4396",800:"#2a2d64",900:"#151632"}}:{grey:{100:"#141414",200:"#1a1a1a",300:"#333333",400:"#4d4d4d",500:"#666666",600:"#858585",700:"#a3a3a3",800:"#c2c2c2",900:"#e0e0e0"},primary:{100:"#040509",200:"#080b12",300:"#0c101b",400:"#101624",500:"#141b2d",600:"#1F2A40",700:"#727681",800:"#a1a4ab",900:"#d0d1d5"},greenAccent:{100:"#0f2922",200:"#1e5245",300:"#2e7c67",400:"#3da58a",500:"#4cceac",600:"#68c281",700:"#c97c7c",800:"#dec4c4",900:"#db4f4a"},redAccent:{100:"#2c100f",200:"#58201e",300:"#832f2c",400:"#af3f3b",500:"#db4f4a",600:"#e2726e",700:"#e99592",800:"#f1b9b7",900:"#f8dcdb"},blueAccent:{100:"#151632",200:"#2a2d64",300:"#3e4396",400:"#535ac8",500:"#6870fa",600:"#8789fb",700:"#a5a6fc",800:"#c3c4fd",900:"#e1e2fe"}}}),Hr=e=>{const t=_(e);return{palette:{mode:e,...e==="dark"?{primary:{main:t.primary[500]},secondary:{main:t.greenAccent[500]},neutral:{dark:t.grey[700],main:t.grey[500],light:t.grey[100]},background:{default:t.primary[500]}}:{primary:{main:t.primary[100]},secondary:{main:t.greenAccent[500]},neutral:{dark:t.grey[700],main:t.grey[500],light:t.grey[100]},background:{default:"#fcfcfc"}}},typography:{fontFamily:["Source Sans Pro","sans-serif"].join(","),fontSize:12,h1:{fontFamily:["Source Sans Pro","sans-serif"].join(","),fontSize:40},h2:{fontFamily:["Source Sans Pro","sans-serif"].join(","),fontSize:32},h3:{fontFamily:["Source Sans Pro","sans-serif"].join(","),fontSize:24},h4:{fontFamily:["Source Sans Pro","sans-serif"].join(","),fontSize:20},h5:{fontFamily:["Source Sans Pro","sans-serif"].join(","),fontSize:16},h6:{fontFamily:["Source Sans Pro","sans-serif"].join(","),fontSize:14}}}},Wn=$.createContext({toggleColorMode:()=>{}}),Ur=()=>{const[e,t]=$.useState("dark"),n=$.useMemo(()=>({toggleColorMode:()=>t(o=>o==="light"?"dark":"light")}),[]);return[$.useMemo(()=>xr(Hr(e)),[e]),n]},Vr=()=>{const e=ve(),t=_(e.palette.mode),n=$.useContext(Wn);return l.jsxs(E,{display:"flex",justifyContent:"space-between",p:2,children:[l.jsxs(E,{display:"flex",backgroundColor:t.primary[400],borderRadius:"3px",children:[l.jsx(yr,{sx:{ml:2,flex:1},placeholder:"Search"}),l.jsx(Ie,{type:"button",sx:{p:1},children:l.jsx(jr,{})})]}),l.jsxs(E,{display:"flex",children:[l.jsx(Ie,{onClick:n.toggleColorMode,children:e.palette.mode==="dark"?l.jsx(kr,{}):l.jsx(Cr,{})}),l.jsx(Ie,{children:l.jsx(Or,{})}),l.jsx(Ie,{children:l.jsx(Bn,{})}),l.jsx(Ie,{children:l.jsx(Ar,{})})]})]})};/*! *****************************************************************************
Copyright (c) Microsoft Corporation.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
***************************************************************************** */var ne=function(){return ne=Object.assign||function(t){for(var n,r=1,o=arguments.length;r<o;r++){n=arguments[r];for(var a in n)Object.prototype.hasOwnProperty.call(n,a)&&(t[a]=n[a])}return t},ne.apply(this,arguments)};function We(e,t){var n={};for(var r in e)Object.prototype.hasOwnProperty.call(e,r)&&t.indexOf(r)<0&&(n[r]=e[r]);if(e!=null&&typeof Object.getOwnPropertySymbols=="function")for(var o=0,r=Object.getOwnPropertySymbols(e);o<r.length;o++)t.indexOf(r[o])<0&&Object.prototype.propertyIsEnumerable.call(e,r[o])&&(n[r[o]]=e[r[o]]);return n}function Z(e,t){return Object.defineProperty?Object.defineProperty(e,"raw",{value:t}):e.raw=t,e}function Rt(){return Rt=Object.assign?Object.assign.bind():function(e){for(var t=1;t<arguments.length;t++){var n=arguments[t];for(var r in n)Object.prototype.hasOwnProperty.call(n,r)&&(e[r]=n[r])}return e},Rt.apply(this,arguments)}function Lt(e){var t=Object.create(null);return function(n){return t[n]===void 0&&(t[n]=e(n)),t[n]}}var Gr=/^((children|dangerouslySetInnerHTML|key|ref|autoFocus|defaultValue|defaultChecked|innerHTML|suppressContentEditableWarning|suppressHydrationWarning|valueLink|abbr|accept|acceptCharset|accessKey|action|allow|allowUserMedia|allowPaymentRequest|allowFullScreen|allowTransparency|alt|async|autoComplete|autoPlay|capture|cellPadding|cellSpacing|challenge|charSet|checked|cite|classID|className|cols|colSpan|content|contentEditable|contextMenu|controls|controlsList|coords|crossOrigin|data|dateTime|decoding|default|defer|dir|disabled|disablePictureInPicture|download|draggable|encType|enterKeyHint|form|formAction|formEncType|formMethod|formNoValidate|formTarget|frameBorder|headers|height|hidden|high|href|hrefLang|htmlFor|httpEquiv|id|inputMode|integrity|is|keyParams|keyType|kind|label|lang|list|loading|loop|low|marginHeight|marginWidth|max|maxLength|media|mediaGroup|method|min|minLength|multiple|muted|name|nonce|noValidate|open|optimum|pattern|placeholder|playsInline|poster|preload|profile|radioGroup|readOnly|referrerPolicy|rel|required|reversed|role|rows|rowSpan|sandbox|scope|scoped|scrolling|seamless|selected|shape|size|sizes|slot|span|spellCheck|src|srcDoc|srcLang|srcSet|start|step|style|summary|tabIndex|target|title|translate|type|useMap|value|width|wmode|wrap|about|datatype|inlist|prefix|property|resource|typeof|vocab|autoCapitalize|autoCorrect|autoSave|color|incremental|fallback|inert|itemProp|itemScope|itemType|itemID|itemRef|on|option|results|security|unselectable|accentHeight|accumulate|additive|alignmentBaseline|allowReorder|alphabetic|amplitude|arabicForm|ascent|attributeName|attributeType|autoReverse|azimuth|baseFrequency|baselineShift|baseProfile|bbox|begin|bias|by|calcMode|capHeight|clip|clipPathUnits|clipPath|clipRule|colorInterpolation|colorInterpolationFilters|colorProfile|colorRendering|contentScriptType|contentStyleType|cursor|cx|cy|d|decelerate|descent|diffuseConstant|direction|display|divisor|dominantBaseline|dur|dx|dy|edgeMode|elevation|enableBackground|end|exponent|externalResourcesRequired|fill|fillOpacity|fillRule|filter|filterRes|filterUnits|floodColor|floodOpacity|focusable|fontFamily|fontSize|fontSizeAdjust|fontStretch|fontStyle|fontVariant|fontWeight|format|from|fr|fx|fy|g1|g2|glyphName|glyphOrientationHorizontal|glyphOrientationVertical|glyphRef|gradientTransform|gradientUnits|hanging|horizAdvX|horizOriginX|ideographic|imageRendering|in|in2|intercept|k|k1|k2|k3|k4|kernelMatrix|kernelUnitLength|kerning|keyPoints|keySplines|keyTimes|lengthAdjust|letterSpacing|lightingColor|limitingConeAngle|local|markerEnd|markerMid|markerStart|markerHeight|markerUnits|markerWidth|mask|maskContentUnits|maskUnits|mathematical|mode|numOctaves|offset|opacity|operator|order|orient|orientation|origin|overflow|overlinePosition|overlineThickness|panose1|paintOrder|pathLength|patternContentUnits|patternTransform|patternUnits|pointerEvents|points|pointsAtX|pointsAtY|pointsAtZ|preserveAlpha|preserveAspectRatio|primitiveUnits|r|radius|refX|refY|renderingIntent|repeatCount|repeatDur|requiredExtensions|requiredFeatures|restart|result|rotate|rx|ry|scale|seed|shapeRendering|slope|spacing|specularConstant|specularExponent|speed|spreadMethod|startOffset|stdDeviation|stemh|stemv|stitchTiles|stopColor|stopOpacity|strikethroughPosition|strikethroughThickness|string|stroke|strokeDasharray|strokeDashoffset|strokeLinecap|strokeLinejoin|strokeMiterlimit|strokeOpacity|strokeWidth|surfaceScale|systemLanguage|tableValues|targetX|targetY|textAnchor|textDecoration|textRendering|textLength|to|transform|u1|u2|underlinePosition|underlineThickness|unicode|unicodeBidi|unicodeRange|unitsPerEm|vAlphabetic|vHanging|vIdeographic|vMathematical|values|vectorEffect|version|vertAdvY|vertOriginX|vertOriginY|viewBox|viewTarget|visibility|widths|wordSpacing|writingMode|x|xHeight|x1|x2|xChannelSelector|xlinkActuate|xlinkArcrole|xlinkHref|xlinkRole|xlinkShow|xlinkTitle|xlinkType|xmlBase|xmlns|xmlnsXlink|xmlLang|xmlSpace|y|y1|y2|yChannelSelector|z|zoomAndPan|for|class|autofocus)|(([Dd][Aa][Tt][Aa]|[Aa][Rr][Ii][Aa]|x)-.*))$/,qr=Lt(function(e){return Gr.test(e)||e.charCodeAt(0)===111&&e.charCodeAt(1)===110&&e.charCodeAt(2)<91});function Yr(e){if(e.sheet)return e.sheet;for(var t=0;t<document.styleSheets.length;t++)if(document.styleSheets[t].ownerNode===e)return document.styleSheets[t]}function Xr(e){var t=document.createElement("style");return t.setAttribute("data-emotion",e.key),e.nonce!==void 0&&t.setAttribute("nonce",e.nonce),t.appendChild(document.createTextNode("")),t.setAttribute("data-s",""),t}var Kr=function(){function e(n){var r=this;this._insertTag=function(o){var a;r.tags.length===0?r.insertionPoint?a=r.insertionPoint.nextSibling:r.prepend?a=r.container.firstChild:a=r.before:a=r.tags[r.tags.length-1].nextSibling,r.container.insertBefore(o,a),r.tags.push(o)},this.isSpeedy=n.speedy===void 0?!0:n.speedy,this.tags=[],this.ctr=0,this.nonce=n.nonce,this.key=n.key,this.container=n.container,this.prepend=n.prepend,this.insertionPoint=n.insertionPoint,this.before=null}var t=e.prototype;return t.hydrate=function(r){r.forEach(this._insertTag)},t.insert=function(r){this.ctr%(this.isSpeedy?65e3:1)===0&&this._insertTag(Xr(this));var o=this.tags[this.tags.length-1];if(this.isSpeedy){var a=Yr(o);try{a.insertRule(r,a.cssRules.length)}catch{}}else o.appendChild(document.createTextNode(r));this.ctr++},t.flush=function(){this.tags.forEach(function(r){return r.parentNode&&r.parentNode.removeChild(r)}),this.tags=[],this.ctr=0},e}(),K="-ms-",yt="-moz-",I="-webkit-",zn="comm",Bt="rule",Wt="decl",Zr="@import",Fn="@keyframes",_r=Math.abs,jt=String.fromCharCode,Qr=Object.assign;function Jr(e,t){return X(e,0)^45?(((t<<2^X(e,0))<<2^X(e,1))<<2^X(e,2))<<2^X(e,3):0}function Hn(e){return e.trim()}function eo(e,t){return(e=t.exec(e))?e[0]:e}function D(e,t,n){return e.replace(t,n)}function It(e,t){return e.indexOf(t)}function X(e,t){return e.charCodeAt(t)|0}function tt(e,t,n){return e.slice(t,n)}function be(e){return e.length}function zt(e){return e.length}function ft(e,t){return t.push(e),e}function to(e,t){return e.map(t).join("")}var kt=1,Ue=1,Un=0,ee=0,G=0,Xe="";function Ct(e,t,n,r,o,a,i){return{value:e,root:t,parent:n,type:r,props:o,children:a,line:kt,column:Ue,length:i,return:""}}function Ze(e,t){return Qr(Ct("",null,null,"",null,null,0),e,{length:-e.length},t)}function no(){return G}function ro(){return G=ee>0?X(Xe,--ee):0,Ue--,G===10&&(Ue=1,kt--),G}function re(){return G=ee<Un?X(Xe,ee++):0,Ue++,G===10&&(Ue=1,kt++),G}function Se(){return X(Xe,ee)}function vt(){return ee}function it(e,t){return tt(Xe,e,t)}function nt(e){switch(e){case 0:case 9:case 10:case 13:case 32:return 5;case 33:case 43:case 44:case 47:case 62:case 64:case 126:case 59:case 123:case 125:return 4;case 58:return 3;case 34:case 39:case 40:case 91:return 2;case 41:case 93:return 1}return 0}function Vn(e){return kt=Ue=1,Un=be(Xe=e),ee=0,[]}function Gn(e){return Xe="",e}function ht(e){return Hn(it(ee-1,Tt(e===91?e+2:e===40?e+1:e)))}function oo(e){for(;(G=Se())&&G<33;)re();return nt(e)>2||nt(G)>3?"":" "}function ao(e,t){for(;--t&&re()&&!(G<48||G>102||G>57&&G<65||G>70&&G<97););return it(e,vt()+(t<6&&Se()==32&&re()==32))}function Tt(e){for(;re();)switch(G){case e:return ee;case 34:case 39:e!==34&&e!==39&&Tt(G);break;case 40:e===41&&Tt(e);break;case 92:re();break}return ee}function io(e,t){for(;re()&&e+G!==57;)if(e+G===84&&Se()===47)break;return"/*"+it(t,ee-1)+"*"+jt(e===47?e:re())}function so(e){for(;!nt(Se());)re();return it(e,ee)}function en(e){return Gn(mt("",null,null,null,[""],e=Vn(e),0,[0],e))}function mt(e,t,n,r,o,a,i,s,d){for(var u=0,c=0,p=i,C=0,y=0,b=0,v=1,S=1,k=1,w=0,j="",h=o,m=a,f=r,x=j;S;)switch(b=w,w=re()){case 40:if(b!=108&&X(x,p-1)==58){It(x+=D(ht(w),"&","&\f"),"&\f")!=-1&&(k=-1);break}case 34:case 39:case 91:x+=ht(w);break;case 9:case 10:case 13:case 32:x+=oo(b);break;case 92:x+=ao(vt()-1,7);continue;case 47:switch(Se()){case 42:case 47:ft(co(io(re(),vt()),t,n),d);break;default:x+="/"}break;case 123*v:s[u++]=be(x)*k;case 125*v:case 59:case 0:switch(w){case 0:case 125:S=0;case 59+c:y>0&&be(x)-p&&ft(y>32?nn(x+";",r,n,p-1):nn(D(x," ","")+";",r,n,p-2),d);break;case 59:x+=";";default:if(ft(f=tn(x,t,n,u,c,o,s,j,h=[],m=[],p),a),w===123)if(c===0)mt(x,t,f,f,h,a,p,s,m);else switch(C===99&&X(x,3)===110?100:C){case 100:case 109:case 115:mt(e,f,f,r&&ft(tn(e,f,f,0,0,o,s,j,o,h=[],p),m),o,m,p,s,r?h:m);break;default:mt(x,f,f,f,[""],m,0,s,m)}}u=c=y=0,v=k=1,j=x="",p=i;break;case 58:p=1+be(x),y=b;default:if(v<1){if(w==123)--v;else if(w==125&&v++==0&&ro()==125)continue}switch(x+=jt(w),w*v){case 38:k=c>0?1:(x+="\f",-1);break;case 44:s[u++]=(be(x)-1)*k,k=1;break;case 64:Se()===45&&(x+=ht(re())),C=Se(),c=p=be(j=x+=so(vt())),w++;break;case 45:b===45&&be(x)==2&&(v=0)}}return a}function tn(e,t,n,r,o,a,i,s,d,u,c){for(var p=o-1,C=o===0?a:[""],y=zt(C),b=0,v=0,S=0;b<r;++b)for(var k=0,w=tt(e,p+1,p=_r(v=i[b])),j=e;k<y;++k)(j=Hn(v>0?C[k]+" "+w:D(w,/&\f/g,C[k])))&&(d[S++]=j);return Ct(e,t,n,o===0?Bt:s,d,u,c)}function co(e,t,n){return Ct(e,t,n,zn,jt(no()),tt(e,2,-2),0)}function nn(e,t,n,r){return Ct(e,t,n,Wt,tt(e,0,r),tt(e,r+1,-1),r)}function Le(e,t){for(var n="",r=zt(e),o=0;o<r;o++)n+=t(e[o],o,e,t)||"";return n}function rn(e,t,n,r){switch(e.type){case Zr:case Wt:return e.return=e.return||e.value;case zn:return"";case Fn:return e.return=e.value+"{"+Le(e.children,r)+"}";case Bt:e.value=e.props.join(",")}return be(n=Le(e.children,r))?e.return=e.value+"{"+n+"}":""}function on(e){var t=zt(e);return function(n,r,o,a){for(var i="",s=0;s<t;s++)i+=e[s](n,r,o,a)||"";return i}}function lo(e){return function(t){t.root||(t=t.return)&&e(t)}}var uo=function(t){var n=new WeakMap;return function(r){if(n.has(r))return n.get(r);var o=t(r);return n.set(r,o),o}},fo=function(t,n,r){for(var o=0,a=0;o=a,a=Se(),o===38&&a===12&&(n[r]=1),!nt(a);)re();return it(t,ee)},po=function(t,n){var r=-1,o=44;do switch(nt(o)){case 0:o===38&&Se()===12&&(n[r]=1),t[r]+=fo(ee-1,n,r);break;case 2:t[r]+=ht(o);break;case 4:if(o===44){t[++r]=Se()===58?"&\f":"",n[r]=t[r].length;break}default:t[r]+=jt(o)}while(o=re());return t},vo=function(t,n){return Gn(po(Vn(t),n))},an=new WeakMap,ho=function(t){if(!(t.type!=="rule"||!t.parent||t.length<1)){for(var n=t.value,r=t.parent,o=t.column===r.column&&t.line===r.line;r.type!=="rule";)if(r=r.parent,!r)return;if(!(t.props.length===1&&n.charCodeAt(0)!==58&&!an.get(r))&&!o){an.set(t,!0);for(var a=[],i=vo(n,a),s=r.props,d=0,u=0;d<i.length;d++)for(var c=0;c<s.length;c++,u++)t.props[u]=a[d]?i[d].replace(/&\f/g,s[c]):s[c]+" "+i[d]}}},mo=function(t){if(t.type==="decl"){var n=t.value;n.charCodeAt(0)===108&&n.charCodeAt(2)===98&&(t.return="",t.value="")}};function qn(e,t){switch(Jr(e,t)){case 5103:return I+"print-"+e+e;case 5737:case 4201:case 3177:case 3433:case 1641:case 4457:case 2921:case 5572:case 6356:case 5844:case 3191:case 6645:case 3005:case 6391:case 5879:case 5623:case 6135:case 4599:case 4855:case 4215:case 6389:case 5109:case 5365:case 5621:case 3829:return I+e+e;case 5349:case 4246:case 4810:case 6968:case 2756:return I+e+yt+e+K+e+e;case 6828:case 4268:return I+e+K+e+e;case 6165:return I+e+K+"flex-"+e+e;case 5187:return I+e+D(e,/(\w+).+(:[^]+)/,I+"box-$1$2"+K+"flex-$1$2")+e;case 5443:return I+e+K+"flex-item-"+D(e,/flex-|-self/,"")+e;case 4675:return I+e+K+"flex-line-pack"+D(e,/align-content|flex-|-self/,"")+e;case 5548:return I+e+K+D(e,"shrink","negative")+e;case 5292:return I+e+K+D(e,"basis","preferred-size")+e;case 6060:return I+"box-"+D(e,"-grow","")+I+e+K+D(e,"grow","positive")+e;case 4554:return I+D(e,/([^-])(transform)/g,"$1"+I+"$2")+e;case 6187:return D(D(D(e,/(zoom-|grab)/,I+"$1"),/(image-set)/,I+"$1"),e,"")+e;case 5495:case 3959:return D(e,/(image-set\([^]*)/,I+"$1$`$1");case 4968:return D(D(e,/(.+:)(flex-)?(.*)/,I+"box-pack:$3"+K+"flex-pack:$3"),/s.+-b[^;]+/,"justify")+I+e+e;case 4095:case 3583:case 4068:case 2532:return D(e,/(.+)-inline(.+)/,I+"$1$2")+e;case 8116:case 7059:case 5753:case 5535:case 5445:case 5701:case 4933:case 4677:case 5533:case 5789:case 5021:case 4765:if(be(e)-1-t>6)switch(X(e,t+1)){case 109:if(X(e,t+4)!==45)break;case 102:return D(e,/(.+:)(.+)-([^]+)/,"$1"+I+"$2-$3$1"+yt+(X(e,t+3)==108?"$3":"$2-$3"))+e;case 115:return~It(e,"stretch")?qn(D(e,"stretch","fill-available"),t)+e:e}break;case 4949:if(X(e,t+1)!==115)break;case 6444:switch(X(e,be(e)-3-(~It(e,"!important")&&10))){case 107:return D(e,":",":"+I)+e;case 101:return D(e,/(.+:)([^;!]+)(;|!.+)?/,"$1"+I+(X(e,14)===45?"inline-":"")+"box$3$1"+I+"$2$3$1"+K+"$2box$3")+e}break;case 5936:switch(X(e,t+11)){case 114:return I+e+K+D(e,/[svh]\w+-[tblr]{2}/,"tb")+e;case 108:return I+e+K+D(e,/[svh]\w+-[tblr]{2}/,"tb-rl")+e;case 45:return I+e+K+D(e,/[svh]\w+-[tblr]{2}/,"lr")+e}return I+e+K+e+e}return e}var go=function(t,n,r,o){if(t.length>-1&&!t.return)switch(t.type){case Wt:t.return=qn(t.value,t.length);break;case Fn:return Le([Ze(t,{value:D(t.value,"@","@"+I)})],o);case Bt:if(t.length)return to(t.props,function(a){switch(eo(a,/(::plac\w+|:read-\w+)/)){case":read-only":case":read-write":return Le([Ze(t,{props:[D(a,/:(read-\w+)/,":"+yt+"$1")]})],o);case"::placeholder":return Le([Ze(t,{props:[D(a,/:(plac\w+)/,":"+I+"input-$1")]}),Ze(t,{props:[D(a,/:(plac\w+)/,":"+yt+"$1")]}),Ze(t,{props:[D(a,/:(plac\w+)/,K+"input-$1")]})],o)}return""})}},gt=typeof document<"u",xo=gt?void 0:uo(function(){return Lt(function(){var e={};return function(t){return e[t]}})}),yo=[go],Yn=function(t){var n=t.key;if(gt&&n==="css"){var r=document.querySelectorAll("style[data-emotion]:not([data-s])");Array.prototype.forEach.call(r,function(h){var m=h.getAttribute("data-emotion");m.indexOf(" ")!==-1&&(document.head.appendChild(h),h.setAttribute("data-s",""))})}var o=t.stylisPlugins||yo,a={},i,s=[];gt&&(i=t.container||document.head,Array.prototype.forEach.call(document.querySelectorAll('style[data-emotion^="'+n+' "]'),function(h){for(var m=h.getAttribute("data-emotion").split(" "),f=1;f<m.length;f++)a[m[f]]=!0;s.push(h)}));var d,u=[ho,mo];if(gt){var c,p=[rn,lo(function(h){c.insert(h)})],C=on(u.concat(o,p)),y=function(m){return Le(en(m),C)};d=function(m,f,x,O){c=x,y(m?m+"{"+f.styles+"}":f.styles),O&&(j.inserted[f.name]=!0)}}else{var b=[rn],v=on(u.concat(o,b)),S=function(m){return Le(en(m),v)},k=xo(o)(n),w=function(m,f){var x=f.name;return k[x]===void 0&&(k[x]=S(m?m+"{"+f.styles+"}":f.styles)),k[x]};d=function(m,f,x,O){var M=f.name,A=w(m,f);if(j.compat===void 0)return O&&(j.inserted[M]=!0),A;if(O)j.inserted[M]=A;else return A}}var j={key:n,sheet:new Kr({key:n,container:i,nonce:t.nonce,speedy:t.speedy,prepend:t.prepend,insertionPoint:t.insertionPoint}),nonce:t.nonce,inserted:a,registered:{},insert:d};return j.sheet.hydrate(s),j},bo=typeof document<"u",sn=function(t){return t()},wo=$.useInsertionEffect?$.useInsertionEffect:!1,So=bo&&wo||sn,jo=typeof document<"u",bt=$.createContext(typeof HTMLElement<"u"?Yn({key:"css"}):null);bt.Provider;var Xn=function(t){return $.forwardRef(function(n,r){var o=$.useContext(bt);return t(n,o,r)})};jo||(Xn=function(t){return function(n){var r=$.useContext(bt);return r===null?(r=Yn({key:"css"}),$.createElement(bt.Provider,{value:r},t(n,r))):t(n,r)}});var ko=$.createContext({}),Dt=typeof document<"u";function Co(e,t,n){var r="";return n.split(" ").forEach(function(o){e[o]!==void 0?t.push(e[o]+";"):r+=o+" "}),r}var Kn=function(t,n,r){var o=t.key+"-"+n.name;(r===!1||Dt===!1&&t.compat!==void 0)&&t.registered[o]===void 0&&(t.registered[o]=n.styles)},Oo=function(t,n,r){Kn(t,n,r);var o=t.key+"-"+n.name;if(t.inserted[n.name]===void 0){var a="",i=n;do{var s=t.insert(n===i?"."+o:"",i,t.sheet,!0);!Dt&&s!==void 0&&(a+=s),i=i.next}while(i!==void 0);if(!Dt&&a.length!==0)return a}};function Ao(e){for(var t=0,n,r=0,o=e.length;o>=4;++r,o-=4)n=e.charCodeAt(r)&255|(e.charCodeAt(++r)&255)<<8|(e.charCodeAt(++r)&255)<<16|(e.charCodeAt(++r)&255)<<24,n=(n&65535)*1540483477+((n>>>16)*59797<<16),n^=n>>>24,t=(n&65535)*1540483477+((n>>>16)*59797<<16)^(t&65535)*1540483477+((t>>>16)*59797<<16);switch(o){case 3:t^=(e.charCodeAt(r+2)&255)<<16;case 2:t^=(e.charCodeAt(r+1)&255)<<8;case 1:t^=e.charCodeAt(r)&255,t=(t&65535)*1540483477+((t>>>16)*59797<<16)}return t^=t>>>13,t=(t&65535)*1540483477+((t>>>16)*59797<<16),((t^t>>>15)>>>0).toString(36)}var Po={animationIterationCount:1,borderImageOutset:1,borderImageSlice:1,borderImageWidth:1,boxFlex:1,boxFlexGroup:1,boxOrdinalGroup:1,columnCount:1,columns:1,flex:1,flexGrow:1,flexPositive:1,flexShrink:1,flexNegative:1,flexOrder:1,gridRow:1,gridRowEnd:1,gridRowSpan:1,gridRowStart:1,gridColumn:1,gridColumnEnd:1,gridColumnSpan:1,gridColumnStart:1,msGridRow:1,msGridRowSpan:1,msGridColumn:1,msGridColumnSpan:1,fontWeight:1,lineHeight:1,opacity:1,order:1,orphans:1,tabSize:1,widows:1,zIndex:1,zoom:1,WebkitLineClamp:1,fillOpacity:1,floodOpacity:1,stopOpacity:1,strokeDasharray:1,strokeDashoffset:1,strokeMiterlimit:1,strokeOpacity:1,strokeWidth:1},Eo=/[A-Z]|^ms/g,Mo=/_EMO_([^_]+?)_([^]*?)_EMO_/g,Zn=function(t){return t.charCodeAt(1)===45},cn=function(t){return t!=null&&typeof t!="boolean"},Et=Lt(function(e){return Zn(e)?e:e.replace(Eo,"-$&").toLowerCase()}),ln=function(t,n){switch(t){case"animation":case"animationName":if(typeof n=="string")return n.replace(Mo,function(r,o,a){return we={name:o,styles:a,next:we},o})}return Po[t]!==1&&!Zn(t)&&typeof n=="number"&&n!==0?n+"px":n};function rt(e,t,n){if(n==null)return"";if(n.__emotion_styles!==void 0)return n;switch(typeof n){case"boolean":return"";case"object":{if(n.anim===1)return we={name:n.name,styles:n.styles,next:we},n.name;if(n.styles!==void 0){var r=n.next;if(r!==void 0)for(;r!==void 0;)we={name:r.name,styles:r.styles,next:we},r=r.next;var o=n.styles+";";return o}return Ro(e,t,n)}case"function":{if(e!==void 0){var a=we,i=n(e);return we=a,rt(e,t,i)}break}}if(t==null)return n;var s=t[n];return s!==void 0?s:n}function Ro(e,t,n){var r="";if(Array.isArray(n))for(var o=0;o<n.length;o++)r+=rt(e,t,n[o])+";";else for(var a in n){var i=n[a];if(typeof i!="object")t!=null&&t[i]!==void 0?r+=a+"{"+t[i]+"}":cn(i)&&(r+=Et(a)+":"+ln(a,i)+";");else if(Array.isArray(i)&&typeof i[0]=="string"&&(t==null||t[i[0]]===void 0))for(var s=0;s<i.length;s++)cn(i[s])&&(r+=Et(a)+":"+ln(a,i[s])+";");else{var d=rt(e,t,i);switch(a){case"animation":case"animationName":{r+=Et(a)+":"+d+";";break}default:r+=a+"{"+d+"}"}}}return r}var dn=/label:\s*([^\s;\n{]+)\s*(;|$)/g,we,Io=function(t,n,r){if(t.length===1&&typeof t[0]=="object"&&t[0]!==null&&t[0].styles!==void 0)return t[0];var o=!0,a="";we=void 0;var i=t[0];i==null||i.raw===void 0?(o=!1,a+=rt(r,n,i)):a+=i[0];for(var s=1;s<t.length;s++)a+=rt(r,n,t[s]),o&&(a+=i[s]);dn.lastIndex=0;for(var d="",u;(u=dn.exec(a))!==null;)d+="-"+u[1];var c=Ao(a)+d;return{name:c,styles:a,next:we}},To=qr,Do=function(t){return t!=="theme"},un=function(t){return typeof t=="string"&&t.charCodeAt(0)>96?To:Do},fn=function(t,n,r){var o;if(n){var a=n.shouldForwardProp;o=t.__emotion_forwardProp&&a?function(i){return t.__emotion_forwardProp(i)&&a(i)}:a}return typeof o!="function"&&r&&(o=t.__emotion_forwardProp),o},No=typeof document<"u",$o=function(t){var n=t.cache,r=t.serialized,o=t.isStringTag;Kn(n,r,o);var a=So(function(){return Oo(n,r,o)});if(!No&&a!==void 0){for(var i,s=r.name,d=r.next;d!==void 0;)s+=" "+d.name,d=d.next;return $.createElement("style",(i={},i["data-emotion"]=n.key+" "+s,i.dangerouslySetInnerHTML={__html:a},i.nonce=n.sheet.nonce,i))}return null},Lo=function e(t,n){var r=t.__emotion_real===t,o=r&&t.__emotion_base||t,a,i;n!==void 0&&(a=n.label,i=n.target);var s=fn(t,n,r),d=s||un(o),u=!d("as");return function(){var c=arguments,p=r&&t.__emotion_styles!==void 0?t.__emotion_styles.slice(0):[];if(a!==void 0&&p.push("label:"+a+";"),c[0]==null||c[0].raw===void 0)p.push.apply(p,c);else{p.push(c[0][0]);for(var C=c.length,y=1;y<C;y++)p.push(c[y],c[0][y])}var b=Xn(function(v,S,k){var w=u&&v.as||o,j="",h=[],m=v;if(v.theme==null){m={};for(var f in v)m[f]=v[f];m.theme=$.useContext(ko)}typeof v.className=="string"?j=Co(S.registered,h,v.className):v.className!=null&&(j=v.className+" ");var x=Io(p.concat(h),S.registered,m);j+=S.key+"-"+x.name,i!==void 0&&(j+=" "+i);var O=u&&s===void 0?un(w):d,M={};for(var A in v)u&&A==="as"||O(A)&&(M[A]=v[A]);return M.className=j,M.ref=k,$.createElement($.Fragment,null,$.createElement($o,{cache:S,serialized:x,isStringTag:typeof w=="string"}),$.createElement(w,M))});return b.displayName=a!==void 0?a:"Styled("+(typeof o=="string"?o:o.displayName||o.name||"Component")+")",b.defaultProps=t.defaultProps,b.__emotion_real=b,b.__emotion_base=o,b.__emotion_styles=p,b.__emotion_forwardProp=s,Object.defineProperty(b,"toString",{value:function(){return"."+i}}),b.withComponent=function(v,S){return e(v,Rt({},n,S,{shouldForwardProp:fn(b,S,!0)})).apply(void 0,p)},b}},Bo=["a","abbr","address","area","article","aside","audio","b","base","bdi","bdo","big","blockquote","body","br","button","canvas","caption","cite","code","col","colgroup","data","datalist","dd","del","details","dfn","dialog","div","dl","dt","em","embed","fieldset","figcaption","figure","footer","form","h1","h2","h3","h4","h5","h6","head","header","hgroup","hr","html","i","iframe","img","input","ins","kbd","keygen","label","legend","li","link","main","map","mark","marquee","menu","menuitem","meta","meter","nav","noscript","object","ol","optgroup","option","output","p","param","picture","pre","progress","q","rp","rt","ruby","s","samp","script","section","select","small","source","span","strong","style","sub","summary","sup","table","tbody","td","textarea","tfoot","th","thead","time","title","tr","track","u","ul","var","video","wbr","circle","clipPath","defs","ellipse","foreignObject","g","image","line","linearGradient","mask","path","pattern","polygon","polyline","radialGradient","rect","stop","svg","text","tspan"],Y=Lo.bind();Bo.forEach(function(e){Y[e]=Y(e)});var _n={exports:{}};/*!
	Copyright (c) 2018 Jed Watson.
	Licensed under the MIT License (MIT), see
	http://jedwatson.github.io/classnames
*/(function(e){(function(){var t={}.hasOwnProperty;function n(){for(var r=[],o=0;o<arguments.length;o++){var a=arguments[o];if(a){var i=typeof a;if(i==="string"||i==="number")r.push(a);else if(Array.isArray(a)){if(a.length){var s=n.apply(null,a);s&&r.push(s)}}else if(i==="object"){if(a.toString!==Object.prototype.toString&&!a.toString.toString().includes("[native code]")){r.push(a.toString());continue}for(var d in a)t.call(a,d)&&a[d]&&r.push(d)}}}return r.join(" ")}e.exports?(n.default=n,e.exports=n):window.classNames=n})()})(_n);var q=_n.exports,Wo=g.createContext(void 0),zo=function(){var e=g.useContext(Wo);return e},Fo=function(e){var t=g.useState(!!e&&typeof window<"u"&&window.matchMedia(e).matches),n=t[0],r=t[1];return g.useEffect(function(){if(e){var o=window.matchMedia(e),a=function(){o.matches!==n&&r(o.matches)};return a(),o.addEventListener("change",a),function(){return o.removeEventListener("change",a)}}},[n,e]),n},H={root:"ps-sidebar-root",container:"ps-sidebar-container",image:"ps-sidebar-image",backdrop:"ps-sidebar-backdrop",collapsed:"ps-collapsed",toggled:"ps-toggled",rtl:"ps-rtl",broken:"ps-broken"},T={root:"ps-menu-root",menuItemRoot:"ps-menuitem-root",subMenuRoot:"ps-submenu-root",button:"ps-menu-button",prefix:"ps-menu-prefix",suffix:"ps-menu-suffix",label:"ps-menu-label",icon:"ps-menu-icon",subMenuContent:"ps-submenu-content",SubMenuExpandIcon:"ps-submenu-expand-icon",disabled:"ps-disabled",active:"ps-active",open:"ps-open"},Ho=Y.div(pn||(pn=Z([`
  position: fixed;
  top: 0px;
  right: 0px;
  bottom: 0px;
  left: 0px;
  z-index: 1;
  background-color: rgb(0, 0, 0, 0.3);
`],[`
  position: fixed;
  top: 0px;
  right: 0px;
  bottom: 0px;
  left: 0px;
  z-index: 1;
  background-color: rgb(0, 0, 0, 0.3);
`]))),pn,Uo={xs:"480px",sm:"576px",md:"768px",lg:"992px",xl:"1200px",xxl:"1600px",always:"always",all:"all"},Vo=Y.aside(vn||(vn=Z([`
  position: relative;
  border-right-width: 1px;
  border-right-style: solid;
  border-color: #efefef;

  transition: `,`;

  width: `,`;
  min-width: `,`;

  &.`,` {
    width: `,`;
    min-width: `,`;
  }

  &.`,` {
    direction: rtl;
    border-right-width: none;
    border-left-width: 1px;
    border-right-style: none;
    border-left-style: solid;
  }

  &.`,` {
    position: fixed;
    height: 100%;
    top: 0px;
    z-index: 100;

    `,`

    &.`,` {
      `,`
    }

    &.`,` {
      `,`
    }

    &.`,` {
      right: -`,`;

      &.`,` {
        right: -`,`;
      }

      &.`,` {
        right: 0;
      }
    }
  }

  `,`
`],[`
  position: relative;
  border-right-width: 1px;
  border-right-style: solid;
  border-color: #efefef;

  transition: `,`;

  width: `,`;
  min-width: `,`;

  &.`,` {
    width: `,`;
    min-width: `,`;
  }

  &.`,` {
    direction: rtl;
    border-right-width: none;
    border-left-width: 1px;
    border-right-style: none;
    border-left-style: solid;
  }

  &.`,` {
    position: fixed;
    height: 100%;
    top: 0px;
    z-index: 100;

    `,`

    &.`,` {
      `,`
    }

    &.`,` {
      `,`
    }

    &.`,` {
      right: -`,`;

      &.`,` {
        right: -`,`;
      }

      &.`,` {
        right: 0;
      }
    }
  }

  `,`
`])),function(e){var t=e.transitionDuration;return"width, left, right, ".concat(t,"ms")},function(e){var t=e.width;return t},function(e){var t=e.width;return t},H.collapsed,function(e){var t=e.collapsedWidth;return t},function(e){var t=e.collapsedWidth;return t},H.rtl,H.broken,function(e){var t=e.rtl,n=e.width;return t?"":"left: -".concat(n,";")},H.collapsed,function(e){var t=e.rtl,n=e.collapsedWidth;return t?"":"left: -".concat(n,"; ")},H.toggled,function(e){var t=e.rtl;return t?"":"left: 0;"},H.rtl,function(e){var t=e.width;return t},H.collapsed,function(e){var t=e.collapsedWidth;return t},H.toggled,function(e){var t=e.rootStyles;return t}),Go=Y.div(hn||(hn=Z([`
  position: relative;
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  z-index: 3;

  `,`
`],[`
  position: relative;
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  z-index: 3;

  `,`
`])),function(e){var t=e.backgroundColor;return t?"background-color:".concat(t,";"):""}),qo=Y.img(mn||(mn=Z([`
  &.`,` {
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center;
    position: absolute;
    left: 0;
    top: 0;
    z-index: 2;
  }
`],[`
  &.`,` {
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center;
    position: absolute;
    left: 0;
    top: 0;
    z-index: 2;
  }
`])),H.image),Ot=g.createContext({collapsed:!1,toggled:!1,rtl:!1,transitionDuration:300}),Yo=g.forwardRef(function(e,t){var n,r=e.collapsed,o=e.toggled,a=e.onBackdropClick,i=e.onBreakPoint,s=e.width,d=s===void 0?"250px":s,u=e.collapsedWidth,c=u===void 0?"80px":u,p=e.defaultCollapsed,C=e.className,y=e.children,b=e.breakPoint,v=e.customBreakPoint,S=e.backgroundColor,k=S===void 0?"rgb(249, 249, 249, 0.7)":S,w=e.transitionDuration,j=w===void 0?300:w,h=e.image,m=e.rtl,f=e.rootStyles,x=We(e,["collapsed","toggled","onBackdropClick","onBreakPoint","width","collapsedWidth","defaultCollapsed","className","children","breakPoint","customBreakPoint","backgroundColor","transitionDuration","image","rtl","rootStyles"]),O=function(){if(v)return"(max-width: ".concat(v,")");if(b)return["xs","sm","md","lg","xl","xxl"].includes(b)?"(max-width: ".concat(Uo[b],")"):b==="always"||b==="all"?(b==="always"&&console.warn('The "always" breakPoint is deprecated and will be removed in future release. Please use the "all" breakPoint instead.'),"screen"):"(max-width: ".concat(b,")")},M=g.useRef();M.current=function(oe){i==null||i(oe)};var A=Fo(O()),N=g.useState(!1),z=N[0],L=N[1],P=zo(),te=r??(!z&&p?!0:P==null?void 0:P.collapsed),U=o??(P==null?void 0:P.toggled),B=function(){a==null||a(),P==null||P.updateSidebarState({toggled:!1})};return g.useEffect(function(){var oe;(oe=M.current)===null||oe===void 0||oe.call(M,A)},[A]),g.useEffect(function(){P==null||P.updateSidebarState({broken:A,rtl:m,transitionDuration:j})},[A,P==null?void 0:P.updateSidebarState,m,j]),g.useEffect(function(){z||(P==null||P.updateSidebarState({collapsed:p}),L(!0))},[p,z,P==null?void 0:P.updateSidebarState]),g.createElement(Ot.Provider,{value:{collapsed:te,toggled:U,rtl:m,transitionDuration:j}},g.createElement(Vo,ne({ref:t,"data-testid":"".concat(H.root,"-test-id"),rtl:m,rootStyles:f,width:d,collapsedWidth:c,transitionDuration:j,className:q(H.root,(n={},n[H.collapsed]=te,n[H.toggled]=U,n[H.broken]=A,n[H.rtl]=m,n),C)},x),g.createElement(Go,{"data-testid":"".concat(H.container,"-test-id"),className:H.container,backgroundColor:k},y),h&&g.createElement(qo,{"data-testid":"".concat(H.image,"-test-id"),src:h,alt:"sidebar background",className:H.image}),A&&U&&g.createElement(Ho,{"data-testid":"".concat(H.backdrop,"-test-id"),role:"button",tabIndex:0,"aria-label":"backdrop",onClick:B,onKeyPress:B,className:H.backdrop})))}),vn,hn,mn,Qn=Y.ul(gn||(gn=Z([`
  list-style-type: none;
  padding: 0;
  margin: 0;
`],[`
  list-style-type: none;
  padding: 0;
  margin: 0;
`]))),gn,Xo=Y.nav(xn||(xn=Z([`
  &.`,` {
    `,`
  }
`],[`
  &.`,` {
    `,`
  }
`])),T.root,function(e){var t=e.rootStyles;return t}),Jn=g.createContext(void 0),wt=g.createContext(0),Ko=function(e,t){var n=e.children,r=e.className,o=e.transitionDuration,a=o===void 0?300:o,i=e.closeOnClick,s=i===void 0?!1:i,d=e.rootStyles,u=e.menuItemStyles,c=e.renderExpandIcon,p=We(e,["children","className","transitionDuration","closeOnClick","rootStyles","menuItemStyles","renderExpandIcon"]),C=g.useMemo(function(){return{transitionDuration:a,closeOnClick:s,menuItemStyles:u,renderExpandIcon:c}},[a,s,u,c]);return g.createElement(Jn.Provider,{value:C},g.createElement(wt.Provider,{value:0},g.createElement(Xo,ne({ref:t,className:q(T.root,r),rootStyles:d},p),g.createElement(Qn,null,n))))},Zo=g.forwardRef(Ko),xn,Ft=function(){var e=g.useContext(Jn);if(e===void 0)throw new Error("Menu Component is required!");return e},_o=Y.div(yn||(yn=Z([`
  height: 0px;
  overflow: hidden;
  z-index: 999;
  transition: height `,`ms;
  box-sizing: border-box;
  background-color: white;

  `,`

  `,`

  `,`;

  `,`;
`],[`
  height: 0px;
  overflow: hidden;
  z-index: 999;
  transition: height `,`ms;
  box-sizing: border-box;
  background-color: white;

  `,`

  `,`

  `,`;

  `,`;
`])),function(e){var t=e.transitionDuration;return t},function(e){var t=e.firstLevel,n=e.collapsed;return t&&n&&`
     background-color: white;
     box-shadow: 0 3px 6px -4px #0000001f, 0 6px 16px #00000014, 0 9px 28px 8px #0000000d;
     `},function(e){var t=e.defaultOpen;return t&&"height: auto;display: block;"},function(e){var t=e.collapsed,n=e.firstLevel,r=e.openWhenCollapsed;return t&&n?`
      position: fixed;
      padding-left: 0px;
      width: 200px;
      border-radius: 4px;
      height: auto!important;
      display: block!important;     
      transition: none!important;     
      visibility: `.concat(r?"visible":"hidden",`;
     `):`
      position: static!important;
      transform: none!important;
      `},function(e){var t=e.rootStyles;return t}),Qo=function(e,t){var n=e.children,r=e.open,o=e.openWhenCollapsed,a=e.firstLevel,i=e.collapsed,s=e.defaultOpen,d=We(e,["children","open","openWhenCollapsed","firstLevel","collapsed","defaultOpen"]),u=Ft().transitionDuration,c=g.useState(s)[0];return g.createElement(_o,ne({"data-testid":"".concat(T.subMenuContent,"-test-id"),ref:t,firstLevel:a,collapsed:i,open:r,openWhenCollapsed:o,transitionDuration:u,defaultOpen:c},d),g.createElement(Qn,null,n))},Jo=g.forwardRef(Qo),yn,er=Y.span(bn||(bn=Z([`
  flex-grow: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  `,`;
`],[`
  flex-grow: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  `,`;
`])),function(e){var t=e.rootStyles;return t}),bn,tr=Y.span(wn||(wn=Z([`
  width: 35px;
  min-width: 35px;
  height: 35px;
  line-height: 35px;
  text-align: center;
  display: inline-block;
  border-radius: 2px;
  display: flex;
  align-items: center;
  justify-content: center;

  `,`

  `,`;
`],[`
  width: 35px;
  min-width: 35px;
  height: 35px;
  line-height: 35px;
  text-align: center;
  display: inline-block;
  border-radius: 2px;
  display: flex;
  align-items: center;
  justify-content: center;

  `,`

  `,`;
`])),function(e){var t=e.rtl;return t?"margin-left: 10px;":"margin-right: 10px;"},function(e){var t=e.rootStyles;return t}),wn,nr=Y.span(Sn||(Sn=Z([`
  `,`
  opacity: `,`;
  transition: opacity `,`ms;

  `,`;
`],[`
  `,`
  opacity: `,`;
  transition: opacity `,`ms;

  `,`;
`])),function(e){var t=e.rtl;return t?"margin-left: 5px;":"margin-right: 5px;"},function(e){var t=e.firstLevel,n=e.collapsed;return t&&n?"0":"1"},function(e){var t=e.transitionDuration;return t},function(e){var t=e.rootStyles;return t}),Sn,rr=Y.span(jn||(jn=Z([`
  margin-right: 5px;
  margin-left: 5px;
  opacity: `,`;
  transition: opacity `,`ms;

  `,`;
`],[`
  margin-right: 5px;
  margin-left: 5px;
  opacity: `,`;
  transition: opacity `,`ms;

  `,`;
`])),function(e){var t=e.firstLevel,n=e.collapsed;return t&&n?"0":"1"},function(e){var t=e.transitionDuration;return t},function(e){var t=e.rootStyles;return t}),jn,ea=Y.span(kn||(kn=Z([`
  `,`

  `,`;
`],[`
  `,`

  `,`;
`])),function(e){var t=e.collapsed,n=e.level,r=e.rtl;return t&&n===0&&`
    position: absolute;
    `.concat(r?"left: 10px;":"right: 10px;",`
    top: 50%;
    transform: translateY(-50%);
    
    `)},function(e){var t=e.rootStyles;return t}),ta=Y.span(Cn||(Cn=Z([`
  display: inline-block;
  transition: transform 0.3s;
  `,`

  width: 5px;
  height: 5px;
  transform: rotate(`,`);
`],[`
  display: inline-block;
  transition: transform 0.3s;
  `,`

  width: 5px;
  height: 5px;
  transform: rotate(`,`);
`])),function(e){var t=e.rtl;return t?`
          border-left: 2px solid currentcolor;
          border-top: 2px solid currentcolor;
        `:` border-right: 2px solid currentcolor;
          border-bottom: 2px solid currentcolor;
        `},function(e){var t=e.open,n=e.rtl;return t?n?"-135deg":"45deg":"-45deg"}),na=Y.span(On||(On=Z([`
  width: 5px;
  height: 5px;
  background-color: currentcolor;
  border-radius: 50%;
  display: inline-block;
`],[`
  width: 5px;
  height: 5px;
  background-color: currentcolor;
  border-radius: 50%;
  display: inline-block;
`]))),kn,Cn,On,Q="top",de="bottom",ue="right",J="left",Ht="auto",st=[Q,de,ue,J],Ve="start",ot="end",ra="clippingParents",or="viewport",_e="popper",oa="reference",An=st.reduce(function(e,t){return e.concat([t+"-"+Ve,t+"-"+ot])},[]),ar=[].concat(st,[Ht]).reduce(function(e,t){return e.concat([t,t+"-"+Ve,t+"-"+ot])},[]),aa="beforeRead",ia="read",sa="afterRead",ca="beforeMain",la="main",da="afterMain",ua="beforeWrite",fa="write",pa="afterWrite",va=[aa,ia,sa,ca,la,da,ua,fa,pa];function ke(e){return e?(e.nodeName||"").toLowerCase():null}function fe(e){if(e==null)return window;if(e.toString()!=="[object Window]"){var t=e.ownerDocument;return t&&t.defaultView||window}return e}function ze(e){var t=fe(e).Element;return e instanceof t||e instanceof Element}function le(e){var t=fe(e).HTMLElement;return e instanceof t||e instanceof HTMLElement}function Ut(e){if(typeof ShadowRoot>"u")return!1;var t=fe(e).ShadowRoot;return e instanceof t||e instanceof ShadowRoot}function ha(e){var t=e.state;Object.keys(t.elements).forEach(function(n){var r=t.styles[n]||{},o=t.attributes[n]||{},a=t.elements[n];!le(a)||!ke(a)||(Object.assign(a.style,r),Object.keys(o).forEach(function(i){var s=o[i];s===!1?a.removeAttribute(i):a.setAttribute(i,s===!0?"":s)}))})}function ma(e){var t=e.state,n={popper:{position:t.options.strategy,left:"0",top:"0",margin:"0"},arrow:{position:"absolute"},reference:{}};return Object.assign(t.elements.popper.style,n.popper),t.styles=n,t.elements.arrow&&Object.assign(t.elements.arrow.style,n.arrow),function(){Object.keys(t.elements).forEach(function(r){var o=t.elements[r],a=t.attributes[r]||{},i=Object.keys(t.styles.hasOwnProperty(r)?t.styles[r]:n[r]),s=i.reduce(function(d,u){return d[u]="",d},{});!le(o)||!ke(o)||(Object.assign(o.style,s),Object.keys(a).forEach(function(d){o.removeAttribute(d)}))})}}var ga={name:"applyStyles",enabled:!0,phase:"write",fn:ha,effect:ma,requires:["computeStyles"]};function je(e){return e.split("-")[0]}var Be=Math.max,St=Math.min,Ge=Math.round;function Nt(){var e=navigator.userAgentData;return e!=null&&e.brands?e.brands.map(function(t){return t.brand+"/"+t.version}).join(" "):navigator.userAgent}function ir(){return!/^((?!chrome|android).)*safari/i.test(Nt())}function qe(e,t,n){t===void 0&&(t=!1),n===void 0&&(n=!1);var r=e.getBoundingClientRect(),o=1,a=1;t&&le(e)&&(o=e.offsetWidth>0&&Ge(r.width)/e.offsetWidth||1,a=e.offsetHeight>0&&Ge(r.height)/e.offsetHeight||1);var i=ze(e)?fe(e):window,s=i.visualViewport,d=!ir()&&n,u=(r.left+(d&&s?s.offsetLeft:0))/o,c=(r.top+(d&&s?s.offsetTop:0))/a,p=r.width/o,C=r.height/a;return{width:p,height:C,top:c,right:u+p,bottom:c+C,left:u,x:u,y:c}}function Vt(e){var t=qe(e),n=e.offsetWidth,r=e.offsetHeight;return Math.abs(t.width-n)<=1&&(n=t.width),Math.abs(t.height-r)<=1&&(r=t.height),{x:e.offsetLeft,y:e.offsetTop,width:n,height:r}}function sr(e,t){var n=t.getRootNode&&t.getRootNode();if(e.contains(t))return!0;if(n&&Ut(n)){var r=t;do{if(r&&e.isSameNode(r))return!0;r=r.parentNode||r.host}while(r)}return!1}function Oe(e){return fe(e).getComputedStyle(e)}function xa(e){return["table","td","th"].indexOf(ke(e))>=0}function Te(e){return((ze(e)?e.ownerDocument:e.document)||window.document).documentElement}function At(e){return ke(e)==="html"?e:e.assignedSlot||e.parentNode||(Ut(e)?e.host:null)||Te(e)}function Pn(e){return!le(e)||Oe(e).position==="fixed"?null:e.offsetParent}function ya(e){var t=/firefox/i.test(Nt()),n=/Trident/i.test(Nt());if(n&&le(e)){var r=Oe(e);if(r.position==="fixed")return null}var o=At(e);for(Ut(o)&&(o=o.host);le(o)&&["html","body"].indexOf(ke(o))<0;){var a=Oe(o);if(a.transform!=="none"||a.perspective!=="none"||a.contain==="paint"||["transform","perspective"].indexOf(a.willChange)!==-1||t&&a.willChange==="filter"||t&&a.filter&&a.filter!=="none")return o;o=o.parentNode}return null}function ct(e){for(var t=fe(e),n=Pn(e);n&&xa(n)&&Oe(n).position==="static";)n=Pn(n);return n&&(ke(n)==="html"||ke(n)==="body"&&Oe(n).position==="static")?t:n||ya(e)||t}function Gt(e){return["top","bottom"].indexOf(e)>=0?"x":"y"}function Je(e,t,n){return Be(e,St(t,n))}function ba(e,t,n){var r=Je(e,t,n);return r>n?n:r}function cr(){return{top:0,right:0,bottom:0,left:0}}function lr(e){return Object.assign({},cr(),e)}function dr(e,t){return t.reduce(function(n,r){return n[r]=e,n},{})}var wa=function(t,n){return t=typeof t=="function"?t(Object.assign({},n.rects,{placement:n.placement})):t,lr(typeof t!="number"?t:dr(t,st))};function Sa(e){var t,n=e.state,r=e.name,o=e.options,a=n.elements.arrow,i=n.modifiersData.popperOffsets,s=je(n.placement),d=Gt(s),u=[J,ue].indexOf(s)>=0,c=u?"height":"width";if(!(!a||!i)){var p=wa(o.padding,n),C=Vt(a),y=d==="y"?Q:J,b=d==="y"?de:ue,v=n.rects.reference[c]+n.rects.reference[d]-i[d]-n.rects.popper[c],S=i[d]-n.rects.reference[d],k=ct(a),w=k?d==="y"?k.clientHeight||0:k.clientWidth||0:0,j=v/2-S/2,h=p[y],m=w-C[c]-p[b],f=w/2-C[c]/2+j,x=Je(h,f,m),O=d;n.modifiersData[r]=(t={},t[O]=x,t.centerOffset=x-f,t)}}function ja(e){var t=e.state,n=e.options,r=n.element,o=r===void 0?"[data-popper-arrow]":r;o!=null&&(typeof o=="string"&&(o=t.elements.popper.querySelector(o),!o)||sr(t.elements.popper,o)&&(t.elements.arrow=o))}var ka={name:"arrow",enabled:!0,phase:"main",fn:Sa,effect:ja,requires:["popperOffsets"],requiresIfExists:["preventOverflow"]};function Ye(e){return e.split("-")[1]}var Ca={top:"auto",right:"auto",bottom:"auto",left:"auto"};function Oa(e){var t=e.x,n=e.y,r=window,o=r.devicePixelRatio||1;return{x:Ge(t*o)/o||0,y:Ge(n*o)/o||0}}function En(e){var t,n=e.popper,r=e.popperRect,o=e.placement,a=e.variation,i=e.offsets,s=e.position,d=e.gpuAcceleration,u=e.adaptive,c=e.roundOffsets,p=e.isFixed,C=i.x,y=C===void 0?0:C,b=i.y,v=b===void 0?0:b,S=typeof c=="function"?c({x:y,y:v}):{x:y,y:v};y=S.x,v=S.y;var k=i.hasOwnProperty("x"),w=i.hasOwnProperty("y"),j=J,h=Q,m=window;if(u){var f=ct(n),x="clientHeight",O="clientWidth";if(f===fe(n)&&(f=Te(n),Oe(f).position!=="static"&&s==="absolute"&&(x="scrollHeight",O="scrollWidth")),f=f,o===Q||(o===J||o===ue)&&a===ot){h=de;var M=p&&f===m&&m.visualViewport?m.visualViewport.height:f[x];v-=M-r.height,v*=d?1:-1}if(o===J||(o===Q||o===de)&&a===ot){j=ue;var A=p&&f===m&&m.visualViewport?m.visualViewport.width:f[O];y-=A-r.width,y*=d?1:-1}}var N=Object.assign({position:s},u&&Ca),z=c===!0?Oa({x:y,y:v}):{x:y,y:v};if(y=z.x,v=z.y,d){var L;return Object.assign({},N,(L={},L[h]=w?"0":"",L[j]=k?"0":"",L.transform=(m.devicePixelRatio||1)<=1?"translate("+y+"px, "+v+"px)":"translate3d("+y+"px, "+v+"px, 0)",L))}return Object.assign({},N,(t={},t[h]=w?v+"px":"",t[j]=k?y+"px":"",t.transform="",t))}function Aa(e){var t=e.state,n=e.options,r=n.gpuAcceleration,o=r===void 0?!0:r,a=n.adaptive,i=a===void 0?!0:a,s=n.roundOffsets,d=s===void 0?!0:s,u={placement:je(t.placement),variation:Ye(t.placement),popper:t.elements.popper,popperRect:t.rects.popper,gpuAcceleration:o,isFixed:t.options.strategy==="fixed"};t.modifiersData.popperOffsets!=null&&(t.styles.popper=Object.assign({},t.styles.popper,En(Object.assign({},u,{offsets:t.modifiersData.popperOffsets,position:t.options.strategy,adaptive:i,roundOffsets:d})))),t.modifiersData.arrow!=null&&(t.styles.arrow=Object.assign({},t.styles.arrow,En(Object.assign({},u,{offsets:t.modifiersData.arrow,position:"absolute",adaptive:!1,roundOffsets:d})))),t.attributes.popper=Object.assign({},t.attributes.popper,{"data-popper-placement":t.placement})}var Pa={name:"computeStyles",enabled:!0,phase:"beforeWrite",fn:Aa,data:{}},pt={passive:!0};function Ea(e){var t=e.state,n=e.instance,r=e.options,o=r.scroll,a=o===void 0?!0:o,i=r.resize,s=i===void 0?!0:i,d=fe(t.elements.popper),u=[].concat(t.scrollParents.reference,t.scrollParents.popper);return a&&u.forEach(function(c){c.addEventListener("scroll",n.update,pt)}),s&&d.addEventListener("resize",n.update,pt),function(){a&&u.forEach(function(c){c.removeEventListener("scroll",n.update,pt)}),s&&d.removeEventListener("resize",n.update,pt)}}var Ma={name:"eventListeners",enabled:!0,phase:"write",fn:function(){},effect:Ea,data:{}},Ra={left:"right",right:"left",bottom:"top",top:"bottom"};function xt(e){return e.replace(/left|right|bottom|top/g,function(t){return Ra[t]})}var Ia={start:"end",end:"start"};function Mn(e){return e.replace(/start|end/g,function(t){return Ia[t]})}function qt(e){var t=fe(e),n=t.pageXOffset,r=t.pageYOffset;return{scrollLeft:n,scrollTop:r}}function Yt(e){return qe(Te(e)).left+qt(e).scrollLeft}function Ta(e,t){var n=fe(e),r=Te(e),o=n.visualViewport,a=r.clientWidth,i=r.clientHeight,s=0,d=0;if(o){a=o.width,i=o.height;var u=ir();(u||!u&&t==="fixed")&&(s=o.offsetLeft,d=o.offsetTop)}return{width:a,height:i,x:s+Yt(e),y:d}}function Da(e){var t,n=Te(e),r=qt(e),o=(t=e.ownerDocument)==null?void 0:t.body,a=Be(n.scrollWidth,n.clientWidth,o?o.scrollWidth:0,o?o.clientWidth:0),i=Be(n.scrollHeight,n.clientHeight,o?o.scrollHeight:0,o?o.clientHeight:0),s=-r.scrollLeft+Yt(e),d=-r.scrollTop;return Oe(o||n).direction==="rtl"&&(s+=Be(n.clientWidth,o?o.clientWidth:0)-a),{width:a,height:i,x:s,y:d}}function Xt(e){var t=Oe(e),n=t.overflow,r=t.overflowX,o=t.overflowY;return/auto|scroll|overlay|hidden/.test(n+o+r)}function ur(e){return["html","body","#document"].indexOf(ke(e))>=0?e.ownerDocument.body:le(e)&&Xt(e)?e:ur(At(e))}function et(e,t){var n;t===void 0&&(t=[]);var r=ur(e),o=r===((n=e.ownerDocument)==null?void 0:n.body),a=fe(r),i=o?[a].concat(a.visualViewport||[],Xt(r)?r:[]):r,s=t.concat(i);return o?s:s.concat(et(At(i)))}function $t(e){return Object.assign({},e,{left:e.x,top:e.y,right:e.x+e.width,bottom:e.y+e.height})}function Na(e,t){var n=qe(e,!1,t==="fixed");return n.top=n.top+e.clientTop,n.left=n.left+e.clientLeft,n.bottom=n.top+e.clientHeight,n.right=n.left+e.clientWidth,n.width=e.clientWidth,n.height=e.clientHeight,n.x=n.left,n.y=n.top,n}function Rn(e,t,n){return t===or?$t(Ta(e,n)):ze(t)?Na(t,n):$t(Da(Te(e)))}function $a(e){var t=et(At(e)),n=["absolute","fixed"].indexOf(Oe(e).position)>=0,r=n&&le(e)?ct(e):e;return ze(r)?t.filter(function(o){return ze(o)&&sr(o,r)&&ke(o)!=="body"}):[]}function La(e,t,n,r){var o=t==="clippingParents"?$a(e):[].concat(t),a=[].concat(o,[n]),i=a[0],s=a.reduce(function(d,u){var c=Rn(e,u,r);return d.top=Be(c.top,d.top),d.right=St(c.right,d.right),d.bottom=St(c.bottom,d.bottom),d.left=Be(c.left,d.left),d},Rn(e,i,r));return s.width=s.right-s.left,s.height=s.bottom-s.top,s.x=s.left,s.y=s.top,s}function fr(e){var t=e.reference,n=e.element,r=e.placement,o=r?je(r):null,a=r?Ye(r):null,i=t.x+t.width/2-n.width/2,s=t.y+t.height/2-n.height/2,d;switch(o){case Q:d={x:i,y:t.y-n.height};break;case de:d={x:i,y:t.y+t.height};break;case ue:d={x:t.x+t.width,y:s};break;case J:d={x:t.x-n.width,y:s};break;default:d={x:t.x,y:t.y}}var u=o?Gt(o):null;if(u!=null){var c=u==="y"?"height":"width";switch(a){case Ve:d[u]=d[u]-(t[c]/2-n[c]/2);break;case ot:d[u]=d[u]+(t[c]/2-n[c]/2);break}}return d}function at(e,t){t===void 0&&(t={});var n=t,r=n.placement,o=r===void 0?e.placement:r,a=n.strategy,i=a===void 0?e.strategy:a,s=n.boundary,d=s===void 0?ra:s,u=n.rootBoundary,c=u===void 0?or:u,p=n.elementContext,C=p===void 0?_e:p,y=n.altBoundary,b=y===void 0?!1:y,v=n.padding,S=v===void 0?0:v,k=lr(typeof S!="number"?S:dr(S,st)),w=C===_e?oa:_e,j=e.rects.popper,h=e.elements[b?w:C],m=La(ze(h)?h:h.contextElement||Te(e.elements.popper),d,c,i),f=qe(e.elements.reference),x=fr({reference:f,element:j,placement:o}),O=$t(Object.assign({},j,x)),M=C===_e?O:f,A={top:m.top-M.top+k.top,bottom:M.bottom-m.bottom+k.bottom,left:m.left-M.left+k.left,right:M.right-m.right+k.right},N=e.modifiersData.offset;if(C===_e&&N){var z=N[o];Object.keys(A).forEach(function(L){var P=[ue,de].indexOf(L)>=0?1:-1,te=[Q,de].indexOf(L)>=0?"y":"x";A[L]+=z[te]*P})}return A}function Ba(e,t){t===void 0&&(t={});var n=t,r=n.placement,o=n.boundary,a=n.rootBoundary,i=n.padding,s=n.flipVariations,d=n.allowedAutoPlacements,u=d===void 0?ar:d,c=Ye(r),p=c?s?An:An.filter(function(b){return Ye(b)===c}):st,C=p.filter(function(b){return u.indexOf(b)>=0});C.length===0&&(C=p);var y=C.reduce(function(b,v){return b[v]=at(e,{placement:v,boundary:o,rootBoundary:a,padding:i})[je(v)],b},{});return Object.keys(y).sort(function(b,v){return y[b]-y[v]})}function Wa(e){if(je(e)===Ht)return[];var t=xt(e);return[Mn(e),t,Mn(t)]}function za(e){var t=e.state,n=e.options,r=e.name;if(!t.modifiersData[r]._skip){for(var o=n.mainAxis,a=o===void 0?!0:o,i=n.altAxis,s=i===void 0?!0:i,d=n.fallbackPlacements,u=n.padding,c=n.boundary,p=n.rootBoundary,C=n.altBoundary,y=n.flipVariations,b=y===void 0?!0:y,v=n.allowedAutoPlacements,S=t.options.placement,k=je(S),w=k===S,j=d||(w||!b?[xt(S)]:Wa(S)),h=[S].concat(j).reduce(function(Ee,ae){return Ee.concat(je(ae)===Ht?Ba(t,{placement:ae,boundary:c,rootBoundary:p,padding:u,flipVariations:b,allowedAutoPlacements:v}):ae)},[]),m=t.rects.reference,f=t.rects.popper,x=new Map,O=!0,M=h[0],A=0;A<h.length;A++){var N=h[A],z=je(N),L=Ye(N)===Ve,P=[Q,de].indexOf(z)>=0,te=P?"width":"height",U=at(t,{placement:N,boundary:c,rootBoundary:p,altBoundary:C,padding:u}),B=P?L?ue:J:L?de:Q;m[te]>f[te]&&(B=xt(B));var oe=xt(B),he=[];if(a&&he.push(U[z]<=0),s&&he.push(U[B]<=0,U[oe]<=0),he.every(function(Ee){return Ee})){M=N,O=!1;break}x.set(N,he)}if(O)for(var Ce=b?3:1,Ae=function(ae){var pe=h.find(function(Me){var ie=x.get(Me);if(ie)return ie.slice(0,ae).every(function(Ne){return Ne})});if(pe)return M=pe,"break"},Pe=Ce;Pe>0;Pe--){var De=Ae(Pe);if(De==="break")break}t.placement!==M&&(t.modifiersData[r]._skip=!0,t.placement=M,t.reset=!0)}}var Fa={name:"flip",enabled:!0,phase:"main",fn:za,requiresIfExists:["offset"],data:{_skip:!1}};function In(e,t,n){return n===void 0&&(n={x:0,y:0}),{top:e.top-t.height-n.y,right:e.right-t.width+n.x,bottom:e.bottom-t.height+n.y,left:e.left-t.width-n.x}}function Tn(e){return[Q,ue,de,J].some(function(t){return e[t]>=0})}function Ha(e){var t=e.state,n=e.name,r=t.rects.reference,o=t.rects.popper,a=t.modifiersData.preventOverflow,i=at(t,{elementContext:"reference"}),s=at(t,{altBoundary:!0}),d=In(i,r),u=In(s,o,a),c=Tn(d),p=Tn(u);t.modifiersData[n]={referenceClippingOffsets:d,popperEscapeOffsets:u,isReferenceHidden:c,hasPopperEscaped:p},t.attributes.popper=Object.assign({},t.attributes.popper,{"data-popper-reference-hidden":c,"data-popper-escaped":p})}var Ua={name:"hide",enabled:!0,phase:"main",requiresIfExists:["preventOverflow"],fn:Ha};function Va(e,t,n){var r=je(e),o=[J,Q].indexOf(r)>=0?-1:1,a=typeof n=="function"?n(Object.assign({},t,{placement:e})):n,i=a[0],s=a[1];return i=i||0,s=(s||0)*o,[J,ue].indexOf(r)>=0?{x:s,y:i}:{x:i,y:s}}function Ga(e){var t=e.state,n=e.options,r=e.name,o=n.offset,a=o===void 0?[0,0]:o,i=ar.reduce(function(c,p){return c[p]=Va(p,t.rects,a),c},{}),s=i[t.placement],d=s.x,u=s.y;t.modifiersData.popperOffsets!=null&&(t.modifiersData.popperOffsets.x+=d,t.modifiersData.popperOffsets.y+=u),t.modifiersData[r]=i}var qa={name:"offset",enabled:!0,phase:"main",requires:["popperOffsets"],fn:Ga};function Ya(e){var t=e.state,n=e.name;t.modifiersData[n]=fr({reference:t.rects.reference,element:t.rects.popper,placement:t.placement})}var Xa={name:"popperOffsets",enabled:!0,phase:"read",fn:Ya,data:{}};function Ka(e){return e==="x"?"y":"x"}function Za(e){var t=e.state,n=e.options,r=e.name,o=n.mainAxis,a=o===void 0?!0:o,i=n.altAxis,s=i===void 0?!1:i,d=n.boundary,u=n.rootBoundary,c=n.altBoundary,p=n.padding,C=n.tether,y=C===void 0?!0:C,b=n.tetherOffset,v=b===void 0?0:b,S=at(t,{boundary:d,rootBoundary:u,padding:p,altBoundary:c}),k=je(t.placement),w=Ye(t.placement),j=!w,h=Gt(k),m=Ka(h),f=t.modifiersData.popperOffsets,x=t.rects.reference,O=t.rects.popper,M=typeof v=="function"?v(Object.assign({},t.rects,{placement:t.placement})):v,A=typeof M=="number"?{mainAxis:M,altAxis:M}:Object.assign({mainAxis:0,altAxis:0},M),N=t.modifiersData.offset?t.modifiersData.offset[t.placement]:null,z={x:0,y:0};if(f){if(a){var L,P=h==="y"?Q:J,te=h==="y"?de:ue,U=h==="y"?"height":"width",B=f[h],oe=B+S[P],he=B-S[te],Ce=y?-O[U]/2:0,Ae=w===Ve?x[U]:O[U],Pe=w===Ve?-O[U]:-x[U],De=t.elements.arrow,Ee=y&&De?Vt(De):{width:0,height:0},ae=t.modifiersData["arrow#persistent"]?t.modifiersData["arrow#persistent"].padding:cr(),pe=ae[P],Me=ae[te],ie=Je(0,x[U],Ee[U]),Ne=j?x[U]/2-Ce-ie-pe-A.mainAxis:Ae-ie-pe-A.mainAxis,dt=j?-x[U]/2+Ce+ie+Me+A.mainAxis:Pe+ie+Me+A.mainAxis,Fe=t.elements.arrow&&ct(t.elements.arrow),Pt=Fe?h==="y"?Fe.clientTop||0:Fe.clientLeft||0:0,ut=(L=N==null?void 0:N[h])!=null?L:0,me=B+Ne-ut-Pt,ge=B+dt-ut,V=Je(y?St(oe,me):oe,B,y?Be(he,ge):he);f[h]=V,z[h]=V-B}if(s){var R,se=h==="x"?Q:J,Re=h==="x"?de:ue,F=f[m],ce=m==="y"?"height":"width",xe=F+S[se],ye=F-S[Re],$e=[Q,J].indexOf(k)!==-1,He=(R=N==null?void 0:N[m])!=null?R:0,Kt=$e?xe:F-x[ce]-O[ce]-He+A.altAxis,Zt=$e?F+x[ce]+O[ce]-He-A.altAxis:ye,_t=y&&$e?ba(Kt,F,Zt):Je(y?Kt:xe,F,y?Zt:ye);f[m]=_t,z[m]=_t-F}t.modifiersData[r]=z}}var _a={name:"preventOverflow",enabled:!0,phase:"main",fn:Za,requiresIfExists:["offset"]};function Qa(e){return{scrollLeft:e.scrollLeft,scrollTop:e.scrollTop}}function Ja(e){return e===fe(e)||!le(e)?qt(e):Qa(e)}function ei(e){var t=e.getBoundingClientRect(),n=Ge(t.width)/e.offsetWidth||1,r=Ge(t.height)/e.offsetHeight||1;return n!==1||r!==1}function ti(e,t,n){n===void 0&&(n=!1);var r=le(t),o=le(t)&&ei(t),a=Te(t),i=qe(e,o,n),s={scrollLeft:0,scrollTop:0},d={x:0,y:0};return(r||!r&&!n)&&((ke(t)!=="body"||Xt(a))&&(s=Ja(t)),le(t)?(d=qe(t,!0),d.x+=t.clientLeft,d.y+=t.clientTop):a&&(d.x=Yt(a))),{x:i.left+s.scrollLeft-d.x,y:i.top+s.scrollTop-d.y,width:i.width,height:i.height}}function ni(e){var t=new Map,n=new Set,r=[];e.forEach(function(a){t.set(a.name,a)});function o(a){n.add(a.name);var i=[].concat(a.requires||[],a.requiresIfExists||[]);i.forEach(function(s){if(!n.has(s)){var d=t.get(s);d&&o(d)}}),r.push(a)}return e.forEach(function(a){n.has(a.name)||o(a)}),r}function ri(e){var t=ni(e);return va.reduce(function(n,r){return n.concat(t.filter(function(o){return o.phase===r}))},[])}function oi(e){var t;return function(){return t||(t=new Promise(function(n){Promise.resolve().then(function(){t=void 0,n(e())})})),t}}function ai(e){var t=e.reduce(function(n,r){var o=n[r.name];return n[r.name]=o?Object.assign({},o,r,{options:Object.assign({},o.options,r.options),data:Object.assign({},o.data,r.data)}):r,n},{});return Object.keys(t).map(function(n){return t[n]})}var Dn={placement:"bottom",modifiers:[],strategy:"absolute"};function Nn(){for(var e=arguments.length,t=new Array(e),n=0;n<e;n++)t[n]=arguments[n];return!t.some(function(r){return!(r&&typeof r.getBoundingClientRect=="function")})}function ii(e){e===void 0&&(e={});var t=e,n=t.defaultModifiers,r=n===void 0?[]:n,o=t.defaultOptions,a=o===void 0?Dn:o;return function(s,d,u){u===void 0&&(u=a);var c={placement:"bottom",orderedModifiers:[],options:Object.assign({},Dn,a),modifiersData:{},elements:{reference:s,popper:d},attributes:{},styles:{}},p=[],C=!1,y={state:c,setOptions:function(k){var w=typeof k=="function"?k(c.options):k;v(),c.options=Object.assign({},a,c.options,w),c.scrollParents={reference:ze(s)?et(s):s.contextElement?et(s.contextElement):[],popper:et(d)};var j=ri(ai([].concat(r,c.options.modifiers)));return c.orderedModifiers=j.filter(function(h){return h.enabled}),b(),y.update()},forceUpdate:function(){if(!C){var k=c.elements,w=k.reference,j=k.popper;if(Nn(w,j)){c.rects={reference:ti(w,ct(j),c.options.strategy==="fixed"),popper:Vt(j)},c.reset=!1,c.placement=c.options.placement,c.orderedModifiers.forEach(function(A){return c.modifiersData[A.name]=Object.assign({},A.data)});for(var h=0;h<c.orderedModifiers.length;h++){if(c.reset===!0){c.reset=!1,h=-1;continue}var m=c.orderedModifiers[h],f=m.fn,x=m.options,O=x===void 0?{}:x,M=m.name;typeof f=="function"&&(c=f({state:c,options:O,name:M,instance:y})||c)}}}},update:oi(function(){return new Promise(function(S){y.forceUpdate(),S(c)})}),destroy:function(){v(),C=!0}};if(!Nn(s,d))return y;y.setOptions(u).then(function(S){!C&&u.onFirstUpdate&&u.onFirstUpdate(S)});function b(){c.orderedModifiers.forEach(function(S){var k=S.name,w=S.options,j=w===void 0?{}:w,h=S.effect;if(typeof h=="function"){var m=h({state:c,name:k,instance:y,options:j}),f=function(){};p.push(m||f)}})}function v(){p.forEach(function(S){return S()}),p=[]}return y}}var si=[Ma,Xa,Pa,ga,qa,Fa,_a,ka,Ua],ci=ii({defaultModifiers:si}),li=function(e){var t=e.level,n=e.buttonRef,r=e.contentRef,o=g.useContext(Ot),a=o.collapsed,i=o.toggled,s=o.transitionDuration,d=g.useRef();return g.useEffect(function(){return t===0&&a&&r.current&&n.current&&(d.current=ci(n.current,r.current,{placement:"right",strategy:"fixed",modifiers:[{name:"offset",options:{offset:[0,5]}}]})),function(){var u;return(u=d.current)===null||u===void 0?void 0:u.destroy()}},[t,a,r,n]),g.useEffect(function(){if(r.current&&n.current){var u=new ResizeObserver(function(){var c;(c=d.current)===null||c===void 0||c.update()});u.observe(r.current),u.observe(n.current)}setTimeout(function(){var c;(c=d.current)===null||c===void 0||c.update()},s)},[s,i,r,n]),{popperInstance:d.current}},pr=function(e){var t=e.rtl,n=e.level,r=e.collapsed,o=e.disabled,a=e.active;return`
    display: flex;
    align-items: center;
    height: 50px;
    text-decoration: none;
    color: inherit;
    box-sizing: border-box;
    cursor: pointer;

    `.concat(t?`padding-left: 20px;
           padding-right: `.concat(n===0?20:(r?n:n+1)*20,`px;
            `):`padding-right: 20px;
           padding-left: `.concat(n===0?20:(r?n:n+1)*20,`px;
           `),`

    &:hover {
      background-color: #f3f3f3;
    }

    `).concat(o&&` 
      pointer-events: none;
      cursor: default;
      color:#adadad;
        `,`

    `).concat(a&&"background-color: #e2eef9;",`
  
  `)},di=function(e,t){var n=e.className,r=e.component,o=e.children,a=We(e,["className","component","children"]);if(r){if(typeof r=="string")return g.createElement(r,ne(ne({className:q(n)},a),{ref:t}),o);var i=r.props,s=i.className,d=We(i,["className"]);return g.cloneElement(r,ne(ne(ne({className:q(n,s)},a),d),{ref:t}),o)}else return g.createElement("a",ne({ref:t,className:q(n)},a),o)},vr=g.forwardRef(di),ui=Y.li($n||($n=Z([`
  position: relative;
  width: 100%;

  `,`;

  `,`;

  > .`,` {
    `,`;

    `,`;
  }
`],[`
  position: relative;
  width: 100%;

  `,`;

  `,`;

  > .`,` {
    `,`;

    `,`;
  }
`])),function(e){var t=e.menuItemStyles;return t},function(e){var t=e.rootStyles;return t},T.button,function(e){var t=e.level,n=e.disabled,r=e.active,o=e.collapsed,a=e.rtl;return pr({level:t,disabled:n,active:r,collapsed:o,rtl:a})},function(e){var t=e.buttonStyles;return t}),fi=function(e,t){var n,r=e.children,o=e.className,a=e.label,i=e.icon,s=e.title,d=e.prefix,u=e.suffix,c=e.open,p=e.defaultOpen,C=e.active,y=C===void 0?!1:C,b=e.disabled,v=b===void 0?!1:b,S=e.rootStyles,k=e.component,w=e.onOpenChange,j=e.onClick,h=e.onKeyUp,m=We(e,["children","className","label","icon","title","prefix","suffix","open","defaultOpen","active","disabled","rootStyles","component","onOpenChange","onClick","onKeyUp"]),f=g.useContext(wt),x=g.useContext(Ot),O=x.collapsed,M=x.rtl,A=x.transitionDuration,N=Ft(),z=N.renderExpandIcon,L=N.closeOnClick,P=N.menuItemStyles,te=N.transitionDuration,U=g.useState(!!p),B=U[0],oe=U[1],he=g.useState(!1),Ce=he[0],Ae=he[1],Pe=g.useState(!1),De=Pe[0],Ee=Pe[1],ae=g.useRef(null),pe=g.useRef(null),Me=g.useRef(),ie=li({level:f,buttonRef:ae,contentRef:pe}).popperInstance,Ne=g.useCallback(function(){var V,R=pe.current;if(R){var se=(V=R==null?void 0:R.querySelector(".".concat(T.subMenuContent," > ul")))===null||V===void 0?void 0:V.clientHeight;R.style.overflow="hidden",R.style.height="".concat(se,"px"),Me.current=setTimeout(function(){R.style.overflow="auto",R.style.height="auto"},te)}},[te]),dt=function(){var V,R=pe.current;if(R){var se=(V=R==null?void 0:R.querySelector(".".concat(T.subMenuContent," > ul")))===null||V===void 0?void 0:V.clientHeight;R.style.overflow="hidden",R.style.height="".concat(se,"px"),R.offsetHeight,R.style.height="0px"}},Fe=function(){f===0&&O||(typeof c>"u"?(clearTimeout(Number(Me.current)),B?dt():Ne(),w==null||w(!B),oe(!B)):w==null||w(!c))};g.useEffect(function(){!(f===0&&O)&&typeof c<"u"&&De&&(clearTimeout(Number(Me.current)),c?Ne():dt())},[O,Ne,a,f,w,c]);var Pt=function(V){j==null||j(V),Fe()},ut=function(V){h==null||h(V),V.key==="Enter"&&Fe()},me=function(V){if(P){var R={level:f,disabled:v,active:y,isSubmenu:!0,open:c??B},se=P.root,Re=P.button,F=P.label,ce=P.icon,xe=P.prefix,ye=P.suffix,$e=P.subMenuContent,He=P.SubMenuExpandIcon;switch(V){case"root":return typeof se=="function"?se(R):se;case"button":return typeof Re=="function"?Re(R):Re;case"label":return typeof F=="function"?F(R):F;case"icon":return typeof ce=="function"?ce(R):ce;case"prefix":return typeof xe=="function"?xe(R):xe;case"suffix":return typeof ye=="function"?ye(R):ye;case"SubMenuExpandIcon":return typeof He=="function"?He(R):He;case"subMenuContent":return typeof $e=="function"?$e(R):$e;default:return}}};g.useEffect(function(){setTimeout(function(){return ie==null?void 0:ie.update()},A),O&&f===0&&Ae(!1)},[O,f,M,A,ie]),g.useEffect(function(){var V=function(F){var ce,xe,ye;!Ce&&(!((ce=ae.current)===null||ce===void 0)&&ce.contains(F))?Ae(!0):(L&&!(!((xe=F.closest(".".concat(T.menuItemRoot)))===null||xe===void 0)&&xe.classList.contains(T.subMenuRoot))||!(!((ye=pe.current)===null||ye===void 0)&&ye.contains(F))&&Ce)&&Ae(!1)},R=function(F){V(F.target)},se=function(F){F.key==="Enter"?V(F.target):F.key==="Escape"&&Ae(!1)},Re=function(){document.removeEventListener("click",R),document.removeEventListener("keyup",se)};return Re(),O&&f===0&&(document.addEventListener("click",R,!1),document.addEventListener("keyup",se,!1)),function(){Re()}},[O,f,L,Ce]),g.useEffect(function(){Ee(!0)},[]);var ge=(n={},n[T.active]=y,n[T.disabled]=v,n[T.open]=c??B,n);return g.createElement(ui,{ref:t,className:q(T.menuItemRoot,T.subMenuRoot,ge,o),menuItemStyles:me("root"),level:f,collapsed:O,rtl:M,disabled:v,active:y,buttonStyles:me("button"),rootStyles:S},g.createElement(vr,ne({"data-testid":"".concat(T.button,"-test-id"),ref:ae,title:s,className:q(T.button,ge),onClick:Pt,onKeyUp:ut,component:k,tabIndex:0},m),i&&g.createElement(tr,{rtl:M,className:q(T.icon,ge),rootStyles:me("icon")},i),d&&g.createElement(nr,{collapsed:O,transitionDuration:A,firstLevel:f===0,className:q(T.prefix,ge),rtl:M,rootStyles:me("prefix")},d),g.createElement(er,{className:q(T.label,ge),rootStyles:me("label")},a),u&&g.createElement(rr,{collapsed:O,transitionDuration:A,firstLevel:f===0,className:q(T.suffix,ge),rootStyles:me("suffix")},u),g.createElement(ea,{rtl:M,className:q(T.SubMenuExpandIcon,ge),collapsed:O,level:f,rootStyles:me("SubMenuExpandIcon")},z?z({level:f,disabled:v,active:y,open:c??B}):O&&f===0?g.createElement(na,null):g.createElement(ta,{rtl:M,open:c??B}))),g.createElement(Jo,{ref:pe,openWhenCollapsed:Ce,open:c??B,firstLevel:f===0,collapsed:O,defaultOpen:c&&!De||p,className:q(T.subMenuContent,ge),rootStyles:me("subMenuContent")},g.createElement(wt.Provider,{value:f+1},r)))};g.forwardRef(fi);var $n,pi=Y.li(Ln||(Ln=Z([`
  width: 100%;
  position: relative;

  `,`;

  `,`;

  > .`,` {
    `,`;

    `,`;
  }
`],[`
  width: 100%;
  position: relative;

  `,`;

  `,`;

  > .`,` {
    `,`;

    `,`;
  }
`])),function(e){var t=e.menuItemStyles;return t},function(e){var t=e.rootStyles;return t},T.button,function(e){var t=e.level,n=e.disabled,r=e.active,o=e.collapsed,a=e.rtl;return pr({level:t,disabled:n,active:r,collapsed:o,rtl:a})},function(e){var t=e.buttonStyles;return t}),vi=function(e,t){var n,r=e.children,o=e.icon,a=e.className,i=e.prefix,s=e.suffix,d=e.active,u=d===void 0?!1:d,c=e.disabled,p=c===void 0?!1:c,C=e.component,y=e.rootStyles,b=We(e,["children","icon","className","prefix","suffix","active","disabled","component","rootStyles"]),v=g.useContext(wt),S=g.useContext(Ot),k=S.collapsed,w=S.rtl,j=S.transitionDuration,h=Ft().menuItemStyles,m=function(x){if(h){var O={level:v,disabled:p,active:u,isSubmenu:!1},M=h.root,A=h.button,N=h.label,z=h.icon,L=h.prefix,P=h.suffix;switch(x){case"root":return typeof M=="function"?M(O):M;case"button":return typeof A=="function"?A(O):A;case"label":return typeof N=="function"?N(O):N;case"icon":return typeof z=="function"?z(O):z;case"prefix":return typeof L=="function"?L(O):L;case"suffix":return typeof P=="function"?P(O):P;default:return}}},f=(n={},n[T.active]=u,n[T.disabled]=p,n);return g.createElement(pi,{ref:t,className:q(T.menuItemRoot,f,a),menuItemStyles:m("root"),level:v,collapsed:k,rtl:w,disabled:p,active:u,buttonStyles:m("button"),rootStyles:y},g.createElement(vr,ne({className:q(T.button,f),"data-testid":"".concat(T.button,"-test-id"),component:C,tabIndex:0},b),o&&g.createElement(tr,{rtl:w,className:q(T.icon,f),rootStyles:m("icon")},o),i&&g.createElement(nr,{collapsed:k,transitionDuration:j,firstLevel:v===0,className:q(T.prefix,f),rtl:w,rootStyles:m("prefix")},i),g.createElement(er,{className:q(T.label,f),rootStyles:m("label")},r),s&&g.createElement(rr,{collapsed:k,transitionDuration:j,firstLevel:v===0,className:q(T.suffix,f),rootStyles:m("suffix")},s)))},hr=g.forwardRef(vi),Ln;const Qe=({title:e,to:t,icon:n,selected:r,setSelected:o})=>{const a=ve(),i=_(a.palette.mode);return l.jsx(hr,{active:r===e,style:{color:i.grey[100]},onClick:()=>o(e),icon:n,component:l.jsx(mr,{to:t}),children:l.jsx(W,{children:e})})},hi=()=>{const e=ve(),t=_(e.palette.mode),[n,r]=$.useState(!1),[o,a]=$.useState("Dashboard");return l.jsx(E,{sx:{"& .ps-sidebar-root":{height:"100%",border:"none"},"& .ps-sidebar-container":{backgroundColor:"transparent !important"},"@media (max-width: 768px)":{position:"absolute",zIndex:1e3,height:"100%","& .ps-sidebar-root":{width:n?"80px":"250px"}}},children:l.jsx(Yo,{collapsed:n,breakPoint:"md",backgroundColor:t.primary[400],children:l.jsxs(Zo,{iconShape:"square",children:[l.jsx(hr,{onClick:()=>r(!n),icon:n?l.jsx(Qt,{}):void 0,style:{margin:"10px 0 20px 0",color:t.grey[100]},children:!n&&l.jsxs(E,{display:"flex",justifyContent:"space-between",alignItems:"center",ml:"15px",children:[l.jsx(W,{variant:"h3",color:t.grey[100],children:"NOXIS ADMIN"}),l.jsx(Ie,{onClick:()=>r(!n),children:l.jsx(Qt,{})})]})}),!n&&l.jsxs(E,{mb:"25px",children:[l.jsx(E,{display:"flex",justifyContent:"center",alignItems:"center",children:l.jsx("img",{alt:"profile-user",width:"100px",height:"100px",src:"../../assets/logo.png",style:{cursor:"pointer",borderRadius:"50%",objectFit:"contain"}})}),l.jsxs(E,{textAlign:"center",children:[l.jsx(W,{variant:"h2",color:t.grey[100],fontWeight:"bold",sx:{m:"10px 0 0 0"},children:"Admin"}),l.jsx(W,{variant:"h5",color:t.greenAccent[500],children:"System Administrator"})]})]}),l.jsxs(E,{paddingLeft:n?void 0:"10%",children:[l.jsx(Qe,{title:"Dashboard",to:"/admin",icon:l.jsx(Pr,{}),selected:o,setSelected:a}),l.jsx(W,{variant:"h6",color:t.grey[300],sx:{m:"15px 0 5px 20px"},children:"Management"}),l.jsx(Qe,{title:"Manage Users",to:"/admin/team",icon:l.jsx(Er,{}),selected:o,setSelected:a}),l.jsx(Qe,{title:"Content Library",to:"/admin/content",icon:l.jsx(Mr,{}),selected:o,setSelected:a}),l.jsx(W,{variant:"h6",color:t.grey[300],sx:{m:"15px 0 5px 20px"},children:"System"}),l.jsx(Qe,{title:"Server Status",to:"/admin/server",icon:l.jsx(Rr,{}),selected:o,setSelected:a}),l.jsx(Qe,{title:"Settings",to:"/admin/settings",icon:l.jsx(Bn,{}),selected:o,setSelected:a})]})]})})})},lt=({title:e,subtitle:t})=>{const n=ve(),r=_(n.palette.mode);return l.jsxs(E,{mb:"30px",children:[l.jsx(W,{variant:"h2",color:r.grey[100],fontWeight:"bold",sx:{m:"0 0 5px 0"},children:e}),l.jsx(W,{variant:"h5",color:r.greenAccent[400],children:t})]})},mi=({isDashboard:e=!1})=>{const t=ve(),n=_(t.palette.mode),r=[{id:"users",color:_("dark").greenAccent[500],data:[{x:"Mon",y:12},{x:"Tue",y:35},{x:"Wed",y:45},{x:"Thu",y:32},{x:"Fri",y:65},{x:"Sat",y:78},{x:"Sun",y:95}]},{id:"sessions",color:_("dark").blueAccent[500],data:[{x:"Mon",y:8},{x:"Tue",y:22},{x:"Wed",y:30},{x:"Thu",y:28},{x:"Fri",y:55},{x:"Sat",y:60},{x:"Sun",y:82}]}];return l.jsx(Wr,{data:r,theme:{axis:{domain:{line:{stroke:n.grey[100]}},legend:{text:{fill:n.grey[100]}},ticks:{line:{stroke:n.grey[100],strokeWidth:1},text:{fill:n.grey[100]}}},legends:{text:{fill:n.grey[100]}},tooltip:{container:{color:n.primary[500]}}},colors:e?{datum:"color"}:{scheme:"nivo"},margin:{top:50,right:110,bottom:50,left:60},xScale:{type:"point"},yScale:{type:"linear",min:"auto",max:"auto",stacked:!0,reverse:!1},yFormat:" >-.2f",curve:"catmullRom",axisTop:null,axisRight:null,axisBottom:{orient:"bottom",tickSize:5,tickPadding:5,tickRotation:0,legend:e?void 0:"Day",legendOffset:36,legendPosition:"middle"},axisLeft:{orient:"left",tickSize:5,tickPadding:5,tickRotation:0,legend:e?void 0:"Count",legendOffset:-40,legendPosition:"middle"},enableGridX:!1,enableGridY:!1,pointSize:10,pointColor:{theme:"background"},pointBorderWidth:2,pointBorderColor:{from:"serieColor"},pointLabelYOffset:-12,useMesh:!0,legends:[{anchor:"bottom-right",direction:"column",justify:!1,translateX:100,translateY:0,itemsSpacing:0,itemDirection:"left-to-right",itemWidth:80,itemHeight:20,itemOpacity:.75,symbolSize:12,symbolShape:"circle",symbolBorderColor:"rgba(0, 0, 0, .5)",effects:[{on:"hover",style:{itemBackground:"rgba(0, 0, 0, .03)",itemOpacity:1}}]}]})},Mt=({title:e,subtitle:t,icon:n,increase:r,color:o})=>{const a=ve(),i=_(a.palette.mode);return l.jsxs(E,{width:"100%",m:"0 30px",children:[l.jsxs(E,{display:"flex",justifyContent:"space-between",children:[l.jsxs(E,{children:[n,l.jsx(W,{variant:"h4",fontWeight:"bold",sx:{color:i.grey[100]},className:"stat-value",children:e})]}),l.jsx(E,{children:l.jsx("div",{style:{background:`radial-gradient(circle, ${o}33 0%, transparent 70%)`,width:"40px",height:"40px",borderRadius:"50%",position:"absolute"}})})]}),l.jsxs(E,{display:"flex",justifyContent:"space-between",mt:"2px",children:[l.jsx(W,{variant:"h5",sx:{color:o},children:t}),l.jsx(W,{variant:"h5",fontStyle:"italic",sx:{color:i.greenAccent[600]},children:r})]})]})},gi=()=>{var a;const e=ve(),t=_(e.palette.mode),[n,r]=$.useState({userCount:0,sessionCount:0,newUsersToday:0,recentUsers:[]}),o=async()=>{var i,s,d;try{const u=localStorage.getItem("noxis_auth_token"),c=await fetch("/api/admin/stats",{headers:{Authorization:`Bearer ${u}`}});if(c.ok){const p=await c.json();p.success&&p.stats&&r({userCount:((i=p.stats.users)==null?void 0:i.total)||0,sessionCount:((s=p.stats.sessions)==null?void 0:s.activeToday)||0,newUsersToday:((d=p.stats.users)==null?void 0:d.newToday)||0,recentUsers:p.stats.recentLogins||[]})}}catch(u){console.error("Stats fetch error",u)}};return $.useEffect(()=>{o();const i=setInterval(o,1e4);return()=>clearInterval(i)},[]),l.jsxs(E,{m:"20px",children:[l.jsxs(E,{display:"flex",justifyContent:"space-between",alignItems:"center",children:[l.jsx(lt,{title:"DASHBOARD",subtitle:"Noxis System Overview"}),l.jsxs(E,{children:[l.jsxs(br,{sx:{backgroundColor:t.blueAccent[700],color:t.grey[100],fontSize:"14px",fontWeight:"bold",padding:"10px 20px",marginRight:"10px"},children:[l.jsx(Jt,{sx:{mr:"10px"}}),"Download Reports"]}),l.jsx(Ie,{onClick:o,sx:{color:t.greenAccent[500],background:"rgba(255,255,255,0.1)"},children:l.jsx(Ir,{})})]})]}),l.jsxs(E,{display:"grid",gridTemplateColumns:"repeat(12, 1fr)",gridAutoRows:"140px",gap:"20px",children:[l.jsx(E,{gridColumn:"span 3",display:"flex",alignItems:"center",justifyContent:"center",className:"glass-card",children:l.jsx(Mt,{title:n.userCount,subtitle:"Total Users",progress:"0.75",increase:`+${n.newUsersToday} Today`,icon:l.jsx(Tr,{sx:{color:t.greenAccent[600],fontSize:"26px"}}),color:t.greenAccent[500]})}),l.jsx(E,{gridColumn:"span 3",display:"flex",alignItems:"center",justifyContent:"center",className:"glass-card",children:l.jsx(Mt,{title:n.sessionCount,subtitle:"Active Sessions",increase:"Online",icon:l.jsx(Dr,{sx:{color:t.blueAccent[600],fontSize:"26px"}}),color:t.blueAccent[500]})}),l.jsx(E,{gridColumn:"span 3",display:"flex",alignItems:"center",justifyContent:"center",className:"glass-card",children:l.jsx(Mt,{title:"Active",subtitle:"Security Shield",increase:"Secured",icon:l.jsx(Nr,{sx:{color:t.redAccent[600],fontSize:"26px"}}),color:t.redAccent[500]})}),l.jsx(E,{gridColumn:"span 3",display:"flex",alignItems:"center",justifyContent:"center",className:"glass-card",children:l.jsxs(E,{textAlign:"center",children:[l.jsx(W,{variant:"h5",color:t.grey[100],fontWeight:"bold",children:"Last Signup"}),l.jsx(W,{variant:"h3",color:t.greenAccent[500],mt:"10px",children:((a=n.recentUsers[0])==null?void 0:a.username)||"-"}),l.jsx(W,{variant:"body2",color:t.grey[300],children:n.recentUsers[0]?new Date(n.recentUsers[0].createdAt).toLocaleTimeString():""})]})}),l.jsxs(E,{gridColumn:"span 8",gridRow:"span 2",className:"glass-card",children:[l.jsxs(E,{mt:"25px",p:"0 30px",display:"flex ",justifyContent:"space-between",alignItems:"center",children:[l.jsxs(E,{children:[l.jsx(W,{variant:"h5",fontWeight:"600",color:t.grey[100],children:"Traffic Overview"}),l.jsx(W,{variant:"h3",fontWeight:"bold",color:t.greenAccent[500],children:"Users & Sessions"})]}),l.jsx(E,{children:l.jsx(Ie,{children:l.jsx(Jt,{sx:{fontSize:"26px",color:t.greenAccent[500]}})})})]}),l.jsx(E,{height:"250px",m:"-20px 0 0 0",children:l.jsx(mi,{isDashboard:!0})})]}),l.jsxs(E,{gridColumn:"span 4",gridRow:"span 2",className:"glass-card",overflow:"auto",children:[l.jsx(E,{display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:`4px solid ${t.primary[500]}`,p:"15px",children:l.jsx(W,{color:t.grey[100],variant:"h5",fontWeight:"600",children:"New Members"})}),n.recentUsers.map((i,s)=>l.jsxs(E,{display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:"1px solid rgba(255,255,255,0.1)",p:"15px",children:[l.jsxs(E,{children:[l.jsx(W,{color:t.greenAccent[500],variant:"h5",fontWeight:"600",children:i.username}),l.jsx(W,{color:t.grey[100],fontSize:"0.8rem",children:i.email||"No Email"})]}),l.jsx(E,{backgroundColor:t.greenAccent[500],p:"5px 10px",borderRadius:"4px",fontSize:"0.8rem",children:i.role})]},`${i.username}-${s}`))]})]})]})},xi=()=>{const e=ve(),t=_(e.palette.mode),[n,r]=$.useState([]);$.useEffect(()=>{(async()=>{try{const i=localStorage.getItem("noxis_auth_token"),s=await fetch("/api/admin/users",{headers:{Authorization:`Bearer ${i}`}});if(s.ok){const u=(await s.json()).users.map(c=>({...c,id:c._id,access:c.role}));r(u)}}catch(i){console.error("Failed to fetch users",i)}})()},[]);const o=[{field:"id",headerName:"ID",flex:1},{field:"username",headerName:"Username",flex:1,cellClassName:"name-column--cell"},{field:"email",headerName:"Email",flex:1},{field:"role",headerName:"Access Level",flex:1,renderCell:({row:{access:a}})=>l.jsxs(E,{width:"60%",m:"0 auto",p:"5px",display:"flex",justifyContent:"center",backgroundColor:a==="admin"?t.greenAccent[600]:a==="moderator"?t.greenAccent[700]:t.greenAccent[800],borderRadius:"4px",children:[a==="admin"&&l.jsx($r,{}),a==="moderator"&&l.jsx(Lr,{}),a==="user"&&l.jsx(Br,{}),l.jsx(W,{color:t.grey[100],sx:{ml:"5px"},children:a})]})}];return l.jsxs(E,{m:"20px",children:[l.jsx(lt,{title:"USER MANAGEMENT",subtitle:"Managing the User Members"}),l.jsx(E,{m:"40px 0 0 0",height:"75vh",sx:{"& .MuiDataGrid-root":{border:"none"},"& .MuiDataGrid-cell":{borderBottom:"none"},"& .name-column--cell":{color:t.greenAccent[300]},"& .MuiDataGrid-columnHeaders":{backgroundColor:t.blueAccent[700],borderBottom:"none"},"& .MuiDataGrid-virtualScroller":{backgroundColor:t.primary[400]},"& .MuiDataGrid-footerContainer":{borderTop:"none",backgroundColor:t.blueAccent[700]},"& .MuiCheckbox-root":{color:`${t.greenAccent[200]} !important`},"& .MuiDataGrid-toolbarContainer .MuiButton-text":{color:`${t.grey[100]} !important`},"@media (max-width: 768px)":{"& .MuiDataGrid-columnHeaders":{display:"none"},"& .MuiDataGrid-row":{display:"flex",flexDirection:"column",marginBottom:"1rem",border:`1px solid ${t.grey[700]}`,borderRadius:"8px",padding:"10px"},"& .MuiDataGrid-cell":{display:"flex",justifyContent:"space-between",width:"100%",borderBottom:"none",padding:"5px 0"},"& .MuiDataGrid-cell:before":{content:"attr(data-field)",fontWeight:"bold",color:t.grey[300]}}},children:l.jsx(zr,{checkboxSelection:!0,rows:n,columns:o,components:{Toolbar:Fr}})})]})},yi=()=>{const e=ve(),t=_(e.palette.mode);return l.jsxs(E,{m:"20px",children:[l.jsx(lt,{title:"CONTENT LIBRARY",subtitle:"Manage Movies and Series"}),l.jsx(E,{height:"75vh",display:"flex",justifyContent:"center",alignItems:"center",children:l.jsx(W,{variant:"h4",color:t.grey[100],children:"Content Management Module Coming Soon"})})]})},bi=()=>{const e=ve(),t=_(e.palette.mode);return l.jsxs(E,{m:"20px",children:[l.jsx(lt,{title:"SERVER STATUS",subtitle:"Monitor System Health"}),l.jsx(E,{height:"75vh",display:"flex",justifyContent:"center",alignItems:"center",children:l.jsx(W,{variant:"h4",color:t.grey[100],children:"System Monitor Module Coming Soon"})})]})},wi=()=>{const e=ve(),t=_(e.palette.mode);return l.jsxs(E,{m:"20px",children:[l.jsx(lt,{title:"SETTINGS",subtitle:"Configure System Preferences"}),l.jsx(E,{height:"75vh",display:"flex",justifyContent:"center",alignItems:"center",children:l.jsx(W,{variant:"h4",color:t.grey[100],children:"Settings Module Coming Soon"})})]})},Pi=()=>{const[e,t]=Ur();return l.jsx(Wn.Provider,{value:t,children:l.jsxs(wr,{theme:e,children:[l.jsx(Sr,{}),l.jsxs("div",{className:"app",children:[l.jsx(hi,{}),l.jsxs("main",{className:"content",style:{flexGrow:1,height:"100%",overflowY:"auto",position:"relative"},children:[l.jsx(Vr,{}),l.jsxs(gr,{children:[l.jsx(Ke,{path:"/",element:l.jsx(gi,{})}),l.jsx(Ke,{path:"/team",element:l.jsx(xi,{})}),l.jsx(Ke,{path:"/content",element:l.jsx(yi,{})}),l.jsx(Ke,{path:"/server",element:l.jsx(bi,{})}),l.jsx(Ke,{path:"/settings",element:l.jsx(wi,{})})]})]})]})]})})};export{Pi as default};
