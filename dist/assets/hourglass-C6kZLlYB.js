var l=Object.defineProperty;var c=(e,t,i)=>t in e?l(e,t,{enumerable:!0,configurable:!0,writable:!0,value:i}):e[t]=i;var a=(e,t,i)=>c(e,typeof t!="symbol"?t+"":t,i);import{ad as d,j as h}from"./index-lt0jn72L.js";import"./ui-bHBfS8iO.js";var s=':host{align-items:center;display:inline-flex;flex-shrink:0;height:var(--uib-size);justify-content:center;width:var(--uib-size)}:host([hidden]){display:none}.container{animation:rotate calc(var(--uib-speed)*2) ease-in-out infinite;display:flex;flex-direction:column;height:100%;position:relative;transform:rotate(45deg);width:100%}.half{--uib-half-size:calc(var(--uib-size)*0.435);align-items:center;display:flex;height:var(--uib-half-size);isolation:isolate;justify-content:center;overflow:hidden;position:absolute;width:var(--uib-half-size)}.half:first-child{left:8.25%;top:8.25%}.half:first-child,.half:last-child{border-radius:50% 50% calc(var(--uib-size)/15)}.half:last-child{align-self:flex-end;bottom:8.25%;right:8.25%;transform:rotate(180deg)}.half:last-child:after{animation-delay:calc(var(--uib-speed)*-1)}.half:before{left:0;opacity:var(--uib-bg-opacity);position:absolute;top:0}.half:after,.half:before{background-color:var(--uib-color);content:"";height:110%;transition:background-color .3s ease;width:110%}.half:after{animation:flow calc(var(--uib-speed)*2) linear infinite both;border-radius:0 0 calc(var(--uib-size)/20) 0;display:block;position:relative;transform:rotate(45deg) translate(-3%,50%) scaleX(1.2);transform-origin:bottom right;z-index:1}@keyframes flow{0%{transform:rotate(45deg) translate(-3%,50%) scaleX(1.2)}30%{transform:rotate(45deg) translate(115%,50%) scaleX(1.2)}30.001%,50%{transform:rotate(0deg) translate(-85%,-85%) scaleX(1)}80%,to{transform:rotate(0deg) translate(0) scaleX(1)}}@keyframes rotate{0%,30%{transform:rotate(45deg)}50%,80%{transform:rotate(225deg)}to{transform:rotate(405deg)}}';class o extends d{constructor(){super();a(this,"_attributes",["size","color","speed","bg-opacity"]);a(this,"size");a(this,"color");a(this,"speed");a(this,"bg-opacity");this.storePropsToUpgrade(this._attributes),this.reflect(this._attributes)}static get observedAttributes(){return["size","color","speed","bg-opacity"]}connectedCallback(){this.upgradeStoredProps(),this.applyDefaultProps({size:40,color:"black",speed:1.75,"bg-opacity":.1}),this.template.innerHTML=`
      <div class="container">
        <div class="half"></div>
        <div class="half"></div>
      </div>
      <style>
        :host{
          --uib-size: ${this.size}px;
          --uib-color: ${this.color};
          --uib-speed: ${this.speed}s;
          --uib-bg-opacity: ${this["bg-opacity"]};
        }
        ${s}
      </style>
    `,this.shadow.replaceChildren(this.template.content.cloneNode(!0))}attributeChangedCallback(){const i=this.shadow.querySelector("style");i&&(i.innerHTML=`
      :host{
        --uib-size: ${this.size}px;
        --uib-color: ${this.color};
        --uib-speed: ${this.speed}s;
        --uib-bg-opacity: ${this["bg-opacity"]};
      }
      ${s}
    `)}}var f={register:(e="l-hourglass")=>{customElements.get(e)||customElements.define(e,class extends o{})},element:o};f.register();const g=({size:e=40,stroke:t=5,bgOpacity:i=0,speed:r=2,color:n="black"})=>h.jsxDEV("l-hourglass",{size:e,stroke:t,"bg-opacity":i,speed:r,color:n},void 0,!1,{fileName:"C:/Users/DucHuyy/.grok/bin/locket-dio/src/components/UI/Loading/hourglass.jsx",lineNumber:8,columnNumber:5},void 0);export{g as H};
